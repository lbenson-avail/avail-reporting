// POST /api/mcp?key=<dashboard password> — MCP server (streamable HTTP,
// JSON-RPC 2.0) exposing the dashboard's metrics to Claude, so the reporting
// can be pulled into claude.ai as a custom connector and analyzed there.
//
// Tools mirror the dashboard exactly (same compute code the pages use) plus
// a time-trends tool the UI doesn't have — weekly/monthly series for
// trend analysis over longer horizons.

import { SALES_OWNERS, SALES_OWNER_IDS, ACCOUNT_PIPELINE_ID, CLOSED_WON_STAGE_ID, PROPS } from '../lib/config.js';
import { keyMatches } from './_lib/auth.js';
import { cached } from './_lib/cache.js';
import { hsSearchAll, getLeadStages, ownerFilter, rangeFilter } from './_lib/hubspot.js';
import { compute as computeLeads } from './metrics/leads.js';
import { compute as computeDeals } from './metrics/deals.js';
import { compute as computeMeetings } from './metrics/meetings.js';
import { compute as computeMarketing } from './metrics/marketing.js';

const PROTOCOL_VERSION = '2025-03-26';

// ─── Param parsing (JSON-RPC args, not query strings) ───────────────────────
function parseWindow(args = {}) {
  const { start, end, rep } = args;
  let startMs = null;
  let endMs = null;
  if (start || end) {
    startMs = Date.parse(`${start}T00:00:00.000Z`);
    endMs = Date.parse(`${end}T23:59:59.999Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      throw new Error('invalid start/end — use YYYY-MM-DD for both');
    }
  }
  let ownerIds = SALES_OWNER_IDS;
  if (rep) {
    const match = SALES_OWNERS.find(
      (o) => o.id === rep || o.name.toLowerCase().includes(String(rep).toLowerCase())
    );
    if (!match) throw new Error(`unknown rep "${rep}" — use ${SALES_OWNERS.map((o) => o.name).join(' or ')}`);
    ownerIds = [match.id];
  }
  return { startMs, endMs, ownerIds, key: `${start || ''}:${end || ''}:${ownerIds.join(',')}` };
}

const toMs = (v) => (v == null || v === '' ? NaN : /^\d+$/.test(v) ? Number(v) : Date.parse(v));

// ─── Time trends (MCP-only tool) ─────────────────────────────────────────────
async function computeTrends({ granularity = 'week', periods } = {}) {
  const isMonth = granularity === 'month';
  const n = Math.min(Math.max(1, Number(periods) || (isMonth ? 6 : 12)), isMonth ? 24 : 52);

  // Bucket boundaries in UTC: n starts plus one sentinel end.
  const now = new Date();
  const bounds = [];
  if (isMonth) {
    for (let i = n - 1; i >= -1; i--) {
      bounds.push(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    }
  } else {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000;
    for (let i = n - 1; i >= -1; i--) bounds.push(monday - i * 7 * 86400000);
  }
  const startMs = bounds[0];
  const endMs = Date.now();
  const bucketOf = (ms) => {
    if (!Number.isFinite(ms)) return -1;
    for (let i = bounds.length - 2; i >= 0; i--) if (ms >= bounds[i]) return i < n ? i : -1;
    return -1;
  };

  const CAP = 5000;
  const [{ roles }, leads, dealsCreated, dealsWon] = await Promise.all([
    getLeadStages(),
    hsSearchAll(
      'leads',
      {
        filterGroups: [
          { filters: [ownerFilter(SALES_OWNER_IDS), rangeFilter(PROPS.leadCreateDate, startMs, endMs)] },
        ],
        properties: [PROPS.leadCreateDate, 'hs_pipeline_stage'],
      },
      CAP
    ),
    hsSearchAll(
      'deals',
      {
        filterGroups: [
          {
            filters: [
              { propertyName: 'pipeline', operator: 'EQ', value: ACCOUNT_PIPELINE_ID },
              ownerFilter(SALES_OWNER_IDS),
              rangeFilter('createdate', startMs, endMs),
            ],
          },
        ],
        properties: ['createdate'],
      },
      CAP
    ),
    hsSearchAll(
      'deals',
      {
        filterGroups: [
          {
            filters: [
              { propertyName: 'pipeline', operator: 'EQ', value: ACCOUNT_PIPELINE_ID },
              { propertyName: 'dealstage', operator: 'EQ', value: CLOSED_WON_STAGE_ID },
              ownerFilter(SALES_OWNER_IDS),
              rangeFilter('closedate', startMs, endMs),
            ],
          },
        ],
        properties: ['closedate', PROPS.dealEstimatedAnnualSpend],
      },
      CAP
    ),
  ]);

  const rows = Array.from({ length: n }, (_, i) => ({
    periodStart: new Date(bounds[i]).toISOString().slice(0, 10),
    leadsCreated: 0,
    qualifiedBuyersNow: 0,
    disqualifiedNow: 0,
    dealsCreated: 0,
    dealsWon: 0,
    wonValue: 0,
  }));

  for (const l of leads.results) {
    const i = bucketOf(toMs(l.properties?.[PROPS.leadCreateDate]));
    if (i < 0) continue;
    rows[i].leadsCreated++;
    const stage = l.properties?.hs_pipeline_stage;
    if (roles.qualified && stage === roles.qualified) rows[i].qualifiedBuyersNow++;
    if (roles.disqualified && stage === roles.disqualified) rows[i].disqualifiedNow++;
  }
  for (const d of dealsCreated.results) {
    const i = bucketOf(toMs(d.properties?.createdate));
    if (i >= 0) rows[i].dealsCreated++;
  }
  for (const d of dealsWon.results) {
    const i = bucketOf(toMs(d.properties?.closedate));
    if (i < 0) continue;
    rows[i].dealsWon++;
    rows[i].wonValue += Number(d.properties?.[PROPS.dealEstimatedAnnualSpend]) || 0;
  }

  return {
    granularity: isMonth ? 'month' : 'week',
    periods: n,
    note: 'qualifiedBuyersNow/disqualifiedNow are the CURRENT stage of leads created in that period (leads keep moving). The last bucket is the in-progress period.',
    truncated: leads.truncated || dealsCreated.truncated || dealsWon.truncated,
    series: rows,
  };
}

// ─── Tool catalog ────────────────────────────────────────────────────────────
const windowSchema = {
  type: 'object',
  properties: {
    start: { type: 'string', description: 'Start date YYYY-MM-DD (UTC). Omit both dates for all time.' },
    end: { type: 'string', description: 'End date YYYY-MM-DD (UTC), inclusive.' },
    rep: {
      type: 'string',
      description: `Optional: limit to one rep by name or HubSpot owner id (${SALES_OWNERS.map((o) => o.name).join(', ')}). Default: both reps.`,
    },
  },
};

const TOOLS = [
  {
    name: 'get_sales_metrics',
    description:
      'Sales dashboard rollup for a date window: lead KPIs (total created, SQLs = ever reached Qualified Buyer, speed to lead, time to connected), current lead-stage counts, ICP fit distribution, rep-vs-rep funnel, deal stage counts, blended pipeline value (10/20/30/50/90% weights, Closed Won 100%), avg speed to close, % close, and meeting show rate. Same numbers the Sales dashboard page shows.',
    inputSchema: windowSchema,
    run: async (args) => {
      const w = parseWindow(args);
      const [leads, deals, meetings] = await Promise.all([
        cached(`leads:${w.key}`, () => computeLeads(w)),
        cached(`deals:${w.key}`, () => computeDeals(w)),
        cached(`meetings:${w.key}`, () => computeMeetings(w)),
      ]);
      return { leads, deals, meetings };
    },
  },
  {
    name: 'get_marketing_metrics',
    description:
      'Marketing dashboard rollup for a date window: total leads (name+company deduped), current-stage counts (Qualified Buyer / Disqualified / Opportunity / Customer), ICP distribution over Qualified Buyers, lead source distribution, channel funnels (Paid Search, Paid Social, Offline/cold email, Organic), lead types, per-rep breakdown, and the disqualified list with reasons. Same numbers the Marketing dashboard page shows.',
    inputSchema: windowSchema,
    run: async (args) => {
      const w = parseWindow(args);
      return cached(`marketing:${w.key}`, () => computeMarketing(w));
    },
  },
  {
    name: 'get_time_trends',
    description:
      'Time series for trend analysis (not on the dashboard pages): per week or month — leads created, how many of them are currently Qualified Buyers / Disqualified, deals created, deals won, and won value ($ estimated annual spend). Use for questions like "how has lead volume trended over the last quarter".',
    inputSchema: {
      type: 'object',
      properties: {
        granularity: { type: 'string', enum: ['week', 'month'], description: 'Bucket size. Weeks start Monday (UTC). Default week.' },
        periods: { type: 'number', description: 'How many buckets, ending with the current one. Default 12 weeks / 6 months. Max 52 weeks / 24 months.' },
      },
    },
    run: (args) =>
      cached(`trends:${args?.granularity || 'week'}:${args?.periods || ''}`, () => computeTrends(args)),
  },
];

// ─── JSON-RPC plumbing ───────────────────────────────────────────────────────
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function handleRpc(msg) {
  const { id, method, params } = msg || {};
  if (!method) return rpcError(id ?? null, -32600, 'invalid request');

  // Notifications get no response body.
  if (id === undefined || id === null) return null;

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'avail-reporting', version: '1.0.0' },
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return rpcError(id, -32602, `unknown tool: ${params?.name}`);
      try {
        const data = await tool.run(params?.arguments || {});
        return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(data) }] });
      } catch (err) {
        return rpcResult(id, {
          isError: true,
          content: [{ type: 'text', text: String(err.message || err) }],
        });
      }
    }
    case 'resources/list':
      return rpcResult(id, { resources: [] });
    case 'prompts/list':
      return rpcResult(id, { prompts: [] });
    default:
      return rpcError(id, -32601, `method not found: ${method}`);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Auth: ?key=<dashboard password> (connector-friendly) or Bearer token.
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!keyMatches(req.query?.key) && !keyMatches(bearer)) {
    return res.status(401).json({ error: 'unauthorized — append ?key=<dashboard password> to the connector URL' });
  }

  if (req.method === 'GET') {
    // No server-initiated stream; clients fall back to plain POST responses.
    return res.status(405).json({ error: 'POST JSON-RPC messages to this endpoint' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = req.body;
  try {
    if (Array.isArray(body)) {
      const replies = (await Promise.all(body.map(handleRpc))).filter(Boolean);
      if (!replies.length) return res.status(202).end();
      return res.status(200).json(replies);
    }
    const reply = await handleRpc(body);
    if (!reply) return res.status(202).end();
    return res.status(200).json(reply);
  } catch (err) {
    return res.status(200).json(rpcError(body?.id ?? null, -32603, String(err.message || err)));
  }
}

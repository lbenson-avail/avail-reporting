// Ad-platform metrics via PaidSync (MCP is PaidSync's API — one integration
// covering Google Ads and LinkedIn). PaidSync meters per tool call and holds
// no history, so results are cached hard per instance (ADS_CACHE_TTL_HOURS,
// default 12) instead of following the dashboard's 5-minute poll.
//
// Without PAIDSYNC_API_KEY, channels report a clean "not connected" state.

import { paidsyncConfigured, paidsyncListTools, paidsyncCallTool } from './paidsync.js';

const CHANNELS = {
  google: { label: 'Google Ads', match: /google/i, accountEnv: 'PAIDSYNC_GOOGLE_ACCOUNT_ID' },
  linkedin: { label: 'LinkedIn Ads', match: /linkedin/i, accountEnv: 'PAIDSYNC_LINKEDIN_ACCOUNT_ID' },
};

const cacheTtlMs = () => (Number(process.env.ADS_CACHE_TTL_HOURS) || 12) * 3600 * 1000;
const adsCache = new Map();

// Serializes set_active_account → report pairs across channels.
let accountLock = Promise.resolve();
function withAccountLock(fn) {
  const run = accountLock.then(fn, fn);
  accountLock = run.catch(() => {});
  return run;
}

// Pick the best-looking campaign-performance tool for a channel from the
// (unmetered) tool catalog, so schema drift on PaidSync's side degrades to a
// readable reason instead of a wrong hardcoded name. PaidSync serves every
// platform through shared report tools (targeted by active account), so both
// channels fall back to the generic get_campaign_performance.
async function resolveTool(channel) {
  const tools = await paidsyncListTools();
  const { match } = CHANNELS[channel];
  const scored = tools
    .filter((t) => /campaign/i.test(t.name) && /(performance|report|metrics|overview)/i.test(t.name))
    .map((t) => ({ t, channelHit: match.test(t.name) || match.test(t.description || '') }));
  const preferred =
    scored.find((s) => s.channelHit)?.t ||
    tools.find((t) => t.name === 'get_campaign_performance') ||
    scored[0]?.t;
  return preferred || null;
}

// ─── Account selection ───────────────────────────────────────────────────────
// PaidSync targets ad platforms by selecting an ad account ("No active
// account set. Use set_active_account first."), not by a platform argument.
// Discover the account lister/setter tools from the unmetered catalog, list
// the connected accounts once (metered, cached), and pick per channel.

async function resolveAccountTools() {
  const tools = await paidsyncListTools();
  const accountish = tools.filter(
    (t) => /account/i.test(t.name) && /(list|get|available|connected)/i.test(t.name) && !/set/i.test(t.name)
  );
  const lister = accountish.find((t) => /list/i.test(t.name)) || accountish[0];
  const setter =
    tools.find((t) => t.name === 'set_active_account') ||
    tools.find((t) => /set.*account/i.test(t.name));
  return { lister, setter };
}

// Caches the in-flight promise so concurrent channels share one metered call.
let accountsCache = null; // { at, promise }

function getAccounts(lister) {
  if (accountsCache && Date.now() - accountsCache.at < cacheTtlMs()) {
    return accountsCache.promise;
  }
  const promise = paidsyncCallTool(lister.name, {}).then((result) => {
    const raw = Array.isArray(result)
      ? result
      : result?.accounts || result?.data || result?.results || [];
    return (Array.isArray(raw) ? raw : [raw]).map((a) => ({
      id: a?.id ?? a?.account_id ?? a?.customer_id ?? null,
      platform: a?.platform ?? a?.provider ?? a?.channel ?? a?.type ?? '',
      name: a?.name ?? a?.account_name ?? '',
    }));
  });
  accountsCache = { at: Date.now(), promise };
  promise.catch(() => {
    accountsCache = null; // don't cache a failed listing
  });
  return promise;
}

function pickAccount(accounts, channel) {
  const envId = process.env[CHANNELS[channel].accountEnv];
  if (envId) return { id: envId, name: '(from env)' };
  const { match } = CHANNELS[channel];
  return accounts.find((a) => match.test(`${a.platform} ${a.name}`)) || null;
}

// Find a platform-selecting property on the tool's schema and the value that
// targets our channel — preferring an enum entry when the schema lists them.
function platformArg(tool, channel) {
  const props = tool.inputSchema?.properties || {};
  const key = ['platform', 'platforms', 'network', 'channel', 'provider', 'ad_platform'].find(
    (k) => props[k]
  );
  if (!key) return null;
  const { match } = CHANNELS[channel];
  const spec = props[key];
  const options = spec?.enum || spec?.items?.enum || null;
  const value = options ? options.find((o) => match.test(String(o))) : channel;
  if (options && !value) return null; // schema enumerates platforms but not this one
  return { key, value: spec?.type === 'array' ? [value] : value };
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// Sum a metric across whatever row shape the report returns.
function sumMetric(rows, keys) {
  let total = null;
  for (const row of rows) {
    for (const k of keys) {
      const v =
        row?.[k] ?? row?.metrics?.[k] ?? row?.stats?.[k] ?? row?.totals?.[k] ?? undefined;
      const n = typeof v === 'string' ? Number(v.replace(/[$,]/g, '')) : v;
      if (typeof n === 'number' && Number.isFinite(n)) {
        total = (total ?? 0) + n;
        break;
      }
    }
  }
  return total;
}

function summarize(report) {
  const rows = Array.isArray(report)
    ? report
    : report?.campaigns || report?.rows || report?.data || report?.results || [];
  const list = Array.isArray(rows) ? rows : [rows];
  return {
    spend: sumMetric(list, ['spend', 'cost', 'total_spend', 'cost_micros_usd', 'amount_spent']),
    impressions: sumMetric(list, ['impressions', 'total_impressions']),
    clicks: sumMetric(list, ['clicks', 'total_clicks']),
    conversions: sumMetric(list, ['conversions', 'total_conversions']),
    campaigns: list.length,
  };
}

export async function getChannelMetrics(channel, startMs, endMs) {
  if (!CHANNELS[channel]) return { unavailable: true, reason: 'unknown channel' };
  if (!paidsyncConfigured()) {
    return {
      unavailable: true,
      reason: `${CHANNELS[channel].label} not connected — set PAIDSYNC_API_KEY in Vercel.`,
    };
  }

  const cacheKey = `${channel}:${startMs ?? 'all'}:${endMs ?? 'all'}`;
  const hit = adsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < cacheTtlMs()) return hit.value;

  try {
    const tool = await resolveTool(channel);
    if (!tool) {
      return {
        unavailable: true,
        reason: `No ${CHANNELS[channel].label} campaign-performance tool found in the PaidSync catalog — check /api/metrics/ads?debug=1.`,
      };
    }

    const platform = platformArg(tool, channel);

    const args = {};
    if (platform) args[platform.key] = platform.value;
    const schemaProps = tool.inputSchema?.properties || {};
    if (schemaProps.date_range) {
      // PaidSync's contract: a preset (this_month, last_30_days, …) or
      // custom dates as one string, "YYYY-MM-DD to YYYY-MM-DD".
      args.date_range =
        startMs != null && endMs != null ? `${iso(startMs)} to ${iso(endMs)}` : 'this_month';
    }
    if (schemaProps.start_date && startMs != null) args.start_date = iso(startMs);
    if (schemaProps.end_date && endMs != null) args.end_date = iso(endMs);

    // Account targeting. Metering: a cold instance worst-cases at 5 metered
    // calls per cache window (1 list + a set + report pair per channel) —
    // the 12h cache keeps that to a handful a day.
    const { lister, setter } = await resolveAccountTools();
    let account = null;
    if (process.env[CHANNELS[channel].accountEnv]) {
      account = pickAccount([], channel);
    } else if (lister) {
      const accounts = await getAccounts(lister);
      account = pickAccount(accounts, channel);
      if (!account) {
        return {
          unavailable: true,
          reason: `No ${CHANNELS[channel].label} ad account connected in PaidSync — accounts seen: ${
            accounts.map((a) => a.name || a.platform || a.id).filter(Boolean).join(', ') || 'none'
          }. Connect it at paidsync.ai, or set ${CHANNELS[channel].accountEnv} in Vercel.`,
        };
      }
    }

    const accountKey = ['account_id', 'customer_id', 'account'].find((k) => schemaProps[k]);
    let report;
    if (account?.id && accountKey) {
      // Cheapest path: the report tool accepts the account inline.
      args[accountKey] = account.id;
      report = await paidsyncCallTool(tool.name, args);
    } else if (account?.id && setter) {
      // Active account is PaidSync-side session state — serialize the
      // set→report pair so the two channels never interleave.
      const setterProps = setter.inputSchema?.properties || {};
      const setterKey =
        ['account_id', 'customer_id', 'account', 'id'].find((k) => setterProps[k]) || 'account_id';
      report = await withAccountLock(async () => {
        await paidsyncCallTool(setter.name, { [setterKey]: account.id });
        return paidsyncCallTool(tool.name, args);
      });
    } else {
      // No account machinery discovered — call bare and let PaidSync's own
      // error surface in the card.
      report = await paidsyncCallTool(tool.name, args);
    }
    const summary = summarize(report);
    const value = {
      ...summary,
      ctr:
        summary.impressions > 0 && summary.clicks != null
          ? (summary.clicks / summary.impressions) * 100
          : null,
      tool: tool.name,
      cachedHours: Number(process.env.ADS_CACHE_TTL_HOURS) || 12,
    };
    adsCache.set(cacheKey, { value, at: Date.now() });
    return value;
  } catch (err) {
    return {
      unavailable: true,
      reason: `${CHANNELS[channel].label} via PaidSync failed: ${String(err.message).slice(0, 300)}`,
    };
  }
}

// Unmetered introspection for finalizing the integration: the relevant tool
// names + input schemas straight from PaidSync's catalog.
export async function adsDebugInfo() {
  if (!paidsyncConfigured()) return { error: 'PAIDSYNC_API_KEY not set' };
  const tools = await paidsyncListTools();
  const interesting = tools.filter(
    (t) => /campaign|report|performance|account/i.test(t.name) || /linkedin|google/i.test(t.name)
  );
  return {
    totalTools: tools.length,
    tools: interesting.slice(0, 60).map((t) => ({
      name: t.name,
      description: (t.description || '').slice(0, 160),
      inputSchema: t.inputSchema,
    })),
  };
}

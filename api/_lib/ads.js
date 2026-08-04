// Ad-platform metrics via PaidSync (MCP is PaidSync's API — one integration
// covering Google Ads and LinkedIn). PaidSync meters per tool call and holds
// no history, so results are cached hard per instance (ADS_CACHE_TTL_HOURS,
// default 12) instead of following the dashboard's 5-minute poll.
//
// Without PAIDSYNC_API_KEY, channels report a clean "not connected" state.

import { paidsyncConfigured, paidsyncListTools, paidsyncCallTool } from './paidsync.js';

const CHANNELS = {
  google: { label: 'Google Ads', match: /google/i },
  linkedin: { label: 'LinkedIn Ads', match: /linkedin/i },
};

const cacheTtlMs = () => (Number(process.env.ADS_CACHE_TTL_HOURS) || 12) * 3600 * 1000;
const adsCache = new Map();

// Pick the best-looking campaign-performance tool for a channel from the
// (unmetered) tool catalog, so schema drift on PaidSync's side degrades to a
// readable reason instead of a wrong hardcoded name.
async function resolveTool(channel) {
  const tools = await paidsyncListTools();
  const { match } = CHANNELS[channel];
  const scored = tools
    .filter((t) => /campaign/i.test(t.name) && /(performance|report|metrics|overview)/i.test(t.name))
    .map((t) => ({ t, channelHit: match.test(t.name) || match.test(t.description || '') }));
  const preferred =
    scored.find((s) => s.channelHit)?.t ||
    (channel === 'google' ? tools.find((t) => t.name === 'get_campaign_performance') : null);
  return preferred || null;
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

    const args = {};
    const schemaProps = tool.inputSchema?.properties || {};
    if (schemaProps.date_range) {
      args.date_range = startMs != null ? 'custom' : 'this_month';
    }
    if (schemaProps.start_date && startMs != null) args.start_date = iso(startMs);
    if (schemaProps.end_date && endMs != null) args.end_date = iso(endMs);

    const report = await paidsyncCallTool(tool.name, args);
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

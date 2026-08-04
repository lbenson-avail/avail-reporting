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

async function resolveAccountTools(channel) {
  const tools = await paidsyncListTools();
  // A true lister enumerates accounts — reject summary/report-style tools
  // (get_account_summary needs an active account itself, so picking it as
  // the lister is a chicken-and-egg failure).
  const accountish = tools.filter(
    (t) =>
      /account/i.test(t.name) &&
      !/set|summary|performance|report|overview|metric/i.test(t.name) &&
      (/accounts/i.test(t.name) || /(list|available|connected)/i.test(t.name))
  );
  const lister = accountish.find((t) => /list/i.test(t.name)) || accountish[0];
  // PaidSync ships per-platform setters (set_linkedin_ad_account,
  // set_fb_ad_account, …) alongside the generic set_active_account, which
  // its own errors tie to Google Ads. Prefer the channel's setter.
  const { match } = CHANNELS[channel];
  const setters = tools.filter(
    (t) => /set/i.test(t.name) && /account/i.test(t.name) && !/clear/i.test(t.name)
  );
  // Name matches beat description matches — set_active_account's description
  // mentions every platform, which otherwise shadows set_linkedin_ad_account.
  const setter =
    setters.find((t) => match.test(t.name)) ||
    setters.find((t) => match.test(t.description || '')) ||
    tools.find((t) => t.name === 'set_active_account') ||
    setters.find((t) => /active/i.test(t.name));
  const accountToolNames = tools
    .filter((t) => /account/i.test(t.name))
    .map((t) => t.name)
    .join(', ');
  return { lister, setter, accountToolNames };
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

// Ad platforms want bare ids — tolerate the human-formatted versions
// (Google shows customer ids as XXX-XXX-XXXX).
const normalizeAccountId = (v) => String(v).trim().replace(/[\s-]+/g, '');

function pickAccount(accounts, channel) {
  const envId = process.env[CHANNELS[channel].accountEnv];
  if (envId) return { id: normalizeAccountId(envId), name: '(from env)' };
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
    const { lister, setter, accountToolNames } = await resolveAccountTools(channel);
    const envId = process.env[CHANNELS[channel].accountEnv];
    let accountId = envId ? normalizeAccountId(envId) : null;
    if (!accountId && lister) {
      let accounts;
      try {
        accounts = await getAccounts(lister);
      } catch (err) {
        return {
          unavailable: true,
          reason: `Listing PaidSync ad accounts via ${lister.name} failed: ${String(
            err.message
          ).slice(0, 200)}. Account tools in the catalog: ${accountToolNames || 'none'}. Set ${
            CHANNELS[channel].accountEnv
          } in Vercel to skip listing.`,
        };
      }
      const account = pickAccount(accounts, channel);
      if (!account) {
        return {
          unavailable: true,
          reason: `No ${CHANNELS[channel].label} ad account connected in PaidSync — accounts seen: ${
            accounts.map((a) => a.name || a.platform || a.id).filter(Boolean).join(', ') || 'none'
          }. Connect it at paidsync.ai, or set ${CHANNELS[channel].accountEnv} in Vercel.`,
        };
      }
      accountId = account.id;
    }

    const accountKey = ['account_id', 'customer_id', 'account'].find((k) => schemaProps[k]);
    let report;
    if (accountId && accountKey) {
      // Cheapest path: the report tool accepts the account inline.
      args[accountKey] = accountId;
      report = await paidsyncCallTool(tool.name, args);
    } else if (setter) {
      // Select the channel's account, then report. The per-platform setters
      // know their connected account, so an explicit id is optional — but if
      // the setter's schema requires one we don't have, say so instead of
      // burning a metered call on a guaranteed failure.
      const setterProps = setter.inputSchema?.properties || {};
      const setterKey = ['account_id', 'customer_id', 'account', 'id'].find(
        (k) => setterProps[k]
      );
      const setterRequired = setter.inputSchema?.required || [];
      if (!accountId && setterKey && setterRequired.includes(setterKey)) {
        return {
          unavailable: true,
          reason: `PaidSync's ${setter.name} requires an account id and none is discoverable (account tools: ${
            accountToolNames || 'none'
          }). Set ${CHANNELS[channel].accountEnv} in Vercel with the id from paidsync.ai.`,
        };
      }
      const setterArgs = setterKey && accountId ? { [setterKey]: accountId } : {};
      // Active account is PaidSync-side session state — serialize the
      // set→report pair so the two channels never interleave.
      report = await withAccountLock(async () => {
        await paidsyncCallTool(setter.name, setterArgs);
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

// One metered probe per channel: call the channel's resolved account setter
// with whatever id we have (env, normalized) or none, and relay PaidSync's
// raw response verbatim. PaidSync's errors state their contract precisely,
// so this turns "why won't spend connect" into a single URL visit.
export async function adsDiscover() {
  if (!paidsyncConfigured()) return { error: 'PAIDSYNC_API_KEY not set' };
  const out = {};
  for (const channel of Object.keys(CHANNELS)) {
    const { setter, accountToolNames } = await resolveAccountTools(channel);
    const envId = process.env[CHANNELS[channel].accountEnv];
    const accountId = envId ? normalizeAccountId(envId) : null;
    if (!setter) {
      out[channel] = { error: `no account setter found (account tools: ${accountToolNames || 'none'})` };
      continue;
    }
    const setterProps = setter.inputSchema?.properties || {};
    const setterKey = ['account_id', 'customer_id', 'account', 'id'].find((k) => setterProps[k]);
    const args = setterKey && accountId ? { [setterKey]: accountId } : {};
    try {
      const result = await withAccountLock(() => paidsyncCallTool(setter.name, args));
      out[channel] = { setter: setter.name, args, result };
    } catch (err) {
      out[channel] = { setter: setter.name, args, error: String(err.message).slice(0, 600) };
    }
  }
  return out;
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
    allToolNames: tools.map((t) => t.name),
    tools: interesting.slice(0, 60).map((t) => ({
      name: t.name,
      description: (t.description || '').slice(0, 160),
      inputSchema: t.inputSchema,
    })),
  };
}

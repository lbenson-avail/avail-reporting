// Minimal HubSpot client for the dashboard API: bounded concurrency,
// 429/5xx retries, count-via-total, capped pagination, and lead-stage
// resolution by label matching.

import {
  LEAD_STAGE_IDS,
  LEAD_STAGE_MATCHERS,
  FETCH_CAPS,
} from '../../lib/config.js';

const HS_BASE = 'https://api.hubapi.com';
const MAX_CONCURRENT = 4;
const MAX_RETRIES = 3;

let inFlight = 0;
const waiters = [];

async function acquire() {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return;
  }
  await new Promise((resolve) => waiters.push(resolve));
  inFlight++;
}

function release() {
  inFlight--;
  const next = waiters.shift();
  if (next) next();
}

export class HsError extends Error {
  constructor(status, body, path) {
    super(`HubSpot ${status} on ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
    this.path = path;
  }

  get isMissingProperty() {
    const msg = typeof this.body === 'string' ? this.body : JSON.stringify(this.body || {});
    return this.status === 400 && /property|PROPERTY/.test(msg) && /exist|invalid/i.test(msg);
  }

  get isAuthOrScope() {
    return this.status === 401 || this.status === 403;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function hsFetch(path, { method = 'GET', body } = {}) {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) throw new HsError(500, 'HUBSPOT_TOKEN is not configured', path);

  await acquire();
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${HS_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 429 || res.status >= 500) {
        if (attempt >= MAX_RETRIES) {
          throw new HsError(res.status, await res.text(), path);
        }
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
        continue;
      }

      if (!res.ok) {
        let parsed;
        const text = await res.text();
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        throw new HsError(res.status, parsed, path);
      }

      if (res.status === 204) return null;
      return res.json();
    }
  } finally {
    release();
  }
}

export function hsSearch(objectType, body) {
  return hsFetch(`/crm/v3/objects/${objectType}/search`, { method: 'POST', body });
}

// Count matching records without fetching them (search responses carry `total`).
export async function hsCount(objectType, filterGroups) {
  const res = await hsSearch(objectType, { filterGroups, limit: 1, properties: ['hs_object_id'] });
  return res.total ?? 0;
}

// Paginate a search up to `cap` records. Returns { results, total, truncated }.
export async function hsSearchAll(objectType, body, cap = FETCH_CAPS.records) {
  const results = [];
  let after;
  let total = 0;
  for (;;) {
    const page = await hsSearch(objectType, {
      ...body,
      limit: Math.min(100, cap - results.length),
      after,
    });
    total = page.total ?? 0;
    results.push(...(page.results || []));
    after = page.paging?.next?.after;
    if (!after || results.length >= cap) break;
  }
  return { results, total, truncated: results.length < total };
}

// ─── Lead pipeline stage resolution ─────────────────────────────────────────
// Resolves the role stages (qualified / disqualified / reachingOut / connected)
// from the portal's lead pipeline, preferring explicit IDs from config.
// Cached per lambda instance for 10 minutes.
let leadStageCache = null;
let leadStageCacheAt = 0;

export async function getLeadStages() {
  if (leadStageCache && Date.now() - leadStageCacheAt < 10 * 60 * 1000) {
    return leadStageCache;
  }
  const data = await hsFetch('/crm/v3/pipelines/leads');
  const pipelines = data.results || [];
  // Leads normally have a single pipeline; take the first.
  const stages = (pipelines[0]?.stages || []).map((s) => ({
    id: s.id,
    label: s.label,
    displayOrder: s.displayOrder,
  }));

  const roles = {};
  for (const [role, explicitId] of Object.entries(LEAD_STAGE_IDS)) {
    if (explicitId) {
      roles[role] = explicitId;
      continue;
    }
    const re = new RegExp(LEAD_STAGE_MATCHERS[role], 'i');
    const match = stages.find((s) => re.test(s.label));
    roles[role] = match?.id || null;
  }

  leadStageCache = { stages, roles };
  leadStageCacheAt = Date.now();
  return leadStageCache;
}

// All lead property names containing "date_entered" — the portal's real
// stage-entry timestamp properties, whatever naming scheme it uses. Cached per
// instance; null when the token lacks schema read (callers degrade to guesses).
let leadEnteredPropsCache;
let leadEnteredPropsCacheAt = 0;

export async function getLeadDateEnteredProps() {
  if (leadEnteredPropsCache !== undefined && Date.now() - leadEnteredPropsCacheAt < 10 * 60 * 1000) {
    return leadEnteredPropsCache;
  }
  try {
    const data = await hsFetch('/crm/v3/properties/leads');
    leadEnteredPropsCache = (data.results || [])
      .map((p) => p.name)
      .filter((n) => n.includes('date_entered'));
  } catch {
    leadEnteredPropsCache = null;
  }
  leadEnteredPropsCacheAt = Date.now();
  return leadEnteredPropsCache;
}

// ─── Filter helpers ──────────────────────────────────────────────────────────
export function ownerFilter(ownerIds) {
  return { propertyName: 'hubspot_owner_id', operator: 'IN', values: ownerIds };
}

export function rangeFilter(propertyName, startMs, endMs) {
  return {
    propertyName,
    operator: 'BETWEEN',
    value: String(startMs),
    highValue: String(endMs),
  };
}

// HubSpot returns datetimes as ISO strings or epoch-ms strings depending on
// the property; accept both.
const toMs = (v) => {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v;
  return /^\d+$/.test(v) ? Number(v) : Date.parse(v);
};

// Average of (b − a) in days over rows where both timestamps exist.
export function avgDays(pairs) {
  const diffs = pairs
    .map(([a, b]) => {
      const t0 = toMs(a);
      const t1 = toMs(b);
      return Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0 ? t1 - t0 : null;
    })
    .filter((d) => d !== null);
  if (!diffs.length) return { days: null, n: 0 };
  const avgMs = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  return { days: avgMs / 86400000, n: diffs.length };
}

// GET /api/metrics/leads?start&end&owner
// Metrics: SQL count, leads-per-stage, speed to lead, ICP fits,
// reaching-out → connected time, rep-vs-rep breakdown, qualified /
// disqualified lists — from the HubSpot Leads object, scoped to sales owners.

import { PROPS, dateEnteredProp, ICP_CATEGORIES, FETCH_CAPS } from '../../lib/config.js';
import { requireAuth } from '../_lib/auth.js';
import { parseParams } from '../_lib/params.js';
import { cached } from '../_lib/cache.js';
import {
  hsFetch,
  hsSearchAll,
  getLeadStages,
  getLeadDateEnteredProps,
  ownerFilter,
  rangeFilter,
  avgDays,
  HsError,
} from '../_lib/hubspot.js';

// Resolve company names for a set of lead IDs.
// Primary: lead → company association. Fallback: lead → contact, then the
// contact's free-text `company` property.
async function resolveCompanies(leadIds) {
  const names = new Map(); // leadId -> company name
  if (!leadIds.length) return names;

  const batches = [];
  for (let i = 0; i < leadIds.length; i += 100) batches.push(leadIds.slice(i, i + 100));

  const leadToCompany = new Map();
  const leadToContact = new Map();

  for (const batch of batches) {
    const inputs = batch.map((id) => ({ id }));
    const [companies, contacts] = await Promise.all([
      hsFetch('/crm/v4/associations/leads/companies/batch/read', {
        method: 'POST',
        body: { inputs },
      }).catch(() => null),
      hsFetch('/crm/v4/associations/leads/contacts/batch/read', {
        method: 'POST',
        body: { inputs },
      }).catch(() => null),
    ]);
    for (const row of companies?.results || []) {
      const to = row.to?.[0]?.toObjectId;
      if (to) leadToCompany.set(String(row.from.id), String(to));
    }
    for (const row of contacts?.results || []) {
      const to = row.to?.[0]?.toObjectId;
      if (to) leadToContact.set(String(row.from.id), String(to));
    }
  }

  const companyIds = [...new Set(leadToCompany.values())];
  const companyNames = new Map();
  for (let i = 0; i < companyIds.length; i += 100) {
    const page = await hsFetch('/crm/v3/objects/companies/batch/read', {
      method: 'POST',
      body: {
        inputs: companyIds.slice(i, i + 100).map((id) => ({ id })),
        properties: ['name'],
      },
    }).catch(() => null);
    for (const c of page?.results || []) companyNames.set(String(c.id), c.properties?.name);
  }

  const contactIds = [
    ...new Set([...leadToContact.entries()].filter(([lid]) => !leadToCompany.has(lid)).map(([, cid]) => cid)),
  ];
  const contactCompany = new Map();
  for (let i = 0; i < contactIds.length; i += 100) {
    const page = await hsFetch('/crm/v3/objects/contacts/batch/read', {
      method: 'POST',
      body: {
        inputs: contactIds.slice(i, i + 100).map((id) => ({ id })),
        properties: ['company'],
      },
    }).catch(() => null);
    for (const c of page?.results || []) contactCompany.set(String(c.id), c.properties?.company);
  }

  for (const id of leadIds) {
    const viaCompany = companyNames.get(leadToCompany.get(id));
    const viaContact = contactCompany.get(leadToContact.get(id));
    names.set(id, viaCompany || viaContact || null);
  }
  return names;
}

async function compute({ startMs, endMs, ownerIds }) {
  const { stages, roles } = await getLeadStages();
  const stageLabel = new Map(stages.map((s) => [s.id, s.label]));

  // Stage-entry timestamps. Naming varies: `hs_v2_date_entered_<id>` and/or
  // legacy `hs_date_entered_<id>`, and built-in lead stages have hyphenated
  // IDs ("attempting-stage-id") that get normalized to underscores in the
  // property name. Resolve each role's candidates against the portal's real
  // property list when readable, and read whichever candidate is populated.
  const legacyEnteredProp = (stageId) => `hs_date_entered_${stageId}`;
  const norm = (id) => String(id).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const portalEnteredProps = await getLeadDateEnteredProps();

  const roleEnteredProps = {};
  for (const [role, id] of Object.entries(roles)) {
    if (!id) {
      roleEnteredProps[role] = [];
      continue;
    }
    const candidates = new Set([
      dateEnteredProp(id),
      legacyEnteredProp(id),
      `hs_v2_date_entered_${norm(id)}`,
      `hs_date_entered_${norm(id)}`,
    ]);
    for (const p of portalEnteredProps || []) {
      if (p.endsWith(norm(id)) || p.endsWith(String(id))) candidates.add(p);
    }
    // Prefer v2 properties (sort puts hs_v2_* after hs_date_* — iterate v2 first).
    roleEnteredProps[role] = [...candidates].sort((a, b) =>
      a.startsWith('hs_v2') === b.startsWith('hs_v2') ? 0 : a.startsWith('hs_v2') ? -1 : 1
    );
  }
  const roleProps = Object.values(roleEnteredProps).flat();
  const enteredAt = (lead, role) => {
    for (const p of roleEnteredProps[role] || []) {
      const v = lead.properties?.[p];
      if (v) return v;
    }
    return null;
  };

  const filters = [ownerFilter(ownerIds)];
  if (startMs != null) filters.push(rangeFilter(PROPS.leadCreateDate, startMs, endMs));

  const { results, total, truncated } = await hsSearchAll('leads', {
    filterGroups: [{ filters }],
    properties: [
      'hs_pipeline_stage',
      PROPS.leadCreateDate,
      'hubspot_owner_id',
      PROPS.leadName,
      PROPS.leadIcpFit,
      PROPS.leadDisqualifyReason,
      ...roleProps,
    ],
    sorts: [{ propertyName: PROPS.leadCreateDate, direction: 'DESCENDING' }],
  });

  // Leads by current stage (in pipeline display order).
  const stageCounts = stages.map((s) => ({
    id: s.id,
    label: s.label,
    count: results.filter((l) => l.properties?.hs_pipeline_stage === s.id).length,
  }));

  // SQLs — has EVER entered the Qualified Buyer stage.
  const qualifiedLeads = roles.qualified ? results.filter((l) => enteredAt(l, 'qualified')) : [];

  // Timing metrics.
  const speedToLead = roles.reachingOut
    ? avgDays(
        results.map((l) => [l.properties?.[PROPS.leadCreateDate], enteredAt(l, 'reachingOut')])
      )
    : { days: null, n: 0 };
  const reachingToConnected =
    roles.reachingOut && roles.connected
      ? avgDays(results.map((l) => [enteredAt(l, 'reachingOut'), enteredAt(l, 'connected')]))
      : { days: null, n: 0 };

  // Per-role visibility into which timestamp property this portal populates —
  // makes an empty timing metric diagnosable from the API response.
  const timingDiagnostics = {
    // Whether the token could list lead properties, and every date_entered
    // property the portal actually has — the ground truth for stage matching.
    schema: {
      readable: portalEnteredProps !== null,
      dateEnteredProps: portalEnteredProps || [],
    },
    ...Object.fromEntries(
      Object.entries(roles).map(([role, id]) => [
        role,
        id
          ? {
              stageId: id,
              counts: Object.fromEntries(
                roleEnteredProps[role].map((p) => [
                  p,
                  results.filter((l) => l.properties?.[p]).length,
                ])
              ),
            }
          : null,
      ])
    ),
  };

  // ICP fit distribution.
  const icpCounts = ICP_CATEGORIES.map((cat) => ({
    category: cat,
    count: results.filter((l) => (l.properties?.[PROPS.leadIcpFit] || '') === cat).length,
  }));
  const icpUnscored = results.filter((l) => !l.properties?.[PROPS.leadIcpFit]).length;

  // Rep vs rep.
  const repBreakdown = ownerIds.map((ownerId) => {
    const mine = results.filter((l) => l.properties?.hubspot_owner_id === ownerId);
    return {
      ownerId,
      created: mine.length,
      share: results.length > 0 ? (mine.length / results.length) * 100 : 0,
      sqls: roles.qualified ? mine.filter((l) => enteredAt(l, 'qualified')).length : null,
      stageCounts: stages.map((s) => ({
        id: s.id,
        count: mine.filter((l) => l.properties?.hs_pipeline_stage === s.id).length,
      })),
    };
  });

  // Qualified / disqualified lists (capped) with company names.
  const disqualifiedLeads = roles.disqualified
    ? results.filter((l) => l.properties?.hs_pipeline_stage === roles.disqualified)
    : [];
  const qualifiedRows = qualifiedLeads.slice(0, FETCH_CAPS.listRows);
  const disqualifiedRows = disqualifiedLeads.slice(0, FETCH_CAPS.listRows);

  const companyNames = await resolveCompanies([
    ...new Set([...qualifiedRows, ...disqualifiedRows].map((l) => String(l.id))),
  ]);

  return {
    totalCreated: total,
    stageCounts,
    roles: Object.fromEntries(
      Object.entries(roles).map(([k, id]) => [k, id ? { id, label: stageLabel.get(id) } : null])
    ),
    sqls: roles.qualified
      ? { count: qualifiedLeads.length }
      : { count: null, error: 'qualified_stage_not_found' },
    speedToLead,
    reachingToConnected,
    timingDiagnostics,
    icp: { counts: icpCounts, unscored: icpUnscored },
    repBreakdown,
    qualifiedList: qualifiedRows.map((l) => ({
      id: l.id,
      name: l.properties?.[PROPS.leadName] || null,
      company: companyNames.get(String(l.id)),
      icpFit: l.properties?.[PROPS.leadIcpFit] || null,
      qualifiedAt: enteredAt(l, 'qualified'),
      ownerId: l.properties?.hubspot_owner_id,
    })),
    disqualifiedList: disqualifiedRows.map((l) => ({
      id: l.id,
      name: l.properties?.[PROPS.leadName] || null,
      company: companyNames.get(String(l.id)),
      reason: l.properties?.[PROPS.leadDisqualifyReason] || null,
      ownerId: l.properties?.hubspot_owner_id,
    })),
    listCaps: {
      qualified: { shown: qualifiedRows.length, total: qualifiedLeads.length },
      disqualified: { shown: disqualifiedRows.length, total: disqualifiedLeads.length },
    },
    truncated,
    fetchedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const params = parseParams(req, res);
  if (!params) return;

  try {
    const data = await cached(`leads:${params.key}`, () => compute(params));
    res.status(200).json(data);
  } catch (err) {
    if (err instanceof HsError && err.isAuthOrScope) {
      return res.status(502).json({
        error: 'hubspot_access',
        message:
          'The HubSpot token cannot read the Leads object. Grant the private app the crm.objects.leads.read scope (and Leads access for the installing user).',
      });
    }
    if (err instanceof HsError && err.isMissingProperty) {
      return res.status(502).json({
        error: 'unknown_property',
        message: `A configured property does not exist in HubSpot: ${err.message}. Fix lib/config.js (see scripts/verify-hubspot.js).`,
      });
    }
    res.status(500).json({ error: 'server_error', message: String(err.message || err) });
  }
}

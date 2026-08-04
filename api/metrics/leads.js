// GET /api/metrics/leads?start&end&owner
// Metrics: SQL count, leads-per-stage, speed to lead, ICP fits,
// reaching-out → connected time, rep-vs-rep breakdown, qualified /
// disqualified lists — from the HubSpot Leads object, scoped to sales owners.

import {
  PROPS,
  dateEnteredProp,
  ICP_CATEGORIES,
  FETCH_CAPS,
  LEAD_STAGE_HIDE_MATCHER,
  REP_FUNNEL,
} from '../../lib/config.js';
import { requireAuth } from '../_lib/auth.js';
import { parseParams } from '../_lib/params.js';
import { cached } from '../_lib/cache.js';
import {
  hsFetch,
  hsSearchAll,
  getLeadStages,
  getLeadPropertyNames,
  getPortalId,
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
  const portalProps = await getLeadPropertyNames();
  const portalEnteredProps = portalProps
    ? portalProps.filter((n) => n.includes('date_entered'))
    : null;

  // The rep's free-text disqualification input lives in portal-specific
  // properties (notes/details variants) alongside the configured reason —
  // request every non-timestamp property mentioning "disqualif".
  const disqualifyNoteProps = (portalProps || []).filter(
    (n) =>
      /disqualif/i.test(n) &&
      !n.includes('date_entered') &&
      !n.includes('date_exited') &&
      !n.includes('time_in') &&
      n !== PROPS.leadDisqualifyReason
  );

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
    // Portal properties normalize hyphenated stage IDs and append a numeric
    // suffix (hs_v2_date_entered_attempting_stage_id_745667965), so match on
    // containment, not suffix.
    for (const p of portalEnteredProps || []) {
      if (p.includes(`date_entered_${norm(id)}`) || p.includes(`date_entered_${id}`)) {
        candidates.add(p);
      }
    }
    // The legacy hs_date_entered_* timestamps are stamped on leads that never
    // actually reached the stage (portal data showed 21/29 "ever qualified"
    // against ~11 real), so when the schema confirms a v2 property exists we
    // trust it EXCLUSIVELY. The mixed candidate list survives only as a
    // degraded fallback when the schema is unreadable.
    const v2Confirmed = [...candidates].filter(
      (p) => p.startsWith('hs_v2_') && portalEnteredProps?.includes(p)
    );
    roleEnteredProps[role] = v2Confirmed.length
      ? v2Confirmed
      : [...candidates].sort((a, b) =>
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
      ...disqualifyNoteProps,
      ...roleProps,
    ],
    sorts: [{ propertyName: PROPS.leadCreateDate, direction: 'DESCENDING' }],
  });

  // Leads by current stage (in pipeline display order), minus hidden stages.
  const hideRe = new RegExp(LEAD_STAGE_HIDE_MATCHER, 'i');
  const stageCounts = stages
    .filter((s) => !hideRe.test(s.label))
    .map((s) => ({
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

  // Rep vs rep — funnel counts: leads that have EVER entered each stage,
  // so the columns read left-to-right as a funnel even as leads keep moving.
  const funnelColumns = REP_FUNNEL.filter((f) => roles[f.role]);
  const repBreakdown = ownerIds.map((ownerId) => {
    const mine = results.filter((l) => l.properties?.hubspot_owner_id === ownerId);
    return {
      ownerId,
      created: mine.length,
      share: results.length > 0 ? (mine.length / results.length) * 100 : 0,
      sqls: roles.qualified ? mine.filter((l) => enteredAt(l, 'qualified')).length : null,
      funnel: funnelColumns.map((f) => ({
        role: f.role,
        count: mine.filter((l) => enteredAt(l, f.role)).length,
      })),
    };
  });

  // Lead lists are CURRENT-stage views (the SQL metric above stays
  // ever-entered): Qualified = sitting in Qualified Buyer now, Disqualified =
  // sitting in Disqualified now, Unscored = active leads (not disqualified,
  // not hidden stages) missing an ICP score.
  const currentStage = (l) => l.properties?.hs_pipeline_stage;
  const qualifiedStageLeads = roles.qualified
    ? results.filter((l) => currentStage(l) === roles.qualified)
    : [];
  const disqualifiedLeads = roles.disqualified
    ? results.filter((l) => currentStage(l) === roles.disqualified)
    : [];
  const unscoredLeads = results.filter(
    (l) =>
      !l.properties?.[PROPS.leadIcpFit] &&
      currentStage(l) !== roles.disqualified &&
      !hideRe.test(stageLabel.get(currentStage(l)) || '')
  );
  const qualifiedRows = qualifiedStageLeads.slice(0, FETCH_CAPS.listRows);
  const disqualifiedRows = disqualifiedLeads.slice(0, FETCH_CAPS.listRows);
  const unscoredRows = unscoredLeads.slice(0, FETCH_CAPS.listRows);

  const [companyNames, portalId] = await Promise.all([
    resolveCompanies([
      ...new Set(
        [...qualifiedRows, ...disqualifiedRows, ...unscoredRows].map((l) => String(l.id))
      ),
    ]),
    getPortalId(),
  ]);

  return {
    totalCreated: total,
    portalId,
    repFunnelColumns: funnelColumns.map((f) => ({
      role: f.role,
      label: f.label,
      stageLabel: stageLabel.get(roles[f.role]) || f.label,
    })),
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
      // The rep's typed explanation, from whichever notes-style property holds it.
      notes:
        disqualifyNoteProps
          .map((p) => l.properties?.[p])
          .filter((v) => v && String(v).trim())
          .join(' · ') || null,
      ownerId: l.properties?.hubspot_owner_id,
    })),
    unscoredList: unscoredRows.map((l) => ({
      id: l.id,
      name: l.properties?.[PROPS.leadName] || null,
      company: companyNames.get(String(l.id)),
      stageLabel: stageLabel.get(l.properties?.hs_pipeline_stage) || null,
      ownerId: l.properties?.hubspot_owner_id,
    })),
    listCaps: {
      qualified: { shown: qualifiedRows.length, total: qualifiedStageLeads.length },
      disqualified: { shown: disqualifiedRows.length, total: disqualifiedLeads.length },
      unscored: { shown: unscoredRows.length, total: unscoredLeads.length },
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

// GET /api/metrics/marketing?start&end&owner
// Marketing spec: total leads (deduped), current-stage counts (QB /
// Disqualified / Opportunity / Customer), ICP distribution over QBs only,
// lead source + lead type distributions, paid channel funnels, per-rep
// breakdown, and the disqualified leads table — all from the Leads object,
// scoped to the two sales owners.

import {
  PROPS,
  FETCH_CAPS,
  LEAD_SOURCES,
  LEAD_TYPES,
  ORGANIC_SOURCES,
  ICP_CATEGORIES,
} from '../../lib/config.js';
import { requireAuth } from '../_lib/auth.js';
import { parseParams } from '../_lib/params.js';
import { cached } from '../_lib/cache.js';
import { resolveCompanies } from '../_lib/companies.js';
import {
  hsSearchAll,
  getLeadStages,
  getLeadPropertyNames,
  getLeadPropertyDef,
  getPortalId,
  ownerFilter,
  rangeFilter,
  HsError,
} from '../_lib/hubspot.js';

// Company resolution powers dedup; past this many leads we skip it and report
// the raw count (flagged in the response) rather than hammer the API.
const DEDUP_CAP = 500;

// Resolve a configured custom property against the portal schema, accepting
// close variants (lead_source vs hs_lead_source vs *_lead_source).
function resolveProp(portalProps, configured, stem) {
  if (!portalProps) return { name: configured, verified: false };
  if (portalProps.includes(configured)) return { name: configured, verified: true };
  const candidate = portalProps.find(
    (n) => n === stem || n.endsWith(`_${stem}`) || n === `hs_${stem}`
  );
  return candidate
    ? { name: candidate, verified: true }
    : { name: configured, verified: false };
}

export async function compute({ startMs, endMs, ownerIds }) {
  const [{ roles }, portalProps, portalId] = await Promise.all([
    getLeadStages(),
    getLeadPropertyNames(),
    getPortalId(),
  ]);

  const sourceProp = resolveProp(portalProps, PROPS.leadSource, 'lead_source');
  const typeProp = resolveProp(portalProps, PROPS.leadType, 'lead_type');

  // Enum properties store internal values that can differ from the display
  // labels the spec (and humans) use — fetch the definitions and normalize
  // every raw value through internal-value → label → canonical bucket.
  const [sourceDef, typeDef] = await Promise.all([
    getLeadPropertyDef(sourceProp.name),
    getLeadPropertyDef(typeProp.name),
  ]);
  const optionLabels = (def) =>
    new Map((def?.options || []).map((o) => [String(o.value), o.label]));
  const sourceLabels = optionLabels(sourceDef);
  const typeLabels = optionLabels(typeDef);
  const canonicalSources = new Map(LEAD_SOURCES.map((s) => [s.toLowerCase(), s]));
  const canonicalTypes = new Map(LEAD_TYPES.map((t) => [t.toLowerCase(), t]));
  const normalize = (raw, labels, canonical) => {
    if (raw == null || raw === '') return null;
    const label = labels.get(String(raw)) ?? String(raw);
    return canonical.get(label.trim().toLowerCase()) ?? label;
  };
  const disqualifyNoteProps = (portalProps || []).filter(
    (n) =>
      /disqualif/i.test(n) &&
      !n.includes('date_entered') &&
      !n.includes('date_exited') &&
      !n.includes('time_in') &&
      n !== PROPS.leadDisqualifyReason
  );

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
      sourceProp.name,
      typeProp.name,
    ],
    sorts: [{ propertyName: PROPS.leadCreateDate, direction: 'DESCENDING' }],
  });

  const p = (l, name) => l.properties?.[name] ?? null;
  const stageOf = (l) => p(l, 'hs_pipeline_stage');
  const sourceOf = (l) => normalize(p(l, sourceProp.name), sourceLabels, canonicalSources);
  const typeOf = (l) => normalize(p(l, typeProp.name), typeLabels, canonicalTypes);

  // Company names — needed for dedup and the disqualified table.
  const companyNames =
    results.length <= DEDUP_CAP
      ? await resolveCompanies(results.map((l) => String(l.id)))
      : await resolveCompanies(
          results
            .filter((l) => roles.disqualified && stageOf(l) === roles.disqualified)
            .slice(0, FETCH_CAPS.listRows)
            .map((l) => String(l.id))
        );
  const dedupSkipped = results.length > DEDUP_CAP;

  // Total leads, counting exact lead-name + company duplicates once.
  let duplicates = 0;
  if (!dedupSkipped) {
    const seen = new Set();
    for (const l of results) {
      const name = (p(l, PROPS.leadName) || '').trim().toLowerCase();
      const company = (companyNames.get(String(l.id)) || '').trim().toLowerCase();
      if (!name || !company) continue; // nothing reliable to match on
      const key = `${name}|${company}`;
      if (seen.has(key)) duplicates++;
      else seen.add(key);
    }
  }

  const inStage = (roleId) => (roleId ? results.filter((l) => stageOf(l) === roleId) : []);
  const qbLeads = inStage(roles.qualified);
  const disqualifiedLeads = inStage(roles.disqualified);
  const opportunityLeads = inStage(roles.opportunity);
  const customerLeads = inStage(roles.customer);

  // ICP distribution over Qualified Buyers only — scoring happens at QB.
  const icpQB = {
    counts: ICP_CATEGORIES.map((cat) => ({
      category: cat,
      count: qbLeads.filter((l) => (p(l, PROPS.leadIcpFit) || '') === cat).length,
    })),
    unscored: qbLeads.filter((l) => !p(l, PROPS.leadIcpFit)).length,
    qbTotal: qbLeads.length,
  };

  // Lead source distribution across the known values + catch-alls.
  const sources = LEAD_SOURCES.map((src) => ({
    source: src,
    count: results.filter((l) => sourceOf(l) === src).length,
    qbCount: qbLeads.filter((l) => sourceOf(l) === src).length,
  }));
  const knownSourceTotal = sources.reduce((s, r) => s + r.count, 0);
  const noSource = results.filter((l) => !sourceOf(l)).length;
  const otherSource = results.length - knownSourceTotal - noSource;
  // The distinct resolved labels hiding inside "Other", so the bar can
  // explain itself on hover.
  const otherSourceValues = [
    ...new Set(
      results
        .map((l) => sourceOf(l))
        .filter((s) => s && !canonicalSources.has(s.toLowerCase()))
    ),
  ].slice(0, 8);

  const channel = (...sourceNames) => {
    const inChannel = (l) => sourceNames.includes(sourceOf(l));
    const leads = results.filter(inChannel).length;
    const qbs = qbLeads.filter(inChannel).length;
    return {
      leads,
      qbs,
      qualifyRate: leads > 0 ? (qbs / leads) * 100 : null,
    };
  };

  const leadTypes = LEAD_TYPES.map((t) => ({
    type: t,
    count: results.filter((l) => typeOf(l) === t).length,
  }));

  const perRep = ownerIds.map((ownerId) => {
    const mine = results.filter((l) => p(l, 'hubspot_owner_id') === ownerId);
    const mineQB = mine.filter((l) => roles.qualified && stageOf(l) === roles.qualified);
    return {
      ownerId,
      total: mine.length,
      qualifiedBuyers: mineQB.length,
      opportunities: mine.filter((l) => roles.opportunity && stageOf(l) === roles.opportunity)
        .length,
      customers: mine.filter((l) => roles.customer && stageOf(l) === roles.customer).length,
      disqualified: mine.filter((l) => roles.disqualified && stageOf(l) === roles.disqualified)
        .length,
      paidSearch: mine.filter((l) => sourceOf(l) === 'Paid Search').length,
      paidSocial: mine.filter((l) => sourceOf(l) === 'Paid Social').length,
      icpScored: mineQB.filter((l) => p(l, PROPS.leadIcpFit)).length,
    };
  });

  const disqualifiedRows = disqualifiedLeads.slice(0, FETCH_CAPS.listRows);

  return {
    portalId,
    totalLeads: {
      count: results.length - duplicates,
      rawCount: total,
      duplicates,
      dedupSkipped,
    },
    stages: {
      qualifiedBuyers: qbLeads.length,
      disqualified: disqualifiedLeads.length,
      opportunities: opportunityLeads.length,
      customers: customerLeads.length,
    },
    icpQB,
    sources,
    otherSource,
    otherSourceValues,
    noSource,
    channels: {
      paidSearch: channel('Paid Search'),
      paidSocial: channel('Paid Social'),
      offline: channel('Offline Sources'),
      organic: channel(...ORGANIC_SOURCES),
    },
    leadTypes,
    perRep,
    disqualifiedList: disqualifiedRows.map((l) => ({
      id: l.id,
      name: p(l, PROPS.leadName),
      company: companyNames.get(String(l.id)) ?? null,
      reason: p(l, PROPS.leadDisqualifyReason),
      notes:
        disqualifyNoteProps
          .map((n) => p(l, n))
          .filter((v) => v && String(v).trim())
          .join(' · ') || null,
      source: sourceOf(l),
      ownerId: p(l, 'hubspot_owner_id'),
    })),
    listCaps: {
      disqualified: { shown: disqualifiedRows.length, total: disqualifiedLeads.length },
    },
    diagnostics: {
      leadSourceProp: {
        ...sourceProp,
        optionCount: sourceLabels.size,
        // Distinct raw → resolved pairs actually seen in this range, so a
        // mismatch is diagnosable straight from the response.
        seen: [...new Set(results.map((l) => p(l, sourceProp.name)).filter(Boolean))]
          .slice(0, 12)
          .map((raw) => ({ raw, resolved: normalize(raw, sourceLabels, canonicalSources) })),
      },
      leadTypeProp: {
        ...typeProp,
        optionCount: typeLabels.size,
        seen: [...new Set(results.map((l) => p(l, typeProp.name)).filter(Boolean))]
          .slice(0, 12)
          .map((raw) => ({ raw, resolved: normalize(raw, typeLabels, canonicalTypes) })),
      },
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
    const data = await cached(`marketing:${params.key}`, () => compute(params));
    res.status(200).json(data);
  } catch (err) {
    if (err instanceof HsError && err.isAuthOrScope) {
      return res.status(502).json({ error: 'hubspot_access', message: String(err.message) });
    }
    res.status(500).json({ error: 'server_error', message: String(err.message || err) });
  }
}

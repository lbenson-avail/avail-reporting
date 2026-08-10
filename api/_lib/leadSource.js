// Shared Lead Source resolution: find the portal's real property name and
// normalize its stored values (internal enum value → option label → canonical
// bucket from LEAD_SOURCES). Used by both the marketing and sales endpoints
// so "source" means the same thing everywhere.

import { PROPS, LEAD_SOURCES } from '../../lib/config.js';
import { getLeadPropertyDef } from './hubspot.js';

// Resolve a configured custom property against the portal schema, accepting
// close variants (lead_source vs hs_lead_source vs *_lead_source).
export function resolveProp(portalProps, configured, stem) {
  if (!portalProps) return { name: configured, verified: false };
  if (portalProps.includes(configured)) return { name: configured, verified: true };
  const candidate = portalProps.find(
    (n) => n === stem || n.endsWith(`_${stem}`) || n === `hs_${stem}`
  );
  return candidate
    ? { name: candidate, verified: true }
    : { name: configured, verified: false };
}

export async function getLeadSourceResolver(portalProps) {
  const prop = resolveProp(portalProps, PROPS.leadSource, 'lead_source');
  const def = await getLeadPropertyDef(prop.name);
  const labels = new Map((def?.options || []).map((o) => [String(o.value), o.label]));
  const canonical = new Map(LEAD_SOURCES.map((s) => [s.toLowerCase(), s]));

  const resolveRaw = (raw) => {
    if (raw == null || raw === '') return null;
    const label = labels.get(String(raw)) ?? String(raw);
    return canonical.get(label.trim().toLowerCase()) ?? label;
  };

  return {
    name: prop.name,
    verified: prop.verified,
    optionCount: labels.size,
    resolveRaw,
    sourceOf: (lead) => resolveRaw(lead.properties?.[prop.name] ?? null),
  };
}

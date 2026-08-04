// Company-name resolution for lead records: lead -> company association
// first, falling back to the associated contact's free-text company.

import { hsFetch } from './hubspot.js';

// Resolve company names for a set of lead IDs.
// Primary: lead → company association. Fallback: lead → contact, then the
// contact's free-text `company` property.
export async function resolveCompanies(leadIds) {
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

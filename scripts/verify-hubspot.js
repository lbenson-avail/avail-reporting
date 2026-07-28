#!/usr/bin/env node
// One-off checker for the HubSpot values lib/config.js depends on.
// Never deployed — run locally:  HUBSPOT_TOKEN=pat-... node scripts/verify-hubspot.js
//
// Prints: lead pipeline stages (IDs + labels + which role each auto-matches),
// candidate ICP / disqualify-reason lead properties, and smoke-tests the
// scopes each dashboard endpoint needs.

import {
  LEAD_STAGE_MATCHERS,
  ACCOUNT_PIPELINE_ID,
  PROPS,
  SALES_OWNER_IDS,
} from '../lib/config.js';

const token = process.env.HUBSPOT_TOKEN;
if (!token) {
  console.error('Set HUBSPOT_TOKEN (a HubSpot Private App token) and re-run.');
  process.exit(1);
}

async function hs(path, body) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${path} → ${await res.text()}`);
  return res.json();
}

function ok(label, extra = '') {
  console.log(`  ✔ ${label}${extra ? ` — ${extra}` : ''}`);
}
function fail(label, err) {
  console.log(`  ✘ ${label}\n    ${String(err.message || err).slice(0, 300)}`);
}

console.log('\n── Lead pipeline stages ──────────────────────────────');
try {
  const pipelines = await hs('/crm/v3/pipelines/leads');
  for (const p of pipelines.results || []) {
    console.log(`  Pipeline: ${p.label} (${p.id})`);
    for (const s of p.stages) {
      const roles = Object.entries(LEAD_STAGE_MATCHERS)
        .filter(([, re]) => new RegExp(re, 'i').test(s.label))
        .map(([role]) => role);
      console.log(
        `    ${s.id.padEnd(14)} ${s.label}${roles.length ? `   ← auto-matches: ${roles.join(', ')}` : ''}`
      );
    }
  }
  console.log('\n  If a role has no match (or the wrong one), pin its stage ID in');
  console.log('  lib/config.js LEAD_STAGE_IDS.');
} catch (err) {
  fail('Cannot read lead pipelines (needs crm.objects.leads.read / schema read)', err);
}

console.log('\n── Lead properties (ICP / disqualify reason / name) ──');
try {
  const props = await hs('/crm/v3/properties/leads');
  const interesting = props.results.filter((p) =>
    /icp|fit|disqualif|reason|lead_name/i.test(p.name + ' ' + (p.label || ''))
  );
  for (const p of interesting) {
    const opts = (p.options || []).map((o) => o.value).join(', ');
    console.log(`  ${p.name.padEnd(38)} ${p.label}${opts ? `  [${opts}]` : ''}`);
  }
  const configured = [PROPS.leadIcpFit, PROPS.leadDisqualifyReason, PROPS.leadName];
  for (const name of configured) {
    const hit = props.results.find((p) => p.name === name);
    console.log(`  config ${name.padEnd(35)} ${hit ? '✔ exists' : '✘ NOT FOUND — fix lib/config.js PROPS'}`);
  }
} catch (err) {
  fail('Cannot list lead properties', err);
}

console.log('\n── Scope smoke tests ─────────────────────────────────');
try {
  const r = await hs('/crm/v3/objects/leads/search', {
    filterGroups: [
      { filters: [{ propertyName: 'hubspot_owner_id', operator: 'IN', values: SALES_OWNER_IDS }] },
    ],
    limit: 1,
  });
  ok('Leads search', `${r.total} leads owned by the sales reps (all time)`);
} catch (err) {
  fail('Leads search (crm.objects.leads.read)', err);
}

try {
  const r = await hs('/crm/v3/objects/deals/search', {
    filterGroups: [
      { filters: [{ propertyName: 'pipeline', operator: 'EQ', value: ACCOUNT_PIPELINE_ID }] },
    ],
    limit: 1,
    properties: [PROPS.dealEstimatedAnnualSpend],
  });
  ok('Deals search', `${r.total} deals on Account Pipeline`);
} catch (err) {
  fail('Deals search (crm.objects.deals.read)', err);
}

try {
  const r = await hs('/crm/v3/objects/meetings/search', {
    filterGroups: [
      { filters: [{ propertyName: 'hs_meeting_outcome', operator: 'EQ', value: 'COMPLETED' }] },
    ],
    limit: 1,
  });
  ok('Meetings search', `${r.total} completed meetings (all time, all owners)`);
} catch (err) {
  fail('Meetings search (meetings read scope)', err);
}

try {
  const leads = await hs('/crm/v3/objects/leads/search', { limit: 1 });
  const id = leads.results?.[0]?.id;
  if (id) {
    const assoc = await hs('/crm/v4/associations/leads/companies/batch/read', {
      inputs: [{ id }],
    });
    ok(
      'Lead → company associations',
      assoc.results?.length ? 'direct associations exist' : 'none on sample — contact fallback will be used'
    );
  }
} catch (err) {
  fail('Lead → company associations (crm.objects.companies.read)', err);
}

console.log('\nDone.\n');

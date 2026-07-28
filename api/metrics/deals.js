// GET /api/metrics/deals?start&end&owner
// Metrics: deals-per-stage (bar), blended pipeline value, avg speed to close,
// % of close — all on the Account Pipeline, scoped to the sales owners.

import {
  ACCOUNT_PIPELINE_ID,
  DEAL_STAGES,
  CLOSED_WON_STAGE_ID,
  CLOSED_LOST_STAGE_ID,
  CLOSED_WON_WEIGHT,
  PROPS,
  dateEnteredProp,
} from '../../lib/config.js';
import { requireAuth } from '../_lib/auth.js';
import { parseParams } from '../_lib/params.js';
import { cached } from '../_lib/cache.js';
import { hsSearchAll, ownerFilter, rangeFilter, avgDays, HsError } from '../_lib/hubspot.js';

const STAGE1_ENTERED = dateEnteredProp(DEAL_STAGES[0].id);

async function compute({ startMs, endMs, ownerIds }) {
  const baseFilters = [
    { propertyName: 'pipeline', operator: 'EQ', value: ACCOUNT_PIPELINE_ID },
    ownerFilter(ownerIds),
  ];

  // Fetch A — deals created in range: stage counts, blended value, created count.
  const createdFilters = [...baseFilters];
  if (startMs != null) createdFilters.push(rangeFilter('createdate', startMs, endMs));

  const created = await hsSearchAll('deals', {
    filterGroups: [{ filters: createdFilters }],
    properties: [
      'dealstage',
      'dealname',
      PROPS.dealEstimatedAnnualSpend,
      PROPS.dealAmount,
      'createdate',
      'closedate',
      'hubspot_owner_id',
    ],
  });

  const stageIndex = new Map(DEAL_STAGES.map((s) => [s.id, s]));
  const byStage = new Map();
  for (const s of DEAL_STAGES) {
    byStage.set(s.id, { ...s, count: 0, raw: 0, weighted: 0 });
  }
  const closedWon = {
    id: CLOSED_WON_STAGE_ID,
    label: 'Closed Won',
    short: 'Won',
    weight: CLOSED_WON_WEIGHT,
    count: 0,
    raw: 0,
    weighted: 0,
  };
  let closedLostCount = 0;

  for (const deal of created.results) {
    const p = deal.properties || {};
    const spend = Number(p[PROPS.dealEstimatedAnnualSpend]) || 0;
    if (p.dealstage === CLOSED_LOST_STAGE_ID) {
      closedLostCount++;
    } else if (p.dealstage === CLOSED_WON_STAGE_ID) {
      closedWon.count++;
      closedWon.raw += spend;
      closedWon.weighted += spend * CLOSED_WON_WEIGHT;
    } else if (stageIndex.has(p.dealstage)) {
      const row = byStage.get(p.dealstage);
      row.count++;
      row.raw += spend;
      row.weighted += spend * row.weight;
    }
  }

  // Fetch B — deals WON in range (by close date): speed to close + % close numerator.
  const wonFilters = [
    { propertyName: 'pipeline', operator: 'EQ', value: ACCOUNT_PIPELINE_ID },
    { propertyName: 'dealstage', operator: 'EQ', value: CLOSED_WON_STAGE_ID },
    ownerFilter(ownerIds),
  ];
  if (startMs != null) wonFilters.push(rangeFilter('closedate', startMs, endMs));

  const won = await hsSearchAll('deals', {
    filterGroups: [{ filters: wonFilters }],
    properties: ['closedate', 'createdate', STAGE1_ENTERED],
  });

  const speed = avgDays(
    won.results.map((d) => [d.properties?.[STAGE1_ENTERED], d.properties?.closedate])
  );

  const openStages = [...byStage.values()];
  const allStages = [...openStages, closedWon];

  return {
    stageCounts: allStages.map(({ id, label, short, count }) => ({ id, label, short, count })),
    closedLostCount,
    blended: {
      byStage: allStages.map(({ id, label, short, weight, raw, weighted }) => ({
        id,
        label,
        short,
        weight,
        raw,
        weighted,
      })),
      totalRaw: allStages.reduce((s, r) => s + r.raw, 0),
      totalWeighted: allStages.reduce((s, r) => s + r.weighted, 0),
      openRaw: openStages.reduce((s, r) => s + r.raw, 0),
      openWeighted: openStages.reduce((s, r) => s + r.weighted, 0),
    },
    speedToClose: { days: speed.days, n: speed.n, wonTotal: won.total },
    pctClose: {
      won: won.total,
      created: created.total,
      pct: created.total > 0 ? (won.total / created.total) * 100 : null,
    },
    truncated: created.truncated || won.truncated,
    fetchedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const params = parseParams(req, res);
  if (!params) return;

  try {
    const data = await cached(`deals:${params.key}`, () => compute(params));
    res.status(200).json(data);
  } catch (err) {
    const status = err instanceof HsError && err.isAuthOrScope ? 502 : 500;
    res.status(status).json({
      error: err instanceof HsError && err.isAuthOrScope ? 'hubspot_access' : 'server_error',
      message: String(err.message || err),
    });
  }
}

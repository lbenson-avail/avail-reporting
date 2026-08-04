// GET /api/metrics/meetings?start&end&owner
// Metric: meeting show rate — outcome counts for meetings that start in the
// selected period, scoped to the sales owners.

import { MEETING_OUTCOMES } from '../../lib/config.js';
import { requireAuth } from '../_lib/auth.js';
import { parseParams } from '../_lib/params.js';
import { cached } from '../_lib/cache.js';
import { hsCount, ownerFilter, rangeFilter, HsError } from '../_lib/hubspot.js';

export async function compute({ startMs, endMs, ownerIds }) {
  const counts = {};
  const countWith = (outcomeFilter) => {
    const filters = [outcomeFilter, ownerFilter(ownerIds)];
    if (startMs != null) filters.push(rangeFilter('hs_meeting_start_time', startMs, endMs));
    return hsCount('meetings', [{ filters }]);
  };

  const [missingOutcome] = await Promise.all([
    countWith({ propertyName: 'hs_meeting_outcome', operator: 'NOT_HAS_PROPERTY' }),
    ...MEETING_OUTCOMES.map(async (outcome) => {
      counts[outcome] = await countWith({
        propertyName: 'hs_meeting_outcome',
        operator: 'EQ',
        value: outcome,
      });
    }),
  ]);

  // Show rate covers meetings WITH an outcome; missing-outcome meetings are
  // reported alongside as a data-quality signal, never in the math.
  const booked = MEETING_OUTCOMES.reduce((s, o) => s + counts[o], 0);
  return {
    counts,
    missingOutcome,
    booked,
    completed: counts.COMPLETED,
    showRate: booked > 0 ? (counts.COMPLETED / booked) * 100 : null,
    fetchedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const params = parseParams(req, res);
  if (!params) return;

  try {
    const data = await cached(`meetings:${params.key}`, () => compute(params));
    res.status(200).json(data);
  } catch (err) {
    const status = err instanceof HsError && err.isAuthOrScope ? 502 : 500;
    res.status(status).json({
      error: err instanceof HsError && err.isAuthOrScope ? 'hubspot_access' : 'server_error',
      message: String(err.message || err),
    });
  }
}

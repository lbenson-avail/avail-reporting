import { SALES_OWNER_IDS } from '../../lib/config.js';

// Parses ?start=YYYY-MM-DD&end=YYYY-MM-DD&owner=<ownerId> into
// { startMs, endMs, ownerIds, key }. Missing start/end = all time.
// Returns null (and writes a 400) on invalid input.
export function parseParams(req, res) {
  const { start, end, owner } = req.query || {};

  let startMs = null;
  let endMs = null;
  if (start || end) {
    startMs = Date.parse(`${start}T00:00:00.000Z`);
    endMs = Date.parse(`${end}T23:59:59.999Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      res.status(400).json({ error: 'invalid start/end — use YYYY-MM-DD' });
      return null;
    }
  }

  let ownerIds = SALES_OWNER_IDS;
  if (owner) {
    if (!SALES_OWNER_IDS.includes(owner)) {
      res.status(400).json({ error: 'unknown owner' });
      return null;
    }
    ownerIds = [owner];
  }

  return {
    startMs,
    endMs,
    ownerIds,
    key: `${start || ''}:${end || ''}:${ownerIds.join(',')}`,
  };
}

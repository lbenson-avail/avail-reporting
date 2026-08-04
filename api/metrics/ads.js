// GET /api/metrics/ads?start&end — spend/impressions per paid channel.
// Returns per-channel data or a clearly-labeled unavailable state.

import { requireAuth, keyMatches } from '../_lib/auth.js';
import { parseParams } from '../_lib/params.js';
import { cached } from '../_lib/cache.js';
import { getChannelMetrics, adsDebugInfo, adsDiscover } from '../_lib/ads.js';

export default async function handler(req, res) {
  // Introspection endpoints, browser-friendly (?key=<dashboard password>):
  //   ?debug=1    — unmetered: PaidSync tool names + schemas.
  //   ?discover=1 — one metered probe per channel: call the account setter
  //                 and relay PaidSync's raw response/error verbatim.
  if (req.query?.debug || req.query?.discover) {
    res.setHeader('Cache-Control', 'no-store');
    if (!keyMatches(req.query?.key) && !keyMatches(req.headers['x-dashboard-key'])) {
      return res.status(401).json({ error: 'unauthorized', hint: 'append &key=<dashboard password>' });
    }
    try {
      return res.status(200).json(await (req.query?.discover ? adsDiscover() : adsDebugInfo()));
    } catch (err) {
      return res.status(500).json({ error: 'debug_failed', message: String(err.message || err) });
    }
  }

  if (!requireAuth(req, res)) return;

  const params = parseParams(req, res);
  if (!params) return;

  try {
    const data = await cached(`ads:${params.key}`, async () => {
      const [google, linkedin] = await Promise.all([
        getChannelMetrics('google', params.startMs, params.endMs),
        getChannelMetrics('linkedin', params.startMs, params.endMs),
      ]);
      return { google, linkedin, fetchedAt: new Date().toISOString() };
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: String(err.message || err) });
  }
}

// GET /api/metrics/ads?start&end — spend/impressions per paid channel.
// Returns per-channel data or a clearly-labeled unavailable state.

import { requireAuth } from '../_lib/auth.js';
import { parseParams } from '../_lib/params.js';
import { cached } from '../_lib/cache.js';
import { getChannelMetrics, adsDebugInfo } from '../_lib/ads.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  // Unmetered schema introspection: /api/metrics/ads?debug=1
  if (req.query?.debug) {
    try {
      return res.status(200).json(await adsDebugInfo());
    } catch (err) {
      return res.status(500).json({ error: 'debug_failed', message: String(err.message || err) });
    }
  }

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

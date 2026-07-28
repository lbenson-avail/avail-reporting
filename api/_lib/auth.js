import { createHash, timingSafeEqual } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest();

// Returns true if the request is authorized; otherwise writes the error
// response and returns false. Every API handler calls this first.
export function requireAuth(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'DASHBOARD_PASSWORD is not configured on the server' });
    return false;
  }

  const provided = req.headers['x-dashboard-key'];
  if (typeof provided !== 'string' || !timingSafeEqual(sha256(provided), sha256(expected))) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

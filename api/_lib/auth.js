import { createHash, timingSafeEqual } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest();

// Constant-time check of a provided key against the dashboard password.
export function keyMatches(provided) {
  const expected = process.env.DASHBOARD_PASSWORD;
  return (
    Boolean(expected) &&
    typeof provided === 'string' &&
    timingSafeEqual(sha256(provided), sha256(expected))
  );
}

// Returns true if the request is authorized; otherwise writes the error
// response and returns false. Every API handler calls this first.
export function requireAuth(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.DASHBOARD_PASSWORD) {
    res.status(500).json({ error: 'DASHBOARD_PASSWORD is not configured on the server' });
    return false;
  }

  if (!keyMatches(req.headers['x-dashboard-key'])) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

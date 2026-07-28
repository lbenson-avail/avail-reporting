import { requireAuth } from './_lib/auth.js';

// POST /api/auth — validates the dashboard password (login screen check).
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!requireAuth(req, res)) return;
  res.status(204).end();
}

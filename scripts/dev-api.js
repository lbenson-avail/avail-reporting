#!/usr/bin/env node
// Local stand-in for Vercel's function runtime: mounts the /api handlers on
// http://localhost:3001 with a minimal req/res shim. Use together with
// `npm run dev` (vite proxies /api here), or hit it directly with curl.
//   HUBSPOT_TOKEN=... DASHBOARD_PASSWORD=... node scripts/dev-api.js

import http from 'node:http';
import { URL } from 'node:url';

import authHandler from '../api/auth.js';
import dealsHandler from '../api/metrics/deals.js';
import leadsHandler from '../api/metrics/leads.js';
import meetingsHandler from '../api/metrics/meetings.js';

const routes = {
  '/api/auth': authHandler,
  '/api/metrics/deals': dealsHandler,
  '/api/metrics/leads': leadsHandler,
  '/api/metrics/meetings': meetingsHandler,
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const handler = routes[url.pathname];

  // Vercel-style helpers.
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
    return res;
  };
  req.query = Object.fromEntries(url.searchParams);

  if (!handler) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  try {
    await handler(req, res);
  } catch (err) {
    console.error(err);
    if (!res.writableEnded) res.status(500).json({ error: 'server_error', message: String(err) });
  }
});

const port = process.env.PORT || 3001;
server.listen(port, () => console.log(`api dev server on http://localhost:${port}`));

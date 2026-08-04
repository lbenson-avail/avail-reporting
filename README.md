# Avail Reporting

Live reporting product for the Avail team: a **Sales** dashboard and a
**Marketing** dashboard behind a left-hand nav. HubSpot is the source of
truth; data is pulled on every load and auto-refreshes every 5 minutes.
Scoped to the two sales reps configured in `lib/config.js` (Jonathan Hopkins &
Steven Santa Ana) — everyone else's records are excluded from every metric.

Ad-platform metrics (Google Ads spend/CPL, LinkedIn) flow through
**PaidSync** (MCP-over-HTTP is PaidSync's API): set `PAIDSYNC_API_KEY` in
Vercel to activate them. PaidSync meters per tool call, so ads data is cached
server-side for `ADS_CACHE_TTL_HOURS` (default 12) instead of polling.
`/api/metrics/ads?debug=1` (password-protected, unmetered) lists the PaidSync
tool schemas for finalizing/adjusting the integration.

**Stack**: Vite + React 19, Tailwind v4 + shadcn/ui, Recharts. Vercel serverless
functions (`/api`) proxy HubSpot so the private-app token never reaches the
browser. The whole dashboard sits behind a shared password.

## Deploy (Vercel)

1. Import this repo into Vercel (framework: Vite — auto-detected).
2. Set two environment variables:
   - `HUBSPOT_TOKEN` — a HubSpot **Private App** token with scopes:
     `crm.objects.leads.read`, `crm.objects.deals.read`,
     `crm.objects.contacts.read`, `crm.objects.companies.read`,
     `crm.objects.owners.read`, `crm.schemas.leads.read`,
     `crm.schemas.deals.read`, and the meetings/engagements read scope.
   - `DASHBOARD_PASSWORD` — the shared password the team enters to view.
3. Deploy. Share the URL + password with the team.

## Verify HubSpot configuration

Lead pipeline stage IDs and a couple of property names are portal-specific.
The API auto-resolves lead stages by label (see `LEAD_STAGE_MATCHERS` in
`lib/config.js`), but you should confirm once:

```sh
HUBSPOT_TOKEN=pat-... node scripts/verify-hubspot.js
```

It prints every lead stage with the role it auto-matches (qualified /
disqualified / reachingOut / connected), checks the configured property names
(`icp_fit_score`, `hs_lead_disqualification_reason`, …), and smoke-tests each
scope the dashboard needs. If a stage matches wrongly (or a property is
missing), pin the correct value in `lib/config.js` — that file is the single
place all pipeline IDs, stage weights, owners, property names, and metric
tooltip copy live.

## Local development

```sh
npm install
cp .env.example .env        # fill in both values
node scripts/dev-api.js &   # serves /api on :3001
npm run dev                 # vite dev server, proxies /api -> :3001
```

## Metric definitions

Each dashboard card carries an info tooltip with its definition; the copy (and
the calculation inputs) live in `METRIC_DEFS` in `lib/config.js`. Headline
counts use HubSpot search totals (exact); averages and the qualified/
disqualified lists are computed from up to 2,000 fetched records per range —
the header shows a "Partial data" badge if a range exceeds that.

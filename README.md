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
The ad-account ids PaidSync selects ship as defaults in `lib/config.js`
(`AD_ACCOUNT_IDS`); set `PAIDSYNC_GOOGLE_ACCOUNT_ID` /
`PAIDSYNC_LINKEDIN_ACCOUNT_ID` in Vercel only to override them
(dashes/spaces in ids are fine either way).
Troubleshooting, both password-protected via `&key=`:
`/api/metrics/ads?debug=1` (unmetered) lists the PaidSync tool schemas;
`/api/metrics/ads?discover=1` (one metered call per channel) relays
PaidSync's raw account-selection response verbatim.

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

## Connect Claude (MCP)

The app serves its metrics over MCP at `/api/mcp`, so Claude can read and
analyze the reporting directly — same numbers as the dashboards, plus a
time-trends tool the pages don't have.

Add it as a custom connector in claude.ai:

1. claude.ai → **Settings → Connectors → Add custom connector**
2. URL: `https://<your-app>.vercel.app/api/mcp?key=<DASHBOARD_PASSWORD>`
3. Name it e.g. **Avail Reporting**, save, and enable it in a chat.

Tools exposed:

- `get_sales_metrics {start?, end?, rep?}` — the Sales dashboard rollup
  (lead KPIs, stage counts, ICP, rep funnel, deal stages, blended pipeline
  value, speed/percent to close, meeting show rate).
- `get_marketing_metrics {start?, end?, rep?}` — the Marketing dashboard
  rollup (deduped totals, stage counts, sources, channel funnels, lead
  types, per-rep, disqualified list).
- `get_time_trends {granularity: week|month, periods}` — weekly/monthly
  series of leads created, current QB/disqualified counts, deals created,
  deals won, and won value, for trend questions.

Dates are `YYYY-MM-DD` (UTC); omit both for all time. `rep` accepts a rep
name. The endpoint is read-only and shares the dashboard password.

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

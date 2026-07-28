// ─────────────────────────────────────────────────────────────────────────────
// Shared dashboard configuration — the single place to adjust pipelines,
// stages, owners, property names, weights, and metric tooltip copy.
// Imported by both the frontend (src/) and the Vercel API functions (api/).
// ─────────────────────────────────────────────────────────────────────────────

// The two reps whose leads/deals/meetings represent the sales pipeline.
// Everyone else's records are excluded from every metric.
export const SALES_OWNERS = [
  { id: '137194338', name: 'Jonathan Hopkins', shortName: 'Jonathan' },
  { id: '51600644', name: 'Steven Santa Ana', shortName: 'Steven' },
];
export const SALES_OWNER_IDS = SALES_OWNERS.map((o) => o.id);

// HubSpot "Account Pipeline" — the sales pipeline (NOT the order-workflow
// "Avail Pipeline"). Weights per Logan's blended-value model:
// stages 1–5 = 10/20/30/50/90%, Closed Won = 100%.
export const ACCOUNT_PIPELINE_ID = '790272545';

export const DEAL_STAGES = [
  { id: '1156147090', label: 'Stage 1 - Interest', short: 'Interest', weight: 0.1 },
  { id: '1156147091', label: 'Stage 2 - Investigate', short: 'Investigate', weight: 0.2 },
  { id: '1156147092', label: 'Stage 3 - Validate', short: 'Validate', weight: 0.3 },
  { id: '1156147093', label: 'Stage 4 - Justify', short: 'Justify', weight: 0.5 },
  { id: '1156147094', label: 'Stage 5 - Decide', short: 'Decide', weight: 0.9 },
];
export const CLOSED_WON_STAGE_ID = '1156147095';
export const CLOSED_LOST_STAGE_ID = '1156147096';
export const CLOSED_WON_WEIGHT = 1.0;

// ─── Lead pipeline stages ────────────────────────────────────────────────────
// The Leads object pipeline stage IDs are portal-specific. Leave the IDs empty
// and the API resolves them at runtime by matching stage labels against the
// regexes below (GET /crm/v3/pipelines/leads, cached). If auto-matching picks
// the wrong stage, run `node scripts/verify-hubspot.js` to list the real IDs
// and pin them here.
export const LEAD_STAGE_IDS = {
  qualified: '', // e.g. stage labeled "Qualified Buyer"
  disqualified: '', // e.g. "Disqualified" / "Unqualified"
  reachingOut: '', // e.g. "Reaching Out" / "Attempting to Connect"
  connected: '', // e.g. "Connected"
  opportunity: '',
  customer: '',
};

export const LEAD_STAGE_MATCHERS = {
  qualified: 'qualified buyer|^qualified',
  disqualified: '^disqualif|unqualified',
  reachingOut: 'reaching out|connect lead|attempting',
  connected: '^connected',
  opportunity: '^opportunity',
  customer: '^customer',
};

// Stages hidden from the stage-distribution and rep views (still counted in
// totals). Label regex, case-insensitive.
export const LEAD_STAGE_HIDE_MATCHER = 'recently lost';

// Rep vs Rep funnel columns, in display order. Counts are "has EVER entered
// the stage" (from stage-entry timestamps), not current stage — that's what
// makes the columns line up as a funnel even though leads keep moving.
export const REP_FUNNEL = [
  { role: 'reachingOut', label: 'Reaching Out' },
  { role: 'connected', label: 'Connected' },
  { role: 'disqualified', label: 'Disqualified' },
  { role: 'qualified', label: 'Qualified (SQL)' },
  { role: 'opportunity', label: 'Opportunity' },
  { role: 'customer', label: 'Customer' },
];

// ─── Property names ──────────────────────────────────────────────────────────
export const PROPS = {
  dealEstimatedAnnualSpend: 'estimated_annual_spend',
  dealAmount: 'amount',
  // Leads use hs_createdate — `createdate` only exists on contacts/deals and
  // filtering on it makes the leads search 400.
  leadCreateDate: 'hs_createdate',
  // ICP fit score. On Contacts this portal uses `icp_fit_score_from_lead`
  // (Strong Fit / Moderate Fit / Weak Fit / Not a Fit); the Leads object
  // property is expected to be `icp_fit_score`. Verify with scripts/verify-hubspot.js.
  leadIcpFit: 'icp_fit_score',
  // Free-text / enum reason captured when a lead is disqualified.
  leadDisqualifyReason: 'hs_lead_disqualification_reason',
  leadName: 'hs_lead_name',
};

// `hs_v2_date_entered_<stageId>` — timestamp a record first entered a stage.
export const dateEnteredProp = (stageId) => `hs_v2_date_entered_${stageId}`;

export const ICP_CATEGORIES = ['Strong Fit', 'Moderate Fit', 'Weak Fit', 'Not a Fit'];

export const MEETING_OUTCOMES = ['SCHEDULED', 'COMPLETED', 'RESCHEDULED', 'NO_SHOW', 'CANCELED'];

// ─── Fetch limits / cadence ──────────────────────────────────────────────────
export const FETCH_CAPS = { records: 2000, listRows: 200 };
export const LIST_PAGE_SIZES = [10, 25, 50];
export const POLL_INTERVAL_MS = 5 * 60 * 1000; // dashboard auto-refresh
export const SERVER_CACHE_TTL_MS = 60 * 1000; // per-instance API cache

// ─── Metric definitions (id, title, tooltip) ─────────────────────────────────
// Tooltip copy mirrors Logan's metric sheet so every card explains itself.
export const METRIC_DEFS = {
  totalLeads: {
    title: 'Total Leads',
    tooltip: 'All leads created in the selected period, across every stage.',
  },
  qualifiedPct: {
    title: 'Qualified %',
    tooltip:
      'Sales Qualified Leads divided by total leads created in the selected period — how much of the top of funnel converts to qualified.',
  },
  sqls: {
    title: 'Sales Qualified Leads',
    tooltip:
      'Leads that have EVER reached the "Qualified Buyer" lead stage (even if they moved on since), among leads created in the selected period.',
  },
  dealStages: {
    title: 'Deals by Stage',
    tooltip:
      'Count of open deals per stage (Stage 1 Interest → Stage 5 Decide) on the Account Pipeline, for deals created in the selected period.',
  },
  speedToClose: {
    title: 'Avg. Speed to Close',
    tooltip:
      'Average time from a deal entering Stage 1 - Interest to Closed Won, for deals won in the selected period. Deals missing a Stage 1 timestamp are excluded (n shows how many counted).',
  },
  pctClose: {
    title: '% of Close',
    tooltip:
      'Deals Closed Won (by close date in the period) divided by deals created in the period, on the Account Pipeline.',
  },
  blendedValue: {
    title: 'Pipeline Value (Blended)',
    tooltip:
      'Estimated Annual Spend summed per stage — both the raw entered amount and the weighted value (Stage 1–5 weighted at 10/20/30/50/90%, Closed Won at 100%).',
  },
  leadStages: {
    title: 'Leads by Stage',
    tooltip: 'Total count of leads currently in each lead stage, for leads created in the selected period.',
  },
  speedToLead: {
    title: 'Speed to Lead',
    tooltip:
      'Average time from lead creation (form fill or cold-email reply) to the first outreach touch — measured as time from creation until the lead entered the Reaching Out stage. n shows how many leads had both timestamps.',
  },
  icpFits: {
    title: 'ICP Fit Ratings',
    tooltip:
      'Count of leads in each ICP Fit Score category (Strong / Moderate / Weak / Not a Fit), for leads created in the selected period.',
  },
  reachingToConnected: {
    title: 'Time to Connected',
    tooltip:
      'Average time between a lead entering "Reaching Out" and entering "Connected" — how long it takes to get a response. n shows how many leads had both timestamps.',
  },
  meetingShowRate: {
    title: 'Meeting Show Rate',
    tooltip:
      'Meetings marked Completed divided by all meetings booked in the period (Completed + Scheduled + Rescheduled + No Show + Canceled). Meetings with no outcome set are shown separately and excluded from the rate.',
  },
  repBreakdown: {
    title: 'Rep vs Rep',
    tooltip:
      'Per rep: total leads created in the period, share of all leads, and how many of their leads have EVER reached each funnel stage (stage-entry history, not current position — so a lead that became a Customer still counts in every stage it passed through).',
  },
  disqualifiedList: {
    title: 'Disqualified Leads',
    tooltip: 'Leads disqualified, with company name and the reason entered at disqualification.',
  },
  unscoredList: {
    title: 'Unscored Leads',
    tooltip:
      'Leads created in the period that have no ICP Fit Score yet — score these in HubSpot to keep the fit metrics meaningful.',
  },
  qualifiedList: {
    title: 'Qualified Leads',
    tooltip: 'Leads that reached Qualified Buyer, with company name and ICP Fit Score.',
  },
};

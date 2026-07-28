import { useMemo, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useMetrics } from '@/hooks/useMetrics';
import { LoginGate } from '@/components/LoginGate';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { DealStageChart } from '@/components/dashboard/DealStageChart';
import { PipelineValueCard } from '@/components/dashboard/PipelineValueCard';
import { LeadStagesCard } from '@/components/dashboard/LeadStagesCard';
import { IcpFitCard } from '@/components/dashboard/IcpFitCard';
import { MeetingShowRateCard } from '@/components/dashboard/MeetingShowRateCard';
import { RepBreakdownTable } from '@/components/dashboard/RepBreakdownTable';
import { LeadLists } from '@/components/dashboard/LeadLists';
import { buildPresets, presetToRange } from '@/components/dashboard/DateRangePicker';
import { METRIC_DEFS } from '../lib/config.js';
import { fmtDays, fmtNum, fmtPct } from '@/lib/format';

function Dashboard() {
  const [range, setRange] = useState(() => presetToRange(buildPresets()[0])); // This month
  const [owner, setOwner] = useState(null);

  const { leads, deals, meetings, lastUpdated, refreshing, refresh } = useMetrics({
    start: range.start,
    end: range.end,
    owner,
  });

  const leadErr = leads.error ? String(leads.error.message) : null;
  const dealErr = deals.error ? String(deals.error.message) : null;
  const meetErr = meetings.error ? String(meetings.error.message) : null;

  const truncated = Boolean(leads.data?.truncated || deals.data?.truncated);

  const kpis = useMemo(() => {
    const l = leads.data;
    const d = deals.data;
    const m = meetings.data;
    return [
      {
        def: METRIC_DEFS.sqls,
        value: l?.sqls?.count != null ? fmtNum(l.sqls.count) : '—',
        sub:
          l?.sqls?.error === 'qualified_stage_not_found'
            ? 'Qualified stage not found — check config'
            : l
              ? `of ${fmtNum(l.totalCreated)} leads created`
              : null,
        loading: leads.loading,
        error: leadErr,
      },
      {
        def: METRIC_DEFS.speedToLead,
        value: fmtDays(l?.speedToLead?.days),
        sub: l ? `n = ${fmtNum(l.speedToLead?.n ?? 0)} leads` : null,
        loading: leads.loading,
        error: leadErr,
      },
      {
        def: METRIC_DEFS.reachingToConnected,
        value: fmtDays(l?.reachingToConnected?.days),
        sub: l ? `n = ${fmtNum(l.reachingToConnected?.n ?? 0)} leads` : null,
        loading: leads.loading,
        error: leadErr,
      },
      {
        def: METRIC_DEFS.speedToClose,
        value: fmtDays(d?.speedToClose?.days),
        sub: d
          ? `n = ${fmtNum(d.speedToClose?.n ?? 0)} of ${fmtNum(d.speedToClose?.wonTotal ?? 0)} won deals`
          : null,
        loading: deals.loading,
        error: dealErr,
      },
      {
        def: METRIC_DEFS.pctClose,
        value: fmtPct(d?.pctClose?.pct, 0),
        sub: d ? `${fmtNum(d.pctClose?.won)} won / ${fmtNum(d.pctClose?.created)} created` : null,
        loading: deals.loading,
        error: dealErr,
      },
      {
        def: METRIC_DEFS.meetingShowRate,
        value: fmtPct(m?.showRate, 0),
        sub: m ? `${fmtNum(m.completed)} of ${fmtNum(m.booked)} meetings` : null,
        loading: meetings.loading,
        error: meetErr,
      },
    ];
  }, [leads, deals, meetings, leadErr, dealErr, meetErr]);

  return (
    <div className="bg-background min-h-screen">
      <DashboardHeader
        range={range}
        onRangeChange={setRange}
        owner={owner}
        onOwnerChange={setOwner}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRefresh={refresh}
        truncated={truncated}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        {/* KPI row */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <MetricCard key={k.def.title} {...k} />
          ))}
        </section>

        {/* Deal funnel + blended value */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DealStageChart deals={deals} />
          <PipelineValueCard deals={deals} />
        </section>

        {/* Lead distributions */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LeadStagesCard leads={leads} />
          <IcpFitCard leads={leads} />
          <MeetingShowRateCard meetings={meetings} />
        </section>

        {/* Rep vs rep */}
        <RepBreakdownTable leads={leads} />

        {/* Lists */}
        <LeadLists leads={leads} />

        <p className="text-muted-foreground pb-4 text-center text-xs">
          Data refreshes automatically every 5 minutes · HubSpot is the source of truth
        </p>
      </main>
    </div>
  );
}

export default function App() {
  const { authed, login } = useAuth();

  return (
    <TooltipProvider delayDuration={150}>
      {authed ? <Dashboard /> : <LoginGate onLogin={login} />}
    </TooltipProvider>
  );
}

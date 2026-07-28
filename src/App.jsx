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
import { fmtDays, fmtDaysExact, fmtNum, fmtPct, fmtPctExact } from '@/lib/format';

function SectionHeading({ children }) {
  return (
    <h2 className="text-foreground mt-2 text-base font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  );
}

function Dashboard() {
  const [range, setRange] = useState(() => presetToRange(buildPresets()[0])); // This month
  const [owner, setOwner] = useState(null);

  const { leads, deals, meetings, lastUpdated, refreshing, refresh } = useMetrics({
    start: range.start,
    end: range.end,
    owner,
  });

  const leadErr = leads.error ? String(leads.error.message) : null;

  const truncated = Boolean(leads.data?.truncated || deals.data?.truncated);

  const leadKpis = useMemo(() => {
    const l = leads.data;
    const qualifiedPct =
      l && l.totalCreated > 0 && l.sqls?.count != null
        ? (l.sqls.count / l.totalCreated) * 100
        : null;
    return [
      {
        def: METRIC_DEFS.totalLeads,
        value: l ? fmtNum(l.totalCreated) : '—',
        sub: 'Created in selected period',
      },
      {
        def: METRIC_DEFS.sqls,
        value: l?.sqls?.count != null ? fmtNum(l.sqls.count) : '—',
        sub:
          l?.sqls?.error === 'qualified_stage_not_found'
            ? 'Qualified stage not found — check config'
            : l
              ? `of ${fmtNum(l.totalCreated)} leads created`
              : null,
      },
      {
        def: METRIC_DEFS.qualifiedPct,
        value: fmtPct(qualifiedPct),
        exact: fmtPctExact(qualifiedPct),
        sub: l ? `${fmtNum(l.sqls?.count)} qualified / ${fmtNum(l.totalCreated)} leads` : null,
      },
      {
        def: METRIC_DEFS.speedToLead,
        value: fmtDays(l?.speedToLead?.days),
        exact: fmtDaysExact(l?.speedToLead?.days),
        sub: l ? `n = ${fmtNum(l.speedToLead?.n ?? 0)} leads` : null,
      },
      {
        def: METRIC_DEFS.reachingToConnected,
        value: fmtDays(l?.reachingToConnected?.days),
        exact: fmtDaysExact(l?.reachingToConnected?.days),
        sub: l ? `n = ${fmtNum(l.reachingToConnected?.n ?? 0)} leads` : null,
      },
    ].map((k) => ({ ...k, loading: leads.loading, error: leadErr }));
  }, [leads, leadErr]);

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
        {/* ── Leads ─────────────────────────────────────────────── */}
        <SectionHeading>Leads</SectionHeading>

        <section aria-label="Lead metrics" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {leadKpis.map((k) => (
            <MetricCard key={k.def.title} {...k} />
          ))}
        </section>

        <section aria-label="Lead distributions" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LeadStagesCard leads={leads} />
          <IcpFitCard leads={leads} />
          <MeetingShowRateCard meetings={meetings} />
        </section>

        <RepBreakdownTable leads={leads} />

        <LeadLists leads={leads} />

        {/* ── Deals ─────────────────────────────────────────────── */}
        <SectionHeading>Deals</SectionHeading>

        <DealStageChart deals={deals} />

        <PipelineValueCard deals={deals} />

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

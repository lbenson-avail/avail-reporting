import { useMemo, useState } from 'react';
import { useMetrics } from '@/hooks/useMetrics';
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
import { TrendChip } from '@/components/dashboard/TrendChip';
import { METRIC_DEFS } from '../../lib/config.js';
import { fmtDays, fmtDaysExact, fmtNum, fmtPct, fmtPctExact } from '@/lib/format';

function SectionHeading({ children }) {
  return (
    <h2 className="text-foreground mt-2 text-base font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  );
}

export default function SalesDashboard() {
  const [range, setRange] = useState(() => presetToRange(buildPresets()[0])); // This month
  const [owner, setOwner] = useState(null);
  const [listsTab, setListsTab] = useState('qualified');

  // "N leads not yet scored" in the ICP card jumps straight to the fix-it list.
  const showUnscored = () => {
    setListsTab('unscored');
    document.getElementById('lead-lists')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const { leads, deals, meetings, previous, lastUpdated, refreshing, refresh } = useMetrics({
    start: range.start,
    end: range.end,
    owner,
  });

  const leadErr = leads.error ? String(leads.error.message) : null;

  const truncated = Boolean(leads.data?.truncated || deals.data?.truncated);

  const leadKpis = useMemo(() => {
    const l = leads.data;
    const pl = previous.leads;
    const pct = (data) =>
      data && data.totalCreated > 0 && data.sqls?.count != null
        ? (data.sqls.count / data.totalCreated) * 100
        : null;
    const qualifiedPct = pct(l);
    return [
      {
        def: METRIC_DEFS.totalLeads,
        value: l ? fmtNum(l.totalCreated) : '—',
        sub: 'Created in selected period',
        trend: (
          <TrendChip
            current={l?.totalCreated}
            previous={pl?.totalCreated}
            detail={pl ? `Previous period: ${fmtNum(pl.totalCreated)} leads` : null}
          />
        ),
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
        trend: (
          <TrendChip
            current={l?.sqls?.count}
            previous={pl?.sqls?.count}
            detail={pl ? `Previous period: ${fmtNum(pl.sqls?.count)} SQLs` : null}
          />
        ),
      },
      {
        def: METRIC_DEFS.qualifiedPct,
        value: fmtPct(qualifiedPct),
        exact: fmtPctExact(qualifiedPct),
        sub: l ? `${fmtNum(l.sqls?.count)} qualified / ${fmtNum(l.totalCreated)} leads` : null,
        trend: (
          <TrendChip
            current={qualifiedPct}
            previous={pct(pl)}
            mode="pts"
            detail={pl ? `Previous period: ${fmtPct(pct(pl))}` : null}
          />
        ),
      },
      {
        def: METRIC_DEFS.speedToLead,
        value: fmtDays(l?.speedToLead?.days),
        exact: fmtDaysExact(l?.speedToLead?.days),
        sub: l ? `n = ${fmtNum(l.speedToLead?.n ?? 0)} leads` : null,
        trend: (
          <TrendChip
            current={l?.speedToLead?.days}
            previous={pl?.speedToLead?.days}
            goodDirection="down"
            detail={pl ? `Previous period: ${fmtDays(pl.speedToLead?.days)}` : null}
          />
        ),
      },
      {
        def: METRIC_DEFS.reachingToConnected,
        value: fmtDays(l?.reachingToConnected?.days),
        exact: fmtDaysExact(l?.reachingToConnected?.days),
        sub: l ? `n = ${fmtNum(l.reachingToConnected?.n ?? 0)} leads` : null,
        trend: (
          <TrendChip
            current={l?.reachingToConnected?.days}
            previous={pl?.reachingToConnected?.days}
            goodDirection="down"
            detail={pl ? `Previous period: ${fmtDays(pl.reachingToConnected?.days)}` : null}
          />
        ),
      },
    ].map((k) => ({ ...k, loading: leads.loading, error: leadErr }));
  }, [leads, previous.leads, leadErr]);

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
          <IcpFitCard leads={leads} onShowUnscored={showUnscored} />
          <MeetingShowRateCard meetings={meetings} previousMeetings={previous.meetings} />
        </section>

        <RepBreakdownTable leads={leads} />

        <LeadLists leads={leads} tab={listsTab} onTabChange={setListsTab} />

        {/* ── Deals ─────────────────────────────────────────────── */}
        <SectionHeading>Deals</SectionHeading>

        <DealStageChart deals={deals} previousDeals={previous.deals} />

        <PipelineValueCard deals={deals} />

        <p className="text-muted-foreground pb-4 text-center text-xs">
          Data refreshes automatically every 5 minutes · HubSpot is the source of truth
        </p>
      </main>
    </div>
  );
}


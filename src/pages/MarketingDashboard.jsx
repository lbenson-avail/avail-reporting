import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Mail, Sprout } from 'lucide-react';
import { GoogleIcon, LinkedInIcon } from '@/components/BrandIcons';
import { useMarketingMetrics } from '@/hooks/useMarketingMetrics';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { TrendChip } from '@/components/dashboard/TrendChip';
import { BarRow } from '@/components/dashboard/BarRow';
import { InfoTip } from '@/components/dashboard/InfoTip';
import { LeadsError } from '@/components/dashboard/LeadsError';
import {
  CapNote,
  LeadLink,
  PaginatedTable,
  ReasonCell,
} from '@/components/dashboard/table-bits';
import { buildPresets, presetToRange } from '@/components/dashboard/DateRangePicker';
import { MARKETING_DEFS, SALES_OWNERS } from '../../lib/config.js';
import { fmtMoneyExact, fmtNum, fmtPct, fmtPctExact } from '@/lib/format';
import { ICP_COLORS, UNSCORED_COLOR } from '@/lib/icpColors';
import { repColor, repName, repShort } from '@/lib/repColors';

function SectionCardHeader({ def, icon }) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {def.title}
        <InfoTip text={def.tooltip} />
      </CardTitle>
    </CardHeader>
  );
}

// Channel card: HubSpot funnel numbers always live. Paid channels also carry
// an ad-platform strip (spend/CPL) that activates when credentials exist,
// otherwise shows why it's absent; organic/offline channels skip the strip.
function ChannelCard({ def, icon, data, adsChannel, showAds = false, prevChannel, loading, error }) {
  const rate = data?.qualifyRate;
  const spend = adsChannel && !adsChannel.unavailable ? adsChannel.spend : null;
  const cpl = spend != null && data?.leads > 0 ? spend / data.leads : null;

  return (
    <Card className="gap-3">
      <SectionCardHeader def={def} icon={icon} />
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : error ? (
          <LeadsError error={error} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Leads
                </p>
                <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold tabular-nums tracking-tight">
                  {fmtNum(data.leads)}
                  <TrendChip
                    current={data.leads}
                    previous={prevChannel?.leads}
                    detail={
                      prevChannel ? `Previous period: ${fmtNum(prevChannel.leads)} leads` : null
                    }
                  />
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Qualified
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                  {fmtNum(data.qbs)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Qualify rate
                </p>
                <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold tabular-nums tracking-tight">
                  {fmtPct(rate)}
                  <TrendChip
                    current={rate}
                    previous={prevChannel?.qualifyRate}
                    mode="pts"
                    detail={
                      prevChannel
                        ? `Previous period: ${fmtPct(prevChannel.qualifyRate)}`
                        : null
                    }
                  />
                </p>
              </div>
            </div>

            {showAds && (
              <div className="mt-4 border-t pt-3">
                {spend != null ? (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Spend</p>
                      <p className="font-medium tabular-nums">{fmtMoneyExact(spend)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">CPL</p>
                      <p className="font-medium tabular-nums">{fmtMoneyExact(cpl)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Impressions</p>
                      <p className="font-medium tabular-nums">{fmtNum(adsChannel.impressions)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    Ad spend not connected
                    <InfoTip
                      text={adsChannel?.reason || 'Ad platform metrics activate once PaidSync is configured in Vercel.'}
                    />
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function MarketingDashboard() {
  const [range, setRange] = useState(() => presetToRange(buildPresets()[0])); // This month (MTD)
  const [owner, setOwner] = useState(null);
  const { marketing, ads, previous, lastUpdated, refreshing, refresh } = useMarketingMetrics({
    start: range.start,
    end: range.end,
    owner,
  });

  const d = marketing.data;
  const prev = previous;
  const err = marketing.error ? String(marketing.error.message) : null;

  const countTrend = (current, previousValue, label, goodDirection = 'up') => (
    <TrendChip
      current={current}
      previous={previousValue}
      goodDirection={goodDirection}
      detail={previousValue != null ? `Previous period: ${fmtNum(previousValue)} ${label}` : null}
    />
  );

  const kpis = [
    {
      def: MARKETING_DEFS.totalLeads,
      value: d ? fmtNum(d.totalLeads.count) : '—',
      sub: d?.totalLeads.duplicates
        ? `${fmtNum(d.totalLeads.duplicates)} duplicate${d.totalLeads.duplicates === 1 ? '' : 's'} merged`
        : 'Created in selected period',
      trend: countTrend(d?.totalLeads.count, prev?.totalLeads?.count, 'leads'),
    },
    {
      def: MARKETING_DEFS.qualifiedBuyers,
      value: d ? fmtNum(d.stages.qualifiedBuyers) : '—',
      sub: d ? `of ${fmtNum(d.totalLeads.count)} leads` : null,
      trend: countTrend(d?.stages.qualifiedBuyers, prev?.stages?.qualifiedBuyers, 'qualified'),
    },
    {
      def: MARKETING_DEFS.opportunities,
      value: d ? fmtNum(d.stages.opportunities) : '—',
      trend: countTrend(d?.stages.opportunities, prev?.stages?.opportunities, 'opportunities'),
    },
    {
      def: MARKETING_DEFS.customers,
      value: d ? fmtNum(d.stages.customers) : '—',
      trend: countTrend(d?.stages.customers, prev?.stages?.customers, 'customers'),
    },
    {
      def: MARKETING_DEFS.disqualified,
      value: d ? fmtNum(d.stages.disqualified) : '—',
      trend: countTrend(d?.stages.disqualified, prev?.stages?.disqualified, 'disqualified', 'down'),
    },
  ].map((k) => ({ ...k, loading: marketing.loading, error: err }));

  const sourceMax = Math.max(1, ...(d?.sources || []).map((s) => s.count), d?.noSource ?? 0);
  const icpMax = Math.max(
    1,
    ...(d?.icpQB?.counts || []).map((c) => c.count),
    d?.icpQB?.unscored ?? 0
  );

  return (
    <div className="bg-background min-h-screen">
      <DashboardHeader
        title="Marketing Dashboard"
        range={range}
        onRangeChange={setRange}
        owner={owner}
        onOwnerChange={setOwner}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRefresh={refresh}
        truncated={Boolean(d?.truncated)}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <section aria-label="Marketing metrics" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => (
            <MetricCard key={k.def.title} {...k} />
          ))}
        </section>

        <section aria-label="Lead attributes" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="gap-3">
            <SectionCardHeader def={MARKETING_DEFS.leadSources} />
            <CardContent>
              {marketing.loading ? (
                <Skeleton className="h-48 w-full" />
              ) : err ? (
                <LeadsError error={marketing.error} />
              ) : (
                <>
                  {d.sources.map((s) => (
                    <BarRow key={s.source} label={s.source} value={s.count} max={sourceMax} />
                  ))}
                  {d.noSource > 0 && (
                    <BarRow
                      label="No source"
                      value={d.noSource}
                      max={sourceMax}
                      color="var(--viz-missing)"
                    />
                  )}
                  {d.otherSource > 0 &&
                    (d.otherSourceValues?.length ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <BarRow
                              label="Other"
                              value={d.otherSource}
                              max={sourceMax}
                              color="var(--muted-foreground)"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-64">
                          Source value{d.otherSourceValues.length === 1 ? '' : 's'} in Other:{' '}
                          {d.otherSourceValues.join(', ')}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <BarRow
                        label="Other"
                        value={d.otherSource}
                        max={sourceMax}
                        color="var(--muted-foreground)"
                      />
                    ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="gap-3">
            <SectionCardHeader def={MARKETING_DEFS.icpQB} />
            <CardContent>
              {marketing.loading ? (
                <Skeleton className="h-40 w-full" />
              ) : err ? (
                <LeadsError error={marketing.error} />
              ) : (
                <>
                  <p className="text-muted-foreground mb-2 text-xs">
                    {fmtNum(d.icpQB.qbTotal)} Qualified Buyers in period
                  </p>
                  {d.icpQB.counts.map((c) => (
                    <BarRow
                      key={c.category}
                      label={c.category}
                      value={c.count}
                      max={icpMax}
                      color={ICP_COLORS[c.category] || UNSCORED_COLOR}
                    />
                  ))}
                  <BarRow
                    label="Unscored"
                    value={d.icpQB.unscored}
                    max={icpMax}
                    color={UNSCORED_COLOR}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="gap-3">
            <SectionCardHeader def={MARKETING_DEFS.leadTypes} />
            <CardContent>
              {marketing.loading ? (
                <Skeleton className="h-24 w-full" />
              ) : err ? (
                <LeadsError error={marketing.error} />
              ) : (
                d.leadTypes.map((t) => (
                  <BarRow
                    key={t.type}
                    label={t.type}
                    value={t.count}
                    max={Math.max(1, ...d.leadTypes.map((x) => x.count))}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="Channels" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChannelCard
            def={MARKETING_DEFS.paidSearch}
            icon={<GoogleIcon />}
            data={d?.channels.paidSearch}
            adsChannel={ads.data?.google}
            showAds
            prevChannel={prev?.channels?.paidSearch}
            loading={marketing.loading}
            error={marketing.error && err}
          />
          <ChannelCard
            def={MARKETING_DEFS.paidSocial}
            icon={<LinkedInIcon />}
            data={d?.channels.paidSocial}
            adsChannel={ads.data?.linkedin}
            showAds
            prevChannel={prev?.channels?.paidSocial}
            loading={marketing.loading}
            error={marketing.error && err}
          />
          <ChannelCard
            def={MARKETING_DEFS.offline}
            icon={<Mail className="text-muted-foreground size-4" aria-hidden="true" />}
            data={d?.channels.offline}
            prevChannel={prev?.channels?.offline}
            loading={marketing.loading}
            error={marketing.error && err}
          />
          <ChannelCard
            def={MARKETING_DEFS.organic}
            icon={<Sprout className="size-4 text-[color:var(--viz-good)]" aria-hidden="true" />}
            data={d?.channels.organic}
            prevChannel={prev?.channels?.organic}
            loading={marketing.loading}
            error={marketing.error && err}
          />
        </section>

        <Card className="gap-3">
          <SectionCardHeader def={MARKETING_DEFS.repBreakdown} />
          <CardContent>
            {marketing.loading ? (
              <Skeleton className="h-32 w-full" />
            ) : err ? (
              <LeadsError error={marketing.error} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rep</TableHead>
                    <TableHead className="text-right">Total leads</TableHead>
                    <TableHead className="text-right">Qualified</TableHead>
                    <TableHead className="text-right">Opportunities</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-right">Disqualified</TableHead>
                    <TableHead className="border-l pl-6 text-right">Paid Search</TableHead>
                    <TableHead className="text-right">Paid Social</TableHead>
                    <TableHead className="text-right">ICP scored</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.perRep.map((r) => (
                    <TableRow key={r.ownerId}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2.5 rounded-full"
                            style={{ background: repColor(r.ownerId) }}
                          />
                          {repName(r.ownerId)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtNum(r.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(r.qualifiedBuyers)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(r.opportunities)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(r.customers)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(r.disqualified)}
                      </TableCell>
                      <TableCell className="border-l pl-6 text-right tabular-nums">
                        {fmtNum(r.paidSearch)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(r.paidSocial)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(r.icpScored)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {MARKETING_DEFS.disqualifiedTable.title}
            </CardTitle>
            <CardDescription className="text-xs">
              {MARKETING_DEFS.disqualifiedTable.tooltip}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {marketing.loading ? (
              <Skeleton className="h-40 w-full" />
            ) : err ? (
              <LeadsError error={marketing.error} />
            ) : (
              <PaginatedTable
                rows={d.disqualifiedList}
                emptyText="No disqualified leads in this period"
                capNote={<CapNote cap={d.listCaps.disqualified} />}
                columns={[
                  {
                    header: 'Company',
                    render: (l) => <LeadLink portalId={d.portalId} lead={l} />,
                    cellClass: 'font-medium',
                  },
                  { header: 'Lead', render: (l) => l.name || '—' },
                  {
                    header: 'Reason',
                    cellClass: 'max-w-64 truncate',
                    render: (l) => <ReasonCell reason={l.reason} notes={l.notes} />,
                  },
                  {
                    header: 'Source',
                    render: (l) =>
                      l.source ? <Badge variant="outline">{l.source}</Badge> : '—',
                  },
                  {
                    header: 'Rep',
                    render: (l) => repShort(l.ownerId),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <p className="text-muted-foreground pb-4 text-center text-xs">
          Trends compare to the previous period of the same length · Scoped to{' '}
          {SALES_OWNERS.map((o) => o.shortName).join(' & ')} · Data refreshes every 5 minutes
        </p>
      </main>
    </div>
  );
}

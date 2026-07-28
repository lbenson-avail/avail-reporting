import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { METRIC_DEFS, SALES_OWNERS } from '../../../lib/config.js';
import { fmtDays, fmtDaysExact, fmtNum, fmtPct, fmtPctExact } from '@/lib/format';
import { REP_COLORS, repShort } from '@/lib/repColors';
import { ExactValue } from './ExactValue';
import { InfoTip } from './InfoTip';
import { TrendChip } from './TrendChip';

// Hover detail: the stage's deals, grouped under each rep with their color dot.
function StageTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const shown = d.deals?.length ?? 0;
  return (
    <div className="bg-popover text-popover-foreground max-w-64 rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="font-medium">
        {d.label} · {fmtNum(d.count)} deal{d.count === 1 ? '' : 's'}
      </p>
      {SALES_OWNERS.map((o, i) => {
        const repDeals = (d.deals || []).filter((deal) => deal.ownerId === o.id);
        if (!repDeals.length) return null;
        return (
          <div key={o.id} className="mt-1.5">
            <p className="flex items-center gap-1.5 font-medium">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ background: REP_COLORS[i] }}
              />
              {o.shortName} ({fmtNum(d.byOwner?.[o.id] ?? repDeals.length)})
            </p>
            <ul className="text-muted-foreground mt-0.5 ml-3.5 list-none">
              {repDeals.map((deal, j) => (
                <li key={j} className="truncate">
                  {deal.name}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {shown < d.count && (
        <p className="text-muted-foreground mt-1.5">+{fmtNum(d.count - shown)} more</p>
      )}
    </div>
  );
}

// Compact stat block for the column beside the chart.
function DealStat({ def, display, exact, trend, sub }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {def.title}
        </span>
        <InfoTip text={def.tooltip} />
      </div>
      <span className="mt-1 flex items-baseline gap-2">
        <ExactValue
          display={display}
          exact={exact}
          className="block text-2xl font-semibold tracking-tight tabular-nums"
        />
        {trend}
      </span>
      {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
    </div>
  );
}

export function DealStageChart({ deals, previousDeals }) {
  const def = METRIC_DEFS.dealStages;
  const d = deals.data;
  const stages = (d?.stageCounts || [])
    .filter((s) => !['Won'].includes(s.short)) // bar graph covers Stage 1→5; won/lost read elsewhere
    .map((s) => ({
      ...s,
      // one stacked series per rep, keyed rep0/rep1 in SALES_OWNERS order
      ...Object.fromEntries(SALES_OWNERS.map((o, i) => [`rep${i}`, s.byOwner?.[o.id] ?? 0])),
    }));

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
          {def.title}
          <InfoTip text={def.tooltip} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deals.loading ? (
          <Skeleton className="h-56 w-full" />
        ) : deals.error ? (
          <p className="text-destructive py-8 text-center text-sm">Deal data unavailable</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
            <div>
            <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stages} margin={{ top: 18, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="short"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <RechartsTooltip content={<StageTooltip />} cursor={{ fill: 'var(--muted)' }} />
                {SALES_OWNERS.map((o, i) => (
                  <Bar
                    key={o.id}
                    dataKey={`rep${i}`}
                    fill={REP_COLORS[i]}
                    maxBarSize={28}
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey={`rep${i}`}
                      position="top"
                      className="fill-foreground"
                      fontSize={11}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
            </div>
            <div className="mt-1 flex items-center justify-center gap-4 text-xs">
              {SALES_OWNERS.map((o, i) => (
                <span key={o.id} className="text-muted-foreground flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ background: REP_COLORS[i] }}
                  />
                  {repShort(o.id)}
                </span>
              ))}
            </div>
            </div>

            <div className="flex flex-col justify-center gap-4 lg:border-l lg:pl-6">
              <DealStat
                def={METRIC_DEFS.speedToClose}
                display={fmtDays(d.speedToClose?.days)}
                exact={fmtDaysExact(d.speedToClose?.days)}
                trend={
                  <TrendChip
                    current={d.speedToClose?.days}
                    previous={previousDeals?.speedToClose?.days}
                    goodDirection="down"
                    detail={
                      previousDeals
                        ? `Previous period: ${fmtDays(previousDeals.speedToClose?.days)}`
                        : null
                    }
                  />
                }
                sub={`n = ${fmtNum(d.speedToClose?.n ?? 0)} of ${fmtNum(d.speedToClose?.wonTotal ?? 0)} won deals`}
              />
              <Separator />
              <DealStat
                def={METRIC_DEFS.pctClose}
                display={fmtPct(d.pctClose?.pct)}
                exact={fmtPctExact(d.pctClose?.pct)}
                trend={
                  <TrendChip
                    current={d.pctClose?.pct}
                    previous={previousDeals?.pctClose?.pct}
                    mode="pts"
                    detail={
                      previousDeals
                        ? `Previous period: ${fmtPct(previousDeals.pctClose?.pct)}`
                        : null
                    }
                  />
                }
                sub={`${fmtNum(d.pctClose?.won)} won / ${fmtNum(d.pctClose?.created)} created`}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

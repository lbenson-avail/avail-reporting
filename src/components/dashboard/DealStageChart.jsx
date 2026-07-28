import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { METRIC_DEFS } from '../../../lib/config.js';
import { fmtNum } from '@/lib/format';
import { InfoTip } from './InfoTip';

// Ordinal ramp — stage order carries the color, light → dark along the funnel.
const RAMP = [
  'var(--viz-ramp-1)',
  'var(--viz-ramp-2)',
  'var(--viz-ramp-3)',
  'var(--viz-ramp-4)',
  'var(--viz-ramp-5)',
];

function StageTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{d.label}</p>
      <p className="text-muted-foreground">
        {fmtNum(d.count)} deal{d.count === 1 ? '' : 's'}
      </p>
    </div>
  );
}

export function DealStageChart({ deals }) {
  const def = METRIC_DEFS.dealStages;
  const stages = (deals.data?.stageCounts || []).filter(
    (s) => !['Won'].includes(s.short) // bar graph covers Stage 1→5; won/lost read elsewhere
  );

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm font-medium">
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
          <div className="h-56">
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
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  <LabelList
                    dataKey="count"
                    position="top"
                    className="fill-foreground"
                    fontSize={12}
                  />
                  {stages.map((s, i) => (
                    <Cell key={s.id} fill={RAMP[i % RAMP.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

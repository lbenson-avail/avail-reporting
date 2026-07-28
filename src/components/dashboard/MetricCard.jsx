import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTip } from './InfoTip';
import { ExactValue } from './ExactValue';
import { cn } from '@/lib/utils';

// Generic KPI card: label + tooltip, one hero figure (rounded, exact on
// hover when `exact` is provided), optional trend chip and sub line.
export function MetricCard({ def, value, exact, trend, sub, loading, error, accentClass, children }) {
  return (
    <Card className="gap-0 py-5">
      <CardContent className="px-5">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {def.title}
          </span>
          <InfoTip text={def.tooltip} />
        </div>
        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : error ? (
            <span className="text-destructive text-sm" title={error}>
              Unavailable
            </span>
          ) : (
            <span className="flex items-baseline gap-2">
              <ExactValue
                display={value}
                exact={exact}
                className={cn('text-2xl font-semibold tracking-tight tabular-nums', accentClass)}
              />
              {trend}
            </span>
          )}
        </div>
        {!loading && !error && sub && (
          <p className="text-muted-foreground mt-1 text-xs">{sub}</p>
        )}
        {!loading && !error && children}
      </CardContent>
    </Card>
  );
}

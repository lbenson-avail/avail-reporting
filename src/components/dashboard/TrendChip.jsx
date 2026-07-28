import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Period-over-period trend indicator. `mode` picks the delta:
//   'pct' — percent change (counts, durations)
//   'pts' — percentage-point difference (metrics that are already percentages)
// `goodDirection` decides which way is green ('down' for time-to-X metrics).
export function TrendChip({ current, previous, goodDirection = 'up', mode = 'pct', detail }) {
  if (
    current == null ||
    previous == null ||
    Number.isNaN(current) ||
    Number.isNaN(previous) ||
    (mode === 'pct' && previous === 0)
  ) {
    return null;
  }

  const delta = mode === 'pts' ? current - previous : ((current - previous) / previous) * 100;
  const flat = Math.abs(delta) < 0.5;
  const improving = goodDirection === 'up' ? delta > 0 : delta < 0;

  const Icon = flat ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const text = flat
    ? 'flat'
    : `${Math.abs(Math.round(delta))}${mode === 'pts' ? ' pts' : '%'}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            'inline-flex cursor-help items-center gap-0.5 rounded-sm text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            flat
              ? 'text-muted-foreground'
              : improving
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
          )}
        >
          <Icon aria-hidden="true" className="size-3" />
          {text}
          <span className="sr-only"> vs previous period</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{detail || 'vs previous period of the same length'}</TooltipContent>
    </Tooltip>
  );
}

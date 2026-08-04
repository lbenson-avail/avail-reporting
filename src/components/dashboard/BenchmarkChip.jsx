import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Comparison against the hardcoded Q1 2026 monthly-average benchmarks.
// Same visual grammar as TrendChip, different comparison basis.
export function BenchmarkChip({ current, benchmark, goodDirection = 'up', mode = 'pct', format }) {
  if (current == null || benchmark == null || Number.isNaN(current) || benchmark === 0) {
    return null;
  }

  const delta = mode === 'pts' ? current - benchmark : ((current - benchmark) / benchmark) * 100;
  const flat = Math.abs(delta) < 0.5;
  const improving = goodDirection === 'up' ? delta > 0 : delta < 0;
  const Icon = flat ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const text = flat ? 'at Q1 avg' : `${Math.abs(Math.round(delta))}${mode === 'pts' ? ' pts' : '%'}`;

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
          <span className="sr-only"> vs Q1 2026 monthly average</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Q1 2026 monthly average: {format ? format(benchmark) : benchmark}
      </TooltipContent>
    </Tooltip>
  );
}

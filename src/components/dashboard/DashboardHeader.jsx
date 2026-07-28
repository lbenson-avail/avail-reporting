import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SALES_OWNERS } from '../../../lib/config.js';
import { timeAgo } from '@/lib/format';
import { DateRangePicker } from './DateRangePicker';
import { cn } from '@/lib/utils';

export function DashboardHeader({
  range,
  onRangeChange,
  owner,
  onOwnerChange,
  lastUpdated,
  refreshing,
  onRefresh,
  truncated,
}) {
  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="mr-auto">
          <h1 className="text-base leading-tight font-semibold">Avail Sales Dashboard</h1>
          <p className="text-muted-foreground text-xs">
            Live from HubSpot · {SALES_OWNERS.map((o) => o.shortName).join(' & ')}
          </p>
        </div>

        {truncated && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[color:var(--viz-warning)] flex items-center gap-1 text-xs font-medium">
                <TriangleAlert className="size-3.5" /> Partial data
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              This range matches more records than the dashboard fetches for detailed breakdowns
              (2,000). Headline counts stay exact; averages and lists reflect the fetched subset.
              Narrow the date range for complete detail.
            </TooltipContent>
          </Tooltip>
        )}

        <Select value={owner || 'all'} onValueChange={(v) => onOwnerChange(v === 'all' ? null : v)}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both reps</SelectItem>
            {SALES_OWNERS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePicker range={range} onChange={onRangeChange} />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
          <span className="text-muted-foreground hidden text-xs whitespace-nowrap sm:inline">
            {refreshing ? 'Updating…' : lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : ''}
          </span>
        </div>
      </div>
    </header>
  );
}

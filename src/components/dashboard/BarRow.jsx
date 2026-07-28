import { fmtNum } from '@/lib/format';

// Label + proportional horizontal bar + value. Single-series comparisons
// where the row label carries identity, so one color is correct.
export function BarRow({ label, value, max, color = 'var(--viz-cat-1)', suffix }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-foreground w-36 shrink-0 truncate text-sm" title={label}>
        {label}
      </span>
      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      <span className="text-foreground w-14 shrink-0 text-right text-sm font-medium tabular-nums">
        {fmtNum(value)}
        {suffix}
      </span>
    </div>
  );
}

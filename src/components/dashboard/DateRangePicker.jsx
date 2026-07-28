import { useMemo, useState } from 'react';
import { CalendarIcon, Check } from 'lucide-react';
import {
  endOfMonth,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

const toParam = (d) => format(d, 'yyyy-MM-dd');

export function buildPresets(now = new Date()) {
  return [
    { key: 'this-month', label: 'This month', start: startOfMonth(now), end: now },
    { key: 'last-30', label: 'Last 30 days', start: subDays(now, 29), end: now },
    { key: 'last-90', label: 'Last 90 days', start: subDays(now, 89), end: now },
    { key: 'qtd', label: 'Quarter to date', start: startOfQuarter(now), end: now },
    { key: 'ytd', label: 'Year to date', start: startOfYear(now), end: now },
    { key: 'all', label: 'All time', start: null, end: null },
  ];
}

export function presetToRange(preset) {
  return {
    key: preset.key,
    label: preset.label,
    start: preset.start ? toParam(preset.start) : null,
    end: preset.end ? toParam(preset.end) : null,
  };
}

export function DateRangePicker({ range, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState();
  const presets = useMemo(() => buildPresets(), []);

  const display =
    range.key === 'custom'
      ? `${format(new Date(`${range.start}T00:00:00`), 'MMM d, yyyy')} – ${format(new Date(`${range.end}T00:00:00`), 'MMM d, yyyy')}`
      : range.label;

  const applyDraft = (selected) => {
    setDraft(selected);
    // First click yields from === to; wait for a second, distinct day.
    if (selected?.from && selected?.to && selected.to.getTime() !== selected.from.getTime()) {
      onChange({
        key: 'custom',
        label: 'Custom',
        start: toParam(selected.from),
        end: toParam(selected.to),
      });
      setOpen(false);
      setDraft(undefined);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-normal">
          <CalendarIcon className="size-4" />
          {display}
        </Button>
      </PopoverTrigger>
      {/* The trigger lives in the sticky header, so below-the-trigger always has
          room; collision flipping mis-measures the two-month calendar and can
          strand the popover off-screen. */}
      <PopoverContent align="end" side="bottom" avoidCollisions={false} className="flex w-auto p-0">
        <div className="flex w-40 flex-col gap-0.5 p-2">
          {presets.map((p) => (
            <Button
              key={p.key}
              variant="ghost"
              size="sm"
              className="justify-start gap-2 font-normal"
              onClick={() => {
                onChange(presetToRange(p));
                setOpen(false);
                setDraft(undefined);
              }}
            >
              <Check className={range.key === p.key ? 'size-4' : 'size-4 opacity-0'} />
              {p.label}
            </Button>
          ))}
        </div>
        <Separator orientation="vertical" className="h-auto" />
        <div className="p-2">
          <p className="text-muted-foreground px-2 pt-1 text-xs">Custom range</p>
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={subDays(new Date(), 30)}
            selected={draft}
            onSelect={applyDraft}
            disabled={{ after: endOfMonth(new Date()) }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

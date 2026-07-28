import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { METRIC_DEFS, MEETING_OUTCOMES } from '../../../lib/config.js';
import { fmtNum, fmtPct } from '@/lib/format';
import { BarRow } from './BarRow';
import { InfoTip } from './InfoTip';

const OUTCOME_LABELS = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  RESCHEDULED: 'Rescheduled',
  NO_SHOW: 'No show',
  CANCELED: 'Canceled',
};

export function MeetingShowRateCard({ meetings }) {
  const def = METRIC_DEFS.meetingShowRate;
  const d = meetings.data;
  const max = Math.max(1, ...MEETING_OUTCOMES.map((o) => d?.counts?.[o] ?? 0));

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          {def.title}
          <InfoTip text={def.tooltip} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {meetings.loading ? (
          <Skeleton className="h-40 w-full" />
        ) : meetings.error ? (
          <p className="text-destructive py-6 text-center text-sm">Meeting data unavailable</p>
        ) : (
          <>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">
                {fmtPct(d.showRate, 0)}
              </span>
              <span className="text-muted-foreground text-xs">
                {fmtNum(d.completed)} of {fmtNum(d.booked)} meetings completed
              </span>
            </div>
            {MEETING_OUTCOMES.map((o) => (
              <BarRow key={o} label={OUTCOME_LABELS[o]} value={d.counts?.[o] ?? 0} max={max} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { METRIC_DEFS, MEETING_OUTCOMES } from '../../../lib/config.js';
import { fmtNum, fmtPct, fmtPctExact } from '@/lib/format';
import { BarRow } from './BarRow';
import { ExactValue } from './ExactValue';
import { InfoTip } from './InfoTip';
import { TrendChip } from './TrendChip';

const OUTCOME_LABELS = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  RESCHEDULED: 'Rescheduled',
  NO_SHOW: 'No show',
  CANCELED: 'Canceled',
};

export function MeetingShowRateCard({ meetings, previousMeetings }) {
  const def = METRIC_DEFS.meetingShowRate;
  const d = meetings.data;
  const max = Math.max(1, d?.missingOutcome ?? 0, ...MEETING_OUTCOMES.map((o) => d?.counts?.[o] ?? 0));

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
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
              <ExactValue
                display={fmtPct(d.showRate)}
                exact={fmtPctExact(d.showRate)}
                className="text-2xl font-semibold tracking-tight tabular-nums"
              />
              <TrendChip
                current={d.showRate}
                previous={previousMeetings?.showRate}
                mode="pts"
                detail={
                  previousMeetings
                    ? `Previous period: ${fmtPct(previousMeetings.showRate)}`
                    : null
                }
              />
              <span className="text-muted-foreground text-xs">
                {fmtNum(d.completed)} of {fmtNum(d.booked)} meetings completed
              </span>
            </div>
            {MEETING_OUTCOMES.map((o) => (
              <BarRow key={o} label={OUTCOME_LABELS[o]} value={d.counts?.[o] ?? 0} max={max} />
            ))}
            {(d.missingOutcome ?? 0) > 0 && (
              <>
                <BarRow
                  label="Missing outcome"
                  value={d.missingOutcome}
                  max={max}
                  color="var(--viz-warning)"
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Missing-outcome meetings aren’t counted in the show rate — set their outcome in
                  HubSpot to include them.
                </p>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

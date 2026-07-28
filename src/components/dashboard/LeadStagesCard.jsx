import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { METRIC_DEFS } from '../../../lib/config.js';
import { fmtNum } from '@/lib/format';
import { BarRow } from './BarRow';
import { InfoTip } from './InfoTip';
import { LeadsError } from './LeadsError';

export function LeadStagesCard({ leads }) {
  const def = METRIC_DEFS.leadStages;
  const stages = leads.data?.stageCounts || [];
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
          {def.title}
          <InfoTip text={def.tooltip} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leads.loading ? (
          <Skeleton className="h-48 w-full" />
        ) : leads.error ? (
          <LeadsError error={leads.error} />
        ) : (
          <>
            <p className="text-muted-foreground mb-2 text-xs">
              {fmtNum(leads.data.totalCreated)} leads created in period
            </p>
            {stages.map((s) => (
              <BarRow key={s.id} label={s.label} value={s.count} max={max} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

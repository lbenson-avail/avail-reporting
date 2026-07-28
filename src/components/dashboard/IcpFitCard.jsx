import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { METRIC_DEFS } from '../../../lib/config.js';
import { fmtNum } from '@/lib/format';
import { BarRow } from './BarRow';
import { InfoTip } from './InfoTip';
import { LeadsError } from './LeadsError';

export function IcpFitCard({ leads }) {
  const def = METRIC_DEFS.icpFits;
  const icp = leads.data?.icp;
  const max = Math.max(1, ...(icp?.counts || []).map((c) => c.count));

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          {def.title}
          <InfoTip text={def.tooltip} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leads.loading ? (
          <Skeleton className="h-40 w-full" />
        ) : leads.error ? (
          <LeadsError error={leads.error} />
        ) : (
          <>
            {icp.counts.map((c) => (
              <BarRow key={c.category} label={c.category} value={c.count} max={max} />
            ))}
            <p className="text-muted-foreground mt-2 text-xs">
              {fmtNum(icp.unscored)} lead{icp.unscored === 1 ? '' : 's'} not yet scored
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

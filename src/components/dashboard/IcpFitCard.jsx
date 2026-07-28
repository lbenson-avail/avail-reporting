import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { METRIC_DEFS } from '../../../lib/config.js';
import { fmtNum } from '@/lib/format';
import { BarRow } from './BarRow';
import { InfoTip } from './InfoTip';
import { LeadsError } from './LeadsError';

export function IcpFitCard({ leads, onShowUnscored }) {
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
            {icp.unscored > 0 ? (
              <button
                type="button"
                onClick={onShowUnscored}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 mt-2 rounded-sm text-xs underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-[3px]"
              >
                {fmtNum(icp.unscored)} lead{icp.unscored === 1 ? '' : 's'} not yet scored — view
                and fix
              </button>
            ) : (
              <p className="text-muted-foreground mt-2 text-xs">Every lead is scored</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { METRIC_DEFS, SALES_OWNERS } from '../../../lib/config.js';
import { fmtNum, fmtPct } from '@/lib/format';
import { InfoTip } from './InfoTip';
import { LeadsError } from './LeadsError';

// Rep identity color follows the entity: slot 1 = first owner, slot 2 = second,
// regardless of filters — with the rep's name always beside the dot.
const REP_COLORS = ['var(--viz-cat-1)', 'var(--viz-cat-2)'];
const repColor = (ownerId) =>
  REP_COLORS[SALES_OWNERS.findIndex((o) => o.id === ownerId)] ?? 'var(--muted-foreground)';

const ownerName = (ownerId) => SALES_OWNERS.find((o) => o.id === ownerId)?.name || ownerId;

export function RepBreakdownTable({ leads }) {
  const def = METRIC_DEFS.repBreakdown;
  const rows = leads.data?.repBreakdown || [];
  const stages = leads.data?.stageCounts || [];

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
          <Skeleton className="h-32 w-full" />
        ) : leads.error ? (
          <LeadsError error={leads.error} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep</TableHead>
                <TableHead className="text-right">Leads created</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">SQLs</TableHead>
                {stages.map((s) => (
                  <TableHead key={s.id} className="text-right">
                    {s.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.ownerId}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full"
                        style={{ background: repColor(r.ownerId) }}
                      />
                      {ownerName(r.ownerId)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {fmtNum(r.created)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(r.share, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.sqls == null ? '—' : fmtNum(r.sqls)}
                  </TableCell>
                  {r.stageCounts.map((s) => (
                    <TableCell key={s.id} className="text-right tabular-nums">
                      {fmtNum(s.count)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

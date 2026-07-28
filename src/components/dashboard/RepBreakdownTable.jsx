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
  const columns = leads.data?.repFunnelColumns || [];

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
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-right">Leads created</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c.role} className="text-right">
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const byRole = new Map((r.funnel || []).map((f) => [f.role, f.count]));
                  return (
                    <TableRow key={r.ownerId}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2.5 rounded-full"
                            style={{ background: repColor(r.ownerId) }}
                          />
                          {ownerName(r.ownerId)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtNum(r.created)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPct(r.share)}
                      </TableCell>
                      {columns.map((c) => (
                        <TableCell key={c.role} className="text-right tabular-nums">
                          {fmtNum(byRole.get(c.role) ?? 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-muted-foreground mt-2 text-xs">
              Stage columns count leads that have <em>ever reached</em> that stage in their
              journey — not where they sit today — so the row reads as a funnel and Qualified
              matches the SQL count.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { METRIC_DEFS } from '../../../lib/config.js';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { InfoTip } from './InfoTip';

export function PipelineValueCard({ deals }) {
  const def = METRIC_DEFS.blendedValue;
  const blended = deals.data?.blended;
  const counts = new Map((deals.data?.stageCounts || []).map((s) => [s.id, s.count]));

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          {def.title}
          <InfoTip text={def.tooltip} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deals.loading ? (
          <Skeleton className="h-56 w-full" />
        ) : deals.error || !blended ? (
          <p className="text-destructive py-8 text-center text-sm">Deal data unavailable</p>
        ) : (
          <>
            <div className="mb-4 flex items-baseline gap-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {fmtMoney(blended.totalWeighted)}
                </p>
                <p className="text-muted-foreground text-xs">weighted (incl. won)</p>
              </div>
              <div>
                <p className="text-lg font-medium">{fmtMoney(blended.totalRaw)}</p>
                <p className="text-muted-foreground text-xs">raw est. annual spend</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Raw</TableHead>
                  <TableHead className="text-right">Weighted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blended.byStage.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNum(counts.get(row.id) ?? 0)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {fmtPct(row.weight * 100, 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(row.raw)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {fmtMoney(row.weighted)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(blended.totalRaw)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(blended.totalWeighted)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

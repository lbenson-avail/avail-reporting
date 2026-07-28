import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { METRIC_DEFS, SALES_OWNERS, LIST_PAGE_SIZES } from '../../../lib/config.js';
import { fmtDate, fmtNum } from '@/lib/format';
import { InfoTip } from './InfoTip';
import { LeadsError } from './LeadsError';

const ownerShort = (ownerId) => SALES_OWNERS.find((o) => o.id === ownerId)?.shortName || '—';

const ICP_BADGE = {
  'Strong Fit': 'default',
  'Moderate Fit': 'secondary',
  'Weak Fit': 'outline',
  'Not a Fit': 'outline',
};

// Client-side paginated table shared by the three lead lists.
function PaginatedTable({ rows, columns, emptyText, capNote }) {
  const [pageSize, setPageSize] = useState(LIST_PAGE_SIZES[0]);
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    if (page > pageCount - 1) setPage(0);
  }, [pageCount, page]);

  const start = page * pageSize;
  const visible = rows.slice(start, start + pageSize);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.header} className={c.headClass}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground py-6 text-center"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          )}
          {visible.map((row) => (
            <TableRow key={row.id}>
              {columns.map((c) => (
                <TableCell key={c.header} className={c.cellClass}>
                  {c.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(0);
            }}
          >
            <SelectTrigger size="sm" aria-label="Rows per page" className="h-7 gap-1 px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIST_PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {rows.length === 0
              ? '0 of 0'
              : `${fmtNum(start + 1)}–${fmtNum(Math.min(start + pageSize, rows.length))} of ${fmtNum(rows.length)}`}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Next page"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
      {capNote}
    </>
  );
}

function CapNote({ cap }) {
  if (!cap || cap.shown >= cap.total) return null;
  return (
    <p className="text-muted-foreground mt-2 text-xs">
      The dashboard fetched {fmtNum(cap.shown)} of {fmtNum(cap.total)} — narrow the date range to
      see all.
    </p>
  );
}

const icpCell = (l) =>
  l.icpFit ? (
    <Badge variant={ICP_BADGE[l.icpFit] || 'outline'}>{l.icpFit}</Badge>
  ) : (
    <span className="text-muted-foreground">Unscored</span>
  );

export function LeadLists({ leads }) {
  const d = leads.data;

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Lead Lists</CardTitle>
      </CardHeader>
      <CardContent>
        {leads.loading ? (
          <Skeleton className="h-56 w-full" />
        ) : leads.error ? (
          <LeadsError error={leads.error} />
        ) : (
          <Tabs defaultValue="qualified">
            <TabsList>
              <TabsTrigger value="qualified">
                Qualified ({fmtNum(d.listCaps.qualified.total)})
              </TabsTrigger>
              <TabsTrigger value="disqualified">
                Disqualified ({fmtNum(d.listCaps.disqualified.total)})
              </TabsTrigger>
              <TabsTrigger value="unscored">
                Unscored ({fmtNum(d.listCaps.unscored?.total)})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qualified">
              <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
                {METRIC_DEFS.qualifiedList.tooltip}
              </div>
              <PaginatedTable
                rows={d.qualifiedList}
                emptyText="No qualified leads in this period"
                capNote={<CapNote cap={d.listCaps.qualified} />}
                columns={[
                  { header: 'Company', render: (l) => l.company || '—', cellClass: 'font-medium' },
                  { header: 'Lead', render: (l) => l.name || '—' },
                  { header: 'ICP Fit', render: icpCell },
                  { header: 'Rep', render: (l) => ownerShort(l.ownerId) },
                  {
                    header: 'Qualified',
                    headClass: 'text-right',
                    cellClass: 'text-right tabular-nums',
                    render: (l) => fmtDate(l.qualifiedAt),
                  },
                ]}
              />
            </TabsContent>

            <TabsContent value="disqualified">
              <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
                {METRIC_DEFS.disqualifiedList.tooltip}
              </div>
              <PaginatedTable
                rows={d.disqualifiedList}
                emptyText="No disqualified leads in this period"
                capNote={<CapNote cap={d.listCaps.disqualified} />}
                columns={[
                  { header: 'Company', render: (l) => l.company || '—', cellClass: 'font-medium' },
                  { header: 'Lead', render: (l) => l.name || '—' },
                  {
                    header: 'Reason',
                    cellClass: 'max-w-72 truncate',
                    render: (l) =>
                      l.reason || <span className="text-muted-foreground">No reason entered</span>,
                  },
                  { header: 'Rep', render: (l) => ownerShort(l.ownerId) },
                ]}
              />
            </TabsContent>

            <TabsContent value="unscored">
              <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
                {METRIC_DEFS.unscoredList.tooltip}
                <InfoTip text={METRIC_DEFS.unscoredList.tooltip} />
              </div>
              <PaginatedTable
                rows={d.unscoredList || []}
                emptyText="Every lead in this period has an ICP score"
                capNote={<CapNote cap={d.listCaps.unscored} />}
                columns={[
                  { header: 'Company', render: (l) => l.company || '—', cellClass: 'font-medium' },
                  { header: 'Lead', render: (l) => l.name || '—' },
                  {
                    header: 'Current Stage',
                    render: (l) =>
                      l.stageLabel ? (
                        <Badge variant="outline">{l.stageLabel}</Badge>
                      ) : (
                        '—'
                      ),
                  },
                  { header: 'Rep', render: (l) => ownerShort(l.ownerId) },
                ]}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

// Shared table building blocks for lead-list style tables: client-side
// pagination, HubSpot record deep-links, and reason-with-notes hover cells.

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LIST_PAGE_SIZES } from '../../../lib/config.js';
import { fmtNum } from '@/lib/format';

const leadUrl = (portalId, leadId) =>
  portalId ? `https://app.hubspot.com/contacts/${portalId}/record/0-136/${leadId}` : null;

// Deep link to the lead record in HubSpot (0-136 = Leads object) so reps can
// fix missing companies, reasons, and ICP scores in one click.

export function LeadLink({ portalId, lead }) {
  const url = leadUrl(portalId, lead.id);
  const label = lead.company || lead.name || 'Unnamed lead';
  if (!url) return <>{label}</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-primary focus-visible:ring-ring/50 group inline-flex items-center gap-1 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
      aria-label={`Open ${label} in HubSpot (new tab)`}
    >
      {lead.company || <span className="text-muted-foreground group-hover:text-primary">Add company</span>}
      <ExternalLink aria-hidden="true" className="size-3 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
    </a>
  );
}

// Disqualification reason with the rep's typed notes on hover.
export function ReasonCell({ reason, notes }) {
  if (!reason && !notes) {
    return <span className="text-muted-foreground">No reason entered</span>;
  }
  const label = reason || 'See notes';
  if (!notes && (reason?.length ?? 0) <= 40) return <>{label}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-sm"
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        {reason && <p className="font-medium">{reason}</p>}
        {notes && <p className={reason ? 'mt-1' : ''}>{notes}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

// Client-side paginated table shared by the three lead lists.
export function PaginatedTable({ rows, columns, emptyText, capNote }) {
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

export function CapNote({ cap }) {
  if (!cap || cap.shown >= cap.total) return null;
  return (
    <p className="text-muted-foreground mt-2 text-xs">
      The dashboard fetched {fmtNum(cap.shown)} of {fmtNum(cap.total)} — narrow the date range to
      see all.
    </p>
  );
}

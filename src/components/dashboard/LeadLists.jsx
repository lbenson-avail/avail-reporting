import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { METRIC_DEFS, SALES_OWNERS } from '../../../lib/config.js';
import { fmtDate, fmtNum } from '@/lib/format';
import { InfoTip } from './InfoTip';
import { LeadsError } from './LeadsError';

const ownerShort = (ownerId) =>
  SALES_OWNERS.find((o) => o.id === ownerId)?.shortName || '—';

const ICP_BADGE = {
  'Strong Fit': 'default',
  'Moderate Fit': 'secondary',
  'Weak Fit': 'outline',
  'Not a Fit': 'outline',
};

function CapNote({ cap }) {
  if (!cap || cap.shown >= cap.total) return null;
  return (
    <p className="text-muted-foreground mt-2 text-xs">
      Showing {fmtNum(cap.shown)} of {fmtNum(cap.total)} — narrow the date range to see all.
    </p>
  );
}

export function LeadLists({ leads }) {
  const qDef = METRIC_DEFS.qualifiedList;
  const dDef = METRIC_DEFS.disqualifiedList;
  const d = leads.data;

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Qualified & Disqualified Leads</CardTitle>
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
            </TabsList>

            <TabsContent value="qualified">
              <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
                {qDef.tooltip}
                <InfoTip text={qDef.tooltip} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>ICP Fit</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead className="text-right">Qualified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.qualifiedList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                        No qualified leads in this period
                      </TableCell>
                    </TableRow>
                  )}
                  {d.qualifiedList.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.company || '—'}</TableCell>
                      <TableCell>{l.name || '—'}</TableCell>
                      <TableCell>
                        {l.icpFit ? (
                          <Badge variant={ICP_BADGE[l.icpFit] || 'outline'}>{l.icpFit}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Unscored</span>
                        )}
                      </TableCell>
                      <TableCell>{ownerShort(l.ownerId)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtDate(l.qualifiedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <CapNote cap={d.listCaps.qualified} />
            </TabsContent>

            <TabsContent value="disqualified">
              <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
                {dDef.tooltip}
                <InfoTip text={dDef.tooltip} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Rep</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.disqualifiedList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                        No disqualified leads in this period
                      </TableCell>
                    </TableRow>
                  )}
                  {d.disqualifiedList.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.company || '—'}</TableCell>
                      <TableCell>{l.name || '—'}</TableCell>
                      <TableCell className="max-w-72 truncate" title={l.reason || ''}>
                        {l.reason || <span className="text-muted-foreground">No reason entered</span>}
                      </TableCell>
                      <TableCell>{ownerShort(l.ownerId)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <CapNote cap={d.listCaps.disqualified} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

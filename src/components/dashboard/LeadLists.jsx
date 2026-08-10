import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { METRIC_DEFS, SALES_OWNERS } from '../../../lib/config.js';
import { fmtDate, fmtNum } from '@/lib/format';
import { ICP_COLORS, UNSCORED_COLOR, icpPillStyle } from '@/lib/icpColors';
import { LeadsError } from './LeadsError';
import { CapNote, LeadLink, PaginatedTable, ReasonCell } from './table-bits';

const ownerShort = (ownerId) => SALES_OWNERS.find((o) => o.id === ownerId)?.shortName || '—';




const sourceCell = (l) =>
  l.source ? <Badge variant="outline">{l.source}</Badge> : <span className="text-muted-foreground">—</span>;

// Pills wear the exact same tokens as the ICP Fit Ratings bars.
const icpCell = (l) =>
  l.icpFit ? (
    <Badge
      variant="outline"
      className="border-transparent font-medium"
      style={icpPillStyle(ICP_COLORS[l.icpFit] || UNSCORED_COLOR)}
    >
      {l.icpFit}
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent">
      Unscored
    </Badge>
  );


export function LeadLists({ leads, tab, onTabChange }) {
  const d = leads.data;
  const portalId = d?.portalId;

  const activeDef = {
    qualified: METRIC_DEFS.qualifiedList,
    disqualified: METRIC_DEFS.disqualifiedList,
    unscored: METRIC_DEFS.unscoredList,
  }[tab];

  return (
    <Card className="gap-3" id="lead-lists">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Lead Lists</CardTitle>
        {activeDef && <CardDescription className="text-xs">{activeDef.tooltip}</CardDescription>}
      </CardHeader>
      <CardContent>
        {leads.loading ? (
          <Skeleton className="h-56 w-full" />
        ) : leads.error ? (
          <LeadsError error={leads.error} />
        ) : (
          <Tabs value={tab} onValueChange={onTabChange}>
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
              <PaginatedTable
                rows={d.qualifiedList}
                emptyText="No qualified leads in this period"
                capNote={<CapNote cap={d.listCaps.qualified} />}
                columns={[
                  {
                    header: 'Company',
                    render: (l) => <LeadLink portalId={portalId} lead={l} />,
                    cellClass: 'font-medium',
                  },
                  { header: 'Lead', render: (l) => l.name || '—' },
                  { header: 'ICP Fit', render: icpCell },
                  { header: 'Source', render: sourceCell },
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
              <PaginatedTable
                rows={d.disqualifiedList}
                emptyText="No disqualified leads in this period"
                capNote={<CapNote cap={d.listCaps.disqualified} />}
                columns={[
                  {
                    header: 'Company',
                    render: (l) => <LeadLink portalId={portalId} lead={l} />,
                    cellClass: 'font-medium',
                  },
                  { header: 'Lead', render: (l) => l.name || '—' },
                  {
                    header: 'Reason',
                    cellClass: 'max-w-72 truncate',
                    render: (l) => <ReasonCell reason={l.reason} notes={l.notes} />,
                  },
                  { header: 'Source', render: sourceCell },
                  { header: 'Rep', render: (l) => ownerShort(l.ownerId) },
                ]}
              />
            </TabsContent>

            <TabsContent value="unscored">
              <PaginatedTable
                rows={d.unscoredList || []}
                emptyText="Every lead in this period has an ICP score"
                capNote={<CapNote cap={d.listCaps.unscored} />}
                columns={[
                  {
                    header: 'Company',
                    render: (l) => <LeadLink portalId={portalId} lead={l} />,
                    cellClass: 'font-medium',
                  },
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
                  { header: 'Source', render: sourceCell },
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

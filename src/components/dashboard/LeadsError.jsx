import { TriangleAlert } from 'lucide-react';

// Friendly in-card explanation when the Leads endpoint fails — most likely
// the HubSpot token missing the Leads scope.
export function LeadsError({ error }) {
  const isAccess = error?.body?.error === 'hubspot_access';
  return (
    <div className="flex items-start gap-2 py-4 text-sm">
      <TriangleAlert className="text-[color:var(--viz-warning)] mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">Lead data unavailable</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {isAccess
            ? 'The HubSpot token can’t read the Leads object. Grant the private app the crm.objects.leads.read scope.'
            : String(error?.message || 'Request failed')}
        </p>
      </div>
    </div>
  );
}

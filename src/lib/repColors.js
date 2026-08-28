import { SALES_OWNERS } from '../../lib/config.js';

// Rep identity colors are fixed to the owner, not the row order, so the same
// rep is the same color in every chart and table.
export const REP_COLORS = ['var(--viz-cat-1)', 'var(--viz-cat-2)', 'var(--viz-cat-3)'];

export const repColor = (ownerId) =>
  REP_COLORS[SALES_OWNERS.findIndex((o) => o.id === ownerId)] ?? 'var(--muted-foreground)';

export const repName = (ownerId) => SALES_OWNERS.find((o) => o.id === ownerId)?.name || ownerId;

export const repShort = (ownerId) =>
  SALES_OWNERS.find((o) => o.id === ownerId)?.shortName || ownerId;

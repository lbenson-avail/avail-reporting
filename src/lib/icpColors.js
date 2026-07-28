// ICP fit colors — single source shared by the ratings bars and the list
// pills so the two views always match. Values are theme-aware CSS variables
// defined in index.css.
export const ICP_COLORS = {
  'Strong Fit': 'var(--viz-good)',
  'Moderate Fit': 'var(--viz-warning)',
  'Weak Fit': 'var(--viz-lost)',
  'Not a Fit': 'var(--viz-bad-dark)',
};

export const UNSCORED_COLOR = 'var(--muted-foreground)';

// Tinted-pill styling derived from the same token: soft wash background,
// full-strength text. Label always accompanies the color.
export const icpPillStyle = (color) => ({
  background: `color-mix(in srgb, ${color} 13%, transparent)`,
  color: `color-mix(in srgb, ${color} 85%, var(--foreground))`,
});

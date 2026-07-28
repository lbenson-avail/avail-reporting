export function fmtMoney(n, { compact = true } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  if (compact && Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (compact && Math.abs(n) >= 10_000) {
    return `$${Math.round(n / 1000).toLocaleString()}K`;
  }
  return `$${Math.round(n).toLocaleString()}`;
}

export function fmtNum(n) {
  return n == null || Number.isNaN(n) ? '—' : n.toLocaleString();
}

export function fmtPct(n, digits = 1) {
  return n == null || Number.isNaN(n) ? '—' : `${n.toFixed(digits)}%`;
}

// Duration given in days: renders hours below 2 days, days otherwise.
export function fmtDays(days) {
  if (days == null || Number.isNaN(days)) return '—';
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)} min`;
  if (days < 2) return `${(days * 24).toFixed(1)} hrs`;
  return `${days.toFixed(1)} days`;
}

export function timeAgo(date) {
  if (!date) return '';
  const s = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

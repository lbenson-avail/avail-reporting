import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '@/lib/api';
import { POLL_INTERVAL_MS } from '../../lib/config.js';

const ENDPOINTS = {
  leads: '/api/metrics/leads',
  deals: '/api/metrics/deals',
  meetings: '/api/metrics/meetings',
};

const initialSection = { data: null, error: null, loading: true };

// The window of the same length immediately before [start, end] — the
// comparison period for trend indicators. Null for all-time.
export function previousRange(start, end) {
  if (!start || !end) return null;
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const days = Math.round((e - s) / 86400000) + 1;
  const prevEnd = new Date(s);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(prevStart), end: iso(prevEnd) };
}

// Fetches all three metric endpoints for the given filters; keeps each
// section's state independent so one failure doesn't blank the page.
// Auto-refreshes on an interval and when the tab regains focus.
export function useMetrics({ start, end, owner }) {
  const [sections, setSections] = useState({
    leads: initialSection,
    deals: initialSection,
    meetings: initialSection,
  });
  const [previous, setPrevious] = useState({ leads: null, deals: null, meetings: null });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const lastParamsKey = useRef(null);

  const prevRange = useMemo(() => previousRange(start, end), [start, end]);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    // Background refreshes (poll / tab focus) keep the current data mounted —
    // only a filter change or first load shows skeletons. Unmounting tables
    // mid-session would reset their pagination state.
    const paramsKey = `${start}|${end}|${owner}`;
    const hard = lastParamsKey.current !== paramsKey;
    lastParamsKey.current = paramsKey;
    setRefreshing(true);
    setSections((prev) => ({
      leads: { ...prev.leads, loading: hard || !prev.leads.data },
      deals: { ...prev.deals, loading: hard || !prev.deals.data },
      meetings: { ...prev.meetings, loading: hard || !prev.meetings.data },
    }));
    if (hard) setPrevious({ leads: null, deals: null, meetings: null });

    const params = { start, end, owner };
    await Promise.all([
      ...Object.entries(ENDPOINTS).map(async ([name, path]) => {
        try {
          const data = await fetchJson(path, params);
          if (generation.current !== gen) return;
          setSections((prev) => ({ ...prev, [name]: { data, error: null, loading: false } }));
        } catch (err) {
          if (generation.current !== gen) return;
          setSections((prev) => ({
            ...prev,
            [name]: { data: prev[name].data, error: err, loading: false },
          }));
        }
      }),
      // Previous period, for trends — best effort, never blocks the page.
      ...(prevRange
        ? Object.entries(ENDPOINTS).map(async ([name, path]) => {
            try {
              const data = await fetchJson(path, { ...prevRange, owner });
              if (generation.current !== gen) return;
              setPrevious((prev) => ({ ...prev, [name]: data }));
            } catch {
              /* no trend for this section */
            }
          })
        : []),
    ]);

    if (generation.current === gen) {
      setLastUpdated(new Date());
      setRefreshing(false);
    }
  }, [start, end, owner, prevRange]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { ...sections, previous, lastUpdated, refreshing, refresh: load };
}

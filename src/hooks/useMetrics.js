import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson } from '@/lib/api';
import { POLL_INTERVAL_MS } from '../../lib/config.js';

const ENDPOINTS = {
  leads: '/api/metrics/leads',
  deals: '/api/metrics/deals',
  meetings: '/api/metrics/meetings',
};

const initialSection = { data: null, error: null, loading: true };

// Fetches all three metric endpoints for the given filters; keeps each
// section's state independent so one failure doesn't blank the page.
// Auto-refreshes on an interval and when the tab regains focus.
export function useMetrics({ start, end, owner }) {
  const [sections, setSections] = useState({
    leads: initialSection,
    deals: initialSection,
    meetings: initialSection,
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    setRefreshing(true);
    setSections((prev) => ({
      leads: { ...prev.leads, loading: true },
      deals: { ...prev.deals, loading: true },
      meetings: { ...prev.meetings, loading: true },
    }));

    const params = { start, end, owner };
    await Promise.all(
      Object.entries(ENDPOINTS).map(async ([name, path]) => {
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
      })
    );

    if (generation.current === gen) {
      setLastUpdated(new Date());
      setRefreshing(false);
    }
  }, [start, end, owner]);

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

  return { ...sections, lastUpdated, refreshing, refresh: load };
}

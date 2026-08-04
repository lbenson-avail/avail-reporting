import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson } from '@/lib/api';
import { POLL_INTERVAL_MS } from '../../lib/config.js';

const initial = { data: null, error: null, loading: true };

// Marketing page data: the HubSpot marketing rollup plus the ad-platform
// metrics, fetched independently so an ads outage never blanks lead data.
export function useMarketingMetrics({ start, end, owner }) {
  const [marketing, setMarketing] = useState(initial);
  const [ads, setAds] = useState(initial);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    setRefreshing(true);
    setMarketing((prev) => ({ ...prev, loading: true }));
    setAds((prev) => ({ ...prev, loading: true }));

    const params = { start, end, owner };
    await Promise.all([
      fetchJson('/api/metrics/marketing', params)
        .then((data) => {
          if (generation.current === gen) setMarketing({ data, error: null, loading: false });
        })
        .catch((err) => {
          if (generation.current === gen)
            setMarketing((prev) => ({ data: prev.data, error: err, loading: false }));
        }),
      fetchJson('/api/metrics/ads', params)
        .then((data) => {
          if (generation.current === gen) setAds({ data, error: null, loading: false });
        })
        .catch((err) => {
          if (generation.current === gen)
            setAds((prev) => ({ data: prev.data, error: err, loading: false }));
        }),
    ]);

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

  return { marketing, ads, lastUpdated, refreshing, refresh: load };
}

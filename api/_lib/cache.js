import { SERVER_CACHE_TTL_MS } from '../../lib/config.js';

// Best-effort per-lambda-instance cache: absorbs the whole team polling the
// same range at once. A cold instance just refetches.
const store = new Map();

export async function cached(key, fn) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < SERVER_CACHE_TTL_MS) return hit.value;
  const value = await fn();
  store.set(key, { value, at: Date.now() });
  return value;
}

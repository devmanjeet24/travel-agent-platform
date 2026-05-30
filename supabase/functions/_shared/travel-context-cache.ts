/** Short-lived in-memory cache for expensive travel API aggregation. */

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 48;

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

export function travelContextCacheKey(input: Record<string, unknown>): string {
  return JSON.stringify(input);
}

export function getCachedTravelContext(key: string): string | undefined {
  pruneExpired();
  const hit = cache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) {
    if (hit) cache.delete(key);
    return undefined;
  }
  return hit.value;
}

export function setCachedTravelContext(
  key: string,
  value: string,
  ttlMs = DEFAULT_TTL_MS,
): void {
  pruneExpired();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300', 10);
const MAX_CACHE_SIZE = parseInt(process.env.CACHE_MAX_SIZE || '500', 10);

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  hits: number;
}

const store = new Map<string, CacheEntry<unknown>>();

function getKey(url: string, params?: Record<string, string>): string {
  if (!params) return url;
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${url}?${sorted}`;
}

export function get<T>(url: string, params?: Record<string, string>): T | null {
  const key = getKey(url, params);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  entry.hits++;
  return entry.data as T;
}

export function set<T>(
  url: string,
  data: T,
  params?: Record<string, string>,
  ttl: number = CACHE_TTL
): void {
  const key = getKey(url, params);
  store.set(key, {
    data,
    expiresAt: Date.now() + ttl * 1000,
    hits: 0,
  });
  evictIfNeeded();
}

export function setWithTTL<T>(url: string, data: T, ttlSeconds: number): void {
  set(url, data, undefined, ttlSeconds);
}

function evictIfNeeded(): void {
  if (store.size <= MAX_CACHE_SIZE) return;

  const entries = Array.from(store.entries())
    .map(([key, entry]) => ({ key, entry }))
    .sort((a, b) => {
      const aExpired = Date.now() > a.entry.expiresAt ? 1 : 0;
      const bExpired = Date.now() > b.entry.expiresAt ? 1 : 0;
      if (aExpired !== bExpired) return bExpired - aExpired;
      return a.entry.hits - b.entry.hits;
    });

  const toDelete = store.size - MAX_CACHE_SIZE;
  for (let i = 0; i < toDelete && i < entries.length; i++) {
    store.delete(entries[i].key);
  }
}

export function clear(): void {
  store.clear();
}

export function getCacheSize(): number {
  return store.size;
}

export function getCacheStats(): { size: number; maxSize: number; ttl: number } {
  return { size: store.size, maxSize: MAX_CACHE_SIZE, ttl: CACHE_TTL };
}

export function has(url: string, params?: Record<string, string>): boolean {
  return get(url, params) !== null;
}

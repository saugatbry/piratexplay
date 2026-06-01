const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300', 10);

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
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
  });

  if (store.size > 500) {
    const oldest = store.entries().next();
    if (!oldest.done) {
      store.delete(oldest.value[0]);
    }
  }
}

export function clear(): void {
  store.clear();
}

export function getCacheSize(): number {
  return store.size;
}

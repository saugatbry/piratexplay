const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10);

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const ipMap = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  ip: string
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = ipMap.get(ip);

  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetTime: now + WINDOW_MS };
  }

  if (entry.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetAt,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.count,
    resetTime: entry.resetAt,
  };
}

export function getRateLimitHeaders(ip: string): Record<string, string> {
  const status = checkRateLimit(ip);
  const max = MAX_REQUESTS;
  const remaining = status.allowed ? status.remaining : 0;
  const reset = Math.ceil((status.resetTime - Date.now()) / 1000);
  return {
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  };
}

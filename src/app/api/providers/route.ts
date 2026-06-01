import { NextRequest, NextResponse } from 'next/server';
import { providers } from '@/utils/fingerprint';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateCheck = checkRateLimit(ip);
  const headers = getRateLimitHeaders(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429, headers });
  }

  const known = providers
    .filter((p) => p.name !== 'Unknown')
    .map((p) => ({ name: p.name, domains: p.domains }));

  return NextResponse.json({ providers: known, total: known.length }, { headers });
}

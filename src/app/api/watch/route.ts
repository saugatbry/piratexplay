import { NextRequest, NextResponse } from 'next/server';
import { scrapeWatch } from '@/lib/scraper';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { normalizeId } from '@/utils/slug';
import { WatchResponse } from '@/types';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateCheck = checkRateLimit(ip);
  const headers = getRateLimitHeaders(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429, headers });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Query parameter "id" is required.' }, { status: 400, headers });
  }

  try {
    const url = normalizeId(id);
    const data = await scrapeWatch(url);
    if (!data.success) {
      return NextResponse.json(
        { error: 'No sources found. Pre-scrape locally: node scripts/refresh.mjs', ...data },
        { status: 503, headers }
      );
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Watch API]', error);
    return NextResponse.json(
      { error: 'Failed to fetch watch sources. Pre-scrape locally: node scripts/refresh.mjs', details: String(error) },
      { status: 503, headers }
    );
  }
}

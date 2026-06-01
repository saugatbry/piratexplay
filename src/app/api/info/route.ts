import { NextRequest, NextResponse } from 'next/server';
import { scrapeInfo } from '@/lib/scraper';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { normalizeId, slugFromUrl } from '@/utils/slug';
import { readDataFile, infoDataPath } from '@/lib/data';
import { InfoResponse } from '@/types';

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

  const slug = slugFromUrl(id);
  const url = normalizeId(id);

  // 1. Try pre-scraped data
  if (slug) {
    const cached = readDataFile<InfoResponse>(infoDataPath(slug));
    if (cached?.title) {
      return NextResponse.json({ ...cached, _source: 'pre-scraped' }, { headers });
    }
  }

  // 2. Fall back to live scraping
  try {
    const data = await scrapeInfo(url);
    if (data.title) {
      return NextResponse.json({ ...data, _source: 'live' }, { headers });
    }
    return NextResponse.json(
      { error: 'Content unavailable. Pre-scrape it locally.', ...data },
      { status: 503, headers }
    );
  } catch (error) {
    console.error('[Info API]', error);
    return NextResponse.json(
      { error: 'Failed to fetch info. Pre-scrape locally: node scripts/refresh.mjs', details: String(error) },
      { status: 503, headers }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { scrapeSearch } from '@/lib/scraper';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { readDataFile, searchDataPath } from '@/lib/data';
import { SearchResponse } from '@/types';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateCheck = checkRateLimit(ip);
  const headers = getRateLimitHeaders(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429, headers });
  }

  const q = request.nextUrl.searchParams.get('q');
  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter "q" is required.' }, { status: 400, headers });
  }

  const query = q.trim();

  // 1. Try pre-scraped data
  const cached = readDataFile<SearchResponse>(searchDataPath(query));
  if (cached?.results?.length) {
    return NextResponse.json({ ...cached, _source: 'pre-scraped' }, { headers });
  }

  // 2. Fall back to live scraping
  try {
    const data = await scrapeSearch(query);
    if (data.results?.length) {
      return NextResponse.json({ ...data, _source: 'live' }, { headers });
    }
    return NextResponse.json(
      { error: `No results for "${query}". Pre-scrape it locally: node scripts/refresh.mjs`, ...data },
      { status: 503, headers }
    );
  } catch (error) {
    console.error('[Search API]', error);
    return NextResponse.json(
      { error: 'Search failed. Pre-scrape locally: node scripts/refresh.mjs', details: String(error) },
      { status: 503, headers }
    );
  }
}

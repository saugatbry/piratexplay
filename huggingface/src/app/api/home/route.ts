import { NextRequest, NextResponse } from 'next/server';
import { scrapeHome } from '@/lib/scraper';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { readDataFile, homeDataPath, getDataFreshenss } from '@/lib/data';
import { HomeResponse } from '@/types';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateCheck = checkRateLimit(ip);
  const headers = getRateLimitHeaders(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429, headers });
  }

  // 1. Try pre-scraped data first
  const cached = readDataFile<HomeResponse>(homeDataPath());
  if (cached?.sections?.length) {
    const freshness = getDataFreshenss(homeDataPath());
    return NextResponse.json({
      ...cached,
      _source: 'pre-scraped',
      _age: freshness.age ? Math.round(freshness.age / 1000 / 60) + 'm' : 'unknown',
    }, { headers });
  }

  // 2. Fall back to live scraping
  try {
    const data = await scrapeHome();
    if (data.sections?.length) {
      return NextResponse.json({ ...data, _source: 'live' }, { headers });
    }
    return NextResponse.json(
      { error: 'No data available. Run the refresh script locally first (node scripts/refresh.mjs).', ...data },
      { status: 503, headers }
    );
  } catch (error) {
    console.error('[Home API]', error);
    return NextResponse.json(
      { error: 'Failed to fetch data. Run node scripts/refresh.mjs on a network with PirateXPlay access.', details: String(error) },
      { status: 503, headers }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { scrapeEpisodes } from '@/lib/scraper';
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
  if (slug) {
    const cached = readDataFile<InfoResponse>(infoDataPath(slug));
    if (cached?.episodes?.length) {
      return NextResponse.json(cached.episodes, { headers });
    }
  }

  try {
    const url = normalizeId(id);
    const data = await scrapeEpisodes(url);
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Episodes API]', error);
    return NextResponse.json(
      { error: 'Failed to fetch episodes. Pre-scrape locally: node scripts/refresh.mjs', details: String(error) },
      { status: 503, headers }
    );
  }
}

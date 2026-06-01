import { NextRequest, NextResponse } from 'next/server';
import { scrapeSearch } from '@/lib/scraper';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateCheck = checkRateLimit(ip);
  const headers = getRateLimitHeaders(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers }
    );
  }

  const q = request.nextUrl.searchParams.get('q');
  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required.' },
      { status: 400, headers }
    );
  }

  try {
    const data = await scrapeSearch(q.trim());
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Search API]', error);
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500, headers }
    );
  }
}

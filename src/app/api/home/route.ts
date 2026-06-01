import { NextRequest, NextResponse } from 'next/server';
import { scrapeHome } from '@/lib/scraper';
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

  try {
    const data = await scrapeHome();
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Home API]', error);
    return NextResponse.json(
      { error: 'Failed to fetch home page data.' },
      { status: 500, headers }
    );
  }
}

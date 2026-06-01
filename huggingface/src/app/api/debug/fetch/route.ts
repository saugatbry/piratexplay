import { NextRequest, NextResponse } from 'next/server';
import { getDebugInfo } from '@/lib/fetcher';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Query parameter "url" is required.' }, { status: 400 });
  }

  try {
    const debug = await getDebugInfo(url);
    return NextResponse.json({
      url,
      ...debug,
      allResults: debug.allResults.map((r) => ({
        strategy: r.strategy,
        status: r.status,
        timeMs: r.timeMs,
        htmlLength: r.html.length,
        cloudflareDetected: r.cloudflareDetected,
        htmlPreview: r.html.slice(0, 500),
        error: r.error || null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithManager, SITE_URL } from '@/lib/fetcher';
import { isCloudflareChallenge } from '@/lib/cloudflare';

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url') || '/home';
  const fullUrlParam = urlParam.startsWith('http') ? urlParam : `${SITE_URL}${urlParam}`;
  const skipCache = request.nextUrl.searchParams.get('cache') === 'false';

  try {
    const result = await fetchWithManager(urlParam, { skipCache });
    const titleMatch = result.html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '(no title)';

    return NextResponse.json({
      url: fullUrlParam,
      strategy: result.strategy,
      status: result.status,
      timeMs: result.timeMs,
      title,
      htmlLength: result.html.length,
      cloudflareDetected: isCloudflareChallenge(result.html),
      htmlPreview: result.html.slice(0, 5000),
    });
  } catch (err: any) {
    return NextResponse.json({
      url: fullUrlParam,
      error: err.message,
    });
  }
}

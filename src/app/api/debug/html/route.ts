import { NextRequest, NextResponse } from 'next/server';
import { fetchHTML } from '@/lib/fetcher';
import { isCloudflareChallenge, extractCloudflareError } from '@/lib/cloudflare';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Query parameter "url" is required.' }, { status: 400 });
  }

  try {
    const html = await fetchHTML(url, { skipCache: true });
    const cloudflare = isCloudflareChallenge(html);

    return NextResponse.json({
      url,
      html,
      htmlLength: html.length,
      cloudflareDetected: cloudflare,
      cloudflareError: cloudflare ? extractCloudflareError(html) : null,
      preview: html.slice(0, 2000),
    });
  } catch (error) {
    return NextResponse.json({ url, error: String(error), html: null }, { status: 500 });
  }
}

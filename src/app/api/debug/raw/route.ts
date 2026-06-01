import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { fetchWithManager, SITE_URL } from '@/lib/fetcher';
import { isGoogleCacheReject, isCloudflareChallenge } from '@/lib/cloudflare';

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url') || '/home';
  const fullUrlParam = urlParam.startsWith('http') ? urlParam : `${SITE_URL}${urlParam}`;
  const useCache = request.nextUrl.searchParams.get('cache') !== 'false';

  const results: any[] = [];

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  const strategies = [
    { name: 'direct', url: fullUrlParam },
    { name: 'google-cache', url: `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(fullUrlParam)}&strip=1&vwsrc=0` },
    { name: 'jina-ai', url: `https://r.jina.ai/http://${new URL(fullUrlParam).host}${new URL(fullUrlParam).pathname}` },
  ];

  for (const s of strategies) {
    try {
      const res = await axios.get(s.url, {
        timeout: 10000,
        maxRedirects: 5,
        headers: { 'User-Agent': UA },
        responseType: 'text',
        transformResponse: [(d: any) => d],
      });
      const html = res.data || '';
      const finalUrl = res.request?.res?.responseUrl || res.config?.url || '';
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '(no title)';
      const cacheReject = isGoogleCacheReject(html);
      const cloudflare = isCloudflareChallenge(html);

      results.push({
        strategy: s.name,
        requestedUrl: s.url,
        status: res.status,
        finalUrl,
        contentType: res.headers['content-type'] || '',
        title,
        htmlLength: html.length,
        cloudflareDetected: cloudflare,
        cacheRejected: cacheReject,
        first3000Chars: html.slice(0, 3000),
      });
    } catch (err: any) {
      results.push({
        strategy: s.name,
        requestedUrl: s.url,
        error: err.message,
        status: err?.response?.status || 0,
      });
    }
  }

  // Also try the main fetchWithManager
  try {
    const managed = await fetchWithManager(urlParam, { skipCache: !useCache });
    const titleMatch = managed.html.match(/<title[^>]*>([^<]*)<\/title>/i);
    results.push({
      strategy: 'fetch-manager',
      selected: managed.strategy,
      status: managed.status,
      title: titleMatch ? titleMatch[1].trim() : '(no title)',
      htmlLength: managed.html.length,
      finalUrl: managed._finalUrl || '',
      errorDetail: managed._errorDetail || '',
    });
  } catch (err: any) {
    results.push({
      strategy: 'fetch-manager',
      error: err.message,
    });
  }

  return NextResponse.json({ url: fullUrlParam, results });
}

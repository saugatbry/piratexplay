import { fetchHTML, resolveUrl } from '../fetcher';
import { MediaSource, Subtitle } from '@/types';
import { detectProviderByDomain, detectProviderByHTML } from '../../utils/fingerprint';
import { load } from 'cheerio';

async function extractGeneric(url: string, html: string): Promise<{ sources: MediaSource[]; subtitles: Subtitle[] }> {
  const sources: MediaSource[] = [];
  const subtitles: Subtitle[] = [];
  const $ = load(html);

  const selectors = [
    { sel: 'video source[src]', attr: 'src' },
    { sel: 'video[src]', attr: 'src' },
    { sel: 'source[src]', attr: 'src' },
    { sel: 'iframe[src]', attr: 'src' },
    { sel: 'iframe[data-src]', attr: 'data-src' },
    { sel: 'track[src]', attr: 'src' },
    { sel: 'a[href$=".mp4"]', attr: 'href' },
    { sel: 'a[href$=".m3u8"]', attr: 'href' },
  ];

  for (const { sel, attr } of selectors) {
    $(sel).each((_, el) => {
      const val = $(el).attr(attr);
      if (!val) return;
      const resolved = resolveUrl(url, val);
      if (sel.includes('track')) {
        subtitles.push({ language: $(el).attr('label') || $(el).attr('srclang') || 'Unknown', url: resolved });
      } else if (val.endsWith('.m3u8')) {
        sources.push({ quality: 'Auto', url: resolved, type: 'm3u8', headers: { Referer: url, 'User-Agent': 'Mozilla/5.0' } });
      } else if (val.endsWith('.mp4')) {
        sources.push({ quality: 'Auto', url: resolved, type: 'mp4', headers: { Referer: url, 'User-Agent': 'Mozilla/5.0' } });
      }
    });
  }

  const scriptHtml = $('script').map((_, el) => $(el).html() || '').get().join('\n');
  const urlMatches = scriptHtml.match(/(https?:\/\/[^\s"'<>]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>]*)?)/gi);
  if (urlMatches) {
    for (const m of urlMatches) {
      sources.push({ quality: 'Auto', url: m, type: m.endsWith('.m3u8') ? 'm3u8' : 'mp4', headers: { Referer: url, 'User-Agent': 'Mozilla/5.0' } });
    }
  }

  return { sources, subtitles };
}

export async function extractWithProvider(url: string, html?: string): Promise<{
  sources: MediaSource[]; subtitles: Subtitle[]; provider: string;
}> {
  const providerName = detectProviderByDomain(url);
  const resolvedHtml = html || (await fetchHTML(url));
  const result = await extractGeneric(url, resolvedHtml);

  const deduped = new Map<string, MediaSource>();
  for (const s of result.sources) {
    if (!deduped.has(s.url)) deduped.set(s.url, s);
  }

  return {
    sources: Array.from(deduped.values()),
    subtitles: result.subtitles,
    provider: providerName !== 'Unknown' ? providerName : detectProviderByHTML(resolvedHtml),
  };
}

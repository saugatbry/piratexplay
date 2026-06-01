import { fetchHTML, resolveUrl } from './fetcher';
import { detectProviderByDomain, detectProviderByHTML } from '../utils/fingerprint';
import { MediaSource, Subtitle } from '@/types';
import { load } from 'cheerio';

async function extractM3U8(html: string, baseUrl: string): Promise<MediaSource[]> {
  const sources: MediaSource[] = [];
  const matches = html.match(/(https?:\/\/[^\s"'<>]+?\.(?:m3u8)(?:\?[^\s"'<>]*)?)/gi);
  if (matches) {
    for (const url of matches) {
      sources.push({
        quality: 'Auto',
        url: url,
        type: 'm3u8',
        headers: { Referer: baseUrl, 'User-Agent': 'Mozilla/5.0', Origin: new URL(baseUrl).origin },
      });
    }
  }
  return sources;
}

async function extractMP4(html: string, baseUrl: string): Promise<MediaSource[]> {
  const sources: MediaSource[] = [];
  const matches = html.match(/(https?:\/\/[^\s"'<>]+?\.(?:mp4)(?:\?[^\s"'<>]*)?)/gi);
  if (matches) {
    for (const url of matches) {
      sources.push({
        quality: 'Auto',
        url: url,
        type: 'mp4',
        headers: { Referer: baseUrl, 'User-Agent': 'Mozilla/5.0' },
      });
    }
  }
  return sources;
}

async function extractFromVideoTag(html: string, baseUrl: string): Promise<MediaSource[]> {
  const sources: MediaSource[] = [];
  const $ = load(html);

  $('video source[src], video[src]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!src) return;
    const resolved = resolveUrl(baseUrl, src);
    const isM3U8 = resolved.endsWith('.m3u8');
    sources.push({
      quality: $(el).attr('size') || $(el).attr('label') || $(el).attr('data-quality') || 'Auto',
      url: resolved,
      type: isM3U8 ? 'm3u8' : 'mp4',
      headers: { Referer: baseUrl, 'User-Agent': 'Mozilla/5.0' },
    });
  });

  return sources;
}

async function extractSubtitles(html: string, baseUrl: string): Promise<Subtitle[]> {
  const subtitles: Subtitle[] = [];
  const $ = load(html);

  $('track[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    subtitles.push({
      language: $(el).attr('label') || $(el).attr('srclang') || 'Unknown',
      url: resolveUrl(baseUrl, src),
    });
  });

  const subMatches = html.match(/(https?:\/\/[^\s"'<>]+?\.(?:vtt|srt)(?:\?[^\s"'<>]*)?)/gi);
  if (subMatches) {
    for (const url of subMatches) {
      subtitles.push({ language: 'Unknown', url });
    }
  }

  return subtitles;
}

async function extractFromPlayerConfig(html: string, baseUrl: string): Promise<MediaSource[]> {
  const sources: MediaSource[] = [];
  const patterns = [
    /(?:file|src|url|source)\s*[:=]\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/gi,
    /sources\s*:\s*\[([\s\S]*?)\]/gi,
    /playlist\s*:\s*\[([\s\S]*?)\]/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (pattern.source.includes('sources') || pattern.source.includes('playlist')) {
        const urlMatches = match[1].match(/(https?:\/\/[^\s"'<>]+?\.(?:m3u8|mp4)[^\s"'<>]*)/gi);
        if (urlMatches) {
          for (const url of urlMatches) {
            sources.push({
              quality: 'Auto',
              url,
              type: url.endsWith('.m3u8') ? 'm3u8' : 'mp4',
              headers: { Referer: baseUrl, 'User-Agent': 'Mozilla/5.0' },
            });
          }
        }
      } else {
        sources.push({
          quality: 'Auto',
          url: resolveUrl(baseUrl, match[1]),
          type: match[1].endsWith('.m3u8') ? 'm3u8' : 'mp4',
          headers: { Referer: baseUrl, 'User-Agent': 'Mozilla/5.0' },
        });
      }
    }
  }

  return sources;
}

async function extractFromObfuscated(html: string, baseUrl: string): Promise<MediaSource[]> {
  const sources: MediaSource[] = [];
  const atobMatches = html.match(/atob\(['"]([^'"]+)['"]\)/g);
  if (atobMatches) {
    for (const match of atobMatches) {
      try {
        const b64 = match.match(/atob\(['"]([^'"]+)['"]\)/);
        if (!b64) continue;
        const decoded = Buffer.from(b64[1], 'base64').toString('utf-8');
        const urlMatch = decoded.match(/(https?:\/\/[^\s"'<>]+?\.(?:m3u8|mp4)[^\s"'<>]*)/i);
        if (urlMatch) {
          sources.push({
            quality: 'Auto',
            url: urlMatch[1],
            type: urlMatch[1].endsWith('.m3u8') ? 'm3u8' : 'mp4',
            headers: { Referer: baseUrl, 'User-Agent': 'Mozilla/5.0' },
          });
        }
      } catch { /* skip */ }
    }
  }
  return sources;
}

export async function extractFromEmbed(embedUrl: string): Promise<{
  sources: MediaSource[]; subtitles: Subtitle[]; provider: string;
}> {
  const provider = detectProviderByDomain(embedUrl);
  try {
    const html = await fetchHTML(embedUrl, { headers: { Referer: embedUrl } });
    const baseUrl = embedUrl;

    const [m3u8, mp4, videoTag, config, obfu, subs] = await Promise.all([
      extractM3U8(html, baseUrl),
      extractMP4(html, baseUrl),
      extractFromVideoTag(html, baseUrl),
      extractFromPlayerConfig(html, baseUrl),
      extractFromObfuscated(html, baseUrl),
      extractSubtitles(html, baseUrl),
    ]);

    const allSources = [...m3u8, ...mp4, ...videoTag, ...config, ...obfu];
    const deduped = new Map<string, MediaSource>();
    for (const s of allSources) {
      if (!deduped.has(s.url)) deduped.set(s.url, s);
    }

    return {
      sources: Array.from(deduped.values()),
      subtitles: subs,
      provider: provider !== 'Unknown' ? provider : detectProviderByHTML(html),
    };
  } catch {
    return { sources: [], subtitles: [], provider };
  }
}

export async function resolveIframeChain(embedUrls: string[], maxDepth = 3): Promise<MediaSource[]> {
  const sources: MediaSource[] = [];
  for (const url of embedUrls) {
    let currentUrl = url;
    for (let depth = 0; depth < maxDepth; depth++) {
      try {
        const html = await fetchHTML(currentUrl, { headers: { Referer: currentUrl } });
        const $ = load(html);
        const iframes = $('iframe[src]');
        if (iframes.length === 0) {
          const result = await extractFromEmbed(currentUrl);
          sources.push(...result.sources);
          break;
        }
        const nextSrc = $(iframes[0]).attr('src');
        if (!nextSrc || nextSrc === currentUrl) break;
        currentUrl = resolveUrl(currentUrl, nextSrc);
      } catch { break; }
    }
  }
  return sources;
}

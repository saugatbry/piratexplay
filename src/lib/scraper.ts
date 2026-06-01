import { load, CheerioAPI } from 'cheerio';
import { fetchHTML, fetchHTMLWithRetry, fetchWithManager, FetchError, resolveUrl, SITE_URL } from './fetcher';
import * as cache from './cache';
import { isCloudflareChallenge, isBlockedPage, extractCloudflareError } from './cloudflare';
import * as logger from './logger';
import {
  MediaItem, HomeSection, HomeResponse,
  SearchResult, SearchResponse,
  InfoResponse, EpisodeInfo,
  WatchResponse, VideoSource,
  FetchResult, FetchDebugInfo,
} from '@/types';

const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300', 10);

const SCRAPE_LOG: string[] = [];

function log(msg: string): void {
  SCRAPE_LOG.push(msg);
  logger.debug(`[SCRAPER] ${msg}`);
}

function getAndClearLog(): string[] {
  const copy = [...SCRAPE_LOG];
  SCRAPE_LOG.length = 0;
  return copy;
}

function toDebug(fetchResult: FetchResult, url: string): FetchDebugInfo {
  return {
    url,
    strategy: fetchResult.strategy,
    status: fetchResult.status,
    timeMs: fetchResult.timeMs,
    cloudflareDetected: fetchResult.cloudflareDetected,
    htmlLength: fetchResult.html.length,
    cacheHit: false,
  };
}

function validateHTML(html: string, label: string): { valid: boolean; reason?: string } {
  if (!html || html.length === 0) {
    return { valid: false, reason: `Empty HTML response for ${label}` };
  }
  if (html.length < 500) {
    return { valid: false, reason: `HTML too short (${html.length}b) for ${label}` };
  }
  if (isCloudflareChallenge(html)) {
    return { valid: false, reason: `Cloudflare challenge detected for ${label}: ${extractCloudflareError(html)}` };
  }
  if (isBlockedPage(html)) {
    return { valid: false, reason: `Blocked page for ${label}: ${extractCloudflareError(html)}` };
  }
  return { valid: true };
}

// ============ ADAPTIVE SELECTOR ENGINE ============

interface SelectorResult {
  selector: string;
  count: number;
  items: MediaItem[];
}

function trySelector($: CheerioAPI, selector: string, sourceUrl: string, container?: any): SelectorResult {
  const elements = container ? $(container).find(selector) : $(selector);
  const count = elements.length;
  log(`  trySelector("${selector}") => ${count} elements`);

  if (count === 0) return { selector, count: 0, items: [] };

  const items: MediaItem[] = [];
  const seen = new Set<string>();

  elements.each((_, el) => {
    const $el = $(el);

    // Find the link
    const link = $el.is('a') ? $el : $el.find('a').first();
    const href = link.attr('href') || '';
    if (!href || seen.has(href)) return;
    seen.add(href);

    // Find the image
    const img = $el.find('img').first();
    const poster = img.attr('src') || img.attr('data-src') || '';

    // Find the title
    let title = '';
    if ($el.find('h2').length) {
      title = $el.find('h2').first().text().trim();
    } else if ($el.find('h3').length) {
      title = $el.find('h3').first().text().trim();
    } else if ($el.find('h4').length) {
      title = $el.find('h4').first().text().trim();
    } else {
      title = img.attr('alt') || $el.text().trim().slice(0, 100);
    }

    // Detect type from class or URL
    let type = '';
    const cls = $el.attr('class') || '';
    if (cls.includes('series') || href.includes('/series/')) type = 'Series';
    else if (cls.includes('movie') || href.includes('/movies/')) type = 'Movie';
    else if (cls.includes('episode') || href.includes('/episode/')) type = 'Episode';

    items.push({
      title,
      url: resolveUrl(sourceUrl, href),
      poster: poster ? resolveUrl(SITE_URL, poster) : '',
      type,
    });
  });

  log(`  => ${items.length} unique items from "${selector}"`);
  return { selector, count, items };
}

// All selector patterns to try, from most specific to most generic
const ITEM_SELECTORS = [
  // Original PirateXPlay selectors
  'li.post.series',
  'li.post.movies',
  'li.post',
  'article.post.dfx.fcl',
  'article.post',
  // Generic selectors
  'article',
  '.post',
  '.item',
  '.card',
  '.entry',
  '.media',
  // List items with images
  'li:has(img[src])',
  'li:has(a[href]):has(img)',
  'li:has(div:has(img))',
  // Any element with both a link and image
  'div:has(a[href]):has(img)',
  'a:has(img)',
];

function extractItemsAdaptive($: CheerioAPI, container: any, sourceUrl: string): MediaItem[] {
  let best: MediaItem[] = [];

  for (const sel of ITEM_SELECTORS) {
    const result = trySelector($, sel, sourceUrl, container);
    if (result.items.length > best.length) {
      best = result.items;
    }
    if (result.items.length >= 20) break; // good enough
  }

  // Last resort: scan for ANY element containing both a link and an image
  if (best.length === 0) {
    log('  [FALLBACK] scanning for any link+image pairs');
    const seen = new Set<string>();
    const items: MediaItem[] = [];

    $(container).find('a[href]').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      if (!href || seen.has(href) || href === '#') return;
      const img = $a.find('img').first();
      if (!img.length) return;
      seen.add(href);

      const poster = img.attr('src') || img.attr('data-src') || '';
      const title = img.attr('alt') || $a.text().trim().slice(0, 100) || '';
      let type = '';
      if (href.includes('/series/')) type = 'Series';
      else if (href.includes('/movies/')) type = 'Movie';
      else if (href.includes('/episode/')) type = 'Episode';

      items.push({
        title,
        url: resolveUrl(sourceUrl, href),
        poster: poster ? resolveUrl(SITE_URL, poster) : '',
        type,
      });
    });

    if (items.length > best.length) {
      log(`  [FALLBACK] found ${items.length} link+image pairs`);
      best = items;
    }
  }

  return best;
}

// ============ SECTION DETECTION ============

interface DetectedSection {
  name: string;
  items: MediaItem[];
}

const SECTION_HEADING_SELECTORS = [
  'h3.section-title',
  'h3',
  'h2.section-title',
  'h2',
  'h4',
  '.section-title',
  '.heading',
  '.title',
  '[class*="title"]',
  '[class*="heading"]',
];

function detectSectionName($: CheerioAPI, container: any): string {
  const $c = $(container);
  for (const sel of SECTION_HEADING_SELECTORS) {
    const text = $c.find(sel).first().text().trim();
    if (text && text.length < 100) {
      log(`  section heading via "${sel}": "${text}"`);
      return text;
    }
  }
  // Check for a preceding heading outside the container
  const prev = $c.prevAll('h2, h3, h4').first().text().trim();
  if (prev) {
    log(`  section heading via prev sibling: "${prev}"`);
    return prev;
  }
  return '';
}

// Full list of section containers to try
const SECTION_CONTAINERS = [
  'section',
  'div.section',
  'div[class*="section"]',
  'div[class*="category"]',
  'div[class*="widget"]',
  'div[class*="block"]',
  'div[class*="wrap"]',
  'div[id*="section"]',
  'div[id*="category"]',
  // Generic: any div with multiple children that look like cards
  'body > div',
  'main',
  '#main',
  '.main',
  '.content',
  '#content',
];

function detectSections($: CheerioAPI, sourceUrl: string): DetectedSection[] {
  const sections: DetectedSection[] = [];

  // Method 1: Try known section containers
  for (const sel of SECTION_CONTAINERS) {
    const containers = $(sel);
    if (containers.length === 0) continue;

    log(`Trying section container "${sel}" => ${containers.length} found`);

    $(containers).each((_, container) => {
      const $c = $(container);
      const name = detectSectionName($, container);
      if (!name) return; // skip containers without a heading

      // Check if already added
      if (sections.some((s) => s.name === name)) return;

      const items = extractItemsAdaptive($, container, sourceUrl);
      if (items.length >= 3) {
        log(`  => Section "${name}" with ${items.length} items`);
        sections.push({ name, items });
      }
    });

    if (sections.length > 0) break; // found sections with this container type
  }

  // Method 2: Extract everything with items and group by proximity
  if (sections.length === 0) {
    log('Method 1 failed, trying Method 2: scan all heading+list groups');

    $('h2, h3, h4').each((_, heading) => {
      const $h = $(heading);
      const name = $h.text().trim();
      if (!name || name.length > 100) return;
      if (sections.some((s) => s.name === name)) return;

      // Look for content after this heading
      let container = $h.nextAll().first();
      // Expand to include siblings
      const items = extractItemsAdaptive($, $h.parent(), sourceUrl);

      if (items.length >= 3) {
        log(`  => Section "${name}" with ${items.length} items (Method 2)`);
        sections.push({ name, items });
      }
    });
  }

  // Method 3: Dump everything into a single section
  if (sections.length === 0) {
    log('Method 2 failed, trying Method 3: extract ALL cards from page');
    const allItems = extractItemsAdaptive($, $.root(), sourceUrl);
    if (allItems.length > 0) {
      log(`  => Single section "Latest" with ${allItems.length} items (Method 3)`);
      sections.push({ name: 'Latest', items: allItems });
    }
  }

  return sections;
}

// ============ HOME SCRAPER ============

export async function scrapeHome(): Promise<HomeResponse> {
  const cached = cache.get<HomeResponse>('home');
  if (cached) return cached;

  const pathed = await fetchHTMLWithRetry(
    ['/home', '/?s=a', '/category/latest', '/category/popular', '/']
  );

  if (!pathed) {
    return {
      sections: [],
      debug: {
        url: '/home',
        strategy: 'none',
        status: 0,
        timeMs: 0,
        cloudflareDetected: true,
        htmlLength: 0,
        cacheHit: false,
      },
    };
  }

  const { html, usedPath, debug: fetchDebug } = pathed;
  const validation = validateHTML(html, `home (${usedPath})`);
  if (!validation.valid) {
    return {
      sections: [],
      debug: {
        url: usedPath,
        strategy: fetchDebug.strategy,
        status: fetchDebug.status,
        timeMs: fetchDebug.timeMs,
        cloudflareDetected: fetchDebug.cloudflareDetected,
        htmlLength: html.length,
        cacheHit: false,
      },
    };
  }

  const $ = load(html);

  // Log page info
  log(`=== Page Analysis for ${usedPath} ===`);
  log(`Title: ${$('title').first().text().trim()}`);
  log(`H1 tags: ${$('h1').length}`);
  log(`H2 tags: ${$('h2').length}`);
  log(`H3 tags: ${$('h3').length}`);
  log(`Section tags: ${$('section').length}`);
  log(`Article tags: ${$('article').length}`);
  log(`Li tags: ${$('li').length}`);
  log(`Total HTML length: ${html.length}`);

  // Log all unique classes
  const allClasses = new Set<string>();
  $('[class]').each((_, el) => {
    ($(el).attr('class') || '').split(/\s+/).forEach((c) => { if (c) allClasses.add(c); });
  });
  log(`All classes (${allClasses.size}): ${Array.from(allClasses).slice(0, 30).join(', ')}`);

  const sections = detectSections($, usedPath);

  if (sections.length === 0) {
    log('WARNING: No sections detected by any method');
    // Log what we found
    log(`Links with images: ${$('a:has(img)').length}`);
    log(`Li elements: ${$('li').length}`);
    log(`Div elements: ${$('div').length}`);
    log(`A elements: ${$('a').length}`);
    log(`Img elements: ${$('img').length}`);
  }

  const response: HomeResponse = {
    sections: sections.map((s) => ({ name: s.name, items: s.items })),
    debug: {
      url: usedPath,
      strategy: fetchDebug.strategy,
      status: fetchDebug.status,
      timeMs: fetchDebug.timeMs,
      cloudflareDetected: fetchDebug.cloudflareDetected,
      htmlLength: html.length,
      cacheHit: false,
    },
    _scrapeLog: getAndClearLog(),
  };

  cache.set('home', response, undefined, CACHE_TTL);
  return response;
}

// ============ SEARCH SCRAPER ============

export async function scrapeSearch(query: string): Promise<SearchResponse> {
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = cache.get<SearchResponse>(cacheKey);
  if (cached) return cached;

  const path = `/?s=${encodeURIComponent(query)}`;

  try {
    const result = await fetchWithManager(path);
    const validation = validateHTML(result.html, `search (${query})`);
    if (!validation.valid) {
      return {
        results: [],
        total: 0,
        debug: toDebug(result, path),
      };
    }

    const $ = load(result.html);
    const items = extractItemsAdaptive($, $.root(), path);

    const response: SearchResponse = {
      results: items.map((item) => ({
        title: item.title,
        url: item.url,
        poster: item.poster,
        type: item.type,
        tmdbRating: undefined,
      })),
      total: items.length,
      debug: toDebug(result, path),
      _scrapeLog: getAndClearLog(),
    };
    cache.set(cacheKey, response, undefined, CACHE_TTL);
    return response;
  } catch (err) {
    const debugInfo: FetchDebugInfo = {
      url: path, strategy: 'none', status: 0, timeMs: 0,
      cloudflareDetected: true, htmlLength: 0, cacheHit: false,
    };
    if (err instanceof FetchError) {
      debugInfo.strategy = err.strategy;
      debugInfo.cloudflareDetected = err.cloudflareDetected;
      if (err.debug) {
        debugInfo.status = err.debug.status;
        debugInfo.timeMs = err.debug.timeMs;
        debugInfo.htmlLength = err.debug.html.length;
      }
    }
    return { results: [], total: 0, debug: debugInfo };
  }
}

// ============ INFO SCRAPER ============

export async function scrapeInfo(url: string): Promise<InfoResponse> {
  const cacheKey = `info:${url}`;
  const cached = cache.get<InfoResponse>(cacheKey);
  if (cached) return cached;

  try {
    const result = await fetchWithManager(url);
    const fullUrl = result.strategy === 'direct' ? url : SITE_URL;
    const validation = validateHTML(result.html, `info (${url})`);
    if (!validation.valid) {
      return {
        title: '', description: '', poster: '', banner: '',
        genres: [], languages: [], year: '', duration: '',
        seasons: 0, episodes: [], recommendations: [],
        debug: toDebug(result, url),
      };
    }
    const $ = load(result.html);

    const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[property="og:description"]').attr('content') || $('p').first().text().trim() || '';
    const posterImg = $('.post-thumbnail img').first().attr('src') || $('img[src*="tmdb"]').first().attr('src') || $('img').first().attr('src') || '';
    const poster = posterImg ? resolveUrl(fullUrl, posterImg) : '';

    const genres: string[] = [];
    $('a[href*="/genre/"]').each((_, el) => {
      const g = $(el).text().trim();
      if (g && !genres.includes(g)) genres.push(g);
    });

    const languages: string[] = [];
    $('a[href*="/language/"]').each((_, el) => {
      const l = $(el).text().trim();
      if (l && !languages.includes(l)) languages.push(l);
    });

    const year = $('.year').first().text().trim() || $('[class*="year"]').first().text().trim() || '';
    const duration = $('.duration').first().text().trim() || $('[class*="duration"]').first().text().trim() || '';

    const episodes: EpisodeInfo[] = [];
    $('a[href*="/episode/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const epTitle = $(el).text().trim();
      const match = href.match(/-(\d+)x(\d+)\/?$/);
      const season = match ? parseInt(match[1]) : 1;
      const episodeNum = match ? parseInt(match[2]) : 0;
      episodes.push({
        season,
        episode: episodeNum,
        title: epTitle || `Episode ${episodeNum}`,
        url: resolveUrl(fullUrl, href),
      });
    });

    episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
    const uniqueSeasons = new Set(episodes.map((e) => e.season));

    const recommendations: MediaItem[] = [];
    const recSection = $('section').last();
    if (recSection.length) {
      const recItems = extractItemsAdaptive($, recSection, url);
      recommendations.push(...recItems);
    }

    const response: InfoResponse = {
      title, description, poster, banner: poster,
      genres, languages, year, duration,
      seasons: uniqueSeasons.size, episodes, recommendations,
      debug: toDebug(result, url),
    };
    cache.set(cacheKey, response, undefined, CACHE_TTL);
    return response;
  } catch (err) {
    const debugInfo: FetchDebugInfo = {
      url, strategy: 'none', status: 0, timeMs: 0,
      cloudflareDetected: true, htmlLength: 0, cacheHit: false,
    };
    if (err instanceof FetchError) {
      debugInfo.strategy = err.strategy;
      debugInfo.cloudflareDetected = err.cloudflareDetected;
      if (err.debug) {
        debugInfo.status = err.debug.status;
        debugInfo.timeMs = err.debug.timeMs;
        debugInfo.htmlLength = err.debug.html.length;
      }
    }
    return {
      title: '', description: '', poster: '', banner: '',
      genres: [], languages: [], year: '', duration: '',
      seasons: 0, episodes: [], recommendations: [],
      debug: debugInfo,
    };
  }
}

// ============ EPISODES SCRAPER ============

export async function scrapeEpisodes(url: string): Promise<EpisodeInfo[]> {
  try {
    const result = await fetchWithManager(url);
    const validation = validateHTML(result.html, `episodes (${url})`);
    if (!validation.valid) return [];

    const $ = load(result.html);
    const episodes: EpisodeInfo[] = [];

    $('a[href*="/episode/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const match = href.match(/-(\d+)x(\d+)\/?$/);
      const season = match ? parseInt(match[1]) : 1;
      const episodeNum = match ? parseInt(match[2]) : 0;
      episodes.push({
        season,
        episode: episodeNum,
        title: `Episode ${episodeNum}`,
        url: resolveUrl(url, href),
      });
    });

    episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
    return episodes;
  } catch {
    return [];
  }
}

// ============ WATCH SCRAPER ============

const KNOWN_SERVERS: Record<string, string> = {
  'as-cdn21': 'As-cdn21',
  'rubystm': 'Rubystm',
  'short': 'Short',
  'cloudy': 'Cloudy',
  'strmup': 'Strmup',
  'turbovidhls': 'Turbovidhls',
  'vidmoly': 'Vidmoly',
  'animesalt': 'Animesalt',
  'vidstreaming': 'Vidstreaming',
  'gdmirrorbot': 'Gdmirrorbot',
  'piratexplay.cc': 'PirateXPlay',
};

function extractServerName(buttonText: string, embedUrl: string): string {
  if (buttonText) {
    const parts = buttonText.split('-');
    const namePart = parts[0]?.replace(/^\d+\s*/, '').trim();
    if (namePart) {
      for (const [key, val] of Object.entries(KNOWN_SERVERS)) {
        if (namePart.toLowerCase().includes(key)) return val;
      }
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
  }
  try {
    const hostname = new URL(embedUrl).hostname.replace('www.', '');
    for (const [key, val] of Object.entries(KNOWN_SERVERS)) {
      if (hostname.includes(key)) return val;
    }
    const parts = hostname.split('.');
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Unknown';
  }
}

export async function scrapeWatch(url: string): Promise<WatchResponse> {
  const cacheKey = `watch:${url}`;
  const cached = cache.get<WatchResponse>(cacheKey);
  if (cached) return cached;

  try {
    const result = await fetchWithManager(url);
    const validation = validateHTML(result.html, `watch (${url})`);
    if (!validation.valid) {
      return {
        success: false, title: '', sources: [],
        debug: toDebug(result, url),
      };
    }

    const $ = load(result.html);
    const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || '';

    const serverButtons: string[] = [];
    $('.server, a.server, [class*="server"]').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ').replace('Server', '').trim();
      if (text) serverButtons.push(text);
    });

    const sources: VideoSource[] = [];

    $('.video.aa-tb').each((i, el) => {
      const iframe = $(el).find('iframe');
      const src = iframe.attr('src') || '';
      const dataSrc = iframe.attr('data-src') || '';
      const embedUrl = src || dataSrc;
      if (!embedUrl) return;

      const serverName = extractServerName(serverButtons[i] || '', embedUrl);
      sources.push({
        server: serverName,
        embed: resolveUrl(url, embedUrl),
      });
    });

    if (sources.length === 0) {
      $('iframe[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.includes('youtube.com') && !src.includes('platform-api')) {
          sources.push({
            server: extractServerName('', src),
            embed: resolveUrl(url, src),
          });
        }
      });
    }

    if (sources.length === 0) {
      $('script').each((_, el) => {
        const script = $(el).html() || '';
        if (!script) return;

        const configPatterns = [
          /(?:file|src|url|embed|source)\s*[:=]\s*['"]([^'"]+)['"]/gi,
          /sources\s*:\s*\[([\s\S]*?)\]/gi,
          /fetch\(['"]([^'"]+)['"]/gi,
          /iframe.*?src\s*=\s*['"]([^'"]+)['"]/gi,
        ];

        for (const pattern of configPatterns) {
          let match;
          while ((match = pattern.exec(script)) !== null) {
            const raw = match[1] || match[0];
            if (raw.length > 10 && raw.includes('http')) {
              const urls = raw.match(/(https?:\/\/[^\s"'<>,\]]+)/gi);
              if (urls) {
                for (const u of urls) {
                  if (!u.includes('youtube.com') && !u.includes('google')) {
                    sources.push({
                      server: extractServerName('', u),
                      embed: resolveUrl(url, u),
                    });
                  }
                }
              }
            }
          }
        }

        const atobMatches = script.match(/atob\(['"]([^'"]+)['"]\)/g);
        if (atobMatches) {
          for (const am of atobMatches) {
            try {
              const b64 = am.match(/atob\(['"]([^'"]+)['"]\)/);
              if (!b64) continue;
              const decoded = Buffer.from(b64[1], 'base64').toString('utf-8');
              const urlMatch = decoded.match(/(https?:\/\/[^\s"'<>]+?)(?:\?|$|\s|")/i);
              if (urlMatch && !urlMatch[1].includes('youtube.com')) {
                sources.push({
                  server: extractServerName('', urlMatch[1]),
                  embed: resolveUrl(url, urlMatch[1]),
                });
              }
            } catch { /* skip */ }
          }
        }
      });
    }

    const deduped = new Map<string, VideoSource>();
    for (const s of sources) {
      if (!deduped.has(s.embed)) deduped.set(s.embed, s);
    }

    const response: WatchResponse = {
      success: deduped.size > 0,
      title,
      sources: Array.from(deduped.values()),
      debug: toDebug(result, url),
    };
    cache.set(cacheKey, response, undefined, CACHE_TTL);
    return response;
  } catch (err) {
    const debugInfo: FetchDebugInfo = {
      url, strategy: 'none', status: 0, timeMs: 0,
      cloudflareDetected: true, htmlLength: 0, cacheHit: false,
    };
    if (err instanceof FetchError) {
      debugInfo.strategy = err.strategy;
      debugInfo.cloudflareDetected = err.cloudflareDetected;
      if (err.debug) {
        debugInfo.status = err.debug.status;
        debugInfo.timeMs = err.debug.timeMs;
        debugInfo.htmlLength = err.debug.html.length;
      }
    }
    return { success: false, title: '', sources: [], debug: debugInfo };
  }
}

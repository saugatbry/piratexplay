import { load, CheerioAPI } from 'cheerio';
import { fetchHTML, resolveUrl, SITE_URL } from './fetcher';
import * as cache from './cache';
import {
  MediaItem, HomeSection, HomeResponse,
  SearchResult, SearchResponse,
  InfoResponse, EpisodeInfo,
  WatchResponse, VideoSource,
} from '@/types';

const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300', 10);

function extractItemsFromSection($: CheerioAPI, sectionEl: any): MediaItem[] {
  const $s = $(sectionEl);
  const items: MediaItem[] = [];
  const seen = new Set<string>();

  $s.find('li.post, article.post').each((_, el) => {
    const link = $(el).find('a.lnk-blk').first();
    const href = link.attr('href');
    if (!href || seen.has(href)) return;
    seen.add(href);

    const title = $(el).find('h2.entry-title').first().text().trim();
    const thumb = $(el).find('.post-thumbnail img').first();
    const poster = thumb.attr('src') || thumb.attr('data-src') || '';
    const type = $(el).hasClass('series') ? 'Series' : $(el).hasClass('movies') ? 'Movie' : '';

    items.push({
      title,
      url: resolveUrl(SITE_URL, href),
      poster: poster ? resolveUrl(SITE_URL, poster) : '',
      type,
    });
  });

  if (items.length === 0) {
    $s.find('.post-thumbnail').parent('a, .post-thumbnail').each((_, el) => {
      const $parent = $(el).closest('a');
      const href = $parent.attr('href') || $(el).find('a').first().attr('href') || '';
      if (!href || seen.has(href)) return;
      seen.add(href);

      const img = $(el).find('img').first();
      const poster = img.attr('src') || img.attr('data-src') || '';
      const title = img.attr('alt') || $(el).find('.entry-title').text().trim() || '';

      items.push({
        title,
        url: resolveUrl(SITE_URL, href),
        poster: poster ? resolveUrl(SITE_URL, poster) : '',
        type: href.includes('/series/') ? 'Series' : href.includes('/movies/') ? 'Movie' : '',
      });
    });
  }

  return items;
}

export async function scrapeHome(): Promise<HomeResponse> {
  const cached = cache.get<HomeResponse>('home');
  if (cached) return cached;

  const html = await fetchHTML('/home');
  const $ = load(html);

  const sections: HomeSection[] = [];

  $('section').each((_, sectionEl) => {
    const $s = $(sectionEl);
    const heading = $s.find('h3.section-title').first().text().trim();
    if (!heading) return;

    const items = extractItemsFromSection($, sectionEl);
    if (items.length >= 3) {
      sections.push({ name: heading, items });
    }
  });

  if (sections.length === 0) {
    const allItems = extractItemsFromSection($, $.root());
    if (allItems.length > 0) {
      sections.push({ name: 'Latest', items: allItems });
    }
  }

  const result: HomeResponse = { sections };
  cache.set('home', result, undefined, CACHE_TTL);
  return result;
}

export async function scrapeSearch(query: string): Promise<SearchResponse> {
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = cache.get<SearchResponse>(cacheKey);
  if (cached) return cached;

  const html = await fetchHTML(`/?s=${encodeURIComponent(query)}`);
  const $ = load(html);

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  $('li.post, article.post').each((_, el) => {
    const link = $(el).find('a.lnk-blk').first();
    const href = link.attr('href');
    if (!href || seen.has(href)) return;
    seen.add(href);

    const title = $(el).find('h2.entry-title').first().text().trim();
    const thumb = $(el).find('.post-thumbnail img').first();
    const poster = thumb.attr('src') || thumb.attr('data-src') || '';
    const type = $(el).hasClass('series') ? 'Series' : $(el).hasClass('movies') ? 'Movie' : '';
    const rating = $(el).find('.vote').text().replace('TMDB', '').trim();

    results.push({
      title,
      url: resolveUrl(SITE_URL, href),
      poster: poster ? resolveUrl(SITE_URL, poster) : '',
      type,
      tmdbRating: rating || undefined,
    });
  });

  if (results.length === 0) {
    $('.post-thumbnail').each((_, el) => {
      const img = $(el).find('img').first();
      const poster = img.attr('src') || img.attr('data-src') || '';
      const title = img.attr('alt') || '';
      const parentLink = $(el).closest('a').attr('href') || $(el).find('a').first().attr('href') || '';
      if (!parentLink || seen.has(parentLink) || !title) return;
      seen.add(parentLink);

      results.push({
        title,
        url: resolveUrl(SITE_URL, parentLink),
        poster: poster ? resolveUrl(SITE_URL, poster) : '',
        type: parentLink.includes('/series/') ? 'Series' : parentLink.includes('/movies/') ? 'Movie' : '',
      });
    });
  }

  return { results, total: results.length };
}

export async function scrapeInfo(url: string): Promise<InfoResponse> {
  const cacheKey = `info:${url}`;
  const cached = cache.get<InfoResponse>(cacheKey);
  if (cached) return cached;

  const html = await fetchHTML(url);
  const $ = load(html);

  const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || '';
  const description = $('meta[property="og:description"]').attr('content') || $('p').first().text().trim() || '';
  const posterImg = $('.post-thumbnail img').first().attr('src') || $('img[src*="tmdb"]').first().attr('src') || '';
  const poster = posterImg ? resolveUrl(url, posterImg) : '';

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
      url: resolveUrl(url, href),
    });
  });

  episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);

  const uniqueSeasons = new Set(episodes.map((e) => e.season));

  const recommendations: MediaItem[] = [];
  $('section').last().find('li.post, article.post').each((_, el) => {
    const link = $(el).find('a.lnk-blk').first();
    const href = link.attr('href');
    if (!href) return;
    const t = $(el).find('h2.entry-title').first().text().trim();
    const img = $(el).find('.post-thumbnail img').first().attr('src') || '';
    recommendations.push({
      title: t,
      url: resolveUrl(url, href),
      poster: img ? resolveUrl(url, img) : '',
      type: href.includes('/series/') ? 'Series' : href.includes('/movies/') ? 'Movie' : '',
    });
  });

  const result: InfoResponse = {
    title, description, poster, banner: poster, genres, languages, year, duration,
    seasons: uniqueSeasons.size, episodes, recommendations,
  };

  cache.set(cacheKey, result, undefined, CACHE_TTL);
  return result;
}

export async function scrapeEpisodes(url: string): Promise<EpisodeInfo[]> {
  const html = await fetchHTML(url);
  const $ = load(html);
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
}

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

  const html = await fetchHTML(url);
  const $ = load(html);

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

  const deduped = new Map<string, VideoSource>();
  for (const s of sources) {
    if (!deduped.has(s.embed)) deduped.set(s.embed, s);
  }

  const result: WatchResponse = { success: deduped.size > 0, title, sources: Array.from(deduped.values()) };
  cache.set(cacheKey, result, undefined, CACHE_TTL);
  return result;
}

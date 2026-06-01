/**
 * Refresh script: fetches PirateXPlay from a working environment (user's home IP)
 * and writes pre-scraped JSON data to src/data/ for deployment.
 *
 * Usage: node scripts/refresh.mjs
 * Requires: Node 18+ (native fetch), npm dependencies installed
 */

import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');
const SITE_URL = process.env.SITE_URL || 'https://piratexplay.cc';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

let totalFetched = 0;

async function fetchHtml(url) {
  const fullUrl = url.startsWith('http') ? url : `${SITE_URL}${url}`;
  const res = await fetch(fullUrl, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${fullUrl}`);
  const html = await res.text();
  return html;
}

function extractItems($, container) {
  const $c = container ? $(container) : $.root();
  const items = [];
  const seen = new Set();

  const selectors = [
    'li.post.series', 'li.post.movies', 'li.post',
    'article.post.dfx.fcl', 'article.post', 'article',
    '.post', '.item', '.card', '.entry',
    'li:has(a[href]):has(img)',
    'div:has(a[href]):has(img)',
    'a:has(img)',
  ];

  let best = [];

  for (const sel of selectors) {
    const elements = $c.find(sel);
    if (elements.length === 0) continue;

    const extracted = [];
    const seenLocal = new Set();

    elements.each((_, el) => {
      const $el = $(el);
      const link = $el.is('a') ? $el : $el.find('a').first();
      const href = link.attr('href');
      if (!href || seenLocal.has(href)) return;
      seenLocal.add(href);

      const img = $el.find('img').first();
      const poster = img.attr('src') || img.attr('data-src') || '';
      const title = $el.find('h2').first().text().trim()
        || $el.find('h3').first().text().trim()
        || img.attr('alt')
        || '';

      let type = '';
      const cls = $el.attr('class') || '';
      if (href.includes('/series/') || cls.includes('series')) type = 'Series';
      else if (href.includes('/movies/') || cls.includes('movie')) type = 'Movie';

      extracted.push({
        title: title.slice(0, 200),
        url: href.startsWith('http') ? href : `${SITE_URL}${href}`,
        poster: poster ? (poster.startsWith('http') ? poster : `${SITE_URL}${poster}`) : '',
        type,
      });
    });

    if (extracted.length > best.length) best = extracted;
    if (extracted.length >= 20) break;
  }

  return best;
}

function detectSections($) {
  const sections = [];
  const seenNames = new Set();

  // Try section containers
  $('section').each((_, sectionEl) => {
    const $s = $(sectionEl);
    let name = $s.find('h3.section-title').first().text().trim()
      || $s.find('h3').first().text().trim()
      || $s.find('h2').first().text().trim()
      || '';
    if (!name || seenNames.has(name)) return;
    seenNames.add(name);
    const items = extractItems($, sectionEl);
    if (items.length >= 3) sections.push({ name, items });
  });

  // Fallback: extract all items
  if (sections.length === 0) {
    const allItems = extractItems($, null);
    if (allItems.length > 0) sections.push({ name: 'Latest', items: allItems });
  }

  return sections;
}

function saveJson(filename, data) {
  const filePath = join(DATA_DIR, filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  const size = JSON.stringify(data).length;
  totalFetched += size;
  console.log(`  ✓ ${filename} (${(size / 1024).toFixed(1)} KB)`);
}

async function refresh() {
  console.log('Refreshing PirateXPlay data...\n');
  console.log(`Site URL: ${SITE_URL}\n`);

  // Create data dir
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  // ----- HOME -----
  console.log('[1/4] Fetching home page...');
  const homePaths = ['/home', '/', '/?s=a', '/category/latest'];
  let homeHtml = null;
  for (const p of homePaths) {
    try {
      homeHtml = await fetchHtml(p);
      console.log(`  Fetched ${p}: ${homeHtml.length} bytes`);
      if (homeHtml.length > 2000) break;
    } catch (e) {
      console.log(`  ${p}: ${e.message}`);
    }
  }
  if (!homeHtml || homeHtml.length < 2000) {
    throw new Error('Could not fetch home page from any path');
  }
  const $home = cheerio.load(homeHtml);
  const sections = detectSections($home);
  saveJson('home.json', { sections, fetchedAt: new Date().toISOString() });

  // ----- SEARCH: common queries -----
  const queries = ['a', 'one piece', 'naruto', 'dragon ball', 'attack on titan', 'demon slayer', 'jujutsu', 'movie', 'series', 'anime'];
  console.log(`\n[2/4] Pre-caching search results (${queries.length} queries)...`);
  for (const q of queries) {
    try {
      const html = await fetchHtml(`/?s=${encodeURIComponent(q)}`);
      const $ = cheerio.load(html);
      const items = extractItems($, null);
      const filename = `search-${q.replace(/\s+/g, '-').toLowerCase()}.json`;
      saveJson(filename, { query: q, results: items, total: items.length, fetchedAt: new Date().toISOString() });
    } catch (e) {
      console.log(`  ✗ "${q}": ${e.message}`);
    }
  }

  // ----- Discovered URLs -----
  console.log('\n[3/4] Collecting content URLs from home page...');
  const allItems = sections.flatMap((s) => s.items);
  const uniqueUrls = [...new Map(allItems.map((i) => [i.url, i])).values()];
  console.log(`  Found ${uniqueUrls.length} unique content URLs`);

  // Save first 20 popular items for info/watch pre-cache
  const popular = uniqueUrls.slice(0, 20);
  saveJson('popular.json', { items: popular, fetchedAt: new Date().toISOString() });

  // Pre-cache info pages
  console.log(`\n[4/4] Pre-caching info pages for ${popular.length} items...`);
  let infoCount = 0;
  for (const item of popular) {
    try {
      const html = await fetchHtml(item.url);
      const $ = cheerio.load(html);

      const title = $('h1').first().text().trim() || item.title;
      const description = $('meta[property="og:description"]').attr('content') || '';
      const posterImg = $('.post-thumbnail img').first().attr('src') || $('img').first().attr('src') || '';
      const poster = posterImg ? (posterImg.startsWith('http') ? posterImg : `${SITE_URL}${posterImg}`) : '';

      const genres = [];
      $('a[href*="/genre/"]').each((_, el) => { const g = $(el).text().trim(); if (g && !genres.includes(g)) genres.push(g); });

      const episodes = [];
      $('a[href*="/episode/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const match = href.match(/-(\d+)x(\d+)\/?$/);
        const season = match ? parseInt(match[1]) : 1;
        const episodeNum = match ? parseInt(match[2]) : 0;
        episodes.push({
          season, episode: episodeNum,
          title: $(el).text().trim() || `Episode ${episodeNum}`,
          url: href.startsWith('http') ? href : `${SITE_URL}${href}`,
        });
      });
      episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);

      const slug = item.url.split('/').filter(Boolean).pop() || `item-${infoCount}`;
      const filename = `info-${slug}.json`;
      saveJson(filename, {
        title, description, poster, banner: poster,
        genres, year: '', duration: '',
        seasons: [...new Set(episodes.map((e) => e.season))].length,
        episodes,
        recommendations: [],
        fetchedAt: new Date().toISOString(),
      });
      infoCount++;
    } catch (e) {
      console.log(`  ✗ ${item.title}: ${e.message}`);
    }
  }

  const totalMb = (totalFetched / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ Refresh complete. ${totalMb} MB of data written to ${DATA_DIR}`);
  console.log(`   ${infoCount} info pages cached.`);
}

refresh().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

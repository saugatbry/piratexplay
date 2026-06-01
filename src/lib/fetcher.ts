import axios, { AxiosInstance } from 'axios';
import { load } from 'cheerio';
import { isCloudflareChallenge, isBlockedPage, extractCloudflareError, isGoogleCacheReject } from './cloudflare';
import * as cache from './cache';
import * as logger from './logger';
import { FetchResult } from '@/types';

const SITE_URL = process.env.SITE_URL || 'https://piratexplay.cc';
const PROXY_URL = process.env.PROXY_URL || '';
const ENABLE_PLAYWRIGHT = process.env.ENABLE_PLAYWRIGHT === 'true' || false;

const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const UA_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': UA_CHROME,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

let cookieJar = '';
let directClient: AxiosInstance | null = null;

function getAxiosClient(): AxiosInstance {
  if (!directClient) {
    directClient = axios.create({
      timeout: 10000,
      headers: BROWSER_HEADERS,
      maxRedirects: 5,
      decompress: true,
    });
    directClient.interceptors.request.use((config) => {
      if (cookieJar) {
        config.headers.Cookie = cookieJar;
      }
      return config;
    });
    directClient.interceptors.response.use(
      (res) => {
        const sc = res.headers['set-cookie'];
        if (sc) {
          const arr = Array.isArray(sc) ? sc : [sc];
          for (const c of arr) {
            const name = c.split('=')[0];
            const val = c.split(';')[0].split('=').slice(1).join('=');
            if (name && val && !cookieJar.includes(`${name}=`)) {
              cookieJar += (cookieJar ? '; ' : '') + `${name}=${val}`;
            }
          }
        }
        return res;
      },
      (err) => Promise.reject(err)
    );
  }
  return directClient;
}

function fullUrl(url: string): string {
  return url.startsWith('http') ? url : `${SITE_URL}${url}`;
}

function makeResult(html: string, strategy: string, status: number, startTime: number, error?: string): FetchResult {
  return {
    html,
    strategy,
    status,
    timeMs: Date.now() - startTime,
    cloudflareDetected: isCloudflareChallenge(html),
    error,
  };
}

function isValidHtml(html: string): boolean {
  return html.length > 500 && !isBlockedPage(html);
}

// ======== STRATEGY A: DIRECT (Axios with browser headers + cookies) ========

async function strategyDirect(url: string): Promise<FetchResult | null> {
  const start = Date.now();
  try {
    const client = getAxiosClient();
    const res = await client.get<string>(fullUrl(url), {
      responseType: 'text',
      transformResponse: [(d) => d],
      headers: { ...BROWSER_HEADERS },
    });
    const html = res.data || '';
    const result = makeResult(html, 'direct', res.status, start);
    logStrategy(result);
    if (isValidHtml(html)) return result;
    return null;
  } catch (err: any) {
    const status = err?.response?.status || 0;
    const result = makeResult('', 'direct', status, start, err?.message);
    logStrategy(result);
    return null;
  }
}

// ======== STRATEGY B: PLAYWRIGHT (Headless Chromium) ========

let playwrightModule: any = null;
try {
  playwrightModule = require('playwright');
} catch {
  logger.debug('Playwright not available, strategy disabled');
}

let browserInstance: any = null;
let browserLastUsed = 0;
const BROWSER_IDLE_MS = 5 * 60 * 1000;

async function getPlaywrightBrowser(): Promise<any> {
  if (browserInstance) {
    try {
      await browserInstance.contexts();
      browserLastUsed = Date.now();
      return browserInstance;
    } catch {
      browserInstance = null;
    }
  }
  if (!playwrightModule) return null;
  try {
    const execPath = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
    browserInstance = await playwrightModule.chromium.launch({
      headless: true,
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
      ],
    });
    browserLastUsed = Date.now();
    return browserInstance;
  } catch (err) {
    logger.error('Failed to launch Playwright browser', { error: String(err) });
    return null;
  }
}

async function closeIdleBrowser(): Promise<void> {
  if (browserInstance && Date.now() - browserLastUsed > BROWSER_IDLE_MS) {
    try {
      await browserInstance.close();
    } catch { /* ignore */ }
    browserInstance = null;
  }
}

async function strategyPlaywright(url: string): Promise<FetchResult | null> {
  if (!ENABLE_PLAYWRIGHT) return null;
  const start = Date.now();
  try {
    const browser = await getPlaywrightBrowser();
    if (!browser) return null;

    const context = await browser.newContext({
      userAgent: UA_CHROME,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    try {
      await page.goto(fullUrl(url), {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      await page.waitForTimeout(2000);
      const html = await page.content();
      const status = 200;
      const result = makeResult(html, 'playwright', status, start);
      logStrategy(result);
      if (isValidHtml(html)) return result;
      return null;
    } finally {
      await context.close();
    }
  } catch (err: any) {
    const result = makeResult('', 'playwright', 0, start, err?.message);
    logStrategy(result);
    return null;
  }
}

// ======== STRATEGY C: GOOGLE CACHE ========

function extractFinalUrl(res: any): string {
  try {
    // Axios 1.x on Node
    if (res.request?.res?.responseUrl) return res.request.res.responseUrl;
    if (res.request?._currentUrl) return res.request._currentUrl;
    if (res.responseUrl) return res.responseUrl;
    if (res.config?.url) return res.config.url;
  } catch { /* ignore */ }
  return '';
}

async function strategyGoogleCache(url: string): Promise<FetchResult | null> {
  const start = Date.now();
  const full = fullUrl(url);
  const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(full)}&strip=1&vwsrc=0`;

  logger.info(`[GOOGLE CACHE] Requesting: ${cacheUrl}`);

  try {
    const res = await axios.get<string>(cacheUrl, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': UA_CHROME,
        'Accept': 'text/html,*/*',
      },
      responseType: 'text',
      transformResponse: [(d) => d],
    });
    const html = res.data || '';
    const finalUrl = extractFinalUrl(res);

    const result = makeResult(html, 'google-cache', res.status, start);
    result._finalUrl = finalUrl;
    result._cacheUrl = cacheUrl;

    logger.info(`[GOOGLE CACHE] Status: ${res.status}, Final: ${finalUrl}, Len: ${html.length}`);

    // Validate: reject Google Search pages, "no cached version", etc.
    const rejectReason = isGoogleCacheReject(html);
    if (rejectReason) {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '(no title)';
      result._errorDetail = `Rejected: ${rejectReason}, title="${title}", finalUrl="${finalUrl}"`;
      logger.warn(`[GOOGLE CACHE] ${result._errorDetail}`);
      logStrategy(result);
      return null;
    }

    logStrategy(result);
    return result;
  } catch (err: any) {
    const result = makeResult('', 'google-cache', 0, start, err?.message);
    result._cacheUrl = cacheUrl;
    logger.error(`[GOOGLE CACHE] Error: ${err?.message}`);
    logStrategy(result);
    return null;
  }
}

// ======== STRATEGY D: JINA AI READER ========

async function strategyJina(url: string): Promise<FetchResult | null> {
  const start = Date.now();
  try {
    const jinaUrl = `https://r.jina.ai/http://${new URL(fullUrl(url)).host}${new URL(fullUrl(url)).pathname}${new URL(fullUrl(url)).search}`;
    const res = await axios.get<string>(jinaUrl, {
      timeout: 20000,
      headers: {
        'User-Agent': UA_CHROME,
        'X-Return-Format': 'html',
        'Accept': 'text/html,*/*',
      },
      responseType: 'text',
      transformResponse: [(d) => d],
    });
    let html = res.data || '';
    const result = makeResult(html, 'jina-ai', res.status, start);
    logStrategy(result);
    if (html && html.length > 500) {
      return result;
    }
    return null;
  } catch (err: any) {
    const result = makeResult('', 'jina-ai', 0, start, err?.message);
    logStrategy(result);
    return null;
  }
}

// ======== STRATEGY E: CUSTOM PROXY ========

async function strategyProxy(url: string): Promise<FetchResult | null> {
  if (!PROXY_URL) return null;
  const start = Date.now();
  try {
    const proxyTarget = `${PROXY_URL}${encodeURIComponent(fullUrl(url))}`;
    const res = await axios.get<string>(proxyTarget, {
      timeout: 20000,
      headers: { 'User-Agent': UA_CHROME },
      responseType: 'text',
      transformResponse: [(d) => d],
    });
    const html = res.data || '';
    const result = makeResult(html, 'proxy', res.status, start);
    logStrategy(result);
    if (isValidHtml(html)) return result;
    return null;
  } catch (err: any) {
    const result = makeResult('', 'proxy', 0, start, err?.message);
    logStrategy(result);
    return null;
  }
}

function logStrategy(result: FetchResult): void {
  logger.logFetch({
    url: 'logged',
    strategy: result.strategy,
    status: result.status,
    timeMs: result.timeMs,
    htmlLength: result.html.length,
    cloudflareDetected: result.cloudflareDetected,
    success: isValidHtml(result.html),
    error: result.error,
  });
}

// ======== STRATEGY REGISTRY ========

interface Strategy {
  name: string;
  fetch: (url: string) => Promise<FetchResult | null>;
}

const STRATEGIES: Strategy[] = [
  { name: 'direct', fetch: strategyDirect },
  { name: 'playwright', fetch: strategyPlaywright },
  { name: 'google-cache', fetch: strategyGoogleCache },
  { name: 'jina-ai', fetch: strategyJina },
  { name: 'proxy', fetch: strategyProxy },
];

let lastCleanup = 0;

// ======== PUBLIC API ========

export async function fetchHTML(url: string, options?: { skipCache?: boolean; preferredStrategy?: string }): Promise<string> {
  const result = await fetchWithManager(url, options);
  return result.html;
}

export async function fetchWithManager(
  url: string,
  options?: { skipCache?: boolean; preferredStrategy?: string }
): Promise<FetchResult> {
  const full = fullUrl(url);

  if (!options?.skipCache) {
    const cached = cache.get<FetchResult>(full);
    if (cached) return cached;
  }

  const strat = options?.preferredStrategy;
  const ordered = strat
    ? [...STRATEGIES.filter((s) => s.name === strat), ...STRATEGIES.filter((s) => s.name !== strat)]
    : STRATEGIES;

  for (const s of ordered) {
    try {
      const result = await s.fetch(url);
      if (result && isValidHtml(result.html)) {
        cache.setWithTTL(full, result, 120);
        return result;
      }
    } catch { /* continue */ }
  }

  const lastResult = await STRATEGIES[0].fetch(url);
  if (lastResult && lastResult.html) {
    throw new FetchError(
      `All fetch strategies failed for ${full}. Last error: ${extractCloudflareError(lastResult.html)}`,
      lastResult.strategy,
      lastResult.cloudflareDetected,
      lastResult
    );
  }

  throw new FetchError(`All fetch strategies failed for ${full}`, 'none', false);
}

export class FetchError extends Error {
  strategy: string;
  cloudflareDetected: boolean;
  debug?: FetchResult;

  constructor(message: string, strategy: string, cloudflareDetected: boolean, debug?: FetchResult) {
    super(message);
    this.name = 'FetchError';
    this.strategy = strategy;
    this.cloudflareDetected = cloudflareDetected;
    this.debug = debug;
  }
}

export async function fetchHTMLWithRetry(
  paths: string[],
  options?: { skipCache?: boolean }
): Promise<{ html: string; usedPath: string; debug: FetchResult } | null> {
  for (const path of paths) {
    try {
      const result = await fetchWithManager(path, { skipCache: options?.skipCache });
      if (result.html?.length > 500) {
        return { html: result.html, usedPath: path, debug: result };
      }
    } catch { continue; }
  }
  return null;
}

export async function fetchCheerio(url: string, options?: { skipCache?: boolean }) {
  return load(await fetchHTML(url, options));
}

export function isAbsoluteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function resolveUrl(base: string, relative: string): string {
  if (isAbsoluteUrl(relative)) return relative;
  try { return new URL(relative, base).href; }
  catch { try { return new URL(relative, SITE_URL).href; } catch { return relative; } }
}

export async function getDebugInfo(url: string): Promise<{
  strategy: string;
  status: number;
  timeMs: number;
  cloudflareDetected: boolean;
  cloudflareError: string;
  htmlLength: number;
  allResults: FetchResult[];
}> {
  const full = fullUrl(url);
  const allResults: FetchResult[] = [];

  for (const s of STRATEGIES) {
    try {
      const result = await s.fetch(url);
      if (result) {
        allResults.push(result);
        if (isValidHtml(result.html)) {
          return {
            strategy: result.strategy,
            status: result.status,
            timeMs: result.timeMs,
            cloudflareDetected: result.cloudflareDetected,
            cloudflareError: result.cloudflareDetected ? extractCloudflareError(result.html) : '',
            htmlLength: result.html.length,
            allResults,
          };
        }
      }
    } catch { /* continue */ }
  }

  return {
    strategy: 'none',
    status: 0,
    timeMs: 0,
    cloudflareDetected: allResults.some((r) => r.cloudflareDetected),
    cloudflareError: allResults.length > 0 ? extractCloudflareError(allResults[0].html) : 'Could not reach site',
    htmlLength: 0,
    allResults,
  };
}

export { SITE_URL };

import axios from 'axios';
import { load } from 'cheerio';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { isCloudflareChallenge, isBlockedPage, extractCloudflareError } from './cloudflare';
import * as cache from './cache';
import { FetchResult } from '@/types';

const SITE_URL = process.env.SITE_URL || 'https://piratexplay.cc';

interface ProxyEntry {
  host: string;
  port: number;
  username: string;
  password: string;
}

const PROXY_LIST: ProxyEntry[] = [
  { host: '38.154.203.95', port: 5863, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
  { host: '198.105.121.200', port: 6462, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
  { host: '64.137.96.74', port: 6641, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
  { host: '209.127.138.10', port: 5784, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
  { host: '38.154.185.97', port: 6370, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
  { host: '84.247.60.125', port: 6095, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
  { host: '142.111.67.146', port: 5611, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
  { host: '191.96.254.138', port: 6185, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
  { host: '31.58.9.4', port: 6077, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
  { host: '104.239.107.47', port: 5699, username: 'qaszsvzc', password: 'jqrrolu1mb6v' },
];

const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

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

function fullUrl(url: string): string {
  return url.startsWith('http') ? url : `${SITE_URL}${url}`;
}

function makeResult(html: string, strategy: string, status: number, startTime: number, error?: string): FetchResult {
  return { html, strategy, status, timeMs: Date.now() - startTime, cloudflareDetected: isCloudflareChallenge(html), error };
}

function isValidHtml(html: string): boolean {
  return html.length > 500 && !isBlockedPage(html);
}

function getAgents(proxy: ProxyEntry) {
  const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  const agent = new HttpsProxyAgent(proxyUrl);
  return { httpsAgent: agent, httpAgent: agent };
}

function shuffleProxies(): ProxyEntry[] {
  const arr = [...PROXY_LIST];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchViaProxy(url: string, proxy: ProxyEntry): Promise<FetchResult | null> {
  const start = Date.now();
  const agents = getAgents(proxy);
  try {
    const res = await axios.get<string>(url, {
      timeout: 20000,
      responseType: 'text',
      transformResponse: [(d) => d],
      headers: { ...BROWSER_HEADERS },
      ...agents,
      proxy: false,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });
    const html = res.data || '';
    const result = makeResult(html, 'proxy', res.status, start);
    if (isValidHtml(html)) return result;
    return null;
  } catch (err: any) {
    return null;
  }
}

async function fetchDirect(url: string): Promise<FetchResult | null> {
  const start = Date.now();
  try {
    const res = await axios.get<string>(url, {
      timeout: 10000,
      responseType: 'text',
      transformResponse: [(d) => d],
      headers: { ...BROWSER_HEADERS },
      proxy: false,
      maxRedirects: 5,
    });
    const html = res.data || '';
    const result = makeResult(html, 'direct', res.status, start);
    if (isValidHtml(html)) return result;
    return null;
  } catch {
    return null;
  }
}

async function fetchBest(url: string): Promise<FetchResult> {
  const proxies = shuffleProxies();
  for (const proxy of proxies) {
    const result = await fetchViaProxy(url, proxy);
    if (result) return result;
  }
  const direct = await fetchDirect(url);
  if (direct) return direct;
  return makeResult('', 'none', 0, Date.now(), 'All proxies failed');
}

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
  const result = await fetchBest(url);
  if (result.html && isValidHtml(result.html)) {
    cache.setWithTTL(full, result, 120);
    return result;
  }
  throw new FetchError(
    `Failed to fetch ${full}. ${extractCloudflareError(result.html)}`,
    result.strategy,
    result.cloudflareDetected,
    result
  );
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
  const result = await fetchBest(url);
  const allResults = [result];
  if (result.html && isValidHtml(result.html)) {
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

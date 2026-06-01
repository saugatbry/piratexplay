import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { load } from 'cheerio';

const SITE_URL = process.env.SITE_URL || 'https://piratexplay.cc';
const PROXY_URL = process.env.PROXY_URL || '';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  Connection: 'keep-alive',
  DNT: '1',
};

let cookieJar: string = '';
let client: AxiosInstance;
let lastProxyFail: number = 0;

function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      timeout: 8000,
      headers: BROWSER_HEADERS,
      maxRedirects: 10,
      withCredentials: true,
      decompress: true,
    });

    client.interceptors.request.use((config) => {
      if (!config.headers.Cookie && cookieJar) config.headers.Cookie = cookieJar;
      if (!config.headers.Referer) config.headers.Referer = SITE_URL;
      return config;
    });

    client.interceptors.response.use(
      (response) => {
        const setCookie = response.headers['set-cookie'];
        if (setCookie) {
          const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
          for (const c of cookies) {
            const name = c.split('=')[0];
            const value = c.split(';')[0].split('=').slice(1).join('=');
            if (!cookieJar.includes(name)) cookieJar += (cookieJar ? '; ' : '') + `${name}=${value}`;
          }
        }
        return response;
      },
      async (error) => {
        if (error.response?.status === 429) {
          await new Promise((r) => setTimeout(r, 3000));
          return client(error.config);
        }
        throw error;
      }
    );
  }
  return client;
}

async function fetchViaProxy(fullUrl: string): Promise<string> {
  const proxyBase = PROXY_URL || 'https://api.allorigins.win/raw?url=';
  const proxyUrl = `${proxyBase}${encodeURIComponent(fullUrl)}`;

  const res = await axios.get<string>(proxyUrl, {
    timeout: 8000,
    headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] },
    responseType: 'text',
    transformResponse: [(data) => data],
  });

  if (!res.data || res.data.length < 200) throw new Error('Empty proxy response');
  return res.data;
}

export async function fetchHTML(url: string, options: AxiosRequestConfig = {}): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : `${SITE_URL}${url}`;

  // Always try direct first (fast on local, fast-fail on Vercel)
  try {
    return await getClient().get<string>(fullUrl, {
      ...options,
      headers: { ...BROWSER_HEADERS, Referer: SITE_URL, ...(options.headers || {}) },
      responseType: 'text',
      transformResponse: [(data) => data],
    }).then(r => r.data);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status !== 403 && status !== 429) throw err;
  }

  // Cooldown: skip proxy if it just failed
  if (Date.now() - lastProxyFail < 5000) {
    throw new Error('Direct and proxy both unavailable');
  }

  try {
    const result = await fetchViaProxy(fullUrl);
    return result;
  } catch {
    lastProxyFail = Date.now();
    throw new Error('Proxy failed');
  }
}

export async function fetchHTMLWithRetry(
  paths: string[],
  options: AxiosRequestConfig = {}
): Promise<{ html: string; usedPath: string } | null> {
  for (const path of paths) {
    try {
      const html = await fetchHTML(path, options);
      if (html?.length > 500) return { html, usedPath: path };
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchCheerio(url: string, options: AxiosRequestConfig = {}) {
  const html = await fetchHTML(url, options);
  return load(html);
}

export function isAbsoluteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function resolveUrl(base: string, relative: string): string {
  if (isAbsoluteUrl(relative)) return relative;
  try { return new URL(relative, base).href; }
  catch { try { return new URL(relative, SITE_URL).href; } catch { return relative; } }
}

export { SITE_URL };

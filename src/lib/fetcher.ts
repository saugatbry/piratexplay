import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { load } from 'cheerio';

const SITE_URL = process.env.SITE_URL || 'https://piratexplay.cc';
const PROXY_URL = process.env.PROXY_URL || '';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
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

const CORS_PROXIES = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url=',
];

let cookieJar: string = '';
let client: AxiosInstance;

function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      timeout: 30000,
      headers: BROWSER_HEADERS,
      maxRedirects: 10,
      withCredentials: true,
      decompress: true,
    });

    client.interceptors.request.use((config) => {
      if (!config.headers.Cookie && cookieJar) {
        config.headers.Cookie = cookieJar;
      }
      if (!config.headers.Referer) {
        config.headers.Referer = SITE_URL;
      }
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
            if (!cookieJar.includes(name)) {
              cookieJar += (cookieJar ? '; ' : '') + `${name}=${value}`;
            }
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

async function warmupCookies(): Promise<void> {
  if (cookieJar) return;
  try {
    const res = await getClient().get(SITE_URL, {
      headers: { ...BROWSER_HEADERS, Referer: 'https://www.google.com/' },
      timeout: 15000,
    });
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const c of cookies) {
        const name = c.split('=')[0];
        const value = c.split(';')[0].split('=').slice(1).join('=');
        cookieJar += (cookieJar ? '; ' : '') + `${name}=${value}`;
      }
    }
  } catch {
    // warmup failed, continue without cookies
  }
}

async function tryDirectFetch(
  fullUrl: string,
  options: AxiosRequestConfig
): Promise<string> {
  const res = await getClient().get<string>(fullUrl, {
    ...options,
    headers: {
      ...BROWSER_HEADERS,
      ...(options.headers || {}),
    },
    responseType: 'text',
    transformResponse: [(data) => data],
  });
  return res.data;
}

async function tryProxyFetch(
  fullUrl: string,
  options: AxiosRequestConfig
): Promise<string> {
  const userProxy = PROXY_URL;
  const proxies = userProxy ? [userProxy] : CORS_PROXIES;

  for (const proxy of proxies) {
    try {
      const proxyUrl = `${proxy}${encodeURIComponent(fullUrl)}`;
      const res = await axios.get<string>(proxyUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': BROWSER_HEADERS['User-Agent'],
          Accept: 'text/html, */*',
        },
        responseType: 'text',
        transformResponse: [(data) => data],
      });

      const data = res.data;
      if (data && data.length > 200 && !data.includes('cf-error') && !data.includes('Attention Required')) {
        return data;
      }
    } catch {
      continue;
    }
  }

  throw new Error('All proxies failed');
}

export async function fetchHTML(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : `${SITE_URL}${url}`;

  await warmupCookies();

  try {
    return await tryDirectFetch(fullUrl, options);
  } catch (directError: any) {
    if (directError?.response?.status === 403 || directError?.response?.status === 429) {
      try {
        return await tryProxyFetch(fullUrl, options);
      } catch {
        throw directError;
      }
    }
    throw directError;
  }
}

export async function fetchHTMLWithRetry(
  paths: string[],
  options: AxiosRequestConfig = {}
): Promise<{ html: string; usedPath: string } | null> {
  for (const path of paths) {
    try {
      const html = await fetchHTML(path, options);
      if (html && html.length > 500) {
        return { html, usedPath: path };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchCheerio(
  url: string,
  options: AxiosRequestConfig = {}
) {
  const html = await fetchHTML(url, options);
  return load(html);
}

export function isAbsoluteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function resolveUrl(base: string, relative: string): string {
  if (isAbsoluteUrl(relative)) return relative;
  try {
    return new URL(relative, base).href;
  } catch {
    try {
      return new URL(relative, SITE_URL).href;
    } catch {
      return relative;
    }
  }
}

export { SITE_URL };

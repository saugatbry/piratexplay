import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { load } from 'cheerio';

const SITE_URL = process.env.SITE_URL || 'https://piratexplay.cc';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

let client: AxiosInstance;

function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      timeout: 25000,
      headers: DEFAULT_HEADERS,
      maxRedirects: 10,
      withCredentials: true,
      decompress: true,
    });
    client.interceptors.response.use(
      (r) => r,
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

export async function fetchHTML(url: string, options: AxiosRequestConfig = {}): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : `${SITE_URL}${url}`;
  const res = await getClient().get<string>(fullUrl, {
    ...options,
    responseType: 'text',
    transformResponse: [(data: string) => data],
  });
  return res.data;
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

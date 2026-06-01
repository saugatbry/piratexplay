import { load, CheerioAPI } from 'cheerio';

const SITE_URL = process.env.SITE_URL || 'https://piratexplay.cc';

export function parseHTML(html: string): CheerioAPI {
  return load(html);
}

export function extractText($: CheerioAPI, selector: string): string {
  return $(selector).first().text().trim();
}

export function extractAttr($: CheerioAPI, selector: string, attr: string): string | null {
  const el = $(selector).first();
  return el.attr(attr) || null;
}

export function extractAllAttrs($: CheerioAPI, selector: string, attr: string): string[] {
  const values: string[] = [];
  $(selector).each((_, el) => {
    const val = $(el).attr(attr);
    if (val) values.push(val);
  });
  return values;
}

export function extractInlineUrls(html: string): string[] {
  const urls: string[] = [];
  const patterns = [
    /(?:https?:)?\/\/[^\s"'<>]+\.(?:m3u8|mp4|ts)\b/g,
    /src:\s*['"]([^'"]+)['"]/g,
    /file:\s*['"]([^'"]+)['"]/g,
    /url:\s*['"]([^'"]+)['"]/g,
    /data-src=['"]([^'"]+)['"]/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = (match[1] || match[0]).trim();
      if (url.length > 5 && !urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}

export function extractIframeSources($: CheerioAPI): string[] {
  const sources: string[] = [];
  $('iframe').each((_, el) => {
    const src = $(el).attr('src');
    if (src) sources.push(src);
    const dataSrc = $(el).attr('data-src');
    if (dataSrc) sources.push(dataSrc);
  });
  return sources;
}

export { SITE_URL };

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithManager, resolveUrl, SITE_URL } from '@/lib/fetcher';
import { load } from 'cheerio';

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url') || '/home';
  const fullUrl = urlParam.startsWith('http') ? urlParam : `${SITE_URL}${urlParam}`;

  try {
    const result = await fetchWithManager(urlParam, { skipCache: true });
    const $ = load(result.html);

    const title = $('title').first().text().trim() || '(none)';
    const h1Tags: string[] = [];
    $('h1').each((_, el) => { const t = $(el).text().trim(); if (t) h1Tags.push(t); });
    const h2Tags: string[] = [];
    $('h2').each((_, el) => { const t = $(el).text().trim(); if (t) h2Tags.push(t); });
    const h3Tags: string[] = [];
    $('h3').each((_, el) => { const t = $(el).text().trim(); if (t) h3Tags.push(t); });

    const sections: { tag: string; id: string; classes: string; childCount: number; htmlPreview: string }[] = [];
    $('section').each((_, el) => {
      const $el = $(el);
      sections.push({
        tag: 'section',
        id: $el.attr('id') || '',
        classes: ($el.attr('class') || ''),
        childCount: $el.children().length,
        htmlPreview: $el.html()?.slice(0, 300)?.replace(/\s+/g, ' ')?.trim()?.slice(0, 200) || '',
      });
    });

    const articles: { classes: string; childCount: number; links: number; images: number }[] = [];
    $('article').each((_, el) => {
      const $el = $(el);
      articles.push({
        classes: $el.attr('class') || '',
        childCount: $el.children().length,
        links: $el.find('a').length,
        images: $el.find('img').length,
      });
    });

    const divs: { classes: string; id: string; childCount: number; textLen: number }[] = [];
    $('div[class]').each((_, el) => {
      const $el = $(el);
      const cls = $el.attr('class') || '';
      if (cls.length > 200) return;
      const text = $el.text().trim();
      divs.push({
        classes: cls,
        id: $el.attr('id') || '',
        childCount: $el.children().length,
        textLen: text.length,
      });
    });

    const lis: { classes: string; links: number; images: number; text: string }[] = [];
    $('li').each((_, el) => {
      const $el = $(el);
      lis.push({
        classes: $el.attr('class') || '',
        links: $el.find('a').length,
        images: $el.find('img').length,
        text: $el.text().trim().slice(0, 100),
      });
    });

    const uls: { classes: string; liCount: number }[] = [];
    $('ul').each((_, el) => {
      const $el = $(el);
      uls.push({
        classes: $el.attr('class') || '',
        liCount: $el.find('li').length,
      });
    });

    const allClasses: string[] = [];
    $('[class]').each((_, el) => {
      const c = $(el).attr('class');
      if (c) {
        c.split(/\s+/).forEach((cls) => {
          if (cls && !allClasses.includes(cls)) allClasses.push(cls);
        });
      }
    });
    allClasses.sort();

    const allIds: string[] = [];
    $('[id]').each((_, el) => {
      const id = $(el).attr('id');
      if (id && !allIds.includes(id)) allIds.push(id);
    });

    const links: { href: string; text: string; class: string }[] = [];
    $('a[href]').each((_, el) => {
      const $el = $(el);
      const h = $el.attr('href') || '';
      const t = $el.text().trim().slice(0, 80);
      const c = $el.attr('class') || '';
      if (h && h !== '#' && !h.startsWith('javascript')) {
        links.push({ href: h, text: t, class: c });
      }
    });
    links.sort((a, b) => a.href.localeCompare(b.href));

    const images: { src: string; alt: string; class: string }[] = [];
    $('img[src]').each((_, el) => {
      const $el = $(el);
      images.push({
        src: ($el.attr('src') || $el.attr('data-src') || '').slice(0, 150),
        alt: ($el.attr('alt') || '').slice(0, 80),
        class: $el.attr('class') || '',
      });
    });

    return NextResponse.json({
      url: fullUrl,
      strategy: result.strategy,
      status: result.status,
      htmlLength: result.html.length,
      cloudflareDetected: result.cloudflareDetected,
      title,
      headings: { h1: h1Tags, h2: h2Tags, h3: h3Tags },
      sections,
      articles,
      listItems: lis.slice(0, 30),
      lists: uls,
      divs: divs.filter((d) => d.textLen > 50).slice(0, 50),
      allClasses: allClasses.slice(0, 100),
      allIds: allIds.slice(0, 50),
      links: links.slice(0, 50),
      images: images.slice(0, 30),
      htmlPreview: result.html.slice(0, 10000),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

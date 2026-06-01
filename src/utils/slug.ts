const SITE_URL = process.env.SITE_URL || 'https://piratexplay.cc';

export type SlugType = 'series' | 'movie' | 'episode';

export function detectSlugType(slug: string): SlugType {
  if (/-\d+x\d+\/?$/.test(slug)) return 'episode';
  if (/season-\d+/.test(slug)) return 'series';
  return 'movie';
}

export function slugToUrl(slug: string): string {
  const type = detectSlugType(slug);
  const clean = slug.replace(/\/+$/, '');
  switch (type) {
    case 'episode':
      return `${SITE_URL}/episode/${clean}/`;
    case 'series':
      return `${SITE_URL}/series/${clean}`;
    case 'movie':
      return `${SITE_URL}/movies/${clean}`;
  }
}

export function normalizeId(id: string): string {
  if (id.startsWith('http://') || id.startsWith('https://')) {
    return id;
  }
  return slugToUrl(id.replace(/^\//, ''));
}

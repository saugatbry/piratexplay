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

export function slugFromUrl(urlOrSlug: string): string | null {
  try {
    const parts = urlOrSlug.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last.length > 5 && last.length < 200) return last;
    return parts[parts.length - 2] || null;
  } catch {
    return urlOrSlug.includes('-') ? urlOrSlug : null;
  }
}

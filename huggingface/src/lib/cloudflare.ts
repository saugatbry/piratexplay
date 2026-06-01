export function isCloudflareChallenge(html: string): boolean {
  if (!html || html.length < 200) return false;
  const indicators = [
    'cf-browser-verification',
    'cf-challenge',
    'cf-turnstile',
    'challenge-form',
    'Attention Required!',
    'Just a moment...',
    'Checking your browser',
    'DDoS protection',
    'cf-error',
    'Cloudflare',
    '/cdn-cgi/',
    'captcha-bypass',
    'turnstile',
    'data-sitekey',
    'challenge-platform',
    'unusual traffic',
    'ray_id',
    '__cf_chl_f_tm',
    'cf_chl_opt',
    'cf_email',
  ];
  const lower = html.toLowerCase();
  for (const ind of indicators) {
    if (lower.includes(ind.toLowerCase())) return true;
  }
  return false;
}

export function isGoogleCacheReject(html: string): string | null {
  if (!html || html.length < 200) return 'Empty or too short';
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '(no title)';

  if (title.includes('Google Search') || title.includes('Google')) {
    return `Google Search page instead of cached content (title: "${title}")`;
  }
  const lower = html.toLowerCase();
  if (lower.includes('no cached version')) return 'No cached version available';
  if (lower.includes('this page is not available in the cache')) return 'Page not available in Google cache';
  if (lower.includes('the requested page is not available')) return 'The requested page is not available';
  if (lower.includes('unusual traffic')) return 'Unusual traffic detected';
  if (lower.includes('sorry')) return 'Sorry page';
  if (lower.includes('enable javascript')) return 'Enable JavaScript page';
  if (lower.includes('captcha')) return 'CAPTCHA required';
  if (title.includes('Error') || title.includes('404') || title.includes('Not Found')) {
    return `Error page (title: "${title}")`;
  }
  return null;
}

export function isBlockedPage(html: string): boolean {
  if (!html || html.length < 200) return true;
  if (isCloudflareChallenge(html)) return true;
  if (html.includes('<title>403 Forbidden</title>')) return true;
  if (html.includes('<title>502 Bad Gateway</title>')) return true;
  if (isGoogleCacheReject(html)) return true;
  return false;
}

export function extractCloudflareError(html: string): string {
  if (!html) return 'Empty response';
  if (html.includes('cf-browser-verification') || html.includes('cf-challenge')) {
    return 'Cloudflare challenge detected: browser verification required';
  }
  if (html.includes('cf-turnstile') || html.includes('turnstile')) {
    return 'Cloudflare challenge detected: Turnstile CAPTCHA required';
  }
  if (html.includes('Attention Required') || html.includes('Just a moment')) {
    return 'Cloudflare challenge detected: attention required';
  }
  if (html.includes('<title>403 Forbidden</title>')) {
    return 'HTTP 403 Forbidden';
  }
  if (html.includes('<title>502 Bad Gateway</title>')) {
    return 'HTTP 502 Bad Gateway';
  }
  if (html.includes('unusual traffic')) {
    return 'Unusual traffic detected by Cloudflare';
  }
  if (html.includes('cf-error')) {
    return 'Cloudflare error page';
  }
  const cacheReject = isGoogleCacheReject(html);
  if (cacheReject) return cacheReject;
  return 'Blocked or invalid page';
}

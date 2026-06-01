import { CheerioAPI } from 'cheerio';

export interface ProviderFingerprint {
  name: string;
  domains: string[];
  patterns: RegExp[];
  detectFromHTML: ($: CheerioAPI) => boolean;
}

const providers: ProviderFingerprint[] = [
  {
    name: 'AS-CDN21',
    domains: ['as-cdn21.top'],
    patterns: [/as-cdn21/i],
    detectFromHTML: ($: CheerioAPI) => /as-cdn21/i.test($.html()),
  },
  {
    name: 'Rubystm',
    domains: ['rubystm.com'],
    patterns: [/rubystm/i],
    detectFromHTML: ($: CheerioAPI) => /rubystm/i.test($.html()),
  },
  {
    name: 'PirateXPlay Proxy',
    domains: ['piratexplay.cc'],
    patterns: [/piratexplay\.cc\/public\/player/i],
    detectFromHTML: ($: CheerioAPI) => /piratexplay\.cc\/public\/player/i.test($.html()),
  },
  {
    name: 'Short',
    domains: ['short.icu'],
    patterns: [/short\.icu/i],
    detectFromHTML: ($: CheerioAPI) => /short\.icu/i.test($.html()),
  },
  {
    name: 'Cloudy',
    domains: ['cloudy.upns.one'],
    patterns: [/cloudy\.upns\.one/i],
    detectFromHTML: ($: CheerioAPI) => /cloudy\.upns\.one/i.test($.html()),
  },
  {
    name: 'Strmup',
    domains: ['strmup.to'],
    patterns: [/strmup\.to/i],
    detectFromHTML: ($: CheerioAPI) => /strmup\.to/i.test($.html()),
  },
  {
    name: 'Turbovidhls',
    domains: ['turbovidhls.com'],
    patterns: [/turbovidhls/i],
    detectFromHTML: ($: CheerioAPI) => /turbovidhls/i.test($.html()),
  },
  {
    name: 'Vidmoly',
    domains: ['vidmoly.net'],
    patterns: [/vidmoly/i],
    detectFromHTML: ($: CheerioAPI) => /vidmoly/i.test($.html()),
  },
  {
    name: 'Animesalt',
    domains: ['animesalt.ac'],
    patterns: [/animesalt/i],
    detectFromHTML: ($: CheerioAPI) => /animesalt/i.test($.html()),
  },
  {
    name: 'Vidstreaming',
    domains: ['vidstreaming.xyz', 'vidstreaming.net'],
    patterns: [/vidstreaming/i],
    detectFromHTML: ($: CheerioAPI) => /vidstreaming/i.test($.html()),
  },
  {
    name: 'Gdmirrorbot',
    domains: ['gdmirrorbot.nl'],
    patterns: [/gdmirrorbot/i],
    detectFromHTML: ($: CheerioAPI) => /gdmirrorbot/i.test($.html()),
  },
  {
    name: 'YouTube',
    domains: ['youtube.com', 'youtu.be'],
    patterns: [/youtube/i],
    detectFromHTML: ($: CheerioAPI) => /youtube/i.test($.html()),
  },
  {
    name: 'DoodStream',
    domains: ['dood.ws', 'dood.sh', 'dood.to', 'dood.la', 'dood.wf', 'doodcdn.com'],
    patterns: [/dood/i],
    detectFromHTML: ($: CheerioAPI) => /dood/i.test($.html()),
  },
  {
    name: 'Filemoon',
    domains: ['filemoon.sx', 'filemoon.to'],
    patterns: [/filemoon/i],
    detectFromHTML: ($: CheerioAPI) => /filemoon/i.test($.html()),
  },
  {
    name: 'StreamTape',
    domains: ['streamtape.com', 'streamtape.net', 'strtape.cloud'],
    patterns: [/streamtape/i, /strtape/i],
    detectFromHTML: ($: CheerioAPI) => /streamtape/i.test($.html()),
  },
  {
    name: 'Mp4Upload',
    domains: ['mp4upload.com'],
    patterns: [/mp4upload/i],
    detectFromHTML: ($: CheerioAPI) => /mp4upload/i.test($.html()),
  },
  {
    name: 'VidCloud',
    domains: ['vidcloud.co', 'vidcloud.io', 'vidcloud.pro'],
    patterns: [/vidcloud/i],
    detectFromHTML: ($: CheerioAPI) => /vidcloud/i.test($.html()),
  },
  {
    name: 'SuperEmbed',
    domains: ['superembed.net', 'superembed.co'],
    patterns: [/superembed/i],
    detectFromHTML: ($: CheerioAPI) => /superembed/i.test($.html()),
  },
  {
    name: 'Hydrax',
    domains: ['hydrax.net', 'hwcdn.net'],
    patterns: [/hydrax/i, /hwcdn\.net/i],
    detectFromHTML: ($: CheerioAPI) => /hydrax/i.test($.html()),
  },
  {
    name: 'VidSrc',
    domains: ['vidsrc.me', 'vidsrc.to', 'vidsrc.pro', 'vidsrc.xyz'],
    patterns: [/vidsrc/i],
    detectFromHTML: ($: CheerioAPI) => /vidsrc/i.test($.html()),
  },
  {
    name: 'Unknown',
    domains: [],
    patterns: [],
    detectFromHTML: () => true,
  },
];

export function detectProviderByDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    for (const p of providers) {
      for (const d of p.domains) {
        if (hostname === d || hostname.endsWith('.' + d) || d.endsWith(hostname)) {
          return p.name;
        }
      }
    }
  } catch { /* ignore */ }
  return 'Unknown';
}

export function detectProviderByHTML(html: string): string {
  for (const p of providers) {
    for (const pattern of p.patterns) {
      if (pattern.test(html)) return p.name;
    }
  }
  return 'Unknown';
}

export { providers };

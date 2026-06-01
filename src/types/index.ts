export interface MediaItem {
  title: string;
  url: string;
  poster: string;
  type?: string;
  rating?: string;
}

export interface HomeSection {
  name: string;
  items: MediaItem[];
}

export interface HomeResponse {
  sections: HomeSection[];
  debug?: FetchDebugInfo;
  _scrapeLog?: string[];
}

export interface SearchResult extends MediaItem {
  tmdbRating?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  debug?: FetchDebugInfo;
  _scrapeLog?: string[];
}

export interface EpisodeInfo {
  season: number;
  episode: number;
  title: string;
  url: string;
}

export interface InfoResponse {
  title: string;
  description: string;
  poster: string;
  banner: string;
  genres: string[];
  languages: string[];
  year: string;
  duration: string;
  seasons: number;
  episodes: EpisodeInfo[];
  recommendations: MediaItem[];
  debug?: FetchDebugInfo;
}

export interface VideoSource {
  server: string;
  embed: string;
}

export interface WatchResponse {
  success: boolean;
  title: string;
  sources: VideoSource[];
  debug?: FetchDebugInfo;
}

export interface MediaSource {
  quality: string;
  url: string;
  type: 'mp4' | 'm3u8' | 'ts';
  headers: Record<string, string>;
}

export interface Subtitle {
  language: string;
  url: string;
}

export interface ExtractResponse {
  success: boolean;
  provider: string;
  sources: MediaSource[];
  subtitles: Subtitle[];
}

export interface ProxyConfig {
  url: string;
  headers: Record<string, string>;
}

export interface FetchResult {
  html: string;
  strategy: string;
  status: number;
  timeMs: number;
  cloudflareDetected: boolean;
  error?: string;
  _finalUrl?: string;
  _cacheUrl?: string;
  _errorDetail?: string;
}

export interface FetchDebugInfo {
  url: string;
  strategy: string;
  status: number;
  timeMs: number;
  cloudflareDetected: boolean;
  htmlLength: number;
  cacheHit: boolean;
}

export interface ScrapeValidation {
  valid: boolean;
  reason?: string;
  htmlLength: number;
  cloudflareDetected: boolean;
}

export interface ScrapeError {
  success: false;
  error: string;
  debug?: FetchDebugInfo;
}

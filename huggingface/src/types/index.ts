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
}

export interface SearchResult extends MediaItem {
  tmdbRating?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
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
}

export interface VideoSource {
  server: string;
  embed: string;
}

export interface WatchResponse {
  success: boolean;
  title: string;
  sources: VideoSource[];
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

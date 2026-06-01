# PirateXPlay API

Unofficial REST API for [PirateXPlay](https://piratexplay.cc) — a free anime streaming website. Built with **Next.js 15**, **TypeScript**, **Cheerio**, and **Axios**. Deployable directly to **Vercel** serverless functions.

## Features

- Scrapes PirateXPlay dynamically — no hardcoded selectors for content layout
- Auto-discovers every video embed server on episode/movie pages
- 22+ known embed provider fingerprints (Rubystm, Vidmoly, Gdmirrorbot, etc.)
- In-memory caching with configurable TTL
- Per-IP rate limiting with response headers
- Slug-based IDs — pass clean identifiers like `one-piece-season-1-37854` instead of full URLs

## Base URL

| Environment | URL |
|---|---|
| **Local** | `http://localhost:3000` |
| **Vercel** | `https://your-project.vercel.app` |

---

## Endpoints

### `GET /api/home`

Returns sections from the homepage (Latest Series, Latest Movies, Networks, Languages).

**Example:**

```bash
curl http://localhost:3000/api/home
```

**Response:**

```json
{
  "sections": [
    {
      "name": "Latest Series",
      "items": [
        {
          "title": "Dr. STONE",
          "url": "https://piratexplay.cc/series/dr-stone-season-4-86031",
          "poster": "https://image.tmdb.org/t/p/w500/nKhEks4Lxgv63cyivxnXdtIG1tg.jpg",
          "type": "Series"
        }
      ]
    },
    {
      "name": "Latest Movie",
      "items": [
        {
          "title": "Scarlet (2025)",
          "url": "https://piratexplay.cc/movies/scarlet-2025-1406657",
          "poster": "https://image.tmdb.org/t/p/w500/2O2tOyS4kvO9GtFPHpWmbXvfRQv.jpg",
          "type": "Movie"
        }
      ]
    }
  ]
}
```

---

### `GET /api/search?q=<query>`

Search for anime and movies.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `q` | `string` | Search query (required) |

**Example:**

```bash
curl "http://localhost:3000/api/search?q=one+piece"
```

**Response:**

```json
{
  "results": [
    {
      "title": "One Piece",
      "url": "https://piratexplay.cc/series/one-piece-season-1-37854",
      "poster": "https://image.tmdb.org/t/p/w500/9hW62RDq5Dno8vLABXscddjEq9M.jpg",
      "type": "Series",
      "tmdbRating": "8.7"
    },
    {
      "title": "One Piece Film Red (2022)",
      "url": "https://piratexplay.cc/movies/one-piece-film-red-2022-900667",
      "poster": "https://image.tmdb.org/t/p/w500/ogDXuVkO92GcETZfSofXXemw7gb.jpg",
      "type": "Movie",
      "tmdbRating": "7.2"
    }
  ],
  "total": 35
}
```

---

### `GET /api/info?id=<slug>`

Get detailed information about a series or movie — including description, genres, languages, year, duration, all episodes, and recommendations.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | Series or movie slug (required) |

**Slug patterns:**

| Type | Format | Example |
|---|---|---|
| Series | `name-season-N-ID` | `one-piece-season-1-37854` |
| Movie | `name-year-ID` | `one-piece-film-red-2022-900667` |

**Example:**

```bash
curl "http://localhost:3000/api/info?id=one-piece-season-1-37854"
```

**Response:**

```json
{
  "title": "One Piece",
  "description": "Watch One Piece online for free in HD on PirateXPlay...",
  "poster": "https://image.tmdb.org/t/p/w185/2rmK7mnchw9Xr3XdiTFSxTTLXqv.jpg",
  "banner": "https://image.tmdb.org/t/p/w185/2rmK7mnchw9Xr3XdiTFSxTTLXqv.jpg",
  "genres": ["Action", "Adventure", "Animation", "Comedy", ...],
  "languages": ["Hindi", "English", "Japanese", "Tamil", ...],
  "year": "1999",
  "duration": "24 min",
  "seasons": 1,
  "episodes": [
    {
      "season": 1,
      "episode": 1,
      "title": "Episode 1",
      "url": "https://piratexplay.cc/episode/one-piece-season-1-37854-1x1/"
    }
  ],
  "recommendations": [
    {
      "title": "Dr. STONE",
      "url": "https://piratexplay.cc/series/dr-stone-season-4-86031",
      "poster": "https://image.tmdb.org/t/p/w185/nKhEks4Lxgv63cyivxnXdtIG1tg.jpg",
      "type": "Series"
    }
  ]
}
```

---

### `GET /api/episodes?id=<slug>`

Returns only the episode list for a series.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | Series slug (required) |

**Example:**

```bash
curl "http://localhost:3000/api/episodes?id=one-piece-season-1-37854"
```

**Response:**

```json
[
  {
    "season": 1,
    "episode": 1,
    "title": "Episode 1",
    "url": "https://piratexplay.cc/episode/one-piece-season-1-37854-1x1/"
  },
  {
    "season": 1,
    "episode": 2,
    "title": "Episode 2",
    "url": "https://piratexplay.cc/episode/one-piece-season-1-37854-1x2/"
  }
]
```

---

### `GET /api/watch?id=<slug>`

Discover all video embed servers for an episode or movie. This is the most important endpoint — it finds every iframe, data-src, and server button on the page.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | Episode slug (`name-season-N-ID-NxM`) or movie slug (required) |

**Episode slug format:** `name-season-N-ID-NxM`

```
one-piece-season-1-37854-1x1
└─ name ─┘└─season─┘└id─┘└NxM┘
```

**Example (episode):**

```bash
curl "http://localhost:3000/api/watch?id=one-piece-season-1-37854-1x1"
```

**Example (movie):**

```bash
curl "http://localhost:3000/api/watch?id=one-piece-film-red-2022-900667"
```

**Response:**

```json
{
  "success": true,
  "title": "One Piece 1x1",
  "sources": [
    {
      "server": "As-cdn21",
      "embed": "https://piratexplay.cc/proxy/play.php?url=https://as-cdn21.top/video/8757150decbd89b0f5442ca3db4d0e0e"
    },
    {
      "server": "Rubystm",
      "embed": "https://rubystm.com/e/3hklgq1uj9i6.html"
    },
    {
      "server": "Short",
      "embed": "https://short.icu/A1JwbC_8e"
    },
    {
      "server": "Animesalt",
      "embed": "https://animesalt.ac/multi-lang-plyr/player.php?data=..."
    }
  ]
}
```

---

### `GET /api/providers`

Returns the list of known embed providers and their domains.

**Example:**

```bash
curl http://localhost:3000/api/providers
```

**Response:**

```json
{
  "providers": [
    { "name": "AS-CDN21", "domains": ["as-cdn21.top"] },
    { "name": "Rubystm", "domains": ["rubystm.com"] },
    { "name": "Vidmoly", "domains": ["vidmoly.net"] },
    { "name": "Animesalt", "domains": ["animesalt.ac"] },
    { "name": "Gdmirrorbot", "domains": ["gdmirrorbot.nl"] }
  ],
  "total": 22
}
```

---

## Slug Reference

The API automatically detects the content type from the slug pattern:

| Pattern | Detected Type | Example Slug | Generated URL |
|---|---|---|---|
| Contains `-season-N-` + ends with `-NxM` | **episode** | `one-piece-season-1-37854-1x1` | `/episode/one-piece-season-1-37854-1x1/` |
| Contains `-season-N-` | **series** | `one-piece-season-1-37854` | `/series/one-piece-season-1-37854` |
| Everything else | **movie** | `one-piece-film-red-2022-900667` | `/movies/one-piece-film-red-2022-900667` |

You can also pass full URLs if needed (e.g., `https://piratexplay.cc/series/one-piece-season-1-37854`).

---

## Rate Limiting

All endpoints include rate limiting headers:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Requests left in window |
| `X-RateLimit-Reset` | Seconds until reset |

**Default limits** (configurable via env):

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_MAX` | `60` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60000` | Window in milliseconds |

When exceeded, the API returns `429 Too Many Requests`.

---

## Caching

Responses are cached in-memory with a configurable TTL:

| Variable | Default | Description |
|---|---|---|
| `CACHE_TTL` | `300` | Cache duration in seconds (5 minutes) |

Cache is automatically evicted when stale. Maximum 500 entries.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `SITE_URL` | `https://piratexplay.cc` | No | Target website URL |
| `CACHE_TTL` | `300` | No | Cache TTL in seconds |
| `RATE_LIMIT_MAX` | `60` | No | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60000` | No | Rate limit window in ms |

---

## Deployment

### Vercel

```bash
npm i -g vercel
vercel --prod
```

Set environment variables in the Vercel dashboard if needed.

### Manual

```bash
git clone <repo>
cd piratexplay-api
npm install
npm run dev
```

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── home/route.ts        # GET /api/home
│   │   ├── search/route.ts      # GET /api/search?q=
│   │   ├── info/route.ts        # GET /api/info?id=
│   │   ├── episodes/route.ts    # GET /api/episodes?id=
│   │   ├── watch/route.ts       # GET /api/watch?id=
│   │   └── providers/route.ts   # GET /api/providers
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── fetcher.ts               # Axios HTTP client
│   ├── cache.ts                 # In-memory TTL cache
│   ├── rate-limit.ts            # Per-IP rate limiter
│   ├── parser.ts                # Cheerio DOM helpers
│   ├── scraper.ts               # Site scraping logic
│   ├── extractor.ts             # Embed-to-video extraction
│   └── providers/
│       └── index.ts             # Provider extraction
├── types/
│   └── index.ts                 # TypeScript interfaces
└── utils/
    ├── slug.ts                  # Slug type detection
    └── fingerprint.ts           # Provider auto-detection
```

---

## Known Embed Providers

The API automatically detects these embed providers:

As-cdn21, Rubystm, PirateXPlay Proxy, Short, Cloudy, Strmup, Turbovidhls, Vidmoly, Animesalt, Vidstreaming, Gdmirrorbot, YouTube, DoodStream, Filemoon, StreamTape, Mp4Upload, VidCloud, SuperEmbed, Hydrax, VidSrc

New providers are detected automatically by domain and HTML pattern matching.

---

## Notes

- This is an **unofficial** API — not affiliated with PirateXPlay
- The `/api/extract` endpoint has been removed; use `/api/watch` to get embed URLs
- Embed pages often use JavaScript-based players — the extractor makes a best-effort attempt but some providers may not yield direct `.m3u8`/`.mp4` URLs without a headless browser
- Rate limits are per-IP and in-memory (reset on server restart)

## License

MIT

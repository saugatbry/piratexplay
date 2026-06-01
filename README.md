# PirateXPlay API

A REST API that serves anime/movie data from [PirateXPlay](https://piratexplay.cc). Pre-scrapes content from a residential IP, caches it as JSON, and serves it from [Vercel](https://piratexplay.vercel.app) or [Hugging Face](https://saugiiman-piratexplay-api.hf.space).

> **Core constraint**: PirateXPlay uses Cloudflare and blocks all server IP ranges. Live scraping from cloud/serverless environments is unreliable. Data must be pre-scraped from a residential network and deployed as cached JSON.

---

## Base URL

```
https://piratexplay.vercel.app
```

---

## Endpoints

### `GET /api/home`

Returns sections (categories) with their media items for the homepage.

**Response**:
```json
{
  "sections": [
    {
      "name": "Network",
      "items": [
        {
          "title": "Crunchyroll",
          "url": "https://piratexplay.cc/ott/crunchyroll/",
          "poster": "https://piratexplay.cc/public/img/ott/crunchyroll-300x300.png",
          "type": ""
        }
      ]
    }
  ],
  "_source": "pre-scraped"
}
```

**Usage for an anime site**: Display each `section.name` as a category row. Each `item` links to an info page.

---

### `GET /api/search?q={query}`

Search for anime/movies.

| Param | Required | Description |
|-------|----------|-------------|
| `q` | Yes | Search query |

**Response**:
```json
{
  "results": [
    {
      "title": "Demon Slayer",
      "url": "https://piratexplay.cc/series/demon-slayer-...",
      "poster": "https://piratexplay.cc/public/img/...",
      "type": "Series"
    }
  ],
  "total": 23,
  "_source": "pre-scraped"
}
```

**Usage**: Build a search UI. On submit, call `/api/search?q={input}`. Display results as cards with poster, title, type badge.

---

### `GET /api/info?id={slug}`

Get detailed info about a specific anime/movie.

| Param | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Slug or full URL (e.g. `dr-stone-season-4-86031` or `fullmetal-alchemist-brotherhood-season-1-31911`) |

**Response**:
```json
{
  "title": "Fullmetal Alchemist: Brotherhood",
  "description": "...",
  "poster": "https://piratexplay.cc/public/img/...",
  "banner": "https://piratexplay.cc/public/img/...",
  "genres": ["Action", "Adventure", "Drama", "Fantasy"],
  "languages": ["English", "Japanese"],
  "year": "2009",
  "duration": "24 min",
  "seasons": 1,
  "episodes": [
    {
      "season": 1,
      "episode": 1,
      "title": "Fullmetal Alchemist: Brotherhood Episode 1",
      "url": "https://piratexplay.cc/series/fullmetal-alchemist-brotherhood-season-1-31911/1x1"
    }
  ],
  "recommendations": [],
  "_source": "pre-scraped"
}
```

**Usage**: Show a detail page with poster, genres, year, episode list. Each episode has a `url` to pass to `/api/watch`.

---

### `GET /api/episodes?id={slug}`

Get just the episode list for a title.

| Param | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Slug or full URL |

**Response**: Array of episodes (same format as `info.episodes`).

**Usage**: If you already have the title info but need just the episode list.

---

### `GET /api/watch?id={episodeUrl}`

Get embed sources for a specific episode.

| Param | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Full episode URL or slug (e.g. `fullmetal-alchemist-brotherhood-season-1-31911/1x1`) |

**Response** (when pre-scraped):
```json
{
  "success": true,
  "title": "Fullmetal Alchemist: Brotherhood Episode 1",
  "sources": [
    {
      "server": "As-cdn21",
      "embed": "https://as-cdn21.top/embed/..."
    },
    {
      "server": "Rubystm",
      "embed": "https://rubystm.com/e/..."
    }
  ]
}
```

> **Note**: This endpoint requires pre-scraped data. Live scraping will fail from Vercel/HF due to Cloudflare. See [Pre-scraping](#pre-scraping) below.

**Usage**: Present server buttons to the user. On click, embed the `embed` URL in an iframe or redirect to it. The embed URL plays the video directly.

---

### `GET /api/providers`

List all known video providers.

**Response**:
```json
{
  "providers": [
    { "name": "Rubystm", "domains": ["rubystm.com"] },
    { "name": "Vidmoly", "domains": ["vidmoly.net"] }
  ],
  "total": 20
}
```

---

### `GET /api/health`

Check if pre-scraped data is available and fresh.

**Response**:
```json
{
  "status": "ready",
  "message": "Pre-scraped data available...",
  "data": {
    "home": { "cached": true, "age": "45m", "totalItems": 41 },
    "popular": { "cached": true }
  }
}
```

---

## Building an Anime Site (AI Instructions)

### Recommended Architecture

```
User's Browser
      │
      ▼
Your Website (React/Next.js/Vue)
      │
      ├─► PirateXPlay API (data source)
      │
      └─► Embed video iframe (from /api/watch sources)
```

### Typical User Flow

1. **Homepage**: Fetch `/api/home` → display sections as horizontal scrollable rows of poster cards
2. **Search**: User types → `/api/search?q=naruto` → show grid of results
3. **Info Page**: User clicks a card → `/api/info?id=demon-slayer-...` → show detail with episode list
4. **Watch**: User clicks an episode → `/api/watch?id=.../1x1` → show server buttons
5. **Play**: User clicks a server → embed the `embed` URL in an iframe (or open in new tab)

### Key Implementation Details

**Step 4-5 is the most important**: `/api/watch` returns `sources` array. Each source has:
- `server`: display name (e.g. "Rubystm")
- `embed`: URL to an iframe embed page

To play: Create an iframe with the `embed` URL. The embed page contains a video player. Some embeds may require a Referer header — the iframe handles this automatically.

### Response Caching

The API has a built-in 2-minute in-memory cache. For your own site, add a CDN or service worker cache on top.

### Error Handling

If an endpoint returns:
- `503` with `_source: "live"` or `error` field → data not pre-scraped. Pre-scrape it.
- `429` with `error: "Rate limit exceeded"` → slow down requests (120 req/min)

---

## Pre-scraping

Since Cloudflare blocks all server-based requests, you must pre-scrape from a **residential IP**.

### One-time

```bash
node scripts/refresh.mjs
```

This fetches pages from PirateXPlay and writes JSON files to `public/data/`.

### Customize what to scrape

Edit `scripts/refresh.mjs` to add more search queries or info pages.

### What gets pre-scraped

- `/api/home` → `public/data/home.json` (sections + items)
- `/api/search?q=...` → `public/data/search-{query}.json`
- `/api/info?id=...` → `public/data/info-{slug}.json`
- `/api/watch?id=...` → `public/data/watch-{slug}.json` (if configured)

---

## Deployment

### Vercel

```bash
git push origin master
```

Auto-deploys if Vercel is connected to your GitHub repo. The `next.config.js` uses `output: 'standalone'`.

### Hugging Face Spaces

```bash
git push https://huggingface.co/spaces/{username}/{space} master
```

The Dockerfile in `huggingface/` is minimal (no Chromium, no Playwright).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SITE_URL` | `https://piratexplay.cc` | Target site |
| `CACHE_TTL` | `300` | In-memory cache TTL (seconds) |
| `RATE_LIMIT_MAX` | `120` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60000` | Rate limit window (ms) |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

---

## Current Data Status

| Endpoint | Pre-scraped | Items |
|----------|-------------|-------|
| `/api/home` | ✅ | 41 items across 4 sections |
| `/api/search?q=anime` | ✅ | 20+ results |
| `/api/search?q=naruto` | ✅ | Available |
| `/api/search?q=one+piece` | ✅ | Available |
| `/api/search?q=demon+slayer` | ✅ | 23 results |
| `/api/search?q=attack+on+titan` | ✅ | Available |
| `/api/search?q=jujutsu` | ✅ | Available |
| `/api/search?q=dragon+ball` | ✅ | Available |
| `/api/search?q=series` | ✅ | Available |
| `/api/search?q=movie` | ✅ | Available |
| `/api/info?=dr-stone-season-4` | ✅ | 36 episodes |
| `/api/info?=fullmetal-alchemist-brotherhood` | ✅ | 36 episodes |
| `/api/watch` | ❌ | Needs pre-scraping |

---

## Full Example: Building a Working Anime Site

### 1. Fetch Homepage Data
```javascript
const home = await fetch('https://piratexplay.vercel.app/api/home').then(r => r.json())
// home.sections → [{ name, items }]
```

### 2. Render Section
```jsx
{home.sections.map(section => (
  <div key={section.name}>
    <h2>{section.name}</h2>
    <div className="row">
      {section.items.map(item => (
        <a key={item.url} href={`/info?url=${encodeURIComponent(item.url)}`}>
          <img src={item.poster} alt={item.title} />
          <span>{item.title}</span>
        </a>
      ))}
    </div>
  </div>
))}
```

### 3. Info Page → Episode List
```javascript
const info = await fetch(`/api/info?id=${slug}`).then(r => r.json())
// info.episodes → [{ season, episode, title, url }]
```

### 4. Watch Page → Embed Player
```javascript
const watch = await fetch(`/api/watch?id=${episodeSlug}`).then(r => r.json())
// watch.sources → [{ server, embed }]
// Render iframe with embed URL
<iframe src={watch.sources[0].embed} allowFullScreen />
```

---

## Project Structure

```
src/
├── app/api/
│   ├── home/route.ts         GET /api/home
│   ├── search/route.ts       GET /api/search?q=
│   ├── info/route.ts         GET /api/info?id=
│   ├── episodes/route.ts     GET /api/episodes?id=
│   ├── watch/route.ts        GET /api/watch?id=
│   ├── providers/route.ts    GET /api/providers
│   ├── health/route.ts       GET /api/health
│   └── debug/                Debug utilities
├── lib/
│   ├── fetcher.ts            Axios + Webshare proxy rotation
│   ├── scraper.ts            Cheerio-based HTML parser
│   ├── data.ts               Read/write pre-scraped JSON
│   ├── cache.ts              In-memory cache
│   ├── cloudflare.ts         Cloudflare detection
│   ├── rate-limit.ts         Rate limiting
│   ├── logger.ts             Structured logging
│   ├── extractor.ts          Video source extraction
│   └── providers/index.ts    Provider-specific extraction
├── utils/
│   ├── slug.ts               URL/slug normalization
│   └── fingerprint.ts        Provider fingerprint database
└── types/index.ts            TypeScript type definitions
```

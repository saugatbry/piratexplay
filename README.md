# PirateXPlay API — AI Agent Guide

Build a complete anime/movie streaming site using PirateXPlay as the data source.

**Domain**: `https://piratexplay.cc`
**Public API base**: `https://piratexplay.cc/api/`
**Internal API base**: `https://api-js.piratexplay.cc/`

---

## 1. Slug System (CRITICAL)

Every piece of content is identified by a **slug**. Understanding slugs is required before using any endpoint.

### Season Slug
```
Format:  {tmdb-title-slug}-season-{season-number}-{tmdb-id}
Example: one-piece-season-1-37854
         dr-stone-season-4-86031
         naruto-season-1-46227
```

### Episode Slug
```
Format:  {season-slug}-{season}x{episode}
Example: one-piece-season-1-37854-1x1
         one-piece-season-1-37854-1x61
         dr-stone-season-4-86031-4x1
```

### Movie Slug
```
Format:  {title-slug}-{year}-{tmdb-id}
Example: one-piece-film-red-2022-900667
         one-piece-film-z-2012-176983
```

### Get slug from search response
```javascript
// search.php returns: { tmdb: { url: "one-piece-season-1-37854" } }
// That `url` field IS the slug
```

---

## 2. Endpoints Reference

---

### `GET /api-js.piratexplay.cc/home` — Homepage Feed

**Purpose**: Discover trending/featured series for your homepage.

**URL**: `https://api-js.piratexplay.cc/home?page=1&per_page=12`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 12 | Items per page (max ~50) |

**Full Response**:
```json
{
  "status": "success",
  "page": 1,
  "per_page": 12,
  "series": [
    {
      "_id": "67bf32ed55c3d4ddb6abd8b6",
      "languages": "English-Hindi-Japanese-Tamil-Telugu",
      "updated": "02-06-2026",
      "tmdb": {
        "backdrop": "/lN13BPAEnc5iXmoxxBQHOZ1ScfZ.jpg",
        "poster": "/nKhEks4Lxgv63cyivxnXdtIG1tg.jpg",
        "title": "Dr. STONE",
        "url": "dr-stone-season-4-86031",
        "tmdb_id": 86031,
        "type": "series",
        "rating": 8.537,
        "popularity": 10.9248,
        "release_year": 2019,
        "overview": "...",
        "genre": ["Action & Adventure", "Sci-Fi & Fantasy", "Animation"],
        "trailers": [
          { "name": "Official Preview", "url": "https://www.youtube.com/watch?v=..." }
        ],
        "ott": {
          "Netflix": "netflix",
          "Crunchyroll": "crunchyroll",
          "Hulu": "hulu"
        },
        "episode_runtime": 24,
        "status": "returning series",
        "age_rating": "TV-14",
        "org_language": "ja",
        "total_episodes": "94",
        "season": "4",
        "season_overview": "After the battle on Treasure Island...",
        "sub": "12",
        "dub": "12"
      }
    }
  ]
}
```

**Fields to use**:

| Field | Usage |
|-------|-------|
| `tmdb.title` | Display title |
| `tmdb.poster` | Poster image (prepend `https://image.tmdb.org/t/p/w500`) |
| `tmdb.backdrop` | Banner/background image |
| `tmdb.url` | **Slug** — pass to other endpoints |
| `tmdb.type` | `"series"` or `"movie"` |
| `tmdb.rating` | 0-10 rating |
| `tmdb.genre` | Array of genre strings |
| `tmdb.release_year` | Year |
| `tmdb.season` | Current season number (string) |
| `tmdb.sub` / `tmdb.dub` | Sub/dub episode count |
| `tmdb.overview` | Description |
| `languages` | Available audio languages (pipe-separated) |

---

### `GET /api/episodes.php` — Season Episodes + Metadata

**Purpose**: Get all episodes for a season + full TMDB details.

**URL**: `https://piratexplay.cc/api/episodes.php?id={season-slug}`

**Full Response**:
```json
{
  "status": "success",
  "id": "one-piece-season-1-37854",
  "data": {
    "tmdb": {
      "backdrop": "/2rmK7mnchw9Xr3XdiTFSxTTLXqv.jpg",
      "poster": "/9hW62RDq5Dno8vLABXscddjEq9M.jpg",
      "title": "One Piece",
      "url": "one-piece-season-1-37854",
      "tmdb_id": 37854,
      "type": "series",
      "rating": 8.726,
      "popularity": 74.207,
      "release_year": 1999,
      "overview": "Years ago, the fearsome Pirate King, Gol D. Roger was executed...",
      "genre": ["fantasy", "adventure", "comedy", "action-adventure"],
      "trailers": [
        { "name": "We're Just Getting Started Trailer", "url": "https://www.youtube.com/watch?v=1KMcoJBMWE4" }
      ],
      "ott": {
        "Netflix": "netflix",
        "Hulu": "hulu",
        "Crunchyroll": "crunchyroll"
      },
      "episode_runtime": 24,
      "status": "returning series",
      "age_rating": "TV-14",
      "org_language": "ja",
      "total_episodes": "1163",
      "season": "1",
      "season_overview": "Monkey D. Luffy meets the Red Hair Pirates...",
      "sub": "61",
      "dub": "61"
    },
    "episodes": [
      { "season": 1, "episode": 1, "image": "https://image.tmdb.org/t/p/w185/2rmK7mnchw9Xr3XdiTFSxTTLXqv.jpg" },
      { "season": 1, "episode": 2, "image": "https://image.tmdb.org/t/p/w185/2rmK7mnchw9Xr3XdiTFSxTTLXqv.jpg" }
    ]
  }
}
```

**Important notes**:
- The `episodes` array may have **gaps** (missing episodes 22-24, 29-40, 46-49 in Season 1 of One Piece). Handle gaps gracefully — they're not available on the source.
- Construct episode URL slugs as: `{season-slug}-{season}x{episode}`

**How to construct episode slugs**:
```javascript
// Given season slug: "one-piece-season-1-37854"
// And episode object: { season: 1, episode: 1 }
const episodeSlug = `one-piece-season-1-37854-1x1`;
const episodeUrl = `/episode/${episodeSlug}/`;
```

---

### `GET /api/sources.php` — Episode Stream Sources

**Purpose**: Get all available video player URLs and download links for an episode.

**URL**: `https://piratexplay.cc/api/sources.php?id={episode-slug}`

**Full Response**:
```json
{
  "status": "success",
  "id": "67bf347355c3d4ddb6abd8d7",
  "type": "series",
  "title": "One Piece",
  "image": "https://image.tmdb.org/t/p/w185/9hW62RDq5Dno8vLABXscddjEq9M.jpg",
  "season": 1,
  "episode": 1,
  "sources": [
    {
      "url": "https://piratexplay.cc/proxy/play.php?url=https://as-cdn21.top/video/8757150decbd89b0f5442ca3db4d0e0e",
      "label": "As-cdn21"
    },
    {
      "url": "https://rubystm.com/e/3hklgq1uj9i6.html",
      "label": "Rubystm"
    },
    {
      "resolution": "FHD",
      "url": "https://piratexplay.cc/public/player/index11.php?id=oatbp4l",
      "label": "FHD"
    },
    {
      "resolution": "HQ",
      "url": "https://piratexplay.cc/public/player/index11.php?id=bczxqgh",
      "label": "HQ"
    },
    {
      "resolution": "HD",
      "url": "https://piratexplay.cc/public/player/index11.php?id=l9l9d6n",
      "label": "HD"
    },
    {
      "url": "https://short.icu/A1JwbC_8e",
      "label": "Short"
    },
    {
      "url": "https://cloudy.upns.one/#mh3z9z",
      "label": "Cloudy"
    },
    {
      "url": "https://strmup.to/LqPhEZKgk3jda",
      "label": "Strmup"
    },
    {
      "url": "https://turbovidhls.com/t/69575eb54ea8e",
      "label": "Turbovidhls"
    },
    {
      "url": "https://vidmoly.net/embed-vz1m7a4x988b.html",
      "label": "Vidmoly"
    },
    {
      "url": "https://animesalt.ac/multi-lang-plyr/player.php?data=W3sibGFuZ3VhZ2Ui...",
      "label": "Animesalt"
    }
  ],
  "downloads": [
    {
      "server": "#01Mega",
      "lang": "Multi-Audio",
      "quality": "480p",
      "url": "https://mega.nz/file/9rAEFQaQ..."
    },
    {
      "server": "#02Mega",
      "lang": "Multi-Audio",
      "quality": "720p",
      "url": "https://mega.nz/file/FjAABAKR..."
    },
    {
      "server": "#03Mega",
      "lang": "Multi-Audio",
      "quality": "1080p",
      "url": "https://mega.nz/file/tqQ0TYjK..."
    },
    {
      "server": "#04Archive",
      "lang": "Most Audio",
      "quality": "All",
      "url": "https://zone.toonmixindia.site/?id=67bf347355c3d4ddb6abd8d7&episode=1"
    }
  ]
}
```

**Player URL types**:

| Type | URL Pattern | Notes |
|------|-------------|-------|
| **Proxied** | `https://piratexplay.cc/proxy/play.php?url=...` | First source, best reliability |
| **Direct embed** | `https://rubystm.com/e/...`, `https://vidmoly.net/embed-...` | Third-party embed |
| **Local player** | `https://piratexplay.cc/public/player/index11.php?id={gdmirr}` | Resolution-labeled (FHD/HQ/HD) |
| **Multi-lang** | `https://animesalt.ac/multi-lang-plyr/player.php?data={base64}` | Base64-encoded JSON with language links |

**Important**: Some sources use `data-src` (lazy-loaded) in the original HTML. The API returns them as `url` directly, but if using the raw HTML, you must read `data-src` and move it to `src` via JS.

---

### `GET /api/search.php` — Search

**URL**: `https://piratexplay.cc/api/search.php/?keyword={query}&page={n}`

**Full Response**:
```json
{
  "status": "success",
  "current_page": 1,
  "total_pages": 5,
  "data": [
    {
      "tmdb": {
        "title": "One Piece",
        "type": "series",
        "url": "one-piece-season-1-37854"
      }
    },
    {
      "tmdb": {
        "title": "ONE PIECE",
        "type": "series",
        "url": "one-piece-season-2-111110"
      }
    },
    {
      "tmdb": {
        "title": "One Piece Film: Z (2012)",
        "type": "movie",
        "url": "one-piece-film-z-2012-176983"
      }
    },
    {
      "tmdb": {
        "title": "One Piece Film Red (2022)",
        "type": "movie",
        "url": "one-piece-film-red-2022-900667"
      }
    },
    {
      "tmdb": {
        "title": "One Piece: Stampede (2019)",
        "type": "movie",
        "url": "one-piece-stampede-2019-568012"
      }
    }
  ]
}
```

**Note**: Search returns minimal data (title, type, url). To get full details, pass the `url` (slug) to `episodes.php`.

---

## 3. Building Your Site — Page-by-Page Guide

### Page 1: Homepage

```javascript
// Fetch real data
const res = await fetch('https://api-js.piratexplay.cc/home?page=1&per_page=20');
const data = await res.json();

// data.series is an array of series items
// Each item has full tmdb metadata
```

**Homepage layout**: Grid of poster cards, each linking to the info/watch page.

```html
<div class="home-grid">
  <!-- LOOP over data.series -->
  <a href="/info?slug={item.tmdb.url}" class="card">
    <img src="https://image.tmdb.org/t/p/w342{item.tmdb.poster}" alt="{item.tmdb.title}" loading="lazy">
    <div class="card-info">
      <h3>{item.tmdb.title}</h3>
      <span class="year">{item.tmdb.release_year}</span>
      <span class="rating">{item.tmdb.rating}</span>
      <span class="type">{item.tmdb.type}</span>
      <span class="lang">{item.languages}</span>
    </div>
    <div class="card-overlay">
      <p>{item.tmdb.overview?.slice(0, 150)}...</p>
      <span class="seasons">Season {item.tmdb.season} · {item.tmdb.sub} eps</span>
    </div>
  </a>
  <!-- END LOOP -->
</div>
```

---

### Page 2: Info Page (Series/Movie Detail)

```
URL pattern: /info?slug=one-piece-season-1-37854
```

```javascript
const slug = params.slug; // e.g. "one-piece-season-1-37854"
const res = await fetch(`https://piratexplay.cc/api/episodes.php?id=${slug}`);
const data = await res.json();

const tmdb = data.data.tmdb;
const episodes = data.data.episodes;
```

**Render detail header**:
```html
<div class="detail-header">
  <img src="https://image.tmdb.org/t/p/w500{tmdb.poster}" alt="{tmdb.title}">
  <div class="detail-info">
    <h1>{tmdb.title}</h1>
    <div class="meta-row">
      <span>{tmdb.release_year}</span>
      <span>{tmdb.episode_runtime} min</span>
      <span>★ {tmdb.rating}</span>
      <span class="age-rating">{tmdb.age_rating}</span>
      <span>{tmdb.org_language?.toUpperCase()}</span>
    </div>
    <p>{tmdb.overview}</p>
    <div class="genres">
      <!-- LOOP tmdb.genre -->
      <span class="genre-tag">{genre}</span>
    </div>
    <div class="languages">
      <span>Available in: {languages}</span>
    </div>
    <!-- If movie, no season info -->
    <!-- If series: -->
    <div class="season-meta">
      <span>Season {tmdb.season}</span>
      <span>{tmdb.sub} Subtitled · {tmdb.dub} Dubbed</span>
      <span>Total: {tmdb.total_episodes} episodes</span>
    </div>
    <!-- OTT availability -->
    <div class="ott">
      {Object.entries(tmdb.ott || {}).map(([name]) => <span>{name}</span>)}
    </div>
  </div>
</div>
```

**Render episode list**:
```html
<div class="episode-grid">
  <!-- LOOP over episodes -->
  <a href="/watch?slug={slug}-{ep.season}x{ep.episode}" class="episode-card">
    <img src="{ep.image}" alt="Episode {ep.episode}" loading="lazy">
    <span class="ep-badge">{ep.season}x{ep.episode}</span>
    <h4>{tmdb.title} {ep.season}x{ep.episode}</h4>
  </a>
</div>
```

---

### Page 3: Watch Page (Player + Servers)

```
URL pattern: /watch?slug=one-piece-season-1-37854-1x1
```

```javascript
const episodeSlug = params.slug; // e.g. "one-piece-season-1-37854-1x1"
const res = await fetch(`https://piratexplay.cc/api/sources.php?id=${episodeSlug}`);
const data = await res.json();

const sources = data.sources; // array of { url, label, resolution? }
const downloads = data.downloads; // array of { server, lang, quality, url }
```

**Render server selector + player**:
```html
<div class="watch-page">
  <h2>{data.title} S{data.season}:E{data.episode}</h2>
  <img src="{data.image}" alt="" class="ep-thumb">

  <!-- Server selector -->
  <div class="server-tabs">
    <!-- LOOP over sources, index 0 is auto-active -->
    <button class="server-btn active" data-index="0">
      {source.label}
      {source.resolution ? `(${source.resolution})` : ''}
    </button>
  </div>

  <!-- Player iframe -->
  <div class="player-container">
    <iframe
      id="video-player"
      src="{sources[0].url}"
      frameborder="0"
      scrolling="no"
      allow="autoplay; encrypted-media"
      allowfullscreen
      loading="lazy"
    ></iframe>
  </div>

  <!-- Download section -->
  <div class="downloads">
    <h3>Download</h3>
    <!-- LOOP downloads -->
    <a href="{download.url}" target="_blank" class="download-btn">
      {download.server} · {download.quality} · {download.lang}
    </a>
  </div>
</div>
```

**JavaScript for server switching**:
```javascript
const iframe = document.getElementById('video-player');
const serverBtns = document.querySelectorAll('.server-btn');

serverBtns.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    serverBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    iframe.src = sources[index].url;
  });
});
```

---

### Page 4: Search

```javascript
const query = params.q;  // user input
const res = await fetch(`https://piratexplay.cc/api/search.php/?keyword=${encodeURIComponent(query)}&page=1`);
const data = await res.json();

const results = data.data; // array of { tmdb: { title, type, url } }
const totalPages = data.total_pages;
```

**Render results**:
```html
<div class="search-results">
  <!-- LOOP results -->
  <a href="/info?slug={result.tmdb.url}" class="result-card">
    <span class="type-badge" data-type={result.tmdb.type}>{result.tmdb.type}</span>
    <h3>{result.tmdb.title}</h3>
  </a>
  <!-- END LOOP -->
</div>

<!-- Pagination if totalPages > 1 -->
<div class="pagination">
  {Array.from({length: data.total_pages}, (_, i) =>
    <a href="/search?q={query}&page={i+1}" class={i+1 === page ? 'active' : ''}>{i+1}</a>
  )}
</div>
```

---

## 4. Error Handling

```javascript
async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    // 503 = not available
    // 429 = rate limited
    // 404 = slug not found
    throw new Error(`API error ${res.status}`);
  }
  const data = await res.json();
  if (data.status === "error") {
    throw new Error(data.message || "Unknown API error");
  }
  return data;
}
```

**Possible errors**:
- `{"status":"error","message":"Missing ID parameter"}` — no slug provided
- `{"status":"error","message":"Details not found"}` — slug doesn't exist (download-id.php)
- `{"error":"Mat Kro Mere Bhai"}` — schedule-api.php is non-functional
- `503` — server overload or Cloudflare block

---

## 5. Complete Data Flow

```
User visits YOUR SITE
        │
        ▼
  [Homepage]
  1. GET /api-js.piratexplay.cc/home
  2. Display poster grid
  3. User clicks a card → /info?slug=...
        │
        ▼
  [Info Page]
  1. GET /api/episodes.php?id={slug}
  2. Show TMDB metadata + episode list
  3. User clicks episode → /watch?slug={slug}-{s}x{e}
        │
        ▼
  [Watch Page]
  1. GET /api/sources.php?id={ep-slug}
  2. Show server buttons + iframe player
  3. User presses play → embed URL in <iframe>
        │
        ▼
  [Search]
  1. GET /api/search.php/?keyword={q}
  2. Show result cards
  3. User clicks → /info?slug={result.url}
```

---

## 6. Complete Working Example (Next.js App Router)

### `app/page.js` — Homepage
```javascript
export default async function HomePage() {
  const res = await fetch('https://api-js.piratexplay.cc/home?per_page=20');
  const data = await res.json();

  return (
    <div className="grid">
      {data.series.map(item => (
        <a key={item._id} href={`/info/${item.tmdb.url}`} className="card">
          <img src={`https://image.tmdb.org/t/p/w342${item.tmdb.poster}`} alt="" loading="lazy" />
          <h3>{item.tmdb.title}</h3>
          <span>{item.tmdb.release_year} · ★{item.tmdb.rating}</span>
        </a>
      ))}
    </div>
  );
}
```

### `app/info/[slug]/page.js` — Info Page
```javascript
export default async function InfoPage({ params }) {
  const { slug } = params;
  const res = await fetch(`https://piratexplay.cc/api/episodes.php?id=${slug}`);
  const data = await res.json();
  const { tmdb, episodes } = data.data;

  return (
    <div>
      <img src={`https://image.tmdb.org/t/p/w500${tmdb.poster}`} alt="" />
      <h1>{tmdb.title}</h1>
      <p>{tmdb.overview}</p>
      <div className="episodes">
        {episodes.map(ep => (
          <a key={ep.episode} href={`/watch/${slug}-${ep.season}x${ep.episode}`}>
            <span>{ep.season}x{ep.episode}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
```

### `app/watch/[slug]/page.js` — Watch Page
```javascript
export default async function WatchPage({ params }) {
  const { slug } = params;
  const res = await fetch(`https://piratexplay.cc/api/sources.php?id=${slug}`);
  const data = await res.json();

  return (
    <div>
      <h2>{data.title} S{data.season}:E{data.episode}</h2>
      <iframe src={data.sources[0].url} allowFullScreen />
      <div className="servers">
        {data.sources.map((s, i) => (
          <button key={i} data-src={s.url}>{s.label} {s.resolution || ''}</button>
        ))}
      </div>
    </div>
  );
}
```

---

## 7. Image URL Construction

TMDB returns relative paths. Prepend the base URL:

| Size | Base URL | Example |
|------|----------|---------|
| Poster small | `https://image.tmdb.org/t/p/w185` | `/9hW62RDq5Dno8vLABXscddjEq9M.jpg` |
| Poster medium | `https://image.tmdb.org/t/p/w342` | |
| Poster large | `https://image.tmdb.org/t/p/w500` | |
| Backdrop | `https://image.tmdb.org/t/p/original` | `/2rmK7mnchw9Xr3XdiTFSxTTLXqv.jpg` |

```javascript
function posterUrl(path, size = 'w342') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : '/placeholder.jpg';
}
function backdropUrl(path) {
  return path ? `https://image.tmdb.org/t/p/original${path}` : '/placeholder.jpg';
}
```

---

## 8. Multi-Audio Server (Animesalt)

The last source in `sources.php` (`animesalt.ac/multi-lang-plyr/player.php?data=...`) has base64-encoded JSON in the `data` parameter. Decode it:

```javascript
function decodeAnimesalt(base64String) {
  const json = atob(base64String);
  return JSON.parse(json);
  // Returns: [
  //   { language: "Hindi", link: "https://short.icu/sP7N-3Brr" },
  //   { language: "Tamil", link: "https://short.icu/xHRk_G6VG" },
  //   { language: "Telugu", link: "https://short.icu/5odiwlJ82w" },
  //   { language: "Malayalam", link: "https://short.icu/5PniuwEct" },
  //   { language: "Kannada", link: "https://short.icu/A3lOxJq6a" },
  //   { language: "English", link: "https://short.icu/CzRpEPz6mc" },
  //   { language: "Japanese", link: "https://short.icu/R2rwBHHWA" }
  // ]
}
```

---

## 9. Known Issues

- **Episode gaps**: Some seasons have missing episode numbers (e.g., One Piece S1 has no episodes 22-24, 29-40, 46-49). These episodes don't exist in the source.
- **Movie posters**: Movies return via search but need their own slug format. Construct as `{title-slug}-{year}-{tmdb_id}`.
- **Home API pagination**: `page` param works, but `per_page` higher than ~50 may return empty.
- **Rate limiting**: ~120 req/min before getting 429 responses. Cache aggressively.
- **schedule-api.php**: Returns `{"error":"Mat Kro Mere Bhai"}` — non-functional, ignore it.

# PirateXPlay API

Unofficial API documentation for [PirateXPlay](https://piratexplay.cc) — an anime/movie streaming site.

## Base URLs

| Environment | URL |
|-------------|-----|
| **Public API** | `https://piratexplay.cc/api/` |
| **Internal API** | `https://api-js.piratexplay.cc/` |

---

## Endpoints

### `GET /home` (Internal API)

Returns homepage feed with paginated series listing.

```
https://api-js.piratexplay.cc/home
```

**Query Params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | `1` | Page number |
| `per_page` | int | `12` | Items per page |

**Response:**
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
        "genre": ["Action & Adventure", "Sci-Fi & Fantasy", "Animation", ...],
        "trailers": [{ "name": "...", "url": "https://youtube.com/..." }],
        "ott": { "Netflix": "netflix", "Crunchyroll": "crunchyroll", ... },
        "episode_runtime": 24,
        "status": "returning series",
        "age_rating": "TV-14",
        "org_language": "ja",
        "total_episodes": "94",
        "season": "4",
        "season_overview": "...",
        "sub": "12",
        "dub": "12"
      }
    }
  ]
}
```

---

### `GET /details` (Internal API)

Returns full episode data with stream identifiers for a series/season/movie.

```
https://api-js.piratexplay.cc/details/?id={slug}
```

| Param | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Slug (e.g. `one-piece-season-1-37854`) |

**Response:**
```json
{
  "status": "success",
  "data": {
    "_id": "67bf347355c3d4ddb6abd8d7",
    "episodes": [
      {
        "resolution": "FHD",
        "episode": 1,
        "gdmirr": "oatbp4l",
        "flps": "67693d986c8ffe681c245d94",
        "forward_id": 67733
      }
    ],
    "languages": "Hindi-English-Japanese-Tamil-Telugu-Malayalam-Kannada",
    "updated": "13-04-2026",
    "tmdb": { "...": "..." }
  }
}
```

The `gdmirr` value maps to player URLs like:
- `https://piratexplay.cc/public/player/index11.php?id={gdmirr}`

---

### `GET /sources.php` (Public API)

Returns stream embed URLs and download links for an episode.

```
https://piratexplay.cc/api/sources.php?id={episode-slug}
```

| Param | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Episode slug (e.g. `one-piece-season-1-37854-1x1`) |

**Response:**
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
     }
  ],
  "downloads": [
    {
      "server": "#01Mega",
      "lang": "Multi-Audio",
      "quality": "480p",
      "url": "https://mega.nz/file/..."
    }
  ]
}
```

**Usage**: Embed the `url` in an iframe to play the video. The first source (`As-cdn21`) is proxied through the site; others are direct embeds.

---

### `GET /episodes.php` (Public API)

Returns episode list + TMDB metadata for a season.

```
https://piratexplay.cc/api/episodes.php?id={season-slug}
```

| Param | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Season slug (e.g. `one-piece-season-1-37854`) |

**Response:**
```json
{
  "status": "success",
  "id": "one-piece-season-1-37854",
  "data": {
    "tmdb": { "...": "..." },
    "episodes": [
      { "season": 1, "episode": 1, "image": "https://image.tmdb.org/t/p/w185/..." },
      { "season": 1, "episode": 2, "image": "https://image.tmdb.org/t/p/w185/..." }
    ]
  }
}
```

---

### `GET /search.php` (Public API)

Search for series and movies by keyword.

```
https://piratexplay.cc/api/search.php/?keyword={query}&page={n}
```

| Param | Required | Description |
|-------|----------|-------------|
| `keyword` | Yes | Search query |
| `page` | No | Page number (default: 1) |

**Response:**
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
    }
  ]
}
```

---

## Slug Format

| Type | Format | Example |
|------|--------|---------|
| Season | `{title-slug}-season-{n}-{tmdb_id}` | `one-piece-season-1-37854` |
| Episode | `{season-slug}-{season}x{episode}` | `one-piece-season-1-37854-1x1` |
| Movie | `{title-slug}-{year}-{tmdb_id}` | `one-piece-film-red-2022-900667` |

Construct episode URLs as:
```
/episode/{season-slug}-{s}x{e}/
```

---

## Usage Pattern

```
1. GET /home             → Discover series
2. GET /search.php?keyword=... → Find specific shows
3. GET /episodes.php?id={slug} → Get TMDB info + episode list
4. GET /sources.php?id={ep-slug} → Get stream embed URLs
5. Embed URL in <iframe> → Play video
```


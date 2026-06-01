---
title: PirateXPlay API
emoji: 🏴‍☠️
colorFrom: red
colorTo: yellow
sdk: docker
pinned: false
license: mit
---

# PirateXPlay API

Unofficial REST API for [PirateXPlay](https://piratexplay.cc). Extracts anime/movie info, episodes, and video embed sources.

## Endpoints

| Endpoint | Example |
|---|---|
| `GET /api/home` | Latest series & movies |
| `GET /api/search?q=one piece` | Search anime/movies |
| `GET /api/info?id=one-piece-season-1-37854` | Series/movie details |
| `GET /api/episodes?id=one-piece-season-1-37854` | Episode list |
| `GET /api/watch?id=one-piece-season-1-37854-1x1` | Video embed sources |
| `GET /api/providers` | Known embed providers |

## Usage

```bash
curl https://saugiiman-piratexplay-api.hf.space/api/search?q=naruto
curl https://saugiiman-piratexplay-api.hf.space/api/watch?id=one-piece-season-1-37854-1x1
```

## Environment Variables

Set these as Space Secrets if needed:

| Variable | Default |
|---|---|
| `SITE_URL` | `https://piratexplay.cc` |
| `CACHE_TTL` | `300` |
| `RATE_LIMIT_MAX` | `60` |
| `RATE_LIMIT_WINDOW` | `60000` |
| `PROXY_URL` | (optional CORS proxy) |

Built with Next.js 15, TypeScript, Cheerio, Axios.

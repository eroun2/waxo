# WaXo
Discover. Stream. Download. Support Local Talent.

## Run locally
    cp .env.example .env     # then change every secret
    docker compose up --build
Open http://localhost (site) and http://localhost/api/health (API + DB check). MinIO console: http://localhost:9001

## Layout
- apps/api: NestJS API. Migrations in apps/api/migrations (applied automatically on start)
- apps/web: React + TS + Tailwind (black/white theme tokens in src/styles/index.css)
- nginx/: reverse proxy (/api -> API, everything else -> web)

## Next build steps
1. Auth module (register, verify email, login, refresh, role guards)
2. Artist onboarding and admin approval
3. Upload pipeline (S3 + FFmpeg worker + signed URLs)
4. Public site, search, player

## Uploads and media (added)
- Uploads go through the API (`POST /songs`, multipart: `audio`, optional `artwork`). The API checks the real file type, optionally scans for malware (ClamAV), probes the audio with ffprobe, stores the original master in the private bucket and queues processing.
- A background worker (BullMQ + FFmpeg) makes an AAC streaming rendition and a 320 kbps MP3 download rendition. Masters are never served.
- Playback and downloads use short-lived signed URLs (`GET /songs/:id/stream-url`, `/download-url`).
- Dev: MinIO is on :9000 (API) / :9001 (console). `S3_PUBLIC_ENDPOINT` must be reachable by the browser.

## Streams and discovery (added)
- Player flow: `GET /songs/:id/stream-url` -> play; `POST /plays {songId}` -> `playToken`; `POST /plays/:token/heartbeat {seconds}` every ~10 s and when playback stops. The server counts a stream once, after `STREAM_MIN_SECONDS`, with abuse checks.
- Discovery (public): `/discover/home`, `/trending`, `/new-releases`, `/recently-added`, `/most-streamed`, `/most-downloaded`, `/rising-stars`, `/featured-artists`, `/featured-songs`, `/leaderboard/:district`, `/recommended`, `/near-me`, `/genres`, `/districts`; `/discover/recently-played` needs login.
- Search: `GET /search?q=...&type=all|songs|artists&district=&genre=&from=&to=&sort=relevance|newest|popular`.

## Web app (added)
- `npm install && npm run dev` inside `apps/web` (dev server proxies `/api` to the API on :3000), or `docker compose up --build` for everything.
- Pages: Home, Discover (all categories + filters), Search, Artists, Artist profile, Song, Districts, District, Join (listener/artist), Login, Verify email, Account, For artists.
- The audio player lives above the router, so music keeps playing while you browse. It reports listening to `/plays` so the server can count validated streams.
- Tip: set `SIGNED_URL_TTL_SECONDS` to 3600 or more so long songs can seek late in playback (the player also refreshes expired links automatically).

## Artist studio (added)
- `/studio` (artists only): Dashboard, Upload Music (progress bar, processing status), My Songs (filters, auto-refresh while processing), Song edit/delete/retry, Analytics (daily/monthly charts, top songs, districts), Artist Profile (details, avatar and cover), Notifications.
- API: `GET /artists/me/dashboard`, `GET /artists/me/analytics?range=30d|90d|12m`, `POST /artists/me/images` (multipart `avatar`/`cover`).
- Not built yet: Albums, Followers, Playlists, Comments, Settings (need their backend first).

## Admin portal (added)
- `/admin` (admins and moderators). Create the first super admin with `npm run create-admin` in the api container, then add moderators from Admin accounts.
- Modules: Dashboard (queues + activity), Music (approval queue, live, featured, remove), Artists (approve/reject/suspend/feature/verify), Listeners, Reported content, Copyright complaints, Districts, Genres, Analytics, Admin accounts, Audit logs, Notifications.
- Moderators can: review music and artists, handle reports, remove content. Everything else needs the super admin (permission `*`). Permissions live in `admin_roles.permissions`.
- Listeners report songs and file copyright complaints at `/songs/:id/report` (no account needed for complaints).
- Not built yet: Platform settings.

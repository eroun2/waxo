import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { StorageService } from '../storage/storage.service';
import { CacheService } from '../cache/cache.module';
import { AuthUser } from '../common/auth.types';
import { PageQuery, likeEscape, offsetOf, pageOf } from '../common/pagination.dto';
import { ArtistDirQuery, DiscoverQuery, SearchQuery } from './dto';

// ---- shared SQL ----
const SONG_VISIBLE = `s.status = 'approved' AND ap.approval_status = 'active' AND u.status = 'active'`;
const SONG_CARD = `s.id, s.title, s.slug, s.artwork_key, s.duration_seconds, s.downloads_enabled, s.release_at,
  s.stream_count, s.download_count, s.like_count,
  ap.id AS artist_id, ap.stage_name AS artist_name, ap.slug AS artist_slug, ap.is_verified AS artist_verified,
  g.name AS genre, g.slug AS genre_slug, d.name AS district, d.slug AS district_slug`;
const SONG_FROM = `FROM songs s JOIN artist_profiles ap ON ap.id = s.artist_id JOIN users u ON u.id = ap.user_id
  LEFT JOIN genres g ON g.id = s.genre_id LEFT JOIN districts d ON d.id = s.district_id`;

const ARTIST_BASE = `ap.approval_status = 'active' AND u.status = 'active'`;
const ARTIST_HAS_SONGS = `EXISTS (SELECT 1 FROM songs s WHERE s.artist_id = ap.id AND s.status = 'approved')`;
const ARTIST_CARD = `ap.id, ap.stage_name, ap.slug, ap.avatar_key, ap.is_verified,
  (ap.is_featured AND (ap.featured_until IS NULL OR ap.featured_until > now())) AS is_featured,
  d.name AS district, d.slug AS district_slug,
  (SELECT count(*)::int FROM followers f WHERE f.artist_id = ap.id) AS follower_count`;
const ARTIST_FROM = `FROM artist_profiles ap JOIN users u ON u.id = ap.user_id JOIN districts d ON d.id = ap.district_id`;

// Trending = recent listening (streams x1) + recent downloads (x2) over 7 days.
const TRENDING_CTE = `WITH recent AS (
  SELECT song_id, sum(w)::int AS score FROM (
    SELECT song_id, 1 AS w FROM streams WHERE counted AND created_at > now() - interval '7 days'
    UNION ALL SELECT song_id, 2 FROM downloads WHERE created_at > now() - interval '7 days'
  ) x GROUP BY song_id)`;
// Rising = momentum over 14 days: streams + 3 x new followers.
const RISING_CTE = `WITH act AS (
  SELECT artist_id, sum(score)::int AS score FROM (
    SELECT s.artist_id, count(*) AS score FROM streams st JOIN songs s ON s.id = st.song_id
      WHERE st.counted AND st.created_at > now() - interval '14 days' GROUP BY s.artist_id
    UNION ALL SELECT artist_id, 3 * count(*) FROM followers WHERE created_at > now() - interval '14 days' GROUP BY artist_id
  ) x GROUP BY artist_id)`;
const PLAYS30_CTE = `WITH plays30 AS (
  SELECT s.artist_id, count(*)::int AS plays FROM streams st JOIN songs s ON s.id = st.song_id
  WHERE st.counted AND st.created_at > now() - interval '30 days' GROUP BY s.artist_id)`;

type Build = (vals: unknown[]) => { where?: string; order: string };
interface ListOpts { cte?: string; join?: string; extraSelect?: string; build: Build }

const pq = (limit: number): DiscoverQuery => Object.assign(new DiscoverQuery(), { page: 1, limit });

@Injectable()
export class DiscoveryService {
  constructor(@Inject(PG_POOL) private pool: Pool, private storage: StorageService, private cache: CacheService) {}

  // ---------- mappers ----------
  private song = (r: any) => ({
    id: r.id, title: r.title, slug: r.slug, durationSeconds: r.duration_seconds, downloadsEnabled: r.downloads_enabled,
    releaseAt: r.release_at, streamCount: Number(r.stream_count), downloadCount: Number(r.download_count), likeCount: Number(r.like_count),
    artworkUrl: this.storage.publicUrl(r.artwork_key),
    artist: { id: r.artist_id, name: r.artist_name, slug: r.artist_slug, verified: r.artist_verified },
    genre: r.genre ? { name: r.genre, slug: r.genre_slug } : null,
    district: r.district ? { name: r.district, slug: r.district_slug } : null,
    ...(r.trending_score !== undefined && { trendingScore: r.trending_score }),
  });
  private artist = (r: any) => ({
    id: r.id, stageName: r.stage_name, slug: r.slug, avatarUrl: this.storage.publicUrl(r.avatar_key), verified: r.is_verified,
    featured: r.is_featured, district: { name: r.district, slug: r.district_slug }, followerCount: r.follower_count,
    ...(r.momentum !== undefined && { momentum: r.momentum }),
    ...(r.plays !== undefined && { plays30d: r.plays }),
  });

  // ---------- generic paged queries ----------
  private async songPage(q: DiscoverQuery, o: ListOpts) {
    const vals: unknown[] = [];
    const { where: extra, order } = o.build(vals);
    const where = [SONG_VISIBLE, ...(extra ? [extra] : [])];
    if (q.district) { vals.push(q.district); where.push(`d.slug = $${vals.length}`); }
    if (q.genre) { vals.push(q.genre); where.push(`g.slug = $${vals.length}`); }
    const body = `${SONG_FROM} ${o.join ?? ''} WHERE ${where.join(' AND ')}`;
    const n = vals.length;
    const [items, total] = await Promise.all([
      this.pool.query(`${o.cte ?? ''} SELECT ${SONG_CARD}${o.extraSelect ?? ''} ${body} ORDER BY ${order} LIMIT $${n + 1} OFFSET $${n + 2}`,
        [...vals, q.limit, offsetOf(q)]),
      this.pool.query(`${o.cte ?? ''} SELECT count(*)::int AS n ${body}`, vals),
    ]);
    return pageOf(items.rows.map(this.song), total.rows[0].n, q);
  }

  private async artistPage(q: DiscoverQuery, o: ListOpts & { requireSongs?: boolean }) {
    const vals: unknown[] = [];
    const { where: extra, order } = o.build(vals);
    const where = [ARTIST_BASE, ...(o.requireSongs === false ? [] : [ARTIST_HAS_SONGS]), ...(extra ? [extra] : [])];
    if (q.district) { vals.push(q.district); where.push(`d.slug = $${vals.length}`); }
    if (q.genre) {
      vals.push(q.genre);
      where.push(`EXISTS (SELECT 1 FROM artist_genres ag JOIN genres g ON g.id = ag.genre_id WHERE ag.artist_id = ap.id AND g.slug = $${vals.length})`);
    }
    const body = `${ARTIST_FROM} ${o.join ?? ''} WHERE ${where.join(' AND ')}`;
    const n = vals.length;
    const [items, total] = await Promise.all([
      this.pool.query(`${o.cte ?? ''} SELECT ${ARTIST_CARD}${o.extraSelect ?? ''} ${body} ORDER BY ${order} LIMIT $${n + 1} OFFSET $${n + 2}`,
        [...vals, q.limit, offsetOf(q)]),
      this.pool.query(`${o.cte ?? ''} SELECT count(*)::int AS n ${body}`, vals),
    ]);
    return pageOf(items.rows.map(this.artist), total.rows[0].n, q);
  }

  private cached<T>(name: string, q: DiscoverQuery, ttl: number, fn: () => Promise<T>) {
    return this.cache.remember(`d:${name}:${q.district ?? ''}:${q.genre ?? ''}:${q.page}:${q.limit}`, ttl, fn);
  }

  // ---------- song lists ----------
  trending(q: DiscoverQuery) {
    return this.cached('trending', q, 120, () => this.songPage(q, {
      cte: TRENDING_CTE, join: 'LEFT JOIN recent r ON r.song_id = s.id', extraSelect: ', COALESCE(r.score, 0)::int AS trending_score',
      build: () => ({ order: 'COALESCE(r.score, 0) DESC, s.stream_count DESC, s.release_at DESC' }),
    }));
  }
  newReleases(q: DiscoverQuery) {
    return this.cached('new', q, 120, () => this.songPage(q, { build: () => ({ where: 's.release_at <= now()', order: 's.release_at DESC' }) }));
  }
  recentlyAdded(q: DiscoverQuery) {
    return this.cached('added', q, 120, () => this.songPage(q, { build: () => ({ order: 's.reviewed_at DESC NULLS LAST, s.created_at DESC' }) }));
  }
  mostStreamed(q: DiscoverQuery) {
    return this.cached('streamed', q, 300, () => this.songPage(q, { build: () => ({ order: 's.stream_count DESC, s.release_at DESC' }) }));
  }
  mostDownloaded(q: DiscoverQuery) {
    return this.cached('downloaded', q, 300, () => this.songPage(q, {
      build: () => ({ where: 's.downloads_enabled', order: 's.download_count DESC, s.stream_count DESC' }),
    }));
  }
  featuredSongs(q: DiscoverQuery) {
    return this.cached('featsongs', q, 120, () => this.songPage(q, { build: () => ({ where: 's.is_featured', order: 's.release_at DESC' }) }));
  }

  /** Personal: based on what the listener played, nudged toward their district. Falls back to trending. */
  async recommended(q: DiscoverQuery, user?: AuthUser) {
    if (!user) return this.trending(q);
    const [genres, district] = await Promise.all([
      this.pool.query(
        `SELECT s.genre_id FROM recently_played rp JOIN songs s ON s.id = rp.song_id
         WHERE rp.user_id = $1 AND s.genre_id IS NOT NULL GROUP BY s.genre_id ORDER BY count(*) DESC LIMIT 3`, [user.id]),
      this.pool.query('SELECT district_id FROM listener_profiles WHERE user_id = $1', [user.id]),
    ]);
    const genreIds = genres.rows.map((r) => r.genre_id as number);
    if (!genreIds.length) return this.nearMe(q, user);
    const districtId: number | null = district.rows[0]?.district_id ?? null;
    return this.songPage(q, {
      build: (vals) => {
        vals.push(genreIds, user.id, districtId);
        const [g, u, d] = [vals.length - 2, vals.length - 1, vals.length];
        return {
          where: `s.genre_id = ANY($${g}::int[]) AND s.id NOT IN (SELECT song_id FROM recently_played WHERE user_id = $${u})`,
          order: `(CASE WHEN s.district_id = $${d}::int THEN 1 ELSE 0 END) DESC, s.stream_count DESC, s.release_at DESC`,
        };
      },
    });
  }

  /** "Popular in your district": uses the logged-in listener's/artist's district, otherwise plain trending. */
  async nearMe(q: DiscoverQuery, user?: AuthUser) {
    if (!user || q.district) return this.trending(q);
    const { rows } = await this.pool.query(
      `SELECT d.slug FROM districts d WHERE d.id = COALESCE(
         (SELECT district_id FROM listener_profiles WHERE user_id = $1), (SELECT district_id FROM artist_profiles WHERE user_id = $1))`, [user.id]);
    return this.trending(Object.assign(new DiscoverQuery(), q, { district: rows[0]?.slug }));
  }

  recentlyPlayed(userId: string, q: PageQuery) {
    return this.songPage(q as DiscoverQuery, {
      join: 'JOIN recently_played rp ON rp.song_id = s.id',
      build: (vals) => { vals.push(userId); return { where: `rp.user_id = $${vals.length}`, order: 'rp.played_at DESC' }; },
    });
  }

  // ---------- artist lists ----------
  risingStars(q: DiscoverQuery) {
    return this.cached('rising', q, 300, () => this.artistPage(q, {
      cte: RISING_CTE, join: 'LEFT JOIN act a ON a.artist_id = ap.id', extraSelect: ', COALESCE(a.score, 0)::int AS momentum',
      build: () => ({ order: 'COALESCE(a.score, 0) DESC, ap.created_at DESC' }),
    }));
  }
  featuredArtists(q: DiscoverQuery) {
    return this.cached('featartists', q, 120, () => this.artistPage(q, {
      build: () => ({ where: `ap.is_featured AND (ap.featured_until IS NULL OR ap.featured_until > now())`, order: 'ap.stage_name' }),
    }));
  }
  /** Browse all artists (featured first), optionally filtered by name, district or genre. */
  artistDirectory(q: ArtistDirQuery) {
    return this.artistPage(q, {
      requireSongs: false,
      build: (vals) => {
        let where: string | undefined;
        if (q.q?.trim()) { vals.push(`%${likeEscape(q.q.trim())}%`); where = `ap.stage_name ILIKE $${vals.length}`; }
        return { where, order: `(ap.is_featured AND (ap.featured_until IS NULL OR ap.featured_until > now())) DESC, ap.stage_name` };
      },
    });
  }

  artistSongs(slug: string, q: DiscoverQuery) {
    return this.songPage(q, {
      build: (vals) => { vals.push(slug); return { where: `ap.slug = $${vals.length}`, order: 's.release_at DESC' }; },
    });
  }

  /** District leaderboard: top artists by validated streams over the last 30 days, plus the district's trending songs. */
  async leaderboard(slug: string, q: DiscoverQuery) {
    const scoped = Object.assign(new DiscoverQuery(), q, { district: slug });
    return this.cache.remember(`d:board:${slug}:${q.genre ?? ''}:${q.page}:${q.limit}`, 300, async () => ({
      artists: await this.artistPage(scoped, {
        cte: PLAYS30_CTE, join: 'LEFT JOIN plays30 p ON p.artist_id = ap.id', extraSelect: ', COALESCE(p.plays, 0) AS plays',
        build: () => ({ order: 'COALESCE(p.plays, 0) DESC, ap.created_at' }),
      }),
      songs: await this.trending(Object.assign(new DiscoverQuery(), scoped, { page: 1, limit: 10 })),
    }));
  }

  // ---------- homepage bundle ----------
  home() {
    return this.cache.remember('home', 120, async () => {
      const [trending, newReleases, recentlyAdded, mostDownloaded, featuredSongs, risingStars, featuredArtists, genres, districts, popularByDistrict] =
        await Promise.all([
          this.songPage(pq(12), { cte: TRENDING_CTE, join: 'LEFT JOIN recent r ON r.song_id = s.id', extraSelect: ', COALESCE(r.score, 0)::int AS trending_score',
            build: () => ({ order: 'COALESCE(r.score, 0) DESC, s.stream_count DESC, s.release_at DESC' }) }),
          this.songPage(pq(12), { build: () => ({ where: 's.release_at <= now()', order: 's.release_at DESC' }) }),
          this.songPage(pq(12), { build: () => ({ order: 's.reviewed_at DESC NULLS LAST, s.created_at DESC' }) }),
          this.songPage(pq(12), { build: () => ({ where: 's.downloads_enabled', order: 's.download_count DESC, s.stream_count DESC' }) }),
          this.songPage(pq(8), { build: () => ({ where: 's.is_featured', order: 's.release_at DESC' }) }),
          this.artistPage(pq(12), { cte: RISING_CTE, join: 'LEFT JOIN act a ON a.artist_id = ap.id', extraSelect: ', COALESCE(a.score, 0)::int AS momentum',
            build: () => ({ order: 'COALESCE(a.score, 0) DESC, ap.created_at DESC' }) }),
          this.artistPage(pq(8), { build: () => ({ where: `ap.is_featured AND (ap.featured_until IS NULL OR ap.featured_until > now())`, order: 'ap.stage_name' }) }),
          this.genreList(),
          this.districtList(),
          this.popularByDistrict(),
        ]);
      return {
        trending: trending.items, newReleases: newReleases.items, recentlyAdded: recentlyAdded.items, mostDownloaded: mostDownloaded.items,
        featuredSongs: featuredSongs.items, risingStars: risingStars.items, featuredArtists: featuredArtists.items,
        genres, districts, popularByDistrict,
      };
    });
  }

  async genreList() {
    const { rows } = await this.pool.query(
      `SELECT g.id, g.name, g.slug, count(s.id) FILTER (WHERE s.status = 'approved')::int AS song_count
       FROM genres g LEFT JOIN songs s ON s.genre_id = g.id WHERE g.is_active GROUP BY g.id ORDER BY song_count DESC, g.name`);
    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, songCount: r.song_count }));
  }

  async districtList() {
    const { rows } = await this.pool.query(
      `SELECT d.id, d.name, d.slug, d.region,
              (SELECT count(*)::int FROM artist_profiles ap JOIN users u ON u.id = ap.user_id
                WHERE ap.district_id = d.id AND ${ARTIST_BASE}) AS artist_count,
              (SELECT count(*)::int FROM songs s JOIN artist_profiles ap ON ap.id = s.artist_id
                WHERE s.district_id = d.id AND s.status = 'approved' AND ap.approval_status = 'active') AS song_count
       FROM districts d WHERE d.is_active ORDER BY song_count DESC, artist_count DESC, d.name`);
    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, region: r.region, artistCount: r.artist_count, songCount: r.song_count }));
  }

  /** Top 4 artists in each of the 6 most active districts. */
  async popularByDistrict() {
    const { rows } = await this.pool.query(
      `${PLAYS30_CTE}, ranked AS (
         SELECT ${ARTIST_CARD}, COALESCE(p.plays, 0) AS plays, d.id AS district_id,
                ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY COALESCE(p.plays, 0) DESC, ap.created_at) AS rn
         ${ARTIST_FROM} LEFT JOIN plays30 p ON p.artist_id = ap.id
         WHERE ${ARTIST_BASE} AND ${ARTIST_HAS_SONGS})
       SELECT * FROM ranked WHERE rn <= 4`);
    const byDistrict = new Map<number, { district: { name: string; slug: string }; total: number; artists: any[] }>();
    for (const r of rows) {
      const e: { district: { name: string; slug: string }; total: number; artists: any[] } =
        byDistrict.get(r.district_id) ?? { district: { name: r.district, slug: r.district_slug }, total: 0, artists: [] };
      e.total += Number(r.plays);
      e.artists.push(this.artist(r));
      byDistrict.set(r.district_id, e);
    }
    return [...byDistrict.values()]
      .sort((a, b) => b.total - a.total || b.artists.length - a.artists.length || a.district.name.localeCompare(b.district.name))
      .slice(0, 6).map(({ district, artists }) => ({ district, artists }));
  }

  // ---------- search ----------
  async search(q: SearchQuery) {
    const term = q.q.trim();
    const wantSongs = q.type !== 'artists';
    const wantArtists = q.type !== 'songs';
    const pg = q.type === 'all' ? Object.assign(new SearchQuery(), q, { page: 1, limit: 10 }) : q;
    const [songs, artists] = await Promise.all([
      wantSongs ? this.searchSongs(pg, term) : undefined,
      wantArtists ? this.searchArtists(pg, term) : undefined,
    ]);
    return { query: term, ...(songs && { songs }), ...(artists && { artists }) };
  }

  private searchSongs(q: SearchQuery, term: string) {
    return this.songPage(q, {
      build: (vals) => {
        vals.push(`%${likeEscape(term)}%`, term);
        const [like, raw] = [vals.length - 1, vals.length];
        const conds = [`(s.title ILIKE $${like} OR ap.stage_name ILIKE $${like} OR similarity(s.title, $${raw}) > 0.3 OR similarity(ap.stage_name, $${raw}) > 0.3)`];
        if (q.from) { vals.push(q.from); conds.push(`s.release_at >= $${vals.length}`); }
        if (q.to) { vals.push(q.to); conds.push(`s.release_at <= $${vals.length}`); }
        const relevance = `GREATEST(similarity(s.title, $${raw}), similarity(ap.stage_name, $${raw})) DESC, s.stream_count DESC`;
        const order = q.sort === 'newest' ? 's.release_at DESC' : q.sort === 'popular' ? 's.stream_count DESC, s.release_at DESC' : relevance;
        return { where: conds.join(' AND '), order };
      },
    });
  }

  private searchArtists(q: SearchQuery, term: string) {
    return this.artistPage(q, {
      requireSongs: false,
      build: (vals) => {
        vals.push(`%${likeEscape(term)}%`, term);
        const [like, raw] = [vals.length - 1, vals.length];
        return {
          where: `(ap.stage_name ILIKE $${like} OR similarity(ap.stage_name, $${raw}) > 0.3)`,
          order: q.sort === 'newest' ? 'ap.created_at DESC' : `similarity(ap.stage_name, $${raw}) DESC, ap.stage_name`,
        };
      },
    });
  }
}

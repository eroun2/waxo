import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { StorageService } from '../storage/storage.service';

type Range = '30d' | '90d' | '12m';

@Injectable()
export class AdminDashboardService {
  constructor(@Inject(PG_POOL) private pool: Pool, private storage: StorageService) {}

  private async since(unit: 'day' | 'month', n: number) {
    const { rows } = await this.pool.query(`SELECT date_trunc($1, now()) - (($2::int - 1) * ('1 ' || $1)::interval) AS since`, [unit, n]);
    return rows[0].since as Date;
  }

  private async series(unit: 'day' | 'month', n: number, since: Date) {
    const { rows } = await this.pool.query(
      `WITH b AS (SELECT generate_series($1::timestamptz, date_trunc($2, now()), ('1 ' || $2)::interval) AS b),
            s AS (SELECT date_trunc($2, created_at) AS b, count(*)::int AS n FROM streams WHERE counted AND created_at >= $1::timestamptz GROUP BY 1),
            d AS (SELECT date_trunc($2, created_at) AS b, count(*)::int AS n FROM downloads WHERE created_at >= $1::timestamptz GROUP BY 1),
            u AS (SELECT date_trunc($2, created_at) AS b, count(*)::int AS n FROM users WHERE created_at >= $1::timestamptz GROUP BY 1)
       SELECT to_char(b.b, 'YYYY-MM-DD') AS date, COALESCE(s.n, 0) AS streams, COALESCE(d.n, 0) AS downloads, COALESCE(u.n, 0) AS signups
       FROM b LEFT JOIN s ON s.b = b.b LEFT JOIN d ON d.b = b.b LEFT JOIN u ON u.b = b.b ORDER BY b.b`, [since, unit]);
    return rows;
  }

  async dashboard() {
    const since = await this.since('day', 14);
    const [counts, series, activity] = await Promise.all([
      this.pool.query(
        `SELECT (SELECT count(*)::int FROM users WHERE role = 'listener') AS listeners,
                (SELECT count(*)::int FROM artist_profiles WHERE approval_status = 'active') AS artists,
                (SELECT count(*)::int FROM artist_profiles WHERE approval_status = 'pending') AS pending_artists,
                (SELECT count(*)::int FROM songs WHERE status = 'approved') AS live_songs,
                (SELECT count(*)::int FROM songs WHERE status = 'pending_review' AND process_status = 'ready') AS pending_songs,
                (SELECT count(*)::int FROM songs WHERE process_status = 'failed' AND status <> 'removed') AS failed_songs,
                (SELECT count(*)::int FROM copyright_reports WHERE status IN ('open','investigating')) AS open_copyright,
                (SELECT count(*)::int FROM music_reports WHERE status IN ('open','investigating')) AS open_reports,
                (SELECT COALESCE(sum(stream_count), 0)::bigint FROM songs) AS streams,
                (SELECT COALESCE(sum(download_count), 0)::bigint FROM songs) AS downloads`),
      this.series('day', 14, since),
      this.pool.query(
        `SELECT a.id, a.action, a.entity_type, a.created_at, u.email AS actor_email
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 8`),
    ]);
    const c = counts.rows[0];
    return {
      users: { listeners: c.listeners, artists: c.artists },
      queues: { pendingArtists: c.pending_artists, pendingSongs: c.pending_songs, failedSongs: c.failed_songs, openCopyright: c.open_copyright, openReports: c.open_reports },
      songs: { live: c.live_songs },
      totals: { streams: Number(c.streams), downloads: Number(c.downloads) },
      series, recentActivity: activity.rows,
    };
  }

  /** Platform-wide analytics from validated server-side events. */
  async analytics(range: Range) {
    const unit = range === '12m' ? 'month' : 'day';
    const n = range === '30d' ? 30 : range === '90d' ? 90 : 12;
    const since = await this.since(unit, n);
    const [series, totals, topSongs, topArtists, districts] = await Promise.all([
      this.series(unit, n, since),
      this.pool.query(
        `SELECT (SELECT count(*)::int FROM streams WHERE counted AND created_at >= $1::timestamptz) AS streams,
                (SELECT count(DISTINCT COALESCE(user_id::text, ip_hash))::int FROM streams WHERE counted AND created_at >= $1::timestamptz) AS listeners,
                (SELECT count(*)::int FROM downloads WHERE created_at >= $1::timestamptz) AS downloads,
                (SELECT count(*)::int FROM users WHERE role = 'listener' AND created_at >= $1::timestamptz) AS new_listeners,
                (SELECT count(*)::int FROM artist_profiles WHERE created_at >= $1::timestamptz) AS new_artists,
                (SELECT count(*)::int FROM songs WHERE created_at >= $1::timestamptz AND status <> 'removed') AS new_songs`, [since]),
      this.pool.query(
        `SELECT s.id, s.title, ap.stage_name AS artist_name, count(st.id)::int AS streams
         FROM streams st JOIN songs s ON s.id = st.song_id JOIN artist_profiles ap ON ap.id = s.artist_id
         WHERE st.counted AND st.created_at >= $1::timestamptz GROUP BY s.id, ap.stage_name ORDER BY streams DESC LIMIT 10`, [since]),
      this.pool.query(
        `SELECT ap.id, ap.stage_name, ap.slug, count(st.id)::int AS streams
         FROM streams st JOIN songs s ON s.id = st.song_id JOIN artist_profiles ap ON ap.id = s.artist_id
         WHERE st.counted AND st.created_at >= $1::timestamptz GROUP BY ap.id ORDER BY streams DESC LIMIT 10`, [since]),
      this.pool.query(
        `SELECT d.name, d.slug, count(st.id)::int AS streams
         FROM streams st JOIN songs s ON s.id = st.song_id JOIN districts d ON d.id = s.district_id
         WHERE st.counted AND st.created_at >= $1::timestamptz GROUP BY d.id ORDER BY streams DESC LIMIT 10`, [since]),
    ]);
    const t = totals.rows[0];
    return {
      range, unit,
      totals: { streams: t.streams, uniqueListeners: t.listeners, downloads: t.downloads, newListeners: t.new_listeners, newArtists: t.new_artists, newSongs: t.new_songs },
      series, topSongs: topSongs.rows, topArtists: topArtists.rows, districts: districts.rows,
    };
  }
}

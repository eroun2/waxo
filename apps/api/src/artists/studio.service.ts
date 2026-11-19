import { BadRequestException, Inject, Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import { stat, unlink } from 'fs/promises';
import { PG_POOL } from '../database/database.module';
import { StorageService } from '../storage/storage.service';
import { FfmpegService } from '../media/ffmpeg.service';
import { ScanService } from '../media/scan.service';
import { readHead, sniffImage } from '../media/sniff';
import { AuditService } from '../audit/audit.service';

type Files = { avatar?: Express.Multer.File[]; cover?: Express.Multer.File[] };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_SPECS = { avatar: { w: 600, h: 600, col: 'avatar_key' }, cover: { w: 1600, h: 600, col: 'cover_key' } } as const;

/** Everything an artist sees about their own work. All queries are scoped to the logged-in artist's profile. */
@Injectable()
export class StudioService {
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    private storage: StorageService,
    private ffmpeg: FfmpegService,
    private scan: ScanService,
    private audit: AuditService,
  ) {}

  private async artistOf(userId: string) {
    const { rows } = await this.pool.query('SELECT id, approval_status, avatar_key, cover_key FROM artist_profiles WHERE user_id = $1', [userId]);
    if (!rows[0]) throw new NotFoundException('Artist profile not found.');
    return rows[0] as { id: string; approval_status: string; avatar_key: string | null; cover_key: string | null };
  }

  async dashboard(userId: string) {
    const a = await this.artistOf(userId);
    const [counts, totals, week, recent] = await Promise.all([
      this.pool.query(`SELECT status, count(*)::int AS n FROM songs WHERE artist_id = $1 AND status <> 'removed' GROUP BY status`, [a.id]),
      this.pool.query(
        `SELECT COALESCE(sum(stream_count), 0)::bigint AS streams, COALESCE(sum(download_count), 0)::bigint AS downloads, COALESCE(sum(like_count), 0)::bigint AS likes,
                (SELECT count(*)::int FROM followers WHERE artist_id = $1) AS followers
         FROM songs WHERE artist_id = $1 AND status <> 'removed'`, [a.id]),
      this.pool.query(
        `SELECT count(*) FILTER (WHERE st.created_at >= now() - interval '7 days')::int AS current,
                count(*) FILTER (WHERE st.created_at < now() - interval '7 days')::int AS previous
         FROM streams st JOIN songs s ON s.id = st.song_id
         WHERE s.artist_id = $1 AND st.counted AND st.created_at >= now() - interval '14 days'`, [a.id]),
      this.pool.query(
        `SELECT id, title, status, process_status, artwork_key, stream_count, download_count, created_at
         FROM songs WHERE artist_id = $1 AND status <> 'removed' ORDER BY created_at DESC LIMIT 5`, [a.id]),
    ]);
    const by = Object.fromEntries(counts.rows.map((r) => [r.status, r.n])) as Record<string, number>;
    const t = totals.rows[0];
    return {
      approvalStatus: a.approval_status,
      songs: {
        live: by.approved ?? 0, scheduled: by.scheduled ?? 0, inReview: by.pending_review ?? 0, processing: by.processing ?? 0,
        rejected: by.rejected ?? 0, draft: by.draft ?? 0, total: Object.values(by).reduce((x, y) => x + y, 0),
      },
      totals: { streams: Number(t.streams), downloads: Number(t.downloads), likes: Number(t.likes), followers: t.followers },
      last7Days: { streams: week.rows[0].current, previous: week.rows[0].previous },
      recentSongs: recent.rows.map(({ artwork_key, ...r }) => ({ ...r, artworkUrl: this.storage.publicUrl(artwork_key) })),
    };
  }

  /**
   * Streams and downloads come only from server-validated events (counted streams, recorded downloads).
   * District figures use the listener's own district, so anonymous or district-less listeners are reported separately.
   */
  async analytics(userId: string, range: '30d' | '90d' | '12m') {
    const a = await this.artistOf(userId);
    const unit = range === '12m' ? 'month' : 'day';
    const n = range === '30d' ? 30 : range === '90d' ? 90 : 12;
    const { since } = (await this.pool.query(`SELECT date_trunc($1, now()) - (($2::int - 1) * ('1 ' || $1)::interval) AS since`, [unit, n])).rows[0];

    const [series, totals, followers, allTime, top, districts] = await Promise.all([
      this.pool.query(
        `WITH my AS (SELECT id FROM songs WHERE artist_id = $1),
              b AS (SELECT generate_series($2::timestamptz, date_trunc($3, now()), ('1 ' || $3)::interval) AS b),
              s AS (SELECT date_trunc($3, st.created_at) AS b, count(*)::int AS streams FROM streams st
                    WHERE st.song_id IN (SELECT id FROM my) AND st.counted AND st.created_at >= $2::timestamptz GROUP BY 1),
              d AS (SELECT date_trunc($3, dl.created_at) AS b, count(*)::int AS downloads FROM downloads dl
                    WHERE dl.song_id IN (SELECT id FROM my) AND dl.created_at >= $2::timestamptz GROUP BY 1)
         SELECT to_char(b.b, 'YYYY-MM-DD') AS date, COALESCE(s.streams, 0) AS streams, COALESCE(d.downloads, 0) AS downloads
         FROM b LEFT JOIN s ON s.b = b.b LEFT JOIN d ON d.b = b.b ORDER BY b.b`, [a.id, since, unit]),
      this.pool.query(
        `SELECT count(*) FILTER (WHERE st.counted)::int AS streams,
                count(DISTINCT COALESCE(st.user_id::text, st.ip_hash)) FILTER (WHERE st.counted)::int AS listeners,
                (SELECT count(*)::int FROM downloads dl JOIN songs s2 ON s2.id = dl.song_id WHERE s2.artist_id = $1 AND dl.created_at >= $2::timestamptz) AS downloads
         FROM streams st JOIN songs s ON s.id = st.song_id WHERE s.artist_id = $1 AND st.created_at >= $2::timestamptz`, [a.id, since]),
      this.pool.query('SELECT count(*)::int AS n FROM followers WHERE artist_id = $1 AND created_at >= $2::timestamptz', [a.id, since]),
      this.pool.query(
        `SELECT COALESCE(sum(stream_count), 0)::bigint AS streams, COALESCE(sum(download_count), 0)::bigint AS downloads,
                (SELECT count(*)::int FROM followers WHERE artist_id = $1) AS followers
         FROM songs WHERE artist_id = $1 AND status <> 'removed'`, [a.id]),
      this.pool.query(
        `SELECT s.id, s.title, s.artwork_key, count(st.id) FILTER (WHERE st.counted)::int AS streams,
                (SELECT count(*)::int FROM downloads dl WHERE dl.song_id = s.id AND dl.created_at >= $2::timestamptz) AS downloads
         FROM songs s LEFT JOIN streams st ON st.song_id = s.id AND st.created_at >= $2::timestamptz
         WHERE s.artist_id = $1 AND s.status = 'approved' GROUP BY s.id ORDER BY streams DESC, s.title LIMIT 10`, [a.id, since]),
      this.pool.query(
        `SELECT d.name, d.slug, count(*)::int AS streams
         FROM streams st JOIN songs s ON s.id = st.song_id LEFT JOIN districts d ON d.id = st.district_id
         WHERE s.artist_id = $1 AND st.counted AND st.created_at >= $2::timestamptz GROUP BY d.id ORDER BY streams DESC`, [a.id, since]),
    ]);

    const known = districts.rows.filter((r) => r.name);
    return {
      range, unit,
      totals: { streams: totals.rows[0].streams, uniqueListeners: totals.rows[0].listeners, downloads: totals.rows[0].downloads, newFollowers: followers.rows[0].n },
      allTime: { streams: Number(allTime.rows[0].streams), downloads: Number(allTime.rows[0].downloads), followers: allTime.rows[0].followers },
      series: series.rows,
      topSongs: top.rows.map(({ artwork_key, ...r }) => ({ ...r, artworkUrl: this.storage.publicUrl(artwork_key) })),
      districts: { items: known.slice(0, 10), unknownStreams: districts.rows.filter((r) => !r.name).reduce((s, r) => s + r.streams, 0) },
    };
  }

  /** Profile picture (600x600) and cover (1600x600). Re-encoded server-side; old files are removed. */
  async updateImages(userId: string, files: Files, ip?: string) {
    const a = await this.artistOf(userId);
    const tmp: string[] = [...(files.avatar ?? []), ...(files.cover ?? [])].map((f) => f.path);
    try {
      if (!tmp.length) throw new BadRequestException('Choose a profile picture or cover image to upload.');
      for (const kind of ['avatar', 'cover'] as const) {
        const f = files[kind]?.[0];
        if (!f) continue;
        if (!sniffImage(await readHead(f.path))) throw new UnsupportedMediaTypeException('Images must be JPG, PNG or WebP.');
        if ((await stat(f.path)).size > MAX_IMAGE_BYTES) throw new BadRequestException('Images must be 5 MB or smaller.');
        await this.scan.assertClean(f.path);
        const spec = IMAGE_SPECS[kind];
        const out = `${f.path}.jpg`;
        tmp.push(out);
        await this.ffmpeg.toImage(f.path, out, spec.w, spec.h);
        const key = `${kind === 'avatar' ? 'avatars' : 'covers'}/${a.id}-${randomBytes(4).toString('hex')}.jpg`;
        await this.storage.putFile(this.storage.publicBucket, key, out, 'image/jpeg');
        await this.pool.query(`UPDATE artist_profiles SET ${spec.col} = $1 WHERE id = $2`, [key, a.id]);
        const old = spec.col === 'avatar_key' ? a.avatar_key : a.cover_key;
        if (old) await this.storage.delete(this.storage.publicBucket, old);
        await this.audit.record(userId, `artist.${kind}_updated`, 'artist_profile', a.id, {}, ip);
      }
      const { rows } = await this.pool.query('SELECT avatar_key, cover_key FROM artist_profiles WHERE id = $1', [a.id]);
      return { avatarUrl: this.storage.publicUrl(rows[0].avatar_key), coverUrl: this.storage.publicUrl(rows[0].cover_key) };
    } finally {
      await Promise.all(tmp.map((p) => unlink(p).catch(() => undefined)));
    }
  }
}

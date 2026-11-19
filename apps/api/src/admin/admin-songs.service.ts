import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { CacheService } from '../cache/cache.module';
import { withTx } from '../common/db';
import { likeEscape, offsetOf, pageOf } from '../common/pagination.dto';
import { AdminSongListQuery } from './dto';

type Kind = 'approve' | 'reject' | 'remove';

// $1 actor, $2 song id, $3 reason (text, null for approve), $4 allowed current statuses
const KINDS: Record<Kind, { set: string; from: string[]; action: string; title: (t: string) => string; body: (t: string, status: string, r?: string) => string }> = {
  approve: {
    set: `status = CASE WHEN release_at IS NOT NULL AND release_at > now() THEN 'scheduled'::song_status ELSE 'approved'::song_status END,
          release_at = COALESCE(release_at, now())`,
    from: ['pending_review'], action: 'song.approved',
    title: (t) => `"${t}" was approved`,
    body: (t, s) => (s === 'scheduled' ? `"${t}" is approved and will go live on its release date.` : `"${t}" is now live on WaXo.`),
  },
  reject: {
    set: `status = 'rejected'::song_status`, from: ['pending_review'], action: 'song.rejected',
    title: (t) => `"${t}" was not approved`,
    body: (t, _s, r) => `"${t}" could not be approved. Reason: ${r}`,
  },
  remove: {
    set: `status = 'removed'::song_status, is_featured = false`, from: ['pending_review', 'approved', 'scheduled', 'rejected'], action: 'song.removed',
    title: (t) => `"${t}" was removed`,
    body: (t, _s, r) => `"${t}" was removed from WaXo. Reason: ${r}`,
  },
};

@Injectable()
export class AdminSongsService {
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    private audit: AuditService,
    private notifications: NotificationsService,
    private mail: MailService,
    private storage: StorageService,
    private cache: CacheService,
  ) {}

  async list(q: AdminSongListQuery) {
    const vals: unknown[] = [];
    const where: string[] = [];
    if (q.status === 'all') where.push(`s.status <> 'removed'`);
    else { vals.push(q.status); where.push(`s.status = $${vals.length}::song_status`); }
    if (q.q) { vals.push(`%${likeEscape(q.q.trim())}%`); where.push(`(s.title ILIKE $${vals.length} OR ap.stage_name ILIKE $${vals.length})`); }
    const order = q.sort === 'streams' ? 's.stream_count DESC, s.created_at DESC'
      : q.sort === 'newest' || (!q.sort && q.status !== 'pending_review') ? 's.created_at DESC' : 's.created_at ASC';
    const from = `FROM songs s JOIN artist_profiles ap ON ap.id = s.artist_id WHERE ${where.join(' AND ')}`;
    const [items, total] = await Promise.all([
      this.pool.query(
        `SELECT s.id, s.title, ap.stage_name AS artist_name, ap.id AS artist_id, s.status, s.process_status, s.duration_seconds, s.downloads_enabled,
                s.release_at, s.created_at, s.is_featured, s.stream_count, s.download_count, s.artwork_key
         ${from} ORDER BY ${order} LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`, [...vals, q.limit, offsetOf(q)]),
      this.pool.query(`SELECT count(*)::int AS n ${from}`, vals),
    ]);
    return pageOf(items.rows.map(({ artwork_key, ...r }) => ({ ...r, artworkUrl: this.storage.publicUrl(artwork_key) })), total.rows[0].n, q);
  }

  /** Includes a short-lived preview URL so moderators can listen before deciding. */
  async get(id: string) {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.title, s.description, s.status, s.process_status, s.rejection_reason, s.duration_seconds, s.downloads_enabled,
              s.release_at, s.is_featured, s.original_mime, s.file_size_bytes, s.ownership_confirmed_at, s.stream_key, s.artwork_key, s.created_at,
              ap.id AS artist_id, ap.stage_name AS artist_name, g.name AS genre, d.name AS district
       FROM songs s JOIN artist_profiles ap ON ap.id = s.artist_id
       LEFT JOIN genres g ON g.id = s.genre_id LEFT JOIN districts d ON d.id = s.district_id WHERE s.id = $1`, [id]);
    const s = rows[0];
    if (!s) throw new NotFoundException('Song not found.');
    const { stream_key, artwork_key, ...rest } = s;
    return {
      ...rest,
      artworkUrl: this.storage.publicUrl(artwork_key),
      previewUrl: stream_key ? await this.storage.signedGetUrl(this.storage.privateBucket, stream_key, 900, { contentType: 'audio/mp4' }) : null,
    };
  }

  /** Feature (or un-feature) an approved song on the homepage and discovery pages. */
  async setFeatured(id: string, actor: string, featured: boolean, ip?: string) {
    const { rows } = await this.pool.query(`UPDATE songs SET is_featured = $2 WHERE id = $1 AND status = 'approved' RETURNING id`, [id, featured]);
    if (!rows[0]) throw new ConflictException('Only approved songs can be featured.');
    await this.audit.record(actor, featured ? 'song.featured' : 'song.unfeatured', 'song', id, {}, ip);
    await this.cache.invalidate();
    return { id, featured };
  }

  approve(id: string, actor: string, ip?: string) { return this.transition('approve', id, actor, undefined, ip); }
  reject(id: string, actor: string, reason: string, ip?: string) { return this.transition('reject', id, actor, reason, ip); }
  remove(id: string, actor: string, reason: string, ip?: string) { return this.transition('remove', id, actor, reason, ip); }

  private async transition(kind: Kind, id: string, actor: string, reason: string | undefined, ip?: string) {
    const k = KINDS[kind];
    const r = await withTx(this.pool, async (db) => {
      const { rows } = await db.query(
        `UPDATE songs SET ${k.set}, reviewed_by = $1::uuid, reviewed_at = now(), rejection_reason = $3::text
         WHERE id = $2 AND status = ANY($4::song_status[]) ${kind === 'approve' ? `AND process_status = 'ready'` : ''}
         RETURNING title, status, artist_id`, [actor, id, reason ?? null, k.from]);
      if (!rows[0]) {
        const cur = await db.query('SELECT status, process_status FROM songs WHERE id = $1', [id]);
        if (!cur.rowCount) throw new NotFoundException('Song not found.');
        throw new ConflictException(`Cannot ${kind} a song that is "${cur.rows[0].status}"${kind === 'approve' && cur.rows[0].process_status !== 'ready' ? ' and not fully processed' : ''}.`);
      }
      const { title, status, artist_id } = rows[0];
      const u = await db.query('SELECT ap.user_id, u.email FROM artist_profiles ap JOIN users u ON u.id = ap.user_id WHERE ap.id = $1', [artist_id]);
      await this.notifications.create(db, u.rows[0].user_id, k.action, k.title(title), k.body(title, status, reason), { songId: id });
      return { title, status, email: u.rows[0].email as string };
    });
    await this.audit.record(actor, k.action, 'song', id, { reason: reason ?? null, title: r.title }, ip);
    await this.mail.send(r.email, k.title(r.title), k.body(r.title, r.status, reason));
    return { id, status: r.status };
  }
}

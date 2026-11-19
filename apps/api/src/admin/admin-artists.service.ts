import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { CacheService } from '../cache/cache.module';
import { withTx } from '../common/db';
import { likeEscape, offsetOf, pageOf } from '../common/pagination.dto';
import { AdminArtistListQuery, ArtistFlagsDto } from './dto';

type Status = 'pending' | 'active' | 'rejected' | 'suspended';

interface Transition {
  from: Status[];
  to: Status;
  action: string;           // audit action
  userStatus?: 'active' | 'suspended';
  revokeSessions?: boolean;
  title: string;            // notification + email subject
  body: (reason?: string) => string;
}

const TRANSITIONS: Record<'approve' | 'reject' | 'suspend' | 'reinstate', Transition> = {
  approve: {
    from: ['pending', 'rejected'], to: 'active', action: 'artist.approved',
    title: 'Your WaXo artist profile is approved',
    body: () => 'Congratulations! Your artist profile is live. You can now upload music.',
  },
  reject: {
    from: ['pending'], to: 'rejected', action: 'artist.rejected',
    title: 'Your WaXo artist profile needs changes',
    body: (r) => `We could not approve your profile yet. Reason: ${r}\nUpdate your profile and resubmit it for review.`,
  },
  suspend: {
    from: ['active'], to: 'suspended', action: 'artist.suspended', userStatus: 'suspended', revokeSessions: true,
    title: 'Your WaXo artist account has been suspended',
    body: (r) => `Your account was suspended. Reason: ${r}`,
  },
  reinstate: {
    from: ['suspended'], to: 'active', action: 'artist.reinstated', userStatus: 'active',
    title: 'Your WaXo artist account has been reinstated',
    body: () => 'Your account is active again.',
  },
};

@Injectable()
export class AdminArtistsService {
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    private audit: AuditService,
    private notifications: NotificationsService,
    private mail: MailService,
    private cache: CacheService,
  ) {}

  async list(q: AdminArtistListQuery) {
    const vals: unknown[] = [q.status];
    let where = 'ap.approval_status = $1';
    if (q.q) { vals.push(`%${likeEscape(q.q.trim())}%`); where += ` AND (ap.stage_name ILIKE $2 OR u.email ILIKE $2)`; }
    const from = `FROM artist_profiles ap JOIN users u ON u.id = ap.user_id JOIN districts d ON d.id = ap.district_id WHERE ${where}`;
    const [items, total] = await Promise.all([
      this.pool.query(
        `SELECT ap.id, ap.stage_name, ap.slug, ap.real_name, ap.phone, u.email, u.email_verified_at IS NOT NULL AS email_verified,
                d.name AS district, ap.approval_status, ap.review_note, ap.is_verified, ap.is_featured, ap.created_at
         ${from} ORDER BY ap.created_at ASC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
        [...vals, q.limit, offsetOf(q)]),
      this.pool.query(`SELECT count(*)::int AS n ${from}`, vals),
    ]);
    return pageOf(items.rows, total.rows[0].n, q);
  }

  async get(id: string) {
    const { rows } = await this.pool.query(
      `SELECT ap.*, u.email, u.status AS account_status, u.email_verified_at, d.name AS district,
              COALESCE((SELECT json_agg(g.name ORDER BY g.name) FROM artist_genres ag JOIN genres g ON g.id = ag.genre_id
                        WHERE ag.artist_id = ap.id), '[]'::json) AS genres
       FROM artist_profiles ap JOIN users u ON u.id = ap.user_id JOIN districts d ON d.id = ap.district_id
       WHERE ap.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Artist not found.');
    return rows[0];
  }

  approve(id: string, actorId: string, ip?: string) { return this.transition('approve', id, actorId, undefined, ip); }
  reject(id: string, actorId: string, reason: string, ip?: string) { return this.transition('reject', id, actorId, reason, ip); }
  suspend(id: string, actorId: string, reason: string, ip?: string) { return this.transition('suspend', id, actorId, reason, ip); }
  reinstate(id: string, actorId: string, ip?: string) { return this.transition('reinstate', id, actorId, undefined, ip); }

  /** Toggle "featured" / "verified" badges on approved artists. */
  async setFlags(id: string, actorId: string, dto: ArtistFlagsDto, ip?: string) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (dto.isFeatured !== undefined) { add('is_featured', dto.isFeatured); if (!dto.isFeatured) add('featured_until', null); }
    if (dto.featuredUntil !== undefined && dto.isFeatured !== false) add('featured_until', dto.featuredUntil);
    if (dto.isVerified !== undefined) add('is_verified', dto.isVerified);
    if (!sets.length) return this.get(id);
    vals.push(id);
    const { rows } = await this.pool.query(
      `UPDATE artist_profiles SET ${sets.join(', ')} WHERE id = $${vals.length} AND approval_status = 'active' RETURNING id`, vals);
    if (!rows[0]) throw new ConflictException('Only approved artists can be featured or verified.');
    await this.audit.record(actorId, 'artist.flags_changed', 'artist_profile', id, { ...dto }, ip);
    await this.cache.invalidate();
    return this.get(id);
  }

  // ---------- internals ----------
  private async transition(kind: keyof typeof TRANSITIONS, id: string, actorId: string, reason: string | undefined, ip?: string) {
    const t = TRANSITIONS[kind];
    const result = await withTx(this.pool, async (db) => {
      const { rows } = await db.query(
        `UPDATE artist_profiles
         SET approval_status = $1::account_status, reviewed_by = $2, reviewed_at = now(), review_note = $3,
             is_featured = CASE WHEN $1::account_status = 'active' THEN is_featured ELSE false END
         WHERE id = $4 AND approval_status = ANY($5::account_status[])
         RETURNING user_id, stage_name`,
        [t.to, actorId, reason ?? null, id, t.from]);
      if (!rows[0]) {
        const exists = await db.query('SELECT approval_status FROM artist_profiles WHERE id = $1', [id]);
        if (!exists.rowCount) throw new NotFoundException('Artist not found.');
        throw new ConflictException(`Cannot ${kind} an artist whose status is "${exists.rows[0].approval_status}".`);
      }
      const { user_id: userId, stage_name: stageName } = rows[0];
      if (t.userStatus) await db.query('UPDATE users SET status = $1 WHERE id = $2', [t.userStatus, userId]);
      if (t.revokeSessions) await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
      await this.notifications.create(db, userId, t.action, t.title, t.body(reason), { reason: reason ?? null });
      const u = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
      return { userId, stageName, email: u.rows[0].email as string };
    });
    await this.audit.record(actorId, t.action, 'artist_profile', id, { reason: reason ?? null, stageName: result.stageName }, ip);
    await this.mail.send(result.email, t.title, t.body(reason));
    return { id, status: t.to };
  }
}

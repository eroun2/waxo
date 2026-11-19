import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { withTx } from '../common/db';
import { offsetOf, pageOf } from '../common/pagination.dto';
import { ReportListQuery } from './dto';

@Injectable()
export class AdminReportsService {
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    private audit: AuditService,
    private notifications: NotificationsService,
    private mail: MailService,
  ) {}

  private page(table: 'music_reports' | 'copyright_reports', q: ReportListQuery, select: string, joins: string) {
    const vals: unknown[] = [];
    let where = 'TRUE';
    if (q.status !== 'all') { vals.push(q.status); where = `r.status = $1::report_status`; }
    const order = q.status === 'open' || q.status === 'investigating' ? 'ASC' : 'DESC';
    const from = `FROM ${table} r ${joins} WHERE ${where}`;
    return Promise.all([
      this.pool.query(`SELECT ${select} ${from} ORDER BY r.created_at ${order} LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`, [...vals, q.limit, offsetOf(q)]),
      this.pool.query(`SELECT count(*)::int AS n ${from}`, vals),
    ]).then(([items, total]) => pageOf(items.rows, total.rows[0].n, q));
  }

  // ---------- reported content ----------
  listMusic(q: ReportListQuery) {
    return this.page('music_reports', q,
      `r.id, r.reason, r.details, r.status, r.created_at, r.resolved_at, s.id AS song_id, s.title, s.status AS song_status, ap.stage_name AS artist_name, u.email AS reporter_email`,
      `JOIN songs s ON s.id = r.song_id JOIN artist_profiles ap ON ap.id = s.artist_id LEFT JOIN users u ON u.id = r.reporter_id`);
  }

  private async closeMusic(id: string, actor: string, status: 'resolved' | 'dismissed', note: string | undefined, removeSong: boolean, ip?: string) {
    await withTx(this.pool, async (db) => {
      const { rows } = await db.query(
        `UPDATE music_reports SET status = $2::report_status, handled_by = $3, resolved_at = now()
         WHERE id = $1 AND status IN ('open','investigating') RETURNING song_id`, [id, status, actor]);
      if (!rows[0]) {
        const cur = await db.query('SELECT status FROM music_reports WHERE id = $1', [id]);
        if (!cur.rowCount) throw new NotFoundException('Report not found.');
        throw new ConflictException(`This report is already ${cur.rows[0].status}.`);
      }
      if (removeSong) await this.removeSong(db, rows[0].song_id, `Removed after a content report.${note ? ` ${note}` : ''}`);
    });
    await this.audit.record(actor, removeSong ? 'report.music_song_removed' : `report.music_${status}`, 'music_report', id, { note: note ?? null }, ip);
    return { id, status };
  }
  resolveMusic(id: string, actor: string, note?: string, ip?: string) { return this.closeMusic(id, actor, 'resolved', note, false, ip); }
  dismissMusic(id: string, actor: string, note?: string, ip?: string) { return this.closeMusic(id, actor, 'dismissed', note, false, ip); }
  removeSongForReport(id: string, actor: string, note?: string, ip?: string) { return this.closeMusic(id, actor, 'resolved', note, true, ip); }

  // ---------- copyright complaints ----------
  listCopyright(q: ReportListQuery) {
    return this.page('copyright_reports', q,
      `r.id, r.status, r.reporter_name, r.reporter_email, r.created_at, r.resolved_at, s.id AS song_id, s.title, s.status AS song_status, ap.stage_name AS artist_name`,
      `JOIN songs s ON s.id = r.song_id JOIN artist_profiles ap ON ap.id = s.artist_id`);
  }

  async getCopyright(id: string) {
    const { rows } = await this.pool.query(
      `SELECT r.id, r.status, r.reporter_name, r.reporter_email, r.claim_details, r.evidence_urls, r.resolution_note, r.created_at, r.resolved_at,
              s.id AS song_id, s.title, s.status AS song_status, s.ownership_confirmed_at, s.created_at AS uploaded_at,
              ap.id AS artist_id, ap.stage_name AS artist_name, u.email AS artist_email, h.email AS handled_by_email,
              (SELECT count(*)::int FROM copyright_reports x WHERE x.song_id = s.id) AS reports_on_song
       FROM copyright_reports r JOIN songs s ON s.id = r.song_id JOIN artist_profiles ap ON ap.id = s.artist_id JOIN users u ON u.id = ap.user_id
       LEFT JOIN users h ON h.id = r.handled_by WHERE r.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Complaint not found.');
    return rows[0];
  }

  async investigate(id: string, actor: string, ip?: string) {
    const { rows } = await this.pool.query(
      `UPDATE copyright_reports SET status = 'investigating', handled_by = $2 WHERE id = $1 AND status = 'open' RETURNING id`, [id, actor]);
    if (!rows[0]) throw new ConflictException('Only open complaints can be moved to investigation.');
    await this.audit.record(actor, 'copyright.investigating', 'copyright_report', id, {}, ip);
    return { id, status: 'investigating' };
  }

  /** Upheld: the song is taken down, the artist is told why, the complainant gets the outcome. */
  uphold(id: string, actor: string, note: string, ip?: string) { return this.closeCopyright(id, actor, 'resolved', note, ip); }
  /** Dismissed: the complaint is rejected and the song stays up. */
  dismissCopyright(id: string, actor: string, note: string, ip?: string) { return this.closeCopyright(id, actor, 'dismissed', note, ip); }

  private async closeCopyright(id: string, actor: string, status: 'resolved' | 'dismissed', note: string, ip?: string) {
    const upheld = status === 'resolved';
    const info = await withTx(this.pool, async (db) => {
      const { rows } = await db.query(
        `UPDATE copyright_reports SET status = $2::report_status, resolution_note = $3, handled_by = $4, resolved_at = now()
         WHERE id = $1 AND status IN ('open','investigating') RETURNING song_id, reporter_email, reporter_name`, [id, status, note, actor]);
      if (!rows[0]) {
        const cur = await db.query('SELECT status FROM copyright_reports WHERE id = $1', [id]);
        if (!cur.rowCount) throw new NotFoundException('Complaint not found.');
        throw new ConflictException(`This complaint is already ${cur.rows[0].status}.`);
      }
      if (upheld) await this.removeSong(db, rows[0].song_id, `Removed after a copyright complaint. ${note}`);
      const song = await db.query('SELECT title FROM songs WHERE id = $1', [rows[0].song_id]);
      return { email: rows[0].reporter_email as string, name: rows[0].reporter_name as string, title: song.rows[0].title as string };
    });
    await this.audit.record(actor, upheld ? 'copyright.upheld' : 'copyright.dismissed', 'copyright_report', id, { note }, ip);
    await this.mail.send(info.email, 'Update on your WaXo copyright complaint',
      `Hello ${info.name},\n\nYour complaint about "${info.title}" was reviewed. ${upheld ? 'We removed the song from WaXo.' : 'We did not find grounds to remove the song.'}\n\nNote from our team: ${note}`);
    return { id, status };
  }

  /** Takes a song down and tells its artist. Runs inside the caller's transaction. */
  private async removeSong(db: PoolClient, songId: string, reason: string) {
    const { rows } = await db.query(
      `UPDATE songs SET status = 'removed', is_featured = false, rejection_reason = $2 WHERE id = $1 AND status <> 'removed' RETURNING title, artist_id`, [songId, reason]);
    if (!rows[0]) return;
    const a = await db.query('SELECT ap.user_id, u.email FROM artist_profiles ap JOIN users u ON u.id = ap.user_id WHERE ap.id = $1', [rows[0].artist_id]);
    await this.notifications.create(db, a.rows[0].user_id, 'song.removed', `"${rows[0].title}" was removed`, reason, { songId });
    await this.mail.send(a.rows[0].email, `"${rows[0].title}" was removed`, reason);
  }
}

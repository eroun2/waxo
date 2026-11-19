import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../common/auth.types';
import { CopyrightReportDto, MusicReportDto } from './dto';

@Injectable()
export class ReportsService {
  constructor(@Inject(PG_POOL) private pool: Pool, private audit: AuditService, private notifications: NotificationsService) {}

  private async liveSong(id: string) {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.title, ap.stage_name FROM songs s JOIN artist_profiles ap ON ap.id = s.artist_id WHERE s.id = $1 AND s.status IN ('approved','scheduled')`, [id]);
    if (!rows[0]) throw new NotFoundException('Song not found.');
    return rows[0] as { id: string; title: string; stage_name: string };
  }

  async music(dto: MusicReportDto, user: AuthUser | undefined, ip?: string) {
    const song = await this.liveSong(dto.songId);
    const { rows } = await this.pool.query(
      'INSERT INTO music_reports(song_id, reporter_id, reason, details) VALUES ($1,$2,$3,$4) RETURNING id', [song.id, user?.id ?? null, dto.reason, dto.details?.trim() || null]);
    await this.audit.record(user?.id ?? null, 'report.music_submitted', 'music_report', rows[0].id, { songId: song.id, reason: dto.reason }, ip);
    await this.notifications.notifyStaff(this.pool, 'staff.music_report', 'Song reported', `"${song.title}" by ${song.stage_name}: ${dto.reason.replace(/_/g, ' ')}`, { reportId: rows[0].id }).catch(() => undefined);
    return { message: 'Thank you. Our team will review your report.' };
  }

  async copyright(dto: CopyrightReportDto, user: AuthUser | undefined, ip?: string) {
    const song = await this.liveSong(dto.songId);
    const { rows } = await this.pool.query(
      `INSERT INTO copyright_reports(song_id, reporter_name, reporter_email, reporter_user_id, claim_details, evidence_urls)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [song.id, dto.reporterName.trim(), dto.reporterEmail.trim(), user?.id ?? null, dto.claimDetails.trim(), dto.evidenceUrls ?? []]);
    await this.audit.record(user?.id ?? null, 'report.copyright_submitted', 'copyright_report', rows[0].id, { songId: song.id }, ip);
    await this.notifications.notifyStaff(this.pool, 'staff.copyright_report', 'Copyright complaint received', `"${song.title}" by ${song.stage_name}`, { reportId: rows[0].id }).catch(() => undefined);
    return { message: 'Your complaint was received. We will investigate and contact you by email.', reference: rows[0].id };
  }
}

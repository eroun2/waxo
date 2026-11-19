import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { withTx } from '../common/db';
import { likeEscape, offsetOf, pageOf } from '../common/pagination.dto';
import { AuditQuery, CreateAdminDto, UserListQuery } from './dto';

@Injectable()
export class AdminUsersService {
  constructor(@Inject(PG_POOL) private pool: Pool, private audit: AuditService, private mail: MailService) {}

  // ---------- listeners ----------
  async listListeners(q: UserListQuery) {
    const vals: unknown[] = [];
    const where = [`u.role = 'listener'`];
    if (q.status) { vals.push(q.status); where.push(`u.status = $${vals.length}::account_status`); }
    if (q.q) { vals.push(`%${likeEscape(q.q.trim())}%`); where.push(`(u.email ILIKE $${vals.length} OR lp.display_name ILIKE $${vals.length})`); }
    const from = `FROM users u LEFT JOIN listener_profiles lp ON lp.user_id = u.id LEFT JOIN districts d ON d.id = lp.district_id WHERE ${where.join(' AND ')}`;
    const [items, total] = await Promise.all([
      this.pool.query(
        `SELECT u.id, u.email, u.status, u.email_verified_at IS NOT NULL AS email_verified, u.created_at, u.last_login_at, lp.display_name, d.name AS district
         ${from} ORDER BY u.created_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`, [...vals, q.limit, offsetOf(q)]),
      this.pool.query(`SELECT count(*)::int AS n ${from}`, vals),
    ]);
    return pageOf(items.rows, total.rows[0].n, q);
  }

  async setListenerStatus(id: string, actor: string, suspend: boolean, reason: string | undefined, ip?: string) {
    const email = await withTx(this.pool, async (db) => {
      const { rows } = await db.query(
        `UPDATE users SET status = $2::account_status WHERE id = $1 AND role = 'listener' AND status = $3::account_status RETURNING email`,
        [id, suspend ? 'suspended' : 'active', suspend ? 'active' : 'suspended']);
      if (!rows[0]) {
        const cur = await db.query(`SELECT status FROM users WHERE id = $1 AND role = 'listener'`, [id]);
        if (!cur.rowCount) throw new NotFoundException('Listener not found.');
        throw new ConflictException(`This listener is already ${cur.rows[0].status}.`);
      }
      if (suspend) await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
      return rows[0].email as string;
    });
    await this.audit.record(actor, suspend ? 'listener.suspended' : 'listener.reinstated', 'user', id, { reason: reason ?? null }, ip);
    await this.mail.send(email, suspend ? 'Your WaXo account has been suspended' : 'Your WaXo account has been reinstated',
      suspend ? `Your account was suspended.${reason ? ` Reason: ${reason}` : ''}` : 'Your account is active again.');
    return { id, status: suspend ? 'suspended' : 'active' };
  }

  // ---------- staff accounts ----------
  roles() { return this.pool.query('SELECT id, name, permissions FROM admin_roles ORDER BY id').then((r) => r.rows); }

  async listStaff() {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.email, u.role, u.status, u.created_at, u.last_login_at, ar.name AS admin_role
       FROM users u LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id WHERE u.role IN ('admin','moderator') ORDER BY u.created_at`);
    return rows;
  }

  async createStaff(dto: CreateAdminDto, actor: string, ip?: string) {
    const role = await this.pool.query('SELECT id, name FROM admin_roles WHERE id = $1', [dto.roleId]);
    if (!role.rows[0]) throw new NotFoundException('That role does not exist.');
    const hash = await bcrypt.hash(dto.password, 12);
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO users(email, password_hash, role, admin_role_id, email_verified_at) VALUES ($1,$2,$3,$4, now()) RETURNING id`,
        [dto.email.toLowerCase(), hash, role.rows[0].name === 'moderator' ? 'moderator' : 'admin', role.rows[0].id]);
      await this.audit.record(actor, 'staff.created', 'user', rows[0].id, { email: dto.email, role: role.rows[0].name }, ip);
      return { id: rows[0].id, email: dto.email, role: role.rows[0].name };
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('An account with this email already exists.');
      throw e;
    }
  }

  async setStaffStatus(id: string, actor: string, suspend: boolean, ip?: string) {
    if (id === actor) throw new ForbiddenException('You cannot change your own account status.');
    await withTx(this.pool, async (db) => {
      const t = await db.query(`SELECT role, status FROM users WHERE id = $1 AND role IN ('admin','moderator') FOR UPDATE`, [id]);
      if (!t.rows[0]) throw new NotFoundException('Staff account not found.');
      if (suspend && t.rows[0].role === 'admin') {
        const others = await db.query(`SELECT 1 FROM users WHERE role = 'admin' AND status = 'active' AND id <> $1 LIMIT 1`, [id]);
        if (!others.rowCount) throw new ConflictException('At least one active administrator must remain.');
      }
      await db.query('UPDATE users SET status = $2::account_status WHERE id = $1', [id, suspend ? 'suspended' : 'active']);
      if (suspend) await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
    });
    await this.audit.record(actor, suspend ? 'staff.suspended' : 'staff.reinstated', 'user', id, {}, ip);
    return { id, status: suspend ? 'suspended' : 'active' };
  }

  // ---------- audit log ----------
  async auditLog(q: AuditQuery) {
    const vals: unknown[] = [];
    const where: string[] = ['TRUE'];
    if (q.action) { vals.push(`%${likeEscape(q.action.trim())}%`); where.push(`a.action ILIKE $${vals.length}`); }
    if (q.entityType) { vals.push(q.entityType); where.push(`a.entity_type = $${vals.length}`); }
    const from = `FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id WHERE ${where.join(' AND ')}`;
    const [items, total] = await Promise.all([
      this.pool.query(
        `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, host(a.ip) AS ip, a.created_at, u.email AS actor_email
         ${from} ORDER BY a.id DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`, [...vals, q.limit, offsetOf(q)]),
      this.pool.query(`SELECT count(*)::int AS n ${from}`, vals),
    ]);
    return pageOf(items.rows, total.rows[0].n, q);
  }
}

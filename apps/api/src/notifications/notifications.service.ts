import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { Db } from '../common/db';
import { PageQuery, offsetOf, pageOf } from '../common/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  /** Pass a transaction client to make the notification part of the caller's transaction. */
  async create(db: Db, userId: string, type: string, title: string, body?: string, data: object = {}) {
    await db.query('INSERT INTO notifications(user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)',
      [userId, type, title, body ?? null, data]);
  }

  /** Notify every active admin and moderator (new artist, new song, new report...). */
  async notifyStaff(db: Db, type: string, title: string, body?: string, data: object = {}) {
    await db.query(
      `INSERT INTO notifications(user_id, type, title, body, data)
       SELECT id, $1, $2, $3, $4 FROM users WHERE role IN ('admin','moderator') AND status = 'active'`, [type, title, body ?? null, data]);
  }

  async list(userId: string, q: PageQuery) {
    const [items, count] = await Promise.all([
      this.pool.query(
        'SELECT id, type, title, body, data, read_at, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, q.limit, offsetOf(q)]),
      this.pool.query('SELECT count(*)::int AS total, count(*) FILTER (WHERE read_at IS NULL)::int AS unread FROM notifications WHERE user_id=$1', [userId]),
    ]);
    return { ...pageOf(items.rows, count.rows[0].total, q), unread: count.rows[0].unread };
  }

  async markRead(userId: string, id: string) {
    await this.pool.query('UPDATE notifications SET read_at = now() WHERE id=$1 AND user_id=$2 AND read_at IS NULL', [id, userId]);
  }

  async markAllRead(userId: string) {
    await this.pool.query('UPDATE notifications SET read_at = now() WHERE user_id=$1 AND read_at IS NULL', [userId]);
  }
}

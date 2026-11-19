import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { randomBytes, randomUUID } from 'crypto';
import { PG_POOL } from '../database/database.module';
import { withTx } from '../common/db';
import { hashIp } from '../common/ip';
import { AuthUser } from '../common/auth.types';

const num = (k: string, d: number) => Number(process.env[k] ?? d);

/**
 * Stream counting. The client only ever *reports* listening; the server decides what counts:
 *  - a play is opened server-side (POST /plays) and gets an unguessable token,
 *  - heartbeats can never claim more seconds than real elapsed time or the song length,
 *  - a stream is counted once, only after the minimum listening time,
 *  - and basic abuse rules apply (replay cooldown, per-IP hourly cap, artists' own plays ignored).
 * Rejections are silent so the rules can't be probed.
 */
@Injectable()
export class PlaysService {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async start(songId: string, sessionId: string | undefined, user: AuthUser | undefined, ip?: string) {
    const ipHash = hashIp(ip);
    const { rows } = await this.pool.query(
      `SELECT s.id, s.duration_seconds FROM songs s
       JOIN artist_profiles ap ON ap.id = s.artist_id JOIN users u ON u.id = ap.user_id
       WHERE s.id = $1 AND s.status = 'approved' AND s.process_status = 'ready' AND ap.approval_status = 'active' AND u.status = 'active'`, [songId]);
    const song = rows[0];
    if (!song) throw new NotFoundException('Song not found.');

    const started = await this.pool.query(`SELECT count(*)::int AS n FROM streams WHERE ip_hash = $1 AND created_at > now() - interval '1 hour'`, [ipHash]);
    if (started.rows[0].n >= num('STREAM_MAX_STARTS_PER_IP_HOUR', 300)) throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);

    const token = randomBytes(24).toString('base64url');
    let districtId: number | null = null;
    if (user) {
      const d = await this.pool.query('SELECT district_id FROM listener_profiles WHERE user_id = $1', [user.id]);
      districtId = d.rows[0]?.district_id ?? null;
    }
    await withTx(this.pool, async (db) => {
      await db.query(
        `INSERT INTO streams(song_id, user_id, session_id, ip_hash, seconds_listened, district_id, counted, play_token)
         VALUES ($1,$2,$3,$4,0,$5,false,$6)`, [songId, user?.id ?? null, sessionId ?? randomUUID(), ipHash, districtId, token]);
      if (user) {
        await db.query(
          `INSERT INTO recently_played(user_id, song_id) VALUES ($1,$2)
           ON CONFLICT (user_id, song_id) DO UPDATE SET played_at = now()`, [user.id, songId]);
      }
    });
    return { playToken: token, minSeconds: this.minSeconds(song.duration_seconds) };
  }

  async heartbeat(token: string, claimedSeconds: number) {
    if (!/^[\w-]{20,64}$/.test(token)) throw new NotFoundException();
    return withTx(this.pool, async (db) => {
      // Row lock: concurrent heartbeats are serialised, so a play can never be counted twice.
      const { rows } = await db.query(
        `SELECT st.id, st.song_id, st.user_id, st.ip_hash, st.seconds_listened, st.counted,
                EXTRACT(EPOCH FROM (now() - st.created_at)) AS elapsed, s.duration_seconds, ap.user_id AS owner_id
         FROM streams st JOIN songs s ON s.id = st.song_id JOIN artist_profiles ap ON ap.id = s.artist_id
         WHERE st.play_token = $1 FOR UPDATE OF st`, [token]);
      const st = rows[0];
      if (!st) throw new NotFoundException();

      const duration = st.duration_seconds ?? 0;
      const ceiling = Math.min(Math.floor(Number(st.elapsed)) + 2, duration > 0 ? duration + 2 : Infinity);
      const listened = Math.max(st.seconds_listened, Math.min(claimedSeconds, ceiling));
      let counted: boolean = st.counted;

      if (!counted && listened >= this.minSeconds(duration) && (await this.passesAbuseChecks(db, st))) {
        counted = true;
        await db.query('UPDATE songs SET stream_count = stream_count + 1 WHERE id = $1', [st.song_id]);
      }
      await db.query('UPDATE streams SET seconds_listened = $2, counted = $3, last_heartbeat_at = now() WHERE id = $1', [st.id, listened, counted]);
      return { counted, listenedSeconds: listened };
    });
  }

  private minSeconds(duration: number | null) {
    const configured = num('STREAM_MIN_SECONDS', 30);
    return duration && duration > 0 ? Math.max(1, Math.min(configured, Math.floor(duration * 0.8))) : configured;
  }

  private async passesAbuseChecks(db: import('pg').PoolClient, st: any): Promise<boolean> {
    if (st.user_id && st.user_id === st.owner_id) return false; // artists don't stream themselves up the charts
    const cooldown = num('STREAM_REPLAY_COOLDOWN_SECONDS', 180);
    const replay = await db.query(
      `SELECT 1 FROM streams WHERE song_id = $1 AND counted AND id <> $2
         AND created_at > now() - ($3 || ' seconds')::interval
         AND (ip_hash = $4 OR ($5::uuid IS NOT NULL AND user_id = $5::uuid)) LIMIT 1`,
      [st.song_id, st.id, String(cooldown), st.ip_hash, st.user_id]);
    if (replay.rowCount) return false;
    const hourly = await db.query(`SELECT count(*)::int AS n FROM streams WHERE ip_hash = $1 AND counted AND created_at > now() - interval '1 hour'`, [st.ip_hash]);
    return hourly.rows[0].n < num('STREAM_MAX_PER_IP_HOUR', 60);
  }
}

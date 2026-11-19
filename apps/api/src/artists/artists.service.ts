import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { withTx } from '../common/db';
import { cleanSocials } from '../common/social';
import { likeEscape, offsetOf, pageOf } from '../common/pagination.dto';
import { ArtistListQuery, UpdateArtistDto } from './dto';

const GENRES_AGG = `COALESCE((SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'slug', g.slug) ORDER BY g.name)
                               FROM artist_genres ag JOIN genres g ON g.id = ag.genre_id WHERE ag.artist_id = ap.id), '[]'::json)`;

@Injectable()
export class ArtistsService {
  constructor(@Inject(PG_POOL) private pool: Pool, private audit: AuditService, private storage: StorageService) {}

  /** The artist's own, private view (includes real name and phone). */
  async getOwn(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT ap.id, ap.stage_name, ap.slug, ap.real_name, ap.phone, ap.district_id, d.name AS district, ap.town, ap.bio,
              ap.social_links, ap.avatar_key, ap.cover_key, ap.is_verified, ap.approval_status, ap.review_note,
              ${GENRES_AGG} AS genres
       FROM artist_profiles ap JOIN districts d ON d.id = ap.district_id WHERE ap.user_id = $1`, [userId]);
    if (!rows[0]) throw new NotFoundException('Artist profile not found.');
    return { ...rows[0], avatarUrl: this.storage.publicUrl(rows[0].avatar_key), coverUrl: this.storage.publicUrl(rows[0].cover_key) };
  }

  async updateOwn(userId: string, dto: UpdateArtistDto) {
    const cur = await this.pool.query('SELECT id, approval_status FROM artist_profiles WHERE user_id = $1', [userId]);
    const profile = cur.rows[0];
    if (!profile) throw new NotFoundException('Artist profile not found.');
    if (profile.approval_status === 'suspended') throw new ForbiddenException('Your profile is suspended.');
    if (dto.stageName && profile.approval_status === 'active') {
      throw new ForbiddenException('Your stage name cannot be changed after approval. Contact support.');
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (dto.stageName !== undefined) add('stage_name', dto.stageName.trim());
    if (dto.phone !== undefined) add('phone', dto.phone.trim());
    if (dto.districtId !== undefined) add('district_id', dto.districtId);
    if (dto.town !== undefined) add('town', dto.town.trim() || null);
    if (dto.bio !== undefined) add('bio', dto.bio.trim() || null);
    if (dto.socialLinks !== undefined) add('social_links', cleanSocials(dto.socialLinks));

    try {
      await withTx(this.pool, async (db) => {
        if (sets.length) {
          vals.push(profile.id);
          await db.query(`UPDATE artist_profiles SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
        }
        if (dto.genreIds) {
          await db.query('DELETE FROM artist_genres WHERE artist_id = $1', [profile.id]);
          for (const gid of new Set(dto.genreIds)) {
            await db.query('INSERT INTO artist_genres(artist_id, genre_id) VALUES ($1,$2)', [profile.id, gid]);
          }
        }
      });
    } catch (e: any) {
      if (e.code === '23503') throw new BadRequestException('Selected district or genre does not exist.');
      throw e;
    }
    return this.getOwn(userId);
  }

  /** A rejected artist fixes their profile, then asks for another review. */
  async resubmit(userId: string) {
    const { rows } = await this.pool.query(
      `UPDATE artist_profiles SET approval_status = 'pending', review_note = NULL
       WHERE user_id = $1 AND approval_status = 'rejected' RETURNING id`, [userId]);
    if (!rows[0]) throw new ConflictException('Only rejected profiles can be resubmitted.');
    await this.audit.record(userId, 'artist.resubmitted', 'artist_profile', rows[0].id);
    return { message: 'Profile resubmitted for review.' };
  }

  // ---------- public ----------
  async list(q: ArtistListQuery) {
    const where = [`ap.approval_status = 'active'`, `u.status = 'active'`];
    const vals: unknown[] = [];
    if (q.q) { vals.push(`%${likeEscape(q.q.trim())}%`); where.push(`ap.stage_name ILIKE $${vals.length}`); }
    if (q.district) { vals.push(q.district); where.push(`d.slug = $${vals.length}`); }
    if (q.genre) {
      vals.push(q.genre);
      where.push(`EXISTS (SELECT 1 FROM artist_genres ag JOIN genres g ON g.id = ag.genre_id WHERE ag.artist_id = ap.id AND g.slug = $${vals.length})`);
    }
    const from = `FROM artist_profiles ap JOIN users u ON u.id = ap.user_id JOIN districts d ON d.id = ap.district_id WHERE ${where.join(' AND ')}`;
    const [items, total] = await Promise.all([
      this.pool.query(
        `SELECT ap.id, ap.stage_name, ap.slug, d.name AS district, d.slug AS district_slug, ap.avatar_key,
                ap.is_verified, ap.is_featured,
                (SELECT count(*)::int FROM followers f WHERE f.artist_id = ap.id) AS follower_count
         ${from} ORDER BY ap.is_featured DESC, ap.stage_name LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
        [...vals, q.limit, offsetOf(q)]),
      this.pool.query(`SELECT count(*)::int AS n ${from}`, vals),
    ]);
    return pageOf(items.rows, total.rows[0].n, q);
  }

  /** Public profile: never exposes real name, phone or email. */
  async getPublic(slug: string) {
    const { rows } = await this.pool.query(
      `SELECT ap.id, ap.stage_name, ap.slug, d.name AS district, d.slug AS district_slug, ap.town, ap.bio,
              ap.social_links, ap.avatar_key, ap.cover_key, ap.is_verified, ap.is_featured,
              (SELECT count(*)::int FROM followers f WHERE f.artist_id = ap.id) AS follower_count,
              ${GENRES_AGG} AS genres
       FROM artist_profiles ap JOIN users u ON u.id = ap.user_id JOIN districts d ON d.id = ap.district_id
       WHERE ap.slug = $1 AND ap.approval_status = 'active' AND u.status = 'active'`, [slug]);
    if (!rows[0]) throw new NotFoundException('Artist not found.');
    const { avatar_key, cover_key, ...r } = rows[0];
    return { ...r, avatarUrl: this.storage.publicUrl(avatar_key), coverUrl: this.storage.publicUrl(cover_key) };
  }
}

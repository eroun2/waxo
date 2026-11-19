import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { CacheService } from '../cache/cache.module';
import { DistrictDto, GenreDto, UpdateDistrictDto, UpdateGenreDto } from './dto';

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

@Injectable()
export class AdminReferenceService {
  constructor(@Inject(PG_POOL) private pool: Pool, private audit: AuditService, private cache: CacheService) {}

  // ---------- districts ----------
  async districts() {
    const { rows } = await this.pool.query(
      `SELECT d.id, d.name, d.slug, d.region, d.country_code, d.is_active,
              (SELECT count(*)::int FROM artist_profiles ap WHERE ap.district_id = d.id) AS artists,
              (SELECT count(*)::int FROM songs s WHERE s.district_id = d.id AND s.status = 'approved') AS songs
       FROM districts d ORDER BY d.country_code, d.region NULLS LAST, d.name`);
    return rows;
  }

  async createDistrict(dto: DistrictDto, actor: string, ip?: string) {
    const country = dto.countryCode ?? 'UG';
    try {
      const { rows } = await this.pool.query(
        'INSERT INTO districts(name, slug, region, country_code) VALUES ($1,$2,$3,$4) RETURNING id', [dto.name.trim(), slugify(dto.name), dto.region.trim(), country]);
      await this.audit.record(actor, 'district.created', 'district', String(rows[0].id), { name: dto.name }, ip);
      await this.cache.invalidate();
      return { id: rows[0].id };
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('A district with this name already exists.');
      throw e;
    }
  }

  async updateDistrict(id: number, dto: UpdateDistrictDto, actor: string, ip?: string) {
    const sets: string[] = []; const vals: unknown[] = [];
    const add = (c: string, v: unknown) => { vals.push(v); sets.push(`${c} = $${vals.length}`); };
    if (dto.name !== undefined) add('name', dto.name.trim());
    if (dto.region !== undefined) add('region', dto.region.trim());
    if (dto.isActive !== undefined) add('is_active', dto.isActive);
    if (!sets.length) return { id };
    vals.push(id);
    try {
      const { rowCount } = await this.pool.query(`UPDATE districts SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
      if (!rowCount) throw new NotFoundException('District not found.');
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('A district with this name already exists.');
      throw e;
    }
    await this.audit.record(actor, 'district.updated', 'district', String(id), { ...dto }, ip);
    await this.cache.invalidate();
    return { id };
  }

  // ---------- genres ----------
  async genres() {
    const { rows } = await this.pool.query(
      `SELECT g.id, g.name, g.slug, g.is_active, (SELECT count(*)::int FROM songs s WHERE s.genre_id = g.id AND s.status = 'approved') AS songs FROM genres g ORDER BY g.name`);
    return rows;
  }

  async createGenre(dto: GenreDto, actor: string, ip?: string) {
    try {
      const { rows } = await this.pool.query('INSERT INTO genres(name, slug) VALUES ($1,$2) RETURNING id', [dto.name.trim(), slugify(dto.name)]);
      await this.audit.record(actor, 'genre.created', 'genre', String(rows[0].id), { name: dto.name }, ip);
      await this.cache.invalidate();
      return { id: rows[0].id };
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('A genre with this name already exists.');
      throw e;
    }
  }

  async updateGenre(id: number, dto: UpdateGenreDto, actor: string, ip?: string) {
    const sets: string[] = []; const vals: unknown[] = [];
    const add = (c: string, v: unknown) => { vals.push(v); sets.push(`${c} = $${vals.length}`); };
    if (dto.name !== undefined) add('name', dto.name.trim());
    if (dto.isActive !== undefined) add('is_active', dto.isActive);
    if (!sets.length) return { id };
    vals.push(id);
    try {
      const { rowCount } = await this.pool.query(`UPDATE genres SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
      if (!rowCount) throw new NotFoundException('Genre not found.');
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('A genre with this name already exists.');
      throw e;
    }
    await this.audit.record(actor, 'genre.updated', 'genre', String(id), { ...dto }, ip);
    await this.cache.invalidate();
    return { id };
  }
}

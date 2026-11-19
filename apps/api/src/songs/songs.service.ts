import {
  BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { Queue } from 'bullmq';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomBytes, randomUUID } from 'crypto';
import { stat, unlink } from 'fs/promises';
import { PG_POOL } from '../database/database.module';
import { AUDIO_QUEUE } from '../queue/queue.module';
import { StorageService } from '../storage/storage.service';
import { FfmpegService } from '../media/ffmpeg.service';
import { ScanService } from '../media/scan.service';
import { readHead, sniffAudio, sniffImage } from '../media/sniff';
import { AuditService } from '../audit/audit.service';
import { Db, withTx } from '../common/db';
import { hashIp } from '../common/ip';
import { offsetOf, pageOf } from '../common/pagination.dto';
import { AuthUser } from '../common/auth.types';
import { CreateSongDto, MySongsQuery, UpdateSongDto } from './dto';

type UploadFiles = { audio?: Express.Multer.File[]; artwork?: Express.Multer.File[] };
const MAX_ARTWORK_BYTES = 5 * 1024 * 1024;
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'song';
const safeName = (s: string) => s.replace(/[^\w .()&-]/g, '').trim().slice(0, 120) || 'song';

@Injectable()
export class SongsService {
  private log = new Logger('Songs');
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    @Inject(AUDIO_QUEUE) private queue: Queue,
    private storage: StorageService,
    private ffmpeg: FfmpegService,
    private scan: ScanService,
    private audit: AuditService,
  ) {}

  // ---------- upload ----------
  async create(artistId: string, userId: string, rawBody: unknown, files: UploadFiles, ip?: string) {
    const audio = files.audio?.[0];
    const art = files.artwork?.[0];
    const tmp = [audio?.path, art?.path].filter(Boolean) as string[];
    const uploaded: { bucket: string; key: string }[] = [];
    let committed = false;
    try {
      if (!audio) throw new BadRequestException('An audio file is required.');
      const dto = await this.parse(rawBody);

      const kind = sniffAudio(await readHead(audio.path));
      if (!kind) throw new UnsupportedMediaTypeException('Unsupported audio format. Use MP3, WAV, FLAC, OGG, M4A or AAC.');
      if (art) {
        if (!sniffImage(await readHead(art.path))) throw new UnsupportedMediaTypeException('Artwork must be a JPG, PNG or WebP image.');
        if ((await stat(art.path)).size > MAX_ARTWORK_BYTES) throw new BadRequestException('Artwork must be 5 MB or smaller.');
      }
      await this.scan.assertClean(audio.path);
      if (art) await this.scan.assertClean(art.path);
      const info = await this.ffmpeg.probe(audio.path);

      const defaults = await this.pool.query('SELECT district_id FROM artist_profiles WHERE id = $1', [artistId]);
      const districtId = dto.districtId ?? defaults.rows[0].district_id;
      await this.assertRefs(dto, districtId, artistId);

      const songId = randomUUID();
      const masterKey = `masters/${artistId}/${songId}/original.${kind.ext}`;
      await this.storage.putFile(this.storage.privateBucket, masterKey, audio.path, kind.mime);
      uploaded.push({ bucket: this.storage.privateBucket, key: masterKey });

      let artworkKey: string | null = null;
      if (art) {
        const out = `${art.path}.jpg`;
        tmp.push(out);
        await this.ffmpeg.toArtwork(art.path, out);
        artworkKey = `artwork/${songId}.jpg`;
        await this.storage.putFile(this.storage.publicBucket, artworkKey, out, 'image/jpeg');
        uploaded.push({ bucket: this.storage.publicBucket, key: artworkKey });
      }

      const releaseAt = dto.releaseAt && dto.releaseAt.getTime() > Date.now() ? dto.releaseAt : null;
      await withTx(this.pool, async (db) => {
        await db.query(
          `INSERT INTO songs(id, artist_id, title, slug, description, genre_id, district_id, artwork_key, master_key,
             duration_seconds, original_mime, file_size_bytes, status, process_status, downloads_enabled, release_at, ownership_confirmed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'processing','queued',$13,$14, now())`,
          [songId, artistId, dto.title.trim(), await this.uniqueSlug(db, artistId, dto.title), dto.description?.trim() || null,
           dto.genreId, districtId, artworkKey, masterKey, info.durationSeconds, kind.mime, audio.size, dto.downloadsEnabled ?? false, releaseAt]);
        for (const fid of new Set(dto.featuredArtistIds ?? [])) {
          await db.query('INSERT INTO song_artists(song_id, artist_id) VALUES ($1,$2)', [songId, fid]);
        }
      });
      committed = true;
      await this.enqueue(songId);
      await this.audit.record(userId, 'song.uploaded', 'song', songId, { title: dto.title }, ip);
      return { id: songId, status: 'processing', processStatus: 'queued', durationSeconds: info.durationSeconds };
    } catch (e) {
      if (!committed) await Promise.all(uploaded.map((u) => this.storage.delete(u.bucket, u.key)));
      throw e;
    } finally {
      await Promise.all(tmp.map((p) => unlink(p).catch(() => undefined)));
    }
  }

  async retryProcessing(artistId: string, id: string) {
    const { rows } = await this.pool.query(
      `UPDATE songs SET process_status = 'queued', status = 'processing'
       WHERE id = $1 AND artist_id = $2 AND process_status = 'failed' RETURNING id`, [id, artistId]);
    if (!rows[0]) throw new ConflictException('Only songs whose processing failed can be retried.');
    await this.enqueue(id);
    return { id, status: 'processing', processStatus: 'queued' };
  }

  // ---------- artist's own songs ----------
  async listMine(artistId: string, q: MySongsQuery) {
    const vals: unknown[] = [artistId];
    let where = `artist_id = $1 AND status <> 'removed'`;
    if (q.status) { vals.push(q.status); where += ` AND status = $2::song_status`; }
    const [items, total] = await Promise.all([
      this.pool.query(
        `SELECT id, title, slug, status, process_status, rejection_reason, artwork_key, duration_seconds, downloads_enabled,
                release_at, stream_count, download_count, like_count, created_at
         FROM songs WHERE ${where} ORDER BY created_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
        [...vals, q.limit, offsetOf(q)]),
      this.pool.query(`SELECT count(*)::int AS n FROM songs WHERE ${where}`, vals),
    ]);
    return pageOf(items.rows.map((r) => this.present(r)), total.rows[0].n, q);
  }

  async getMine(artistId: string, id: string) {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.title, s.slug, s.description, s.status, s.process_status, s.rejection_reason, s.artwork_key,
              s.duration_seconds, s.downloads_enabled, s.release_at, s.genre_id, s.district_id,
              s.stream_count, s.download_count, s.like_count, s.created_at
       FROM songs s WHERE s.id = $1 AND s.artist_id = $2 AND s.status <> 'removed'`, [id, artistId]);
    if (!rows[0]) throw new NotFoundException('Song not found.');
    return this.present(rows[0]);
  }

  async update(artistId: string, id: string, dto: UpdateSongDto) {
    const cur = await this.pool.query(`SELECT status FROM songs WHERE id = $1 AND artist_id = $2 AND status <> 'removed'`, [id, artistId]);
    if (!cur.rows[0]) throw new NotFoundException('Song not found.');
    if (dto.releaseAt && cur.rows[0].status === 'approved') throw new ForbiddenException('This song is already released.');

    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (dto.title !== undefined) add('title', dto.title.trim());
    if (dto.description !== undefined) add('description', dto.description.trim() || null);
    if (dto.genreId !== undefined) add('genre_id', dto.genreId);
    if (dto.districtId !== undefined) add('district_id', dto.districtId);
    if (dto.downloadsEnabled !== undefined) add('downloads_enabled', dto.downloadsEnabled);
    if (dto.releaseAt !== undefined) add('release_at', dto.releaseAt.getTime() > Date.now() ? dto.releaseAt : null);
    if (sets.length) {
      vals.push(id, artistId);
      try {
        await this.pool.query(`UPDATE songs SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND artist_id = $${vals.length}`, vals);
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('Selected genre or district does not exist.');
        throw e;
      }
    }
    return this.getMine(artistId, id);
  }

  async remove(artistId: string, userId: string, id: string, ip?: string) {
    const { rows } = await this.pool.query(
      `UPDATE songs SET status = 'removed' WHERE id = $1 AND artist_id = $2 AND status <> 'removed' RETURNING id`, [id, artistId]);
    if (!rows[0]) throw new NotFoundException('Song not found.');
    await this.audit.record(userId, 'song.deleted_by_artist', 'song', id, {}, ip);
  }

  // ---------- public ----------
  async getPublic(id: string) {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.title, s.slug, s.description, s.artwork_key, s.duration_seconds, s.downloads_enabled, s.release_at,
              s.stream_count, s.download_count, s.like_count, g.name AS genre, d.name AS district,
              ap.id AS artist_id, ap.stage_name AS artist_name, ap.slug AS artist_slug, ap.is_verified AS artist_verified,
              COALESCE((SELECT json_agg(json_build_object('id', fa.id, 'stageName', fa.stage_name, 'slug', fa.slug))
                        FROM song_artists sa JOIN artist_profiles fa ON fa.id = sa.artist_id WHERE sa.song_id = s.id), '[]'::json) AS featured_artists
       FROM songs s
       JOIN artist_profiles ap ON ap.id = s.artist_id JOIN users u ON u.id = ap.user_id
       LEFT JOIN genres g ON g.id = s.genre_id LEFT JOIN districts d ON d.id = s.district_id
       WHERE s.id = $1 AND s.status = 'approved' AND ap.approval_status = 'active' AND u.status = 'active'`, [id]);
    if (!rows[0]) throw new NotFoundException('Song not found.');
    return this.present(rows[0]);
  }

  /** Short-lived signed URL for the stream rendition. Unreleased songs are only playable by their owner and moderators. */
  async streamUrl(id: string, user?: AuthUser) {
    const song = await this.playable(id, user);
    if (!song.stream_key || song.process_status !== 'ready') throw new ConflictException('This song is still being processed.');
    const ttl = Number(process.env.SIGNED_URL_TTL_SECONDS ?? 300);
    return { url: await this.storage.signedGetUrl(this.storage.privateBucket, song.stream_key, ttl, { contentType: 'audio/mp4' }), expiresIn: ttl };
  }

  /** Only when the artist enabled downloads. Legitimate downloads are counted once per listener per hour. */
  async downloadUrl(id: string, user: AuthUser | undefined, ip?: string) {
    const song = await this.playable(id, user, true);
    if (!song.downloads_enabled || !song.download_key) throw new ForbiddenException('The artist has not enabled downloads for this song.');
    const ipHash = hashIp(ip);
    const recent = await this.pool.query(
      `SELECT 1 FROM downloads WHERE song_id = $1 AND created_at > now() - interval '1 hour'
         AND (ip_hash = $2 OR ($3::uuid IS NOT NULL AND user_id = $3::uuid)) LIMIT 1`, [id, ipHash, user?.id ?? null]);
    if (!recent.rowCount) {
      await withTx(this.pool, async (db) => {
        await db.query('INSERT INTO downloads(song_id, user_id, ip_hash) VALUES ($1,$2,$3)', [id, user?.id ?? null, ipHash]);
        await db.query('UPDATE songs SET download_count = download_count + 1 WHERE id = $1', [id]);
      });
    }
    const filename = `${safeName(song.artist_name)} - ${safeName(song.title)}.mp3`;
    const ttl = Number(process.env.SIGNED_URL_TTL_SECONDS ?? 300);
    return { url: await this.storage.signedGetUrl(this.storage.privateBucket, song.download_key, ttl, { filename, contentType: 'audio/mpeg' }), expiresIn: ttl };
  }

  // ---------- helpers ----------
  private async playable(id: string, user?: AuthUser, publicOnly = false) {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.title, s.status, s.stream_key, s.download_key, s.process_status, s.downloads_enabled, s.artist_id,
              ap.user_id AS owner_user_id, ap.stage_name AS artist_name, ap.approval_status
       FROM songs s JOIN artist_profiles ap ON ap.id = s.artist_id WHERE s.id = $1`, [id]);
    const s = rows[0];
    if (!s || s.status === 'removed') throw new NotFoundException('Song not found.');
    const isPublic = s.status === 'approved' && s.approval_status === 'active';
    const isOwner = user?.id === s.owner_user_id;
    const isStaff = user?.role === 'admin' || user?.role === 'moderator';
    if (!(isPublic || (!publicOnly && (isOwner || isStaff)))) throw new NotFoundException('Song not found.');
    return s;
  }

  private present(r: any) {
    const { artwork_key, ...rest } = r;
    return { ...rest, artworkUrl: this.storage.publicUrl(artwork_key) };
  }

  private async enqueue(songId: string) {
    try {
      await this.queue.add('process', { songId }, { jobId: `${songId}-${Date.now()}` });
    } catch (e) {
      this.log.error(`Could not enqueue ${songId}: ${(e as Error).message}`);
      await this.pool.query(`UPDATE songs SET process_status = 'failed', status = 'draft' WHERE id = $1`, [songId]);
      throw new ConflictException('Upload received but processing could not start. Please retry from My Songs.');
    }
  }

  private async parse(raw: unknown): Promise<CreateSongDto> {
    const dto = plainToInstance(CreateSongDto, raw);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) throw new BadRequestException(errors.flatMap((e) => Object.values(e.constraints ?? {})));
    if (dto.releaseAt && dto.releaseAt.getTime() > Date.now() + 366 * 86_400_000) throw new BadRequestException('Release date is too far in the future.');
    return dto;
  }

  private async assertRefs(dto: CreateSongDto, districtId: number, ownArtistId: string) {
    const [g, d] = await Promise.all([
      this.pool.query('SELECT 1 FROM genres WHERE id = $1 AND is_active', [dto.genreId]),
      this.pool.query('SELECT 1 FROM districts WHERE id = $1 AND is_active', [districtId]),
    ]);
    if (!g.rowCount) throw new BadRequestException('Selected genre does not exist.');
    if (!d.rowCount) throw new BadRequestException('Selected district does not exist.');
    const ids = [...new Set(dto.featuredArtistIds ?? [])];
    if (ids.includes(ownArtistId)) throw new BadRequestException('You cannot list yourself as a featured artist.');
    if (ids.length) {
      const f = await this.pool.query(`SELECT count(*)::int AS n FROM artist_profiles WHERE id = ANY($1::uuid[]) AND approval_status = 'active'`, [ids]);
      if (f.rows[0].n !== ids.length) throw new BadRequestException('One or more featured artists were not found.');
    }
  }

  private async uniqueSlug(db: Db, artistId: string, title: string) {
    const base = slugify(title);
    let slug = base;
    while ((await db.query('SELECT 1 FROM songs WHERE artist_id = $1 AND slug = $2', [artistId, slug])).rowCount) {
      slug = `${base}-${randomBytes(2).toString('hex')}`;
    }
    return slug;
  }
}

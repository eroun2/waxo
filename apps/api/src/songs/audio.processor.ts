import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { Pool } from 'pg';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PG_POOL } from '../database/database.module';
import { AUDIO_QUEUE_NAME, newRedis } from '../queue/queue.module';
import { StorageService } from '../storage/storage.service';
import { FfmpegService } from '../media/ffmpeg.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Background worker: master -> AAC stream rendition + MP3 download rendition.
 * Runs inside the API process by default; set AUDIO_WORKER=false on API instances and run a dedicated worker to scale.
 */
@Injectable()
export class AudioProcessor implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('AudioWorker');
  private worker?: Worker;
  private releaser?: NodeJS.Timeout;

  constructor(
    @Inject(PG_POOL) private pool: Pool,
    private storage: StorageService,
    private ffmpeg: FfmpegService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (process.env.AUDIO_WORKER === 'false') return;
    this.worker = new Worker(AUDIO_QUEUE_NAME, (job) => this.process(job.data.songId), {
      connection: newRedis(), concurrency: Number(process.env.AUDIO_CONCURRENCY ?? 2),
    });
    this.worker.on('failed', (job, err) => {
      this.log.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) void this.markFailed(job.data.songId);
    });
    // Promote scheduled songs when their release time arrives (idempotent, safe on multiple instances).
    this.releaser = setInterval(() => {
      this.pool.query(`UPDATE songs SET status = 'approved' WHERE status = 'scheduled' AND release_at <= now()`)
        .catch((e) => this.log.error(`Release job failed: ${e.message}`));
    }, 60_000);
  }

  async onModuleDestroy() {
    if (this.releaser) clearInterval(this.releaser);
    await this.worker?.close();
  }

  private async process(songId: string) {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.title, s.master_key, ap.stage_name, ap.user_id
       FROM songs s JOIN artist_profiles ap ON ap.id = s.artist_id WHERE s.id = $1 AND s.status IN ('processing')`, [songId]);
    const song = rows[0];
    if (!song) return; // removed or already handled
    await this.pool.query(`UPDATE songs SET process_status = 'processing' WHERE id = $1`, [songId]);

    const dir = await mkdtemp(join(tmpdir(), 'waxo-proc-'));
    try {
      const src = join(dir, 'master');
      const streamOut = join(dir, 'stream.m4a');
      const dlOut = join(dir, 'download.mp3');
      await this.storage.downloadToFile(this.storage.privateBucket, song.master_key, src);
      const info = await this.ffmpeg.probe(src);
      await this.ffmpeg.toStream(src, streamOut);
      await this.ffmpeg.toDownload(src, dlOut, { title: song.title, artist: song.stage_name });

      const streamKey = `songs/${songId}/stream.m4a`;
      const downloadKey = `songs/${songId}/download.mp3`;
      await this.storage.putFile(this.storage.privateBucket, streamKey, streamOut, 'audio/mp4');
      await this.storage.putFile(this.storage.privateBucket, downloadKey, dlOut, 'audio/mpeg');

      await this.pool.query(
        `UPDATE songs SET stream_key = $2, download_key = $3, duration_seconds = $4, process_status = 'ready',
                status = 'pending_review' WHERE id = $1`, [songId, streamKey, downloadKey, info.durationSeconds]);
      await this.notifications.create(this.pool, song.user_id, 'song.processed', 'Your song is ready for review',
        `"${song.title}" was processed and submitted for moderation.`, { songId });
      await this.notifications.notifyStaff(this.pool, 'staff.song_pending', 'New song awaiting review', `"${song.title}" by ${song.stage_name}`, { songId })
        .catch(() => undefined);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async markFailed(songId: string) {
    const { rows } = await this.pool.query(
      `UPDATE songs s SET process_status = 'failed', status = 'draft' WHERE s.id = $1 AND s.process_status <> 'ready'
       RETURNING s.title, (SELECT user_id FROM artist_profiles WHERE id = s.artist_id) AS user_id`, [songId]);
    if (rows[0]) {
      await this.notifications.create(this.pool, rows[0].user_id, 'song.processing_failed', 'We could not process your song',
        `"${rows[0].title}" failed to process. Open My Songs and retry, or upload a different file.`, { songId });
    }
  }
}

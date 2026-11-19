import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'child_process';

export interface ProbeInfo { durationSeconds: number; codec: string }

/** All commands use execFile with argument arrays (no shell), so file names can never inject commands. */
@Injectable()
export class FfmpegService {
  private run(cmd: string, args: string[], timeoutMs = 10 * 60_000): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(`${cmd} failed: ${(stderr || err.message).toString().slice(-500)}`));
        resolve(stdout.toString());
      });
    });
  }

  async probe(path: string): Promise<ProbeInfo> {
    let json: any;
    try {
      json = JSON.parse(await this.run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path], 60_000));
    } catch {
      throw new BadRequestException('This file could not be read as audio. It may be corrupted.');
    }
    const audio = (json.streams ?? []).find((s: any) => s.codec_type === 'audio');
    const duration = Number(json.format?.duration ?? audio?.duration);
    if (!audio || !Number.isFinite(duration) || duration < 1) throw new BadRequestException('No playable audio was found in this file.');
    const maxMin = Number(process.env.MAX_AUDIO_MINUTES ?? 30);
    if (duration > maxMin * 60) throw new BadRequestException(`Songs can be at most ${maxMin} minutes long.`);
    return { durationSeconds: Math.round(duration), codec: audio.codec_name };
  }

  /** Streaming rendition: AAC 160 kbps in an MP4 container with the index up front for instant playback. */
  toStream(input: string, output: string) {
    return this.run('ffmpeg', ['-y', '-i', input, '-vn', '-map_metadata', '-1', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', output]);
  }

  /** Download rendition: MP3 320 kbps, tagged with title/artist. */
  toDownload(input: string, output: string, tags: { title: string; artist: string }) {
    return this.run('ffmpeg', ['-y', '-i', input, '-vn', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '320k',
      '-metadata', `title=${tags.title}`, '-metadata', `artist=${tags.artist}`, output]);
  }

  /** Re-encodes uploaded artwork to a clean 1000x1000 JPEG (also strips any embedded payloads/metadata). */
  toArtwork(input: string, output: string) {
    return this.run('ffmpeg', ['-y', '-i', input, '-vf', 'scale=1000:1000:force_original_aspect_ratio=increase,crop=1000:1000',
      '-frames:v', '1', '-q:v', '3', '-map_metadata', '-1', output], 60_000);
  }

  /** Generic cover-crop to w x h JPEG (profile pictures and cover images). */
  toImage(input: string, output: string, w: number, h: number) {
    return this.run('ffmpeg', ['-y', '-i', input, '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
      '-frames:v', '1', '-q:v', '3', '-map_metadata', '-1', output], 60_000);
  }
}

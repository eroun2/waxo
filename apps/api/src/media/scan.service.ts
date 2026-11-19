import { Injectable, Logger, OnModuleInit, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { createReadStream } from 'fs';
import * as net from 'net';

/** Optional ClamAV scanning (clamd INSTREAM). Enabled when CLAMAV_HOST is set; fails closed when enabled but unreachable. */
@Injectable()
export class ScanService implements OnModuleInit {
  private log = new Logger('Scan');
  onModuleInit() {
    if (!process.env.CLAMAV_HOST) this.log.warn('CLAMAV_HOST not set: malware scanning is DISABLED.');
  }

  async assertClean(path: string) {
    const host = process.env.CLAMAV_HOST;
    if (!host) return;
    let result: string;
    try {
      result = await this.scan(path, host, Number(process.env.CLAMAV_PORT ?? 3310));
    } catch (e) {
      this.log.error(`Scan failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException('File scanning is temporarily unavailable. Please try again shortly.');
    }
    if (result.includes('FOUND')) throw new UnprocessableEntityException('This file was rejected by the malware scan.');
    if (!result.endsWith('OK')) throw new ServiceUnavailableException('File scanning is temporarily unavailable. Please try again shortly.');
  }

  private scan(path: string, host: string, port: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host, port });
      let out = '';
      sock.setTimeout(120_000, () => sock.destroy(new Error('scan timeout')));
      sock.on('data', (d) => (out += d.toString()));
      sock.on('error', reject);
      sock.on('close', () => resolve(out.replace(/\0/g, '').trim()));
      sock.write('zINSTREAM\0');
      const rs = createReadStream(path, { highWaterMark: 64 * 1024 });
      rs.on('data', (chunk) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        if (!sock.write(Buffer.concat([len, chunk as Buffer]))) { rs.pause(); sock.once('drain', () => rs.resume()); }
      });
      rs.on('end', () => sock.write(Buffer.alloc(4)));
      rs.on('error', reject);
    });
  }
}

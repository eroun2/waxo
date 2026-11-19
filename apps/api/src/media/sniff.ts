import { open } from 'fs/promises';

export interface Kind { ext: string; mime: string }

export async function readHead(path: string, n = 16): Promise<Buffer> {
  const fh = await open(path, 'r');
  try {
    const b = Buffer.alloc(n);
    const { bytesRead } = await fh.read(b, 0, n, 0);
    return b.subarray(0, bytesRead);
  } finally { await fh.close(); }
}

/** Identify audio by content, never by the client-supplied name or MIME type. */
export function sniffAudio(b: Buffer): Kind | null {
  const s = (from: number, to: number) => b.subarray(from, to).toString('latin1');
  if (s(0, 3) === 'ID3') return { ext: 'mp3', mime: 'audio/mpeg' };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) {
    return (b[1] & 0x06) === 0 ? { ext: 'aac', mime: 'audio/aac' } : { ext: 'mp3', mime: 'audio/mpeg' };
  }
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };
  if (s(0, 4) === 'fLaC') return { ext: 'flac', mime: 'audio/flac' };
  if (s(0, 4) === 'OggS') return { ext: 'ogg', mime: 'audio/ogg' };
  if (s(4, 8) === 'ftyp') return { ext: 'm4a', mime: 'audio/mp4' };
  return null;
}

export function sniffImage(b: Buffer): Kind | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return { ext: 'png', mime: 'image/png' };
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

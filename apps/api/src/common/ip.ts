import { createHmac } from 'crypto';
/** Stable, non-reversible IP fingerprint for abuse detection (we never store raw IPs in event tables). */
export const hashIp = (ip = 'unknown') =>
  createHmac('sha256', process.env.IP_HASH_SALT ?? process.env.JWT_ACCESS_SECRET ?? 'waxo').update(ip).digest('hex');

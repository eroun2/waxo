const KEYS = ['facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'website'];
/** Keep only known networks with https URLs. */
export function cleanSocials(input?: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const k of KEYS) {
    const v = input?.[k];
    if (typeof v === 'string' && /^https:\/\/\S{3,300}$/.test(v)) out[k] = v;
  }
  return out;
}

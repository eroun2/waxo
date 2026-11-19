export const fmtTime = (s: number | null | undefined) => {
  if (!s || !Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const compact = (n: number) => compactFmt.format(n);

/** Native share sheet where available (mobile), otherwise copy the link. */
export async function shareLink(path: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = `${window.location.origin}${path}`;
  try {
    if (navigator.share) { await navigator.share({ title, url }); return 'shared'; }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch { return 'failed'; }
}

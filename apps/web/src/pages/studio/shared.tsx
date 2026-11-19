import { useOutletContext } from 'react-router-dom';
import { cx } from '../../components/ui';

export interface ArtistMe {
  id: string; stage_name: string; slug: string; real_name: string; phone: string; district_id: number; district: string; town: string | null;
  bio: string | null; social_links: Record<string, string>; avatarUrl: string | null; coverUrl: string | null; is_verified: boolean;
  approval_status: 'pending' | 'active' | 'rejected' | 'suspended'; review_note: string | null; genres: { id: number; name: string; slug: string }[];
}
export interface StudioCtx { artist: ArtistMe; reload: () => void }
export const useStudio = () => useOutletContext<StudioCtx>();

export interface SongMine {
  id: string; title: string; slug: string; description?: string | null; status: string; process_status: string; rejection_reason: string | null;
  artworkUrl: string | null; duration_seconds: number | null; downloads_enabled: boolean; release_at: string | null;
  genre_id?: number | null; district_id?: number | null; stream_count: number; download_count: number; like_count: number; created_at: string;
}

export function statusInfo(s: { status: string; process_status: string }) {
  if (s.process_status === 'failed') return { label: 'Processing failed', tone: 'bad' as const };
  switch (s.status) {
    case 'processing': return { label: 'Processing', tone: 'busy' as const };
    case 'pending_review': return { label: 'In review', tone: 'busy' as const };
    case 'approved': return { label: 'Live', tone: 'good' as const };
    case 'scheduled': return { label: 'Scheduled', tone: 'good' as const };
    case 'rejected': return { label: 'Rejected', tone: 'bad' as const };
    default: return { label: 'Draft', tone: 'busy' as const };
  }
}

export function StatusPill({ song }: { song: { status: string; process_status: string } }) {
  const i = statusInfo(song);
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
      i.tone === 'good' ? 'border-fg bg-fg text-bg' : i.tone === 'bad' ? 'border-red-500 text-red-500' : 'border-line text-muted')}>
      {i.tone === 'busy' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}{i.label}
    </span>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-line p-4 sm:p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** ISO string -> value for <input type="datetime-local"> in the user's timezone. */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { qs } from '../../lib/api';
import { usePaged } from '../../lib/hooks';
import { compact, fmtTime } from '../../lib/format';
import { Artwork } from '../../components/Artwork';
import { Button, EmptyState, ErrorState, LinkButton, Skeleton, cx } from '../../components/ui';
import { type SongMine, StatusPill, useStudio } from './shared';

const FILTERS = [['', 'All'], ['approved', 'Live'], ['pending_review', 'In review'], ['processing', 'Processing'], ['scheduled', 'Scheduled'], ['rejected', 'Rejected'], ['draft', 'Drafts']] as const;

export default function StudioSongs() {
  const { artist } = useStudio();
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? '';
  const p = usePaged<SongMine>(`/songs/mine${qs({ status })}`);

  // Keep processing songs fresh without a manual refresh.
  const busy = p.items.some((s) => s.status === 'processing' || s.process_status === 'queued' || s.process_status === 'processing');
  useEffect(() => {
    if (!busy || p.items.length > 20) return;
    const id = window.setInterval(() => void p.reload(), 5000);
    return () => window.clearInterval(id);
  }, [busy, p.items.length, p.reload]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">My songs {p.total > 0 && <span className="text-base font-normal text-muted">({p.total})</span>}</h2>
        {artist.approval_status === 'active' && <LinkButton to="/studio/upload" size="sm"><Upload className="h-4 w-4" />Upload</LinkButton>}
      </div>

      <div role="tablist" aria-label="Filter songs" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={status === k} onClick={() => setSp(k ? { status: k } : {}, { replace: true })}
            className={cx('h-9 shrink-0 rounded-full border px-4 text-sm', status === k ? 'border-fg bg-fg text-bg' : 'border-line hover:bg-surface')}>{label}</button>
        ))}
      </div>

      <div className="mt-6">
        {p.initial ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          : p.error && !p.items.length ? <ErrorState message={p.error} onRetry={p.reload} />
          : !p.items.length ? <EmptyState title={status ? 'No songs with this status' : 'No songs yet'} text={status ? 'Try another filter.' : 'Upload your first song to get started.'} />
          : (
            <>
              <ul className="divide-y divide-line rounded-card border border-line">
                {p.items.map((s) => (
                  <li key={s.id}>
                    <Link to={`/studio/songs/${s.id}`} className="flex items-center gap-3 p-3 hover:bg-surface sm:gap-4 sm:p-4">
                      <Artwork src={s.artworkUrl} alt="" className="h-14 w-14 shrink-0 !rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{fmtTime(s.duration_seconds)} · {new Date(s.created_at).toLocaleDateString()}{s.release_at && s.status === 'scheduled' ? ` · releases ${new Date(s.release_at).toLocaleDateString()}` : ''}</p>
                        {s.rejection_reason && <p className="mt-1 truncate text-xs text-red-500">{s.rejection_reason}</p>}
                      </div>
                      <div className="hidden text-right text-xs tabular-nums text-muted sm:block"><p>{compact(s.stream_count)} plays</p><p>{s.downloads_enabled ? `${compact(s.download_count)} downloads` : 'Downloads off'}</p></div>
                      <StatusPill song={s} />
                    </Link>
                  </li>
                ))}
              </ul>
              {p.hasMore && <div className="mt-4 flex justify-center"><Button variant="outline" onClick={p.loadMore} disabled={p.loading}>Load more</Button></div>}
            </>
          )}
      </div>
    </div>
  );
}

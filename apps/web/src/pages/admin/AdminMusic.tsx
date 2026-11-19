import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useApi, usePaged } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { compact, fmtTime } from '../../lib/format';
import { Artwork } from '../../components/Artwork';
import { Button, EmptyState, ErrorState, Skeleton, cx, inputCls } from '../../components/ui';
import { StatusPill } from '../studio/shared';
import { ActionButton, Badge, Field2, PageTitle, ReasonAction, Tabs, can, dateTime, statusTone } from './shared';

const TABS = [['pending_review', 'Approval queue'], ['approved', 'Live'], ['scheduled', 'Scheduled'], ['rejected', 'Rejected'], ['removed', 'Removed'], ['all', 'All']] as const;
type Tab = (typeof TABS)[number][0];

interface Row { id: string; title: string; artist_name: string; status: string; process_status: string; stream_count: number; download_count: number; is_featured: boolean; created_at: string; duration_seconds: number | null; artworkUrl: string | null }

export default function AdminMusic() {
  const { me } = useAuth();
  const [sp, setSp] = useSearchParams();
  const status = (sp.get('status') as Tab) || 'pending_review';
  const sort = sp.get('sort') ?? '';
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const p = usePaged<Row>(`/admin/songs${qs({ status, sort, q: term })}`);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const feature = async (id: string, featured: boolean) => { await api(`/admin/songs/${id}/feature`, { method: 'PATCH', body: { featured } }); await p.reload(); };

  const items = Array.isArray(p.items) ? p.items : [];

  return (
    <div>
      <PageTitle title="Music" sub="Approve new uploads, manage live songs and feature standout tracks." />
      <Tabs value={status} onChange={(v) => set('status', v === 'pending_review' ? '' : v)} items={TABS} />
      <div className="mt-4 flex flex-wrap gap-3">
        <form className="min-w-0 flex-1 sm:max-w-sm" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search music" placeholder="Search by title or artist" className={inputCls} /></form>
        <select aria-label="Sort" value={sort} onChange={(e) => set('sort', e.target.value)} className={cx(inputCls, 'w-44')}>
          <option value="">Default order</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="streams">Most streamed</option>
        </select>
      </div>
      <div className="mt-6">
        {p.initial ? <Skeleton className="h-48" /> : p.error && !items.length ? <ErrorState message={p.error} onRetry={p.reload} />
          : !items.length ? <EmptyState title={status === 'pending_review' ? 'The queue is clear' : 'No songs here'} text={status === 'pending_review' ? 'New uploads appear here once they have been processed.' : 'Try another tab or search.'} /> : (
            <>
              <ul className="divide-y divide-line rounded-card border border-line">
                {items.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 p-3 hover:bg-surface sm:gap-4 sm:p-4">
                    <Link to={`/admin/music/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Artwork src={s.artworkUrl} alt="" className="h-12 w-12 shrink-0 !rounded-lg" />
                      <span className="min-w-0"><span className="block truncate font-medium">{s.title}</span><span className="block truncate text-xs text-muted">{s.artist_name} · {fmtTime(s.duration_seconds)} · {new Date(s.created_at).toLocaleDateString()}</span></span>
                    </Link>
                    <span className="hidden text-right text-xs tabular-nums text-muted sm:block">{compact(s.stream_count)} plays<br />{compact(s.download_count)} dl</span>
                    <StatusPill song={s} />
                    {s.status === 'approved' && can(me, 'music.feature') && (
                      <button onClick={() => void feature(s.id, !s.is_featured)} aria-pressed={s.is_featured} aria-label={s.is_featured ? 'Remove from featured' : 'Feature this song'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-bg"><Star className={cx('h-5 w-5', s.is_featured && 'fill-current')} /></button>
                    )}
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

interface Detail {
  id: string; title: string; description: string | null; status: string; process_status: string; rejection_reason: string | null; duration_seconds: number | null;
  downloads_enabled: boolean; is_featured: boolean; release_at: string | null; original_mime: string | null; file_size_bytes: number | null; ownership_confirmed_at: string | null;
  created_at: string; artist_id: string; artist_name: string; genre: string | null; district: string | null; artworkUrl: string | null; previewUrl: string | null;
}

export function AdminSongDetail() {
  const { id = '' } = useParams();
  const { me } = useAuth();
  const { data: s, error, refetch } = useApi<Detail>(`/admin/songs/${id}`);
  const [featured, setFeatured] = useState<boolean | null>(null);
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!s) return <Skeleton className="h-96" />;
  const post = (path: string, body?: unknown) => async () => { await api(`/admin/songs/${id}/${path}`, { method: 'POST', body: body ?? {} }); refetch(); };
  const withReason = (path: string) => async (reason: string) => { await api(`/admin/songs/${id}/${path}`, { method: 'POST', body: { reason } }); refetch(); };
  const canReview = s.status === 'pending_review' && s.process_status === 'ready';
  const removable = ['pending_review', 'approved', 'scheduled', 'rejected'].includes(s.status);

  return (
    <div className="space-y-6">
      <Link to="/admin/music" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Music</Link>
      <div className="flex items-start gap-4">
        <Artwork src={s.artworkUrl} alt="" className="h-24 w-24 shrink-0 !rounded-xl sm:h-32 sm:w-32" />
        <div className="min-w-0"><h2 className="text-2xl font-bold tracking-tight">{s.title}</h2>
          <p className="mt-1 text-sm text-muted">by <Link to={`/admin/artists/${s.artist_id}`} className="underline">{s.artist_name}</Link></p>
          <p className="mt-2 flex flex-wrap gap-2"><StatusPill song={s} />{s.downloads_enabled && <Badge>Downloads on</Badge>}</p></div>
      </div>

      {s.status === 'approved' && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-medium">
          <span>✓ Song is approved and live for streaming across all 146 districts on WaXo.</span>
        </div>
      )}
      {s.status === 'rejected' && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 font-medium">
          <span>Song was rejected. {s.rejection_reason ? `Reason: ${s.rejection_reason}` : ''}</span>
        </div>
      )}

      <section className="rounded-card border border-line p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold">Listen before you decide</h3>
        {s.previewUrl ? <audio controls preload="none" src={s.previewUrl} className="w-full" /> : <p className="text-sm text-muted">No audio is available yet. The song may still be processing.</p>}
        <p className="mt-2 text-xs text-muted">The preview link expires after 15 minutes. Reload the page for a fresh one.</p>
      </section>

      <dl className="grid gap-4 rounded-card border border-line p-5 sm:grid-cols-2">
        <Field2 label="Genre">{s.genre ?? '—'}</Field2><Field2 label="District">{s.district ?? '—'}</Field2>
        <Field2 label="Length">{fmtTime(s.duration_seconds)}</Field2><Field2 label="File">{s.original_mime ?? '—'}{s.file_size_bytes ? ` · ${(s.file_size_bytes / 1048576).toFixed(1)} MB` : ''}</Field2>
        <Field2 label="Uploaded">{dateTime(s.created_at)}</Field2><Field2 label="Release">{s.release_at ? dateTime(s.release_at) : 'On approval'}</Field2>
        <Field2 label="Ownership confirmed by artist">{dateTime(s.ownership_confirmed_at)}</Field2>
        <Field2 label="Status"><Badge tone={statusTone(s.status)}>{s.status.replace('_', ' ')}</Badge></Field2>
        {s.description && <div className="sm:col-span-2"><Field2 label="Description"><span className="whitespace-pre-line">{s.description}</span></Field2></div>}
        {s.rejection_reason && <div className="sm:col-span-2"><Field2 label="Last moderator note">{s.rejection_reason}</Field2></div>}
      </dl>

      <div className="flex flex-wrap items-start gap-3">
        {canReview && <ActionButton label="Approve" onClick={post('approve')} />}
        {canReview && <ReasonAction label="Reject" confirmLabel="Reject with this reason" placeholder="Tell the artist why" onSubmit={withReason('reject')} />}
        {s.status === 'approved' && can(me, 'music.feature') && (
          <ActionButton variant="outline" label={(featured ?? s.is_featured) ? 'Remove from featured' : 'Feature on homepage'} onClick={async () => { const next = !(featured ?? s.is_featured); await api(`/admin/songs/${id}/feature`, { method: 'PATCH', body: { featured: next } }); setFeatured(next); }} />
        )}
        {removable && can(me, 'content.remove') && <ReasonAction label="Remove song" danger confirmLabel="Remove song" placeholder="Why is this being removed?" onSubmit={withReason('remove')} />}
      </div>
      {s.status === 'pending_review' && s.process_status !== 'ready' && <p className="text-sm text-muted">This song cannot be approved until processing finishes.</p>}
    </div>
  );
}

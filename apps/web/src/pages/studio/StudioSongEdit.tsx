import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { compact } from '../../lib/format';
import { Artwork } from '../../components/Artwork';
import { DistrictSelect, GenreSelect } from '../../components/Selects';
import { Button, ErrorState, Field, Skeleton, cx, inputCls } from '../../components/ui';
import { type SongMine, StatusPill, toLocalInput } from './shared';

export default function StudioSongEdit() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data: s, error, refetch } = useApi<SongMine>(`/songs/mine/${id}`);
  const [f, setF] = useState({ title: '', description: '', genreId: '', districtId: '', downloads: false, when: 'now' as 'now' | 'schedule', scheduledAt: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!s) return;
    const future = s.release_at && new Date(s.release_at).getTime() > Date.now();
    setF({ title: s.title, description: s.description ?? '', genreId: s.genre_id ? String(s.genre_id) : '', districtId: s.district_id ? String(s.district_id) : '', downloads: s.downloads_enabled, when: future ? 'schedule' : 'now', scheduledAt: future ? toLocalInput(s.release_at) : '' });
  }, [s]);

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!s) return <Skeleton className="h-96" />;
  const released = s.status === 'approved';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return setMsg({ ok: false, text: 'The title cannot be empty.' });
    if (!released && f.when === 'schedule' && new Date(f.scheduledAt).getTime() <= Date.now()) return setMsg({ ok: false, text: 'Pick a release date in the future.' });
    setBusy(true); setMsg(null);
    try {
      await api(`/songs/${s.id}`, {
        method: 'PATCH',
        body: {
          title: f.title.trim(), description: f.description.trim(), downloadsEnabled: f.downloads,
          ...(f.genreId && { genreId: Number(f.genreId) }), ...(f.districtId && { districtId: Number(f.districtId) }),
          // Sending a past date clears the schedule (publish on approval).
          ...(!released && { releaseAt: f.when === 'schedule' ? new Date(f.scheduledAt).toISOString() : new Date(0).toISOString() }),
        },
      });
      setMsg({ ok: true, text: 'Changes saved.' });
      refetch();
    } catch (err) { setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not save your changes.' }); }
    finally { setBusy(false); }
  };

  const retry = async () => {
    setBusy(true);
    try { await api(`/songs/${s.id}/retry-processing`, { method: 'POST' }); refetch(); }
    catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api(`/songs/${s.id}`, { method: 'DELETE' }); nav('/studio/songs', { replace: true }); }
    catch (err) { setMsg({ ok: false, text: (err as Error).message }); setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <Link to="/studio/songs" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />My songs</Link>

      <div className="flex items-center gap-4">
        <Artwork src={s.artworkUrl} alt="" className="h-20 w-20 shrink-0 !rounded-xl" />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{s.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted"><StatusPill song={s} /><span>{compact(s.stream_count)} plays</span><span>{compact(s.download_count)} downloads</span></div>
        </div>
      </div>

      {s.rejection_reason && <div role="alert" className="rounded-card border border-red-500 p-4 text-sm"><strong className="text-red-500">Moderator note:</strong> {s.rejection_reason}</div>}
      {s.process_status === 'failed' && (
        <div role="alert" className="rounded-card border border-red-500 p-4 text-sm">
          <p><strong className="text-red-500">Processing failed.</strong> This can happen with damaged files.</p>
          <Button size="sm" className="mt-3" onClick={retry} disabled={busy}>Retry processing</Button>
        </div>
      )}
      {s.status === 'processing' && <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted">We are still preparing this song. This page will not change until processing finishes.</p>}

      <form onSubmit={save} className="space-y-4">
        <Field label="Song title"><input className={inputCls} value={f.title} maxLength={120} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} /></Field>
        <Field label="Description"><textarea rows={3} className={cx(inputCls, 'h-auto py-3')} maxLength={2000} value={f.description} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Genre"><GenreSelect by="id" value={f.genreId} emptyLabel="Choose a genre" onChange={(v) => setF((x) => ({ ...x, genreId: v }))} /></Field>
          <Field label="District"><DistrictSelect by="id" value={f.districtId} emptyLabel="Choose a district" onChange={(v) => setF((x) => ({ ...x, districtId: v }))} /></Field>
        </div>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-current" checked={f.downloads} onChange={(e) => setF((x) => ({ ...x, downloads: e.target.checked }))} />
          <span>Allow listeners to download this song<span className="block text-xs text-muted">Takes effect immediately.</span></span></label>
        {released ? <p className="text-sm text-muted">Released {s.release_at ? new Date(s.release_at).toLocaleDateString() : ''}.</p> : (
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-3"><input type="radio" name="when" className="h-4 w-4 accent-current" checked={f.when === 'now'} onChange={() => setF((x) => ({ ...x, when: 'now' }))} />Publish as soon as it is approved</label>
            <label className="flex items-center gap-3"><input type="radio" name="when" className="h-4 w-4 accent-current" checked={f.when === 'schedule'} onChange={() => setF((x) => ({ ...x, when: 'schedule' }))} />Schedule a release date</label>
            {f.when === 'schedule' && <input type="datetime-local" aria-label="Release date and time" className={`${inputCls} max-w-xs`} value={f.scheduledAt} onChange={(e) => setF((x) => ({ ...x, scheduledAt: e.target.value }))} />}
          </div>
        )}
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={cx('text-sm font-medium', !msg.ok && 'text-red-500')}>{msg.text}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
      </form>

      <section className="rounded-card border border-line p-5">
        <h3 className="font-semibold">Delete song</h3>
        <p className="mt-1 text-sm text-muted">The song disappears from WaXo for everyone. This cannot be undone from here.</p>
        {confirmDelete ? (
          <div className="mt-4 flex flex-wrap items-center gap-3"><span className="text-sm font-medium">Delete “{s.title}”?</span>
            <Button variant="outline" size="sm" className="!border-red-500 !text-red-500" onClick={remove} disabled={busy}>Yes, delete it</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button></div>
        ) : <Button variant="outline" size="sm" className="mt-4" onClick={() => setConfirmDelete(true)}>Delete song</Button>}
      </section>
    </div>
  );
}

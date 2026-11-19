import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../lib/api';
import { useApi, usePaged } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Button, EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { ActionButton, Badge, Field2, PageTitle, ReasonAction, Tabs, can, dateTime, statusTone } from './shared';

const MUSIC_TABS = [['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed'], ['all', 'All']] as const;
const COPY_TABS = [['open', 'Open'], ['investigating', 'Investigating'], ['resolved', 'Upheld'], ['dismissed', 'Dismissed'], ['all', 'All']] as const;

interface MusicRow { id: string; reason: string; details: string | null; status: string; created_at: string; song_id: string; title: string; song_status: string; artist_name: string; reporter_email: string | null }

export function AdminContentReports() {
  const { me } = useAuth();
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed' | 'all'>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const p = usePaged<MusicRow>(`/admin/reports/music${qs({ status })}`);
  const items: MusicRow[] = Array.isArray(p.items) ? p.items : [];
  const act = (id: string, path: string) => async (note: string) => { await api(`/admin/reports/music/${id}/${path}`, { method: 'POST', body: note ? { note } : {} }); await p.reload(); };

  return (
    <div>
      <PageTitle title="Reported content" sub="Reports from listeners about inappropriate or misleading songs." />
      <Tabs value={status} onChange={setStatus} items={MUSIC_TABS} />
      <div className="mt-6">
        {p.initial ? <Skeleton className="h-40" /> : p.error && !items.length ? <ErrorState message={p.error} onRetry={p.reload} />
          : !items.length ? <EmptyState title="No reports here" text={status === 'open' ? 'Nothing needs your attention.' : undefined} /> : (
            <>
              <ul className="divide-y divide-line rounded-card border border-line">
                {items.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-expanded={openId === r.id} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left hover:bg-surface">
                      <span className="min-w-0 flex-1"><span className="block font-medium">{r.title}</span><span className="block text-xs text-muted">{r.artist_name} · {r.reason.replace(/_/g, ' ')}</span></span>
                      <span className="text-xs text-muted">{dateTime(r.created_at)}</span><Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </button>
                    {openId === r.id && (
                      <div className="space-y-4 border-t border-line bg-surface/50 p-4">
                        <dl className="grid gap-3 sm:grid-cols-2">
                          <Field2 label="Reporter">{r.reporter_email ?? 'Anonymous'}</Field2><Field2 label="Song status"><Badge tone={statusTone(r.song_status)}>{r.song_status.replace('_', ' ')}</Badge></Field2>
                          <div className="sm:col-span-2"><Field2 label="Details">{r.details || 'No details provided.'}</Field2></div>
                        </dl>
                        <p className="flex gap-4 text-sm"><Link className="underline font-medium text-amber-400" to={`/admin/music/${r.song_id}`}>Review track in admin →</Link></p>
                        {r.status === 'open' && (
                          <div className="flex flex-wrap items-start gap-3">
                            <ReasonAction optional label="Dismiss report" placeholder="Note" onSubmit={act(r.id, 'dismiss')} />
                            <ReasonAction optional label="Mark resolved" placeholder="Note" onSubmit={act(r.id, 'resolve')} />
                            {can(me, 'content.remove') && <ReasonAction danger optional label="Remove song" confirmLabel="Remove song" placeholder="Note for the artist" onSubmit={act(r.id, 'remove-song')} />}
                          </div>
                        )}
                      </div>
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

interface CopyRow { id: string; status: string; reporter_name: string; reporter_email: string; created_at: string; song_id: string; title: string; song_status: string; artist_name: string }
interface CopyDetail extends CopyRow {
  claim_details: string; evidence_urls: string[]; resolution_note: string | null; resolved_at: string | null; ownership_confirmed_at: string | null; uploaded_at: string;
  artist_id: string; artist_email: string; handled_by_email: string | null; reports_on_song: number;
}

function CopyrightDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { me } = useAuth();
  const { data: c, error, refetch } = useApi<CopyDetail>(`/admin/copyright/${id}`);
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!c) return <Skeleton className="h-40" />;
  const done = () => { refetch(); onChanged(); };
  const act = (path: string) => async (note: string) => { await api(`/admin/copyright/${id}/${path}`, { method: 'POST', body: { note } }); done(); };
  const live = c.status === 'open' || c.status === 'investigating';
  return (
    <div className="space-y-4 border-t border-line bg-surface/50 p-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field2 label="Complainant">{c.reporter_name} · <a className="underline" href={`mailto:${c.reporter_email}`}>{c.reporter_email}</a></Field2>
        <Field2 label="Submitted">{dateTime(c.created_at)}</Field2>
        <div className="sm:col-span-2"><Field2 label="Claim"><span className="whitespace-pre-line">{c.claim_details}</span></Field2></div>
        {(c.evidence_urls?.length ?? 0) > 0 && <div className="sm:col-span-2"><Field2 label="Evidence"><span className="flex flex-col gap-1">{(c.evidence_urls ?? []).map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">{u}</a>)}</span></Field2></div>}
        <Field2 label="Uploader">{c.artist_name} · {c.artist_email}</Field2>
        <Field2 label="Uploader confirmed ownership">{dateTime(c.ownership_confirmed_at)}</Field2>
        <Field2 label="Song uploaded">{dateTime(c.uploaded_at)}</Field2><Field2 label="Complaints about this song">{c.reports_on_song}</Field2>
        {c.resolution_note && <div className="sm:col-span-2"><Field2 label={`Outcome${c.handled_by_email ? ` (by ${c.handled_by_email})` : ''}`}>{c.resolution_note}</Field2></div>}
      </dl>
      <p className="flex gap-4 text-sm"><Link className="underline font-medium text-amber-400" to={`/admin/music/${c.song_id}`}>Review track in admin →</Link></p>
      {c.status === 'investigating' && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400 font-medium">
          <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Investigation in progress{c.handled_by_email ? ` (assigned to ${c.handled_by_email})` : ''}. Review the claim and evidence, then uphold to remove the song or dismiss the complaint.</span>
        </div>
      )}
      {live && (
        <div className="flex flex-wrap items-start gap-3">
          {c.status === 'open' && <ActionButton variant="outline" label="Start investigation" onClick={async () => { await api(`/admin/copyright/${id}/investigate`, { method: 'POST', body: {} }); done(); }} />}
          {can(me, 'content.remove') && <ReasonAction danger label="Uphold and remove song" confirmLabel="Uphold and remove" placeholder="Explain the decision (sent to the artist and the complainant)" onSubmit={act('uphold')} />}
          <ReasonAction label="Dismiss complaint" confirmLabel="Dismiss" placeholder="Explain the decision (sent to the complainant)" onSubmit={act('dismiss')} />
        </div>
      )}
    </div>
  );
}

export function AdminCopyright() {
  const [status, setStatus] = useState<'open' | 'investigating' | 'resolved' | 'dismissed' | 'all'>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const p = usePaged<CopyRow>(`/admin/copyright${qs({ status })}`);
  const items: CopyRow[] = Array.isArray(p.items) ? p.items : [];
  return (
    <div>
      <PageTitle title="Copyright complaints" sub="Investigate each complaint. Upholding one removes the song and notifies everyone involved." />
      <Tabs value={status} onChange={setStatus} items={COPY_TABS} />
      <div className="mt-6">
        {p.initial ? <Skeleton className="h-40" /> : p.error && !items.length ? <ErrorState message={p.error} onRetry={p.reload} />
          : !items.length ? <EmptyState title="No complaints here" /> : (
            <>
              <ul className="divide-y divide-line rounded-card border border-line">
                {items.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setOpenId(openId === c.id ? null : c.id)} aria-expanded={openId === c.id} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left hover:bg-surface">
                      <span className="min-w-0 flex-1"><span className="block font-medium">{c.title}</span><span className="block text-xs text-muted">{c.artist_name} · complaint by {c.reporter_name}</span></span>
                      <span className="text-xs text-muted">{dateTime(c.created_at)}</span><Badge tone={statusTone(c.status)}>{c.status === 'resolved' ? 'upheld' : c.status}</Badge>
                    </button>
                    {openId === c.id && <CopyrightDetail id={c.id} onChanged={() => void p.reload()} />}
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

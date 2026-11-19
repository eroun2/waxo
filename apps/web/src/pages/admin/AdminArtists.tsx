import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Star } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useApi, usePaged } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Button, EmptyState, ErrorState, Page, Skeleton, inputCls } from '../../components/ui';
import { ActionButton, Badge, Field2, PageTitle, ReasonAction, Tabs, can, dateTime, statusTone } from './shared';

const TABS = [['pending', 'Awaiting approval'], ['active', 'Approved'], ['rejected', 'Rejected'], ['suspended', 'Suspended']] as const;
type Tab = (typeof TABS)[number][0];

interface Row { id: string; stage_name: string; real_name: string; email: string; email_verified: boolean; district: string; approval_status: string; is_verified: boolean; is_featured: boolean; created_at: string }

export default function AdminArtists() {
  const [sp, setSp] = useSearchParams();
  const status = (sp.get('status') as Tab) || 'pending';
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const p = usePaged<Row>(`/admin/artists${qs({ status, q: term })}`);
  const items = Array.isArray(p.items) ? p.items : [];
  return (
    <div>
      <PageTitle title="Artists" sub="Review registrations, then feature or verify standout artists." />
      <Tabs value={status} onChange={(v) => setSp({ status: v }, { replace: true })} items={TABS} />
      <form className="mt-4 max-w-sm" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search artists" placeholder="Search by stage name or email" className={inputCls} /></form>
      <div className="mt-6">
        {p.initial ? <Skeleton className="h-48" /> : p.error && !items.length ? <ErrorState message={p.error} onRetry={p.reload} />
          : !items.length ? <EmptyState title="Nothing here" text={status === 'pending' ? 'No artists are waiting for approval.' : 'No artists match this view.'} /> : (
            <>
              <ul className="divide-y divide-line rounded-card border border-line">
                {items.map((a) => (
                  <li key={a.id}>
                    <Link to={`/admin/artists/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-surface">
                      <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 font-medium">{a.stage_name}{a.is_verified && <BadgeCheck className="h-4 w-4" />}{a.is_featured && <Star className="h-4 w-4 fill-current" />}</span>
                        <span className="block truncate text-xs text-muted">{a.real_name} · {a.email}{a.email_verified ? '' : ' (email not verified)'}</span></span>
                      <span className="text-xs text-muted">{a.district}</span><span className="text-xs text-muted">{new Date(a.created_at).toLocaleDateString()}</span>
                      <Badge tone={statusTone(a.approval_status)}>{a.approval_status}</Badge>
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

interface Detail {
  id: string; stage_name: string; real_name: string; phone: string; email: string; email_verified_at: string | null; account_status: string; district: string; town: string | null;
  bio: string | null; social_links: Record<string, string>; genres: string[]; approval_status: string; review_note: string | null; is_verified: boolean; is_featured: boolean;
  created_at: string; reviewed_at: string | null; copyright_confirmed_at: string | null; slug: string;
}

export function AdminArtistDetail() {
  const { id = '' } = useParams();
  const { me } = useAuth();
  const { data: a, error, refetch } = useApi<Detail>(`/admin/artists/${id}`);
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!a) return <Skeleton className="h-96" />;
  const act = (path: string, body?: unknown) => async () => { await api(`/admin/artists/${id}/${path}`, { method: 'POST', body: body ?? {} }); refetch(); };
  const withReason = (path: string) => async (reason: string) => { await api(`/admin/artists/${id}/${path}`, { method: 'POST', body: { reason } }); refetch(); };
  const flag = (body: object) => async () => { await api(`/admin/artists/${id}`.concat('/flags'), { method: 'PATCH', body }); refetch(); };
  const s = a.approval_status;

  return (
    <div className="space-y-6">
      <Link to="/admin/artists" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Artists</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-bold tracking-tight">{a.stage_name}</h2><p className="mt-1 flex flex-wrap gap-2"><Badge tone={statusTone(s)}>{s === 'active' ? 'Approved' : s === 'pending' ? 'Awaiting approval' : s}</Badge>{a.is_verified && <Badge tone="good">Verified</Badge>}{a.is_featured && <Badge tone="good">Featured</Badge>}</p></div>
      </div>

      {s === 'active' && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-medium">
          <span>✓ Artist profile is approved and live on the WaXo platform.</span>
        </div>
      )}
      {s === 'rejected' && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 font-medium">
          <span>Artist registration was rejected. {a.review_note ? `Reason: ${a.review_note}` : ''}</span>
        </div>
      )}

      <dl className="grid gap-4 rounded-card border border-line p-5 sm:grid-cols-2">
        <Field2 label="Real name (private)">{a.real_name}</Field2><Field2 label="Phone (private)">{a.phone}</Field2>
        <Field2 label="Email">{a.email} {a.email_verified_at ? <Badge tone="good">verified</Badge> : <Badge tone="bad">not verified</Badge>}</Field2>
        <Field2 label="District">{[a.town, a.district].filter(Boolean).join(', ')}</Field2>
        <Field2 label="Genres">{a.genres.join(', ') || '—'}</Field2><Field2 label="Registered">{dateTime(a.created_at)}</Field2>
        <Field2 label="Ownership confirmed">{dateTime(a.copyright_confirmed_at)}</Field2><Field2 label="Last reviewed">{dateTime(a.reviewed_at)}</Field2>
        <div className="sm:col-span-2"><Field2 label="Biography"><span className="whitespace-pre-line">{a.bio || '—'}</span></Field2></div>
        {Object.keys(a.social_links ?? {}).length > 0 && <div className="sm:col-span-2"><Field2 label="Links"><span className="flex flex-wrap gap-x-4">{Object.entries(a.social_links).map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener noreferrer nofollow" className="capitalize underline">{k}</a>)}</span></Field2></div>}
        {a.review_note && <div className="sm:col-span-2"><Field2 label="Review note">{a.review_note}</Field2></div>}
      </dl>

      <div className="flex flex-wrap items-start gap-3">
        {(s === 'pending' || s === 'rejected') && <ActionButton label="Approve artist" onClick={act('approve')} />}
        {s === 'pending' && can(me, 'artists.review') && <ReasonAction label="Reject" confirmLabel="Reject with this reason" placeholder="What should the artist fix?" onSubmit={withReason('reject')} />}
        {s === 'active' && can(me, 'artists.suspend') && <ReasonAction label="Suspend" danger confirmLabel="Suspend artist" placeholder="Why is this artist being suspended?" onSubmit={withReason('suspend')} />}
        {s === 'suspended' && can(me, 'artists.suspend') && <ActionButton label="Reinstate artist" onClick={act('reinstate')} />}
        {s === 'active' && can(me, 'artists.feature') && (<>
          <ActionButton variant="outline" label={a.is_featured ? 'Remove from featured' : 'Feature on homepage'} onClick={flag({ isFeatured: !a.is_featured })} />
          <ActionButton variant="outline" label={a.is_verified ? 'Remove verified badge' : 'Mark as verified'} onClick={flag({ isVerified: !a.is_verified })} />
        </>)}
      </div>
    </div>
  );
}

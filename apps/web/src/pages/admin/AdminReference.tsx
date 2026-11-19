import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { Button, EmptyState, ErrorState, Field, Skeleton, cx, inputCls } from '../../components/ui';
import { Badge, PageTitle } from './shared';

const REGIONS = ['Central', 'Eastern', 'Northern', 'Western', 'Other'];

interface District { id: number; name: string; slug: string; region: string | null; country_code: string; is_active: boolean; artists: number; songs: number }
interface Genre { id: number; name: string; slug: string; is_active: boolean; songs: number }

function useSaver(onDone: () => void) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { await fn(); onDone(); return true; } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.'); return false; } finally { setBusy(false); }
  };
  return { err, busy, run };
}

export function AdminDistricts() {
  const { data, error, refetch } = useApi<District[]>('/admin/districts');
  const [name, setName] = useState(''); const [region, setRegion] = useState('Central'); const [country, setCountry] = useState('UG');
  const [q, setQ] = useState(''); const [editing, setEditing] = useState<number | null>(null); const [draft, setDraft] = useState({ name: '', region: 'Central' });
  const add = useSaver(refetch); const edit = useSaver(() => { setEditing(null); refetch(); });
  const list = useMemo<District[]>(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any)?.items)) return (data as any).items as District[];
    return [];
  }, [data]);
  const rows = useMemo(() => list.filter((d: District) => d.name.toLowerCase().includes(q.toLowerCase())), [list, q]);

  const submit = async (e: FormEvent) => { e.preventDefault(); if (await add.run(() => api('/admin/districts', { body: { name: name.trim(), region, countryCode: country.toUpperCase() } }))) setName(''); };
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return (
    <div>
      <PageTitle title="Districts" sub="Hide a district to remove it from sign-up forms and filters. Existing music keeps its district." />
      <form onSubmit={submit} className="grid gap-3 rounded-card border border-line p-4 sm:grid-cols-[1fr_160px_90px_auto] sm:items-end">
        <Field label="New district"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required /></Field>
        <Field label="Region"><select className={inputCls} value={region} onChange={(e) => setRegion(e.target.value)}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Country"><input className={cx(inputCls, 'uppercase')} value={country} maxLength={2} onChange={(e) => setCountry(e.target.value)} /></Field>
        <Button type="submit" disabled={add.busy}>Add</Button>
        {add.err && <p role="alert" className="text-sm font-medium text-red-500 sm:col-span-4">{add.err}</p>}
      </form>

      <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter districts" placeholder="Filter districts" className={cx(inputCls, 'mt-6 max-w-sm')} />
      <div className="mt-4">
        {!data ? <Skeleton className="h-64" /> : !rows.length ? <EmptyState title="No districts match" /> : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {rows.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                {editing === d.id ? (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input aria-label="District name" className={cx(inputCls, 'min-w-0 flex-1')} value={draft.name} onChange={(e) => setDraft((x) => ({ ...x, name: e.target.value }))} />
                    <select aria-label="Region" className={cx(inputCls, 'w-36')} value={draft.region} onChange={(e) => setDraft((x) => ({ ...x, region: e.target.value }))}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
                    <Button size="sm" disabled={edit.busy} onClick={() => void edit.run(() => api(`/admin/districts/${d.id}`, { method: 'PATCH', body: { name: draft.name.trim(), region: draft.region } }))}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    {edit.err && <p role="alert" className="w-full text-xs font-medium text-red-500">{edit.err}</p>}
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1"><p className="font-medium">{d.name} <span className="text-xs font-normal text-muted">{d.country_code} · {d.region ?? 'No region'}</span></p><p className="text-xs text-muted">{d.artists} artists · {d.songs} live songs</p></div>
                    {!d.is_active && <Badge tone="bad">Hidden</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(d.id); setDraft({ name: d.name, region: d.region ?? 'Other' }); }}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => void edit.run(() => api(`/admin/districts/${d.id}`, { method: 'PATCH', body: { isActive: !d.is_active } }))}>{d.is_active ? 'Hide' : 'Show'}</Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AdminGenres() {
  const { data, error, refetch } = useApi<Genre[]>('/admin/genres');
  const [name, setName] = useState(''); const [editing, setEditing] = useState<number | null>(null); const [draft, setDraft] = useState('');
  const add = useSaver(refetch); const edit = useSaver(() => { setEditing(null); refetch(); });
  const list = useMemo<Genre[]>(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any)?.items)) return (data as any).items as Genre[];
    return [];
  }, [data]);
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return (
    <div>
      <PageTitle title="Genres" sub="Hide a genre to stop new uploads in it. Existing songs keep their genre." />
      <form onSubmit={async (e) => { e.preventDefault(); if (await add.run(() => api('/admin/genres', { body: { name: name.trim() } }))) setName(''); }} className="flex flex-wrap items-end gap-3 rounded-card border border-line p-4">
        <div className="min-w-0 flex-1"><Field label="New genre"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required /></Field></div>
        <Button type="submit" disabled={add.busy}>Add</Button>
        {add.err && <p role="alert" className="w-full text-sm font-medium text-red-500">{add.err}</p>}
      </form>
      <div className="mt-6">
        {!data ? <Skeleton className="h-48" /> : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {list.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                {editing === g.id ? (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input aria-label="Genre name" className={cx(inputCls, 'min-w-0 flex-1')} value={draft} onChange={(e) => setDraft(e.target.value)} />
                    <Button size="sm" disabled={edit.busy} onClick={() => void edit.run(() => api(`/admin/genres/${g.id}`, { method: 'PATCH', body: { name: draft.trim() } }))}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    {edit.err && <p role="alert" className="w-full text-xs font-medium text-red-500">{edit.err}</p>}
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1"><p className="font-medium">{g.name}</p><p className="text-xs text-muted">{g.songs} live songs</p></div>
                    {!g.is_active && <Badge tone="bad">Hidden</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(g.id); setDraft(g.name); }}>Rename</Button>
                    <Button size="sm" variant="outline" onClick={() => void edit.run(() => api(`/admin/genres/${g.id}`, { method: 'PATCH', body: { isActive: !g.is_active } }))}>{g.is_active ? 'Hide' : 'Show'}</Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

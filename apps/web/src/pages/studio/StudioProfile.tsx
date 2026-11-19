import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera } from 'lucide-react';
import { api, ApiError, upload } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import type { Genre } from '../../lib/types';
import { Artwork } from '../../components/Artwork';
import { DistrictSelect } from '../../components/Selects';
import { Button, Field, Spinner, cx, inputCls } from '../../components/ui';
import { useStudio } from './shared';

const SOCIALS = ['instagram', 'youtube', 'tiktok', 'facebook', 'twitter', 'website'] as const;
const httpsify = (v: string) => { const t = v.trim(); return !t ? '' : /^https?:\/\//i.test(t) ? t.replace(/^http:\/\//i, 'https://') : `https://${t}`; };

function Images() {
  const { artist, reload } = useStudio();
  const [busy, setBusy] = useState<'avatar' | 'cover' | null>(null);
  const [error, setError] = useState('');
  const send = async (kind: 'avatar' | 'cover', file?: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError('Images must be JPG, PNG or WebP.');
    if (file.size > 5 * 1024 * 1024) return setError('Images must be 5 MB or smaller.');
    setError(''); setBusy(kind);
    try { const fd = new FormData(); fd.append(kind, file); await upload('/artists/me/images', fd); reload(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'The upload failed. Please try again.'); }
    finally { setBusy(null); }
  };
  const cover = useRef<HTMLInputElement>(null);
  const avatar = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="relative h-36 overflow-hidden rounded-card bg-surface sm:h-48">
        {artist.coverUrl && <img src={artist.coverUrl} alt="Cover" className="h-full w-full object-cover" />}
        <input ref={cover} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { void send('cover', e.target.files?.[0]); e.target.value = ''; }} />
        <Button type="button" variant="outline" size="sm" className="absolute bottom-3 right-3 bg-bg" onClick={() => cover.current?.click()} disabled={busy !== null}>
          {busy === 'cover' ? <Spinner /> : <Camera className="h-4 w-4" />}{artist.coverUrl ? 'Change cover' : 'Add cover'}
        </Button>
      </div>
      <div className="-mt-12 flex items-end gap-4 px-4">
        <div className="relative">
          <Artwork src={artist.avatarUrl} alt={artist.stage_name} round className="h-24 w-24 border-4 border-bg sm:h-28 sm:w-28" />
          <input ref={avatar} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { void send('avatar', e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" aria-label="Change profile picture" onClick={() => avatar.current?.click()} disabled={busy !== null}
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-bg shadow hover:bg-surface">
            {busy === 'avatar' ? <Spinner className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-500">{error}</p>}
      <p className="mt-3 text-xs text-muted">JPG, PNG or WebP up to 5 MB. Cover images look best wide; we crop automatically.</p>
    </div>
  );
}

export default function StudioProfile() {
  const { artist, reload } = useStudio();
  const genres = useApi<Genre[]>('/discover/genres');
  const [f, setF] = useState({ stageName: '', phone: '', districtId: '', town: '', bio: '' });
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [social, setSocial] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setF({ stageName: artist.stage_name, phone: artist.phone, districtId: String(artist.district_id), town: artist.town ?? '', bio: artist.bio ?? '' });
    setGenreIds(artist.genres.map((g) => g.id));
    setSocial(artist.social_links ?? {});
  }, [artist]);

  const nameLocked = artist.approval_status === 'active';
  const toggle = (id: number) => setGenreIds((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length < 5 ? [...g, id] : g));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!genreIds.length) return setMsg({ ok: false, text: 'Pick at least one genre.' });
    setBusy(true); setMsg(null);
    try {
      await api('/artists/me', {
        method: 'PATCH',
        body: {
          ...(!nameLocked && { stageName: f.stageName.trim() }), phone: f.phone.trim(), districtId: Number(f.districtId),
          town: f.town.trim(), bio: f.bio.trim(), genreIds,
          socialLinks: Object.fromEntries(Object.entries(social).map(([k, v]) => [k, httpsify(v)]).filter(([, v]) => v)),
        },
      });
      setMsg({ ok: true, text: 'Profile saved.' });
      reload();
    } catch (err) { setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not save your profile.' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Artist profile</h2>
      <Images />
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stage name" hint={nameLocked ? 'Locked after approval. Contact support to change it.' : undefined}>
            <input className={cx(inputCls, nameLocked && 'opacity-60')} value={f.stageName} disabled={nameLocked} onChange={(e) => setF((x) => ({ ...x, stageName: e.target.value }))} /></Field>
          <Field label="Real name" hint="Private. Contact support to change it."><input className={cx(inputCls, 'opacity-60')} value={artist.real_name} disabled /></Field>
          <Field label="Phone number" hint="Private. Used by our team only."><input type="tel" className={inputCls} value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} /></Field>
          <Field label="District"><DistrictSelect by="id" value={f.districtId} onChange={(v) => setF((x) => ({ ...x, districtId: v }))} emptyLabel="Choose your district" /></Field>
          <Field label="Subcounty or town"><input className={inputCls} value={f.town} onChange={(e) => setF((x) => ({ ...x, town: e.target.value }))} /></Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Genres <span className="font-normal text-muted">(up to 5)</span></legend>
          <div className="flex flex-wrap gap-2">
            {(genres.data ?? []).map((g) => { const on = genreIds.includes(g.id); return (
              <button type="button" key={g.id} aria-pressed={on} onClick={() => toggle(g.id)} className={cx('h-9 rounded-full border px-4 text-sm', on ? 'border-fg bg-fg text-bg' : 'border-line hover:bg-surface')}>{g.name}</button>); })}
          </div>
        </fieldset>

        <Field label="Biography"><textarea rows={5} maxLength={2000} className={cx(inputCls, 'h-auto py-3')} value={f.bio} onChange={(e) => setF((x) => ({ ...x, bio: e.target.value }))} /></Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Social links</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {SOCIALS.map((k) => <input key={k} aria-label={k} placeholder={k === 'website' ? 'Website' : `${k[0].toUpperCase()}${k.slice(1)} link`} className={inputCls} value={social[k] ?? ''} onChange={(e) => setSocial((s) => ({ ...s, [k]: e.target.value }))} />)}
          </div>
        </fieldset>

        {msg && <p role={msg.ok ? 'status' : 'alert'} className={cx('text-sm font-medium', !msg.ok && 'text-red-500')}>{msg.text}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button>
      </form>
    </div>
  );
}

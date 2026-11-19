import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FileAudio, ImagePlus, Loader2, X, XCircle } from 'lucide-react';
import { api, ApiError, upload } from '../../lib/api';
import type { ArtistCardT, Paged } from '../../lib/types';
import { DistrictSelect, GenreSelect } from '../../components/Selects';
import { Button, EmptyState, Field, LinkButton, cx, inputCls } from '../../components/ui';
import { type SongMine, useStudio } from './shared';

const AUDIO_EXT = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'];
const MAX_AUDIO_MB = 150; // keep in sync with MAX_AUDIO_MB on the server
const MAX_ART_MB = 5;
type Errors = Record<string, string>;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function FeaturedPicker({ selected, onChange, selfId }: { selected: ArtistCardT[]; onChange: (a: ArtistCardT[]) => void; selfId: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ArtistCardT[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    let live = true;
    const t = window.setTimeout(() => {
      api<Paged<ArtistCardT>>(`/discover/artists?q=${encodeURIComponent(q.trim())}&limit=6`).then((r) => live && setResults(r.items)).catch(() => undefined);
    }, 300);
    return () => { live = false; window.clearTimeout(t); };
  }, [q]);
  const options = results.filter((r) => r.id !== selfId && !selected.some((s) => s.id === r.id));
  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selected.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-line py-1 pl-3 pr-1 text-sm">{a.stageName}
              <button type="button" aria-label={`Remove ${a.stageName}`} onClick={() => onChange(selected.filter((s) => s.id !== a.id))} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface"><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
      )}
      {selected.length < 5 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for an artist on WaXo" aria-label="Search featured artists" className={inputCls} />}
      {options.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-xl border border-line bg-surface">
          {options.map((a) => (
            <li key={a.id}><button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-bg" onClick={() => { onChange([...selected, a]); setQ(''); setResults([]); }}>
              <span>{a.stageName}</span><span className="text-xs text-muted">{a.district.name}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Processing({ id, onAnother }: { id: string; onAnother: () => void }) {
  const [song, setSong] = useState<SongMine | null>(null);
  useEffect(() => {
    let live = true;
    let timer = 0;
    const tick = async () => {
      try {
        const s = await api<SongMine>(`/songs/mine/${id}`);
        if (!live) return;
        setSong(s);
        if (s.process_status === 'ready' || s.process_status === 'failed') return;
      } catch { /* try again */ }
      timer = window.setTimeout(tick, 3000);
    };
    void tick();
    return () => { live = false; window.clearTimeout(timer); };
  }, [id]);

  const failed = song?.process_status === 'failed';
  const ready = song?.process_status === 'ready';
  const row = (done: boolean, active: boolean, text: string) => (
    <li className="flex items-center gap-3 text-sm">
      {done ? <CheckCircle2 className="h-5 w-5" /> : active ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="h-5 w-5 rounded-full border border-line" />}
      <span className={cx(!done && !active && 'text-muted')}>{text}</span>
    </li>
  );
  return (
    <div className="rounded-card border border-line p-6 sm:p-8">
      <h2 className="text-xl font-semibold">{failed ? 'We could not process this song' : ready ? 'Submitted for review' : 'Processing your song'}</h2>
      <p className="mt-1 text-sm text-muted">{failed ? 'Something went wrong while preparing the audio.' : ready ? 'Our team will review it shortly. You will be notified when it goes live.' : 'You can leave this page. We will notify you when it is ready.'}</p>
      <ul className="mt-6 space-y-3">
        {row(true, false, 'Upload complete')}
        {failed ? <li className="flex items-center gap-3 text-sm text-red-500"><XCircle className="h-5 w-5" />Audio processing failed</li> : row(!!ready, !ready, 'Preparing streaming and download versions')}
        {!failed && row(false, !!ready, 'Waiting for moderator review')}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onAnother}>Upload another song</Button>
        <LinkButton to={`/studio/songs/${id}`} variant="outline">{failed ? 'Retry from song page' : 'View song'}</LinkButton>
      </div>
    </div>
  );
}

export default function StudioUpload() {
  const { artist } = useStudio();
  const [phase, setPhase] = useState<'form' | 'uploading' | 'processing'>('form');
  const [songId, setSongId] = useState('');
  const [pct, setPct] = useState(0);
  const [f, setF] = useState({ title: '', description: '', genreId: '', districtId: String(artist.district_id), downloads: false, when: 'now' as 'now' | 'schedule', scheduledAt: '', own: false });
  const [featured, setFeatured] = useState<ArtistCardT[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [art, setArt] = useState<File | null>(null);
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [drag, setDrag] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!art) { setArtUrl(null); return; } const u = URL.createObjectURL(art); setArtUrl(u); return () => URL.revokeObjectURL(u); }, [art]);

  if (artist.approval_status !== 'active') {
    return <EmptyState title="Uploads are locked" text="You can upload music as soon as our team approves your artist profile." action={<LinkButton to="/studio/profile" variant="outline">Review my profile</LinkButton>} />;
  }
  if (phase === 'processing') return <Processing id={songId} onAnother={() => { setPhase('form'); setAudio(null); setArt(null); setF((s) => ({ ...s, title: '', description: '', own: false })); setFeatured([]); }} />;

  const pickAudio = (file?: File | null) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!AUDIO_EXT.includes(ext)) return setErrors((e) => ({ ...e, audio: `Unsupported file. Use ${AUDIO_EXT.join(', ').toUpperCase()}.` }));
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) return setErrors((e) => ({ ...e, audio: `This file is ${mb(file.size)}. The limit is ${MAX_AUDIO_MB} MB.` }));
    setErrors(({ audio: _a, ...rest }) => rest);
    setAudio(file);
    if (!f.title) setF((s) => ({ ...s, title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() }));
  };
  const pickArt = (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setErrors((e) => ({ ...e, art: 'Artwork must be a JPG, PNG or WebP image.' }));
    if (file.size > MAX_ART_MB * 1024 * 1024) return setErrors((e) => ({ ...e, art: `Artwork must be ${MAX_ART_MB} MB or smaller.` }));
    setErrors(({ art: _a, ...rest }) => rest);
    setArt(file);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pickAudio(e.dataTransfer.files[0]); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Errors = {};
    if (!audio) er.audio = 'Choose an audio file to upload.';
    if (!f.title.trim()) er.title = 'Enter a song title.';
    if (!f.genreId) er.genreId = 'Choose a genre.';
    if (f.when === 'schedule' && (!f.scheduledAt || new Date(f.scheduledAt).getTime() <= Date.now())) er.scheduledAt = 'Pick a date and time in the future.';
    if (!f.own) er.own = 'You must confirm you have the rights to this music.';
    setErrors((prev) => ({ ...(prev.art ? { art: prev.art } : {}), ...er }));
    if (Object.keys(er).length) return;

    const fd = new FormData();
    fd.append('title', f.title.trim());
    if (f.description.trim()) fd.append('description', f.description.trim());
    fd.append('genreId', f.genreId);
    fd.append('districtId', f.districtId);
    fd.append('downloadsEnabled', String(f.downloads));
    if (f.when === 'schedule') fd.append('releaseAt', new Date(f.scheduledAt).toISOString());
    featured.forEach((a) => fd.append('featuredArtistIds', a.id));
    fd.append('confirmOwnership', 'true');
    fd.append('audio', audio!);
    if (art) fd.append('artwork', art);

    setFormError(''); setPct(0); setPhase('uploading');
    try {
      const r = await upload<{ id: string }>('/songs', fd, setPct);
      setSongId(r.id); setPhase('processing');
    } catch (err) {
      setPhase('form');
      setFormError(err instanceof ApiError ? err.message : 'The upload failed. Please try again.');
    }
  };

  const uploading = phase === 'uploading';
  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Upload music</h2>
        <p className="mt-1 text-sm text-muted">After processing, your song goes to our team for review before it is published.</p>
      </div>

      <div>
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
          className={cx('rounded-card border-2 border-dashed p-6 text-center transition-colors sm:p-10', drag ? 'border-fg bg-surface' : 'border-line')}>
          <input ref={audioInput} type="file" hidden accept={AUDIO_EXT.map((x) => `.${x}`).join(',')} onChange={(e) => pickAudio(e.target.files?.[0])} />
          {audio ? (
            <div className="flex items-center justify-center gap-3 text-left">
              <FileAudio className="h-8 w-8 shrink-0" />
              <div className="min-w-0"><p className="truncate font-medium">{audio.name}</p><p className="text-sm text-muted">{mb(audio.size)}</p></div>
              {!uploading && <button type="button" onClick={() => setAudio(null)} aria-label="Remove audio file" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-surface"><X className="h-4 w-4" /></button>}
            </div>
          ) : (
            <>
              <FileAudio className="mx-auto h-10 w-10 text-muted" />
              <p className="mt-3 font-medium">Drag your song here</p>
              <p className="mt-1 text-sm text-muted">MP3, WAV, FLAC, OGG, M4A or AAC · up to {MAX_AUDIO_MB} MB</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => audioInput.current?.click()}>Choose file</Button>
            </>
          )}
        </div>
        {errors.audio && <p role="alert" className="mt-1.5 text-xs font-medium text-red-500">{errors.audio}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <div>
          <span className="mb-1.5 block text-sm font-medium">Artwork</span>
          <label className="group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-card border border-dashed border-line bg-surface hover:border-fg transition-colors">
            <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => pickArt(e.target.files?.[0])} />
            {artUrl ? (
              <img src={artUrl} alt="Artwork preview" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 p-3 text-center text-sm text-muted">
                <ImagePlus className="h-7 w-7" />
                <span className="font-medium text-fg">Add artwork</span>
                <span className="text-[11px] text-muted">1000 × 1000 px</span>
              </span>
            )}
          </label>
          <p className="mt-1.5 text-xs text-muted">
            Square (1:1) works best. Recommended: <strong className="font-semibold text-fg">1000 × 1000 px</strong> (minimum 500 × 500 px, up to 3000 × 3000 px). JPG, PNG or WebP, up to {MAX_ART_MB} MB.
          </p>
          {art && <button type="button" className="mt-1 text-xs text-muted underline hover:text-fg" onClick={() => setArt(null)}>Remove</button>}
          {errors.art && <p role="alert" className="mt-1 text-xs font-medium text-red-500">{errors.art}</p>}
        </div>

        <div className="space-y-4">
          <Field label="Song title" error={errors.title}><input className={inputCls} value={f.title} maxLength={120} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></Field>
          <Field label="Description (optional)"><textarea rows={3} className={cx(inputCls, 'h-auto py-3')} maxLength={2000} value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Genre" error={errors.genreId}><GenreSelect by="id" value={f.genreId} emptyLabel="Choose a genre" onChange={(v) => setF((s) => ({ ...s, genreId: v }))} /></Field>
            <Field label="District"><DistrictSelect by="id" value={f.districtId} emptyLabel="Choose a district" onChange={(v) => setF((s) => ({ ...s, districtId: v }))} /></Field>
          </div>
          <div><span className="mb-1.5 block text-sm font-medium">Featured artists (optional)</span><FeaturedPicker selected={featured} onChange={setFeatured} selfId={artist.id} /></div>
        </div>
      </div>

      <fieldset className="grid gap-6 sm:grid-cols-2">
        <div>
          <legend className="mb-2 text-sm font-medium">Downloads</legend>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-current" checked={f.downloads} onChange={(e) => setF((s) => ({ ...s, downloads: e.target.checked }))} />
            <span>Allow listeners to download this song<span className="block text-xs text-muted">You can change this at any time.</span></span></label>
        </div>
        <div>
          <legend className="mb-2 text-sm font-medium">Release</legend>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-3"><input type="radio" name="when" className="h-4 w-4 accent-current" checked={f.when === 'now'} onChange={() => setF((s) => ({ ...s, when: 'now' }))} />Publish as soon as it is approved</label>
            <label className="flex items-center gap-3"><input type="radio" name="when" className="h-4 w-4 accent-current" checked={f.when === 'schedule'} onChange={() => setF((s) => ({ ...s, when: 'schedule' }))} />Schedule a release date</label>
            {f.when === 'schedule' && <div><input type="datetime-local" aria-label="Release date and time" className={inputCls} value={f.scheduledAt} onChange={(e) => setF((s) => ({ ...s, scheduledAt: e.target.value }))} />{errors.scheduledAt && <p role="alert" className="mt-1 text-xs font-medium text-red-500">{errors.scheduledAt}</p>}</div>}
          </div>
        </div>
      </fieldset>

      <div>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-current" checked={f.own} onChange={(e) => setF((s) => ({ ...s, own: e.target.checked }))} />
          <span>I confirm that I own, or have permission to distribute, this music. I understand it may be removed after a copyright complaint.</span></label>
        {errors.own && <p role="alert" className="mt-1 text-xs font-medium text-red-500">{errors.own}</p>}
      </div>

      {formError && <p role="alert" className="rounded-xl border border-red-500 p-3 text-sm font-medium text-red-500">{formError}</p>}

      {uploading ? (
        <div role="status" aria-live="polite">
          <div className="mb-2 flex justify-between text-sm"><span>{pct < 100 ? 'Uploading…' : 'Checking your file…'}</span><span className="tabular-nums">{pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-fg transition-[width]" style={{ width: `${pct}%` }} /></div>
          <p className="mt-2 text-xs text-muted">Keep this page open until the upload finishes.</p>
        </div>
      ) : <Button type="submit" size="lg" className="w-full sm:w-auto">Upload and submit for review</Button>}
      <p className="text-xs text-muted">Need to change something later? Open the song from <Link to="/studio/songs" className="underline">My Songs</Link>.</p>
    </form>
  );
}

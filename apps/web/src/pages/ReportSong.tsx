import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { Button, ErrorState, Field, Page, Skeleton, cx, inputCls } from '../components/ui';

const REASONS: [string, string][] = [['inappropriate', 'Inappropriate or explicit content'], ['hate_or_abuse', 'Hate speech or abuse'], ['spam', 'Spam or fake upload'], ['misleading', 'Misleading title or artwork'], ['other', 'Something else']];

export default function ReportSong() {
  const { id = '' } = useParams();
  const { me } = useAuth();
  const { data: song, error, refetch } = useApi<{ title: string; artist_name: string }>(`/songs/${id}`);
  const [kind, setKind] = useState<'content' | 'copyright'>('content');
  const [reason, setReason] = useState('inappropriate');
  const [details, setDetails] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(me?.email ?? '');
  const [claim, setClaim] = useState('');
  const [evidence, setEvidence] = useState('');
  const [good, setGood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (kind === 'copyright') {
      if (name.trim().length < 2) return setErr('Enter your full name.');
      if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.');
      if (claim.trim().length < 20) return setErr('Describe your claim in at least 20 characters.');
      if (!good) return setErr('Please confirm the statement to submit your complaint.');
    }
    const urls = evidence.split(/\s+/).map((u) => u.trim()).filter(Boolean);
    setBusy(true);
    try {
      const r = kind === 'content'
        ? await api<{ message: string }>('/reports/music', { body: { songId: id, reason, details: details.trim() || undefined } })
        : await api<{ message: string }>('/reports/copyright', { body: { songId: id, reporterName: name.trim(), reporterEmail: email.trim(), claimDetails: claim.trim(), evidenceUrls: urls.length ? urls : undefined, goodFaithStatement: true } });
      setDone(r.message);
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };

  if (error) return <Page className="max-w-xl py-12"><ErrorState message={error} onRetry={refetch} /></Page>;
  if (!song) return <Page className="max-w-xl py-12"><Skeleton className="h-64" /></Page>;
  if (done) return (
    <Page className="max-w-xl py-16 text-center"><CheckCircle2 className="mx-auto h-12 w-12" /><h1 className="mt-4 text-2xl font-bold">Report received</h1><p className="mt-2 text-muted">{done}</p>
      <Link to={`/songs/${id}`} className="mt-6 inline-block underline">Back to the song</Link></Page>
  );
  return (
    <Page className="max-w-xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight">Report a song</h1>
      <p className="mt-2 text-muted">“{song.title}” by {song.artist_name}</p>

      <div role="tablist" className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
        {([['content', 'Inappropriate content'], ['copyright', 'Copyright complaint']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setErr(''); }} className={cx('h-10 rounded-lg text-sm font-medium', kind === k ? 'bg-bg shadow-sm' : 'text-muted hover:text-fg')}>{l}</button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        {kind === 'content' ? (
          <>
            <fieldset><legend className="mb-2 text-sm font-medium">What is the problem?</legend>
              <div className="space-y-2">{REASONS.map(([k, l]) => <label key={k} className="flex items-center gap-3 text-sm"><input type="radio" name="reason" className="h-4 w-4 accent-current" checked={reason === k} onChange={() => setReason(k)} />{l}</label>)}</div></fieldset>
            <Field label="More details (optional)"><textarea rows={4} maxLength={1000} className={cx(inputCls, 'h-auto py-3')} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
          </>
        ) : (
          <>
            <p className="rounded-xl bg-surface p-3 text-xs text-muted">Use this form if you own the rights to this music and it was uploaded without permission. Our team reviews each complaint and may remove the song.</p>
            <Field label="Your full name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
            <Field label="Your email" hint="We will contact you about the outcome."><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
            <Field label="Describe your claim" hint="What work is it, and how do you hold the rights?"><textarea rows={5} maxLength={3000} className={cx(inputCls, 'h-auto py-3')} value={claim} onChange={(e) => setClaim(e.target.value)} /></Field>
            <Field label="Links to evidence (optional)" hint="One https link per line, up to 5."><textarea rows={3} className={cx(inputCls, 'h-auto py-3')} value={evidence} onChange={(e) => setEvidence(e.target.value)} /></Field>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-current" checked={good} onChange={(e) => setGood(e.target.checked)} />
              <span>I state in good faith that the information above is accurate and that I am the rights holder or authorised to act for them.</span></label>
          </>
        )}
        {err && <p role="alert" className="text-sm font-medium text-red-500">{err}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</Button>
      </form>
    </Page>
  );
}

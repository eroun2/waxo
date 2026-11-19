import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail, MailCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import type { Genre } from '../lib/types';
import { DistrictSelect } from '../components/Selects';
import { Button, Field, Page, Spinner, cx, inputCls } from '../components/ui';
import { Logo } from '../components/Layout';
import { GoogleAuthButton } from '../components/GoogleAuthButton';

type Errors = Record<string, string>;
const SOCIALS = ['instagram', 'youtube', 'tiktok', 'facebook', 'twitter', 'website'] as const;
const httpsify = (v: string) => { const t = v.trim(); return !t ? '' : /^https?:\/\//i.test(t) ? t.replace(/^http:\/\//i, 'https://') : `https://${t}`; };

function validateCommon(f: { email: string; password: string }, e: Errors) {
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email address.';
  if (f.password.length < 10) e.password = 'Use at least 10 characters.';
  else if (f.password.length > 72) e.password = 'Use 72 characters or fewer.';
}

function VerificationCodeStep({ email, as, initialCode }: { email: string; as: 'listener' | 'artist'; initialCode?: string }) {
  const [code, setCode] = useState(initialCode || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [currentCode, setCurrentCode] = useState(initialCode || '');
  const nav = useNavigate();

  const handleVerify = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const clean = code.trim().replace(/\D/g, '');
    if (clean.length < 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/auth/verify-email', { body: { code: clean, email } });
      setVerified(true);
      setTimeout(() => {
        nav(`/login?email=${encodeURIComponent(email)}&verified=1`, { replace: true });
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const res = await api<{ code?: string }>('/auth/resend-verification', { body: { email } });
      if (res?.code) setCurrentCode(res.code);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch {
      setError('Could not resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center animate-in fade-in duration-200">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-fg">Email Verified!</h2>
        <p className="mt-2 text-sm text-muted">
          Your account has been activated. {as === 'artist' ? 'An administrator will review your profile shortly.' : 'Redirecting you to log in…'}
        </p>
        <div className="mt-6">
          <Link to={`/login?email=${encodeURIComponent(email)}`} className="text-sm font-semibold text-emerald-400 underline">
            Click here if you are not redirected
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface/50 p-6 sm:p-8 text-center shadow-sm animate-in fade-in duration-200">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400 border border-violet-500/20">
        <Mail className="h-6 w-6" />
      </div>

      <h2 className="mt-4 text-2xl font-bold tracking-tight">Enter Verification Code</h2>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto">
        We sent a 6-digit verification code to <strong className="text-fg break-all">{email}</strong>. Enter the code below to activate your account.
      </p>

      <form onSubmit={handleVerify} className="mt-6 max-w-xs mx-auto space-y-4">
        <div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            required
            placeholder="······"
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(val);
              setError('');
              if (val.length === 6) {
                setTimeout(() => { void handleVerify(); }, 50);
              }
            }}
            className="h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-center font-mono text-3xl font-bold tracking-[0.35em] text-fg focus:border-violet-500 focus:outline-none transition-all shadow-inner"
          />
        </div>

        {currentCode && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5 text-xs text-left flex items-center justify-between gap-2">
            <span className="text-muted">Code: <strong className="text-fg font-mono text-sm tracking-wider">{currentCode}</strong></span>
            <button
              type="button"
              onClick={() => { setCode(currentCode); setError(''); }}
              className="text-xs font-semibold text-violet-400 hover:text-violet-300 underline"
            >
              Auto-fill code
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs font-semibold text-red-500 animate-in fade-in">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full font-bold" disabled={busy || code.trim().length < 6}>
          {busy ? <Spinner className="h-5 w-5" /> : 'Verify & Activate Account'}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2.5 pt-4 border-t border-line/60">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resent}
          className="text-xs font-medium text-muted hover:text-fg disabled:opacity-60 transition-colors"
        >
          {resending ? 'Sending new code…' : resent ? '✓ New code sent! Check your inbox' : "Didn't receive code? Send again"}
        </button>

        <Link to={`/login?email=${encodeURIComponent(email)}`} className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors">
          Already verified? Go to log in
        </Link>
      </div>
    </div>
  );
}

function useSubmit(onDone: (email: string, code?: string) => void) {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const run = async (path: string, body: unknown, email: string) => {
    setBusy(true); setFormError('');
    try {
      const res = await api<{ code?: string }>(path, { body });
      onDone(email, res?.code);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, formError, run };
}

function ListenerForm({ onDone }: { onDone: (email: string, code?: string) => void }) {
  const [f, setF] = useState({ displayName: '', email: '', password: '', districtId: '' });
  const [errors, setErrors] = useState<Errors>({});
  const { busy, formError, run } = useSubmit(onDone);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: Errors = {};
    if (f.displayName.trim().length < 2) er.displayName = 'Enter your name (at least 2 characters).';
    validateCommon(f, er);
    setErrors(er);
    if (Object.keys(er).length) return;
    void run('/auth/register/listener', { email: f.email.trim(), password: f.password, displayName: f.displayName.trim(), districtId: f.districtId ? Number(f.districtId) : undefined }, f.email.trim());
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Your name" error={errors.displayName}><input className={inputCls} value={f.displayName} onChange={set('displayName')} autoComplete="name" /></Field>
      <Field label="Email" error={errors.email}><input type="email" className={inputCls} value={f.email} onChange={set('email')} autoComplete="email" /></Field>
      <Field label="Password" error={errors.password} hint="At least 10 characters."><input type="password" className={inputCls} value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
      <Field label="Your district (optional)" hint="Helps us show you music from home."><DistrictSelect by="id" value={f.districtId} onChange={(v) => setF((s) => ({ ...s, districtId: v }))} emptyLabel="Choose a district" /></Field>
      {formError && <p role="alert" className="text-sm font-medium text-red-500">{formError}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create listener account'}</Button>
    </form>
  );
}

function ArtistForm({ onDone }: { onDone: (email: string, code?: string) => void }) {
  const genres = useApi<Genre[]>('/discover/genres');
  const [f, setF] = useState({ stageName: '', realName: '', email: '', phone: '', password: '', districtId: '', town: '', bio: '', own: false });
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [social, setSocial] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Errors>({});
  const { busy, formError, run } = useSubmit(onDone);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const toggleGenre = (id: number) => setGenreIds((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length < 5 ? [...g, id] : g));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: Errors = {};
    if (f.stageName.trim().length < 2) er.stageName = 'Enter your stage name.';
    if (f.realName.trim().length < 2) er.realName = 'Enter your real name.';
    if (!/^\+?[0-9 ()-]{7,20}$/.test(f.phone.trim())) er.phone = 'Enter a valid phone number.';
    if (!f.districtId) er.districtId = 'Choose your district.';
    if (!genreIds.length) er.genres = 'Pick at least one genre.';
    if (f.bio.length > 2000) er.bio = 'Keep your bio under 2000 characters.';
    if (!f.own) er.own = 'You must confirm this before registering.';
    validateCommon(f, er);
    setErrors(er);
    if (Object.keys(er).length) { document.querySelector('[role=alert]')?.scrollIntoView({ block: 'center' }); return; }
    const socialLinks = Object.fromEntries(Object.entries(social).map(([k, v]) => [k, httpsify(v)]).filter(([, v]) => v));
    void run('/auth/register/artist', {
      email: f.email.trim(), password: f.password, stageName: f.stageName.trim(), realName: f.realName.trim(), phone: f.phone.trim(),
      districtId: Number(f.districtId), town: f.town.trim() || undefined, bio: f.bio.trim() || undefined, genreIds, socialLinks, confirmOwnership: true,
    }, f.email.trim());
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Stage name" error={errors.stageName}><input className={inputCls} value={f.stageName} onChange={set('stageName')} /></Field>
        <Field label="Real name" error={errors.realName} hint="Private. Never shown publicly."><input className={inputCls} value={f.realName} onChange={set('realName')} autoComplete="name" /></Field>
        <Field label="Email" error={errors.email}><input type="email" className={inputCls} value={f.email} onChange={set('email')} autoComplete="email" /></Field>
        <Field label="Phone number" error={errors.phone} hint="Private. Used by our team only."><input type="tel" className={inputCls} value={f.phone} onChange={set('phone')} autoComplete="tel" /></Field>
        <Field label="District" error={errors.districtId}><DistrictSelect by="id" value={f.districtId} onChange={(v) => setF((s) => ({ ...s, districtId: v }))} emptyLabel="Choose your district" /></Field>
        <Field label="Subcounty or town (optional)"><input className={inputCls} value={f.town} onChange={set('town')} /></Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Music genres <span className="font-normal text-muted">(up to 5)</span></legend>
        <div className="flex flex-wrap gap-2">
          {(genres.data ?? []).map((g) => {
            const on = genreIds.includes(g.id);
            return <button type="button" key={g.id} aria-pressed={on} onClick={() => toggleGenre(g.id)} className={cx('h-9 rounded-full border px-4 text-sm transition-colors', on ? 'border-fg bg-fg text-bg' : 'border-line hover:bg-surface')}>{g.name}</button>;
          })}
        </div>
        {errors.genres && <p role="alert" className="mt-1 text-xs font-medium text-red-500">{errors.genres}</p>}
      </fieldset>

      <Field label="Artist biography (optional)" error={errors.bio}><textarea rows={4} className={cx(inputCls, 'h-auto py-3')} value={f.bio} onChange={set('bio')} maxLength={2000} /></Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Social links (optional)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIALS.map((k) => <input key={k} aria-label={k} placeholder={k === 'website' ? 'Website' : `${k[0].toUpperCase()}${k.slice(1)} link`} className={inputCls} value={social[k] ?? ''} onChange={(e) => setSocial((s) => ({ ...s, [k]: e.target.value }))} />)}
        </div>
      </fieldset>

      <Field label="Password" error={errors.password} hint="At least 10 characters."><input type="password" className={inputCls} value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-current" checked={f.own} onChange={(e) => setF((s) => ({ ...s, own: e.target.checked }))} />
          <span>I confirm that I own, or have permission to distribute, all music I upload to WaXo.</span>
        </label>
        {errors.own && <p role="alert" className="mt-1 text-xs font-medium text-red-500">{errors.own}</p>}
      </div>

      {formError && <p role="alert" className="text-sm font-medium text-red-500">{formError}</p>}
      <p className="text-xs text-muted">New artist profiles are reviewed by our team before they go live. You'll be notified by email.</p>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Creating profile…' : 'Create artist account'}</Button>
    </form>
  );
}

export default function Join() {
  const [sp, setSp] = useSearchParams();
  const { status } = useAuth();
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const [doneCode, setDoneCode] = useState<string | undefined>(undefined);
  const as = sp.get('as') === 'artist' ? 'artist' : 'listener';
  if (status === 'authed') return <Navigate to="/account" replace />;
  return (
    <Page className="max-w-2xl py-10 sm:py-14">
      <div className="flex justify-center mb-8 w-full">
        <Logo imgClassName="h-16 sm:h-20 w-auto" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Join WaXo</h1>
        <p className="mt-2 text-muted">Free for listeners and artists.</p>
      </div>
      {doneEmail ? <div className="mt-8"><VerificationCodeStep email={doneEmail} as={as} initialCode={doneCode} /></div> : (
        <>
          <div role="tablist" className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
            {(['listener', 'artist'] as const).map((k) => (
              <button key={k} role="tab" aria-selected={as === k} onClick={() => setSp(k === 'artist' ? { as: 'artist' } : {}, { replace: true })}
                className={cx('h-10 rounded-lg text-sm font-medium transition-colors', as === k ? 'bg-bg shadow-sm' : 'text-muted hover:text-fg')}>{k === 'listener' ? "I'm a listener" : "I'm an artist"}</button>
            ))}
          </div>

          {/* Quick Google Sign Up */}
          <div className="mt-6">
            <GoogleAuthButton mode="signup" role={as} />
            <div className="relative my-6 text-center text-xs text-muted">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line" /></div>
              <span className="relative bg-bg px-3 font-semibold uppercase tracking-wider">Or register with email</span>
            </div>
          </div>

          <div>{as === 'artist' ? <ArtistForm onDone={setDoneEmail} /> : <ListenerForm onDone={setDoneEmail} />}</div>
          <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link to="/login" className="font-medium text-fg underline">Log in</Link></p>
        </>
      )}
    </Page>
  );
}

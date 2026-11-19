import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Mail, MailCheck, Shield } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Me } from '../lib/types';
import { Button, Field, Page, inputCls } from '../components/ui';
import { Logo } from '../components/Layout';
import { GoogleAuthButton } from '../components/GoogleAuthButton';

export const getPortalRedirect = (m: Me, next?: string | null): string => {
  if (m.role === 'artist') {
    // If next explicitly belongs to studio, respect it; otherwise always send to artist studio portal
    return next && next.startsWith('/studio') ? next : '/studio';
  }
  if (m.role === 'admin' || m.role === 'moderator') {
    return next && next.startsWith('/admin') ? next : '/admin';
  }
  // Listener portal / account settings
  return next && !next.startsWith('/studio') && !next.startsWith('/admin') ? next : '/account';
};

export const homeFor = (m: Me) => getPortalRedirect(m);

export default function Login() {
  const { login, status, me } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const [email, setEmail] = useState(() => sp.get('email') || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  const handleVerifyCode = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const clean = verificationCode.trim().replace(/\D/g, '');
    if (clean.length < 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }
    setVerifying(true);
    try {
      await api('/auth/verify-email', { body: { code: clean, email: email.trim() } });
      setVerifiedSuccess(true);
      setUnverified(false);
      setError('');
      const m = await login(email.trim(), password || 'Password123!');
      nav(getPortalRedirect(m, safeNext), { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setVerifying(false);
    }
  };

  if (status === 'authed') return <Navigate to={safeNext ? getPortalRedirect(me!, safeNext) : (me ? homeFor(me) : '/account')} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setUnverified(false); setVerifiedSuccess(false);
    try {
      const m = await login(email.trim(), password);
      nav(getPortalRedirect(m, safeNext), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setUnverified(err.code === 'EMAIL_NOT_VERIFIED');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api('/auth/resend-verification', { body: { email: email.trim() } });
      setResent(true);
    } catch {
      setError('Could not resend email. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  const handleInstantVerify = async () => {
    setVerifying(true);
    try {
      await api('/auth/verify-email', { body: { email: email.trim() } });
      setVerifiedSuccess(true);
      setUnverified(false);
      setError('');
      // Automatically complete login and redirect to portal
      const m = await login(email.trim(), password || 'Password123!');
      nav(getPortalRedirect(m, safeNext), { replace: true });
    } catch {
      setError('Instant verification failed. Please try resending the link.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Page className="max-w-md py-12 sm:py-20">
      <div className="flex justify-center mb-8 w-full">
        <Logo imgClassName="h-16 sm:h-20 w-auto" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-muted">Log in to your WaXo account.</p>
      </div>

      {/* Verification Status Badge / Alert Box */}
      {unverified && (
        <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-left shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-500/20 p-2 text-amber-500 shrink-0 mt-0.5">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Account Unverified
                </span>
              </div>
              <h3 className="mt-2 text-base font-bold text-fg">Verification Required</h3>
              <p className="mt-1 text-sm text-muted">
                Your email <strong className="text-fg break-all">{email}</strong> has not been verified yet. Enter the 6-digit verification code sent to your inbox:
              </p>

              <form onSubmit={handleVerifyCode} className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={verificationCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerificationCode(val);
                    setError('');
                  }}
                  className="h-9 w-36 rounded-lg border border-amber-500/40 bg-surface px-3 text-center font-mono text-sm font-bold tracking-widest text-fg focus:outline-none focus:border-amber-500"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={verifying || verificationCode.length < 6}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white border-none shadow-xs font-semibold"
                >
                  {verifying ? 'Verifying…' : 'Submit Code'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={resending || resent}
                  onClick={handleResend}
                  className="text-xs font-medium"
                >
                  {resending ? 'Sending…' : resent ? (
                    <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                      <MailCheck className="h-3.5 w-3.5" /> Code Sent
                    </span>
                  ) : (
                    'Resend code'
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={verifying}
                  onClick={handleInstantVerify}
                  className="text-xs text-muted hover:text-fg underline ml-auto"
                >
                  Instant verify (demo)
                </Button>
              </form>

              {resent && (
                <p className="mt-2.5 text-xs text-emerald-500 font-medium">
                  ✓ A new 6-digit verification code was dispatched to {email}. Check your inbox.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {verifiedSuccess && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            Account verified successfully! Redirecting to your portal…
          </p>
        </div>
      )}

      {/* Google Authentication */}
      <div className="mt-6">
        <GoogleAuthButton mode="signin" />
        <div className="relative my-6 text-center text-xs text-muted">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line" /></div>
          <span className="relative bg-bg px-3 font-semibold uppercase tracking-wider">Or continue with email</span>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            required
            className={inputCls}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setUnverified(false); }}
            autoComplete="email"
          />
        </Field>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && !unverified && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-left flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New to WaXo? <Link to="/join" className="font-medium text-fg underline">Create an account</Link>
      </p>
    </Page>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { Button, LinkButton, Page, Spinner } from '../components/ui';
import { Logo } from '../components/Layout';

export default function VerifyEmail() {
  const [sp] = useSearchParams();
  const initialCode = sp.get('code') || sp.get('token') || '';
  const initialEmail = sp.get('email') || '';

  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<'idle' | 'working' | 'ok' | 'fail'>(initialCode ? 'working' : 'idle');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const ran = useRef(false);

  const executeVerify = async (codeToSubmit: string, emailToSubmit?: string) => {
    setState('working');
    try {
      const r = await api<{ message: string }>('/auth/verify-email', {
        body: { code: codeToSubmit, email: emailToSubmit || undefined },
      });
      setMessage(r.message || 'Email verified successfully! You can now log in.');
      setState('ok');
    } catch (e: any) {
      setMessage(e.message || 'Invalid or expired verification code.');
      setState('fail');
    }
  };

  useEffect(() => {
    if (!initialCode || ran.current) return;
    ran.current = true;
    void executeVerify(initialCode, initialEmail);
  }, [initialCode, initialEmail]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) return;
    void executeVerify(code.trim(), email.trim() || undefined);
  };

  const handleResend = async () => {
    if (!email.trim()) return;
    setResending(true);
    try {
      await api('/auth/resend-verification', { body: { email: email.trim() } });
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch {
      // ignore
    } finally {
      setResending(false);
    }
  };

  return (
    <Page className="max-w-md py-16 sm:py-20 text-center">
      <div className="flex justify-center mb-8">
        <Logo imgClassName="h-16 sm:h-20 w-auto" />
      </div>

      {state === 'working' && (
        <div className="animate-in fade-in duration-200">
          <Spinner className="mx-auto h-8 w-8" />
          <p className="mt-4 text-muted">Verifying your code…</p>
        </div>
      )}

      {state === 'ok' && (
        <div className="animate-in fade-in duration-200">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold">Email Verified</h1>
          <p className="mt-2 text-muted">{message}</p>
          <div className="mt-6 flex justify-center">
            <LinkButton to={`/login${email ? `?email=${encodeURIComponent(email)}` : ''}`}>
              Log in to your account
            </LinkButton>
          </div>
        </div>
      )}

      {(state === 'idle' || state === 'fail') && (
        <div className="rounded-2xl border border-line bg-surface/40 p-6 sm:p-8 text-center shadow-sm animate-in fade-in duration-200">
          {state === 'fail' ? (
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
          ) : (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400 border border-violet-500/20">
              <Mail className="h-6 w-6" />
            </div>
          )}

          <h1 className="mt-4 text-2xl font-bold">Enter Verification Code</h1>
          <p className="mt-2 text-sm text-muted">
            {state === 'fail'
              ? message
              : 'Enter the 6-digit verification code sent to your email to activate your account.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!initialEmail && (
              <input
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-fg focus:outline-none focus:border-fg"
              />
            )}

            <div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                placeholder="······"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-center font-mono text-3xl font-bold tracking-[0.35em] text-fg focus:border-violet-500 focus:outline-none transition-all shadow-inner"
              />
            </div>

            <Button type="submit" size="lg" className="w-full font-bold" disabled={code.trim().length < 6}>
              Verify Code
            </Button>
          </form>

          {email && (
            <div className="mt-5 pt-4 border-t border-line/60">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || resent}
                className="text-xs font-medium text-muted hover:text-fg disabled:opacity-60 transition-colors"
              >
                {resending ? 'Sending new code…' : resent ? '✓ New code sent to your email' : "Didn't receive code? Send again"}
              </button>
            </div>
          )}

          <div className="mt-4">
            <LinkButton to="/login" variant="outline" size="sm">
              Back to log in
            </LinkButton>
          </div>
        </div>
      )}
    </Page>
  );
}

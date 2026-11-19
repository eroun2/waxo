import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Button, Field, LinkButton, Page, inputCls } from '../components/ui';
import { Logo } from '../components/Layout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/forgot-password', {
        body: { email: email.trim() },
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page className="max-w-md py-12 sm:py-20">
      <div className="flex justify-center mb-8 w-full">
        <Logo imgClassName="h-16 sm:h-20 w-auto" />
      </div>

      {!sent ? (
        <div>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight">Forgot password?</h1>
            <p className="mt-2 text-sm text-muted">
              Enter your account's email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email Address">
              <input
                type="email"
                required
                className={inputCls}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </Field>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-left flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Sending reset link…' : 'Send password reset link'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to log in
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 mb-4">
            <Mail className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            If an account exists for <strong className="text-fg">{email}</strong>, we have dispatched a password reset link.
          </p>

          <div className="mt-5 rounded-2xl border border-line bg-surface/50 p-4 text-xs text-muted text-left space-y-2">
            <p className="flex items-center gap-2 text-fg font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              The link expires in 1 hour.
            </p>
            <p className="pl-6">
              Be sure to check your spam or junk folder if you don't see it within a couple of minutes.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <LinkButton to="/login" size="lg">
              Return to log in
            </LinkButton>
            <button
              type="button"
              onClick={() => { setSent(false); }}
              className="text-xs text-muted hover:text-fg transition-colors pt-2"
            >
              Didn't receive it? Try a different email
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}

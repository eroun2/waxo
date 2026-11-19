import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Button, Field, LinkButton, Page, inputCls } from '../components/ui';
import { Logo } from '../components/Layout';

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const token = sp.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing reset token. Please request a new reset link.');
      return;
    }
    if (newPassword.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await api('/auth/reset-password', {
        body: { token, newPassword },
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to reset password. The link may have expired or already been used.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Page className="max-w-md py-16 sm:py-20 text-center">
        <div className="flex justify-center mb-8">
          <Logo imgClassName="h-16 sm:h-20 w-auto" />
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-500 mb-4">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">Invalid Reset Link</h1>
        <p className="mt-2 text-sm text-muted">
          This password reset link is incomplete or missing a security token.
        </p>
        <div className="mt-6 flex justify-center">
          <LinkButton to="/forgot-password">Request a new link</LinkButton>
        </div>
      </Page>
    );
  }

  return (
    <Page className="max-w-md py-12 sm:py-20">
      <div className="flex justify-center mb-8 w-full">
        <Logo imgClassName="h-16 sm:h-20 w-auto" />
      </div>

      {!success ? (
        <div>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight">Set new password</h1>
            <p className="mt-2 text-sm text-muted">
              Choose a strong password to protect your account.
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={10}
                  className={`${inputCls} pr-10`}
                  placeholder="At least 10 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted">Minimum 10 characters required.</p>
            </div>

            <Field label="Confirm New Password">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={10}
                className={inputCls}
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
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
              {busy ? 'Updating password…' : 'Set new password'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Remember your credentials? <Link to="/login" className="font-semibold text-fg underline">Log in</Link>
          </p>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 mb-4">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Password Reset Complete</h1>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Your password was successfully updated. As a security measure, all other active sessions were terminated and your email address has been marked as verified.
          </p>

          <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-left text-emerald-700 dark:text-emerald-400 flex items-start gap-2.5">
            <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Account Verified & Secured</p>
              <p className="mt-0.5 opacity-90">You can now access your artist studio or listener account with your new password.</p>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <LinkButton to="/login" size="lg" className="w-full sm:w-auto px-8">
              Proceed to log in
            </LinkButton>
          </div>
        </div>
      )}
    </Page>
  );
}

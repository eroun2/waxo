import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound, LogOut, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/hooks';
import { LinkButton, Button, ErrorState, Page, Skeleton, cx, inputCls } from '../components/ui';

interface ArtistMe { stage_name: string; slug: string; approval_status: 'pending' | 'active' | 'rejected' | 'suspended'; review_note: string | null }
interface Note { id: string; title: string; body: string | null; read_at: string | null; created_at: string }
interface Notes { items: Note[]; unread: number }

const STATUS = {
  pending: { label: 'Under review', text: 'Our team is reviewing your profile. You will get an email and a notification once it is approved.' },
  active: { label: 'Approved', text: 'Your artist profile is live.' },
  rejected: { label: 'Changes needed', text: 'Your profile was not approved yet. Update it and resubmit for review.' },
  suspended: { label: 'Suspended', text: 'Your artist account is suspended. Contact support if you think this is a mistake.' },
} as const;

function ArtistStatus() {
  const { data, error, refetch } = useApi<ArtistMe>('/artists/me');
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-32" />;
  const approval = data.approval_status && STATUS[data.approval_status] ? data.approval_status : 'active';
  const s = STATUS[approval];
  const resubmit = async () => { setBusy(true); try { await api('/artists/me/resubmit', { method: 'POST' }); refetch(); } finally { setBusy(false); } };
  return (
    <div className="rounded-card border border-line p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Artist profile: {data.stage_name || 'My Artist Profile'}</h2>
        <span className={cx('rounded-full border px-3 py-1 text-xs font-semibold', approval === 'active' ? 'border-fg bg-fg text-bg' : 'border-line')}>{s.label}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{s.text}</p>
      {data.review_note && <p className="mt-3 rounded-xl bg-surface p-3 text-sm"><strong>Note from our team:</strong> {data.review_note}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        {approval === 'active' && data.slug && <LinkButton to={`/artists/${data.slug}`} variant="outline" size="sm">View public profile</LinkButton>}
        {approval === 'rejected' && <Button size="sm" onClick={resubmit} disabled={busy}>Resubmit for review</Button>}
      </div>
      <div className="mt-4"><LinkButton to="/studio" size="sm">Open artist studio</LinkButton></div>
    </div>
  );
}

function Notifications() {
  const { data, error, refetch } = useApi<Notes>('/notifications?limit=10');
  const [optimisticAllRead, setOptimisticAllRead] = useState(false);

  useEffect(() => {
    const handler = () => { refetch(); };
    window.addEventListener('waxo:notifications-updated', handler);
    return () => window.removeEventListener('waxo:notifications-updated', handler);
  }, [refetch]);

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-32" />;

  const unreadCount = optimisticAllRead ? 0 : data.unread;
  const items = optimisticAllRead
    ? data.items.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    : data.items;

  const markAllRead = async () => {
    setOptimisticAllRead(true);
    await api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    refetch();
  };

  return (
    <div className="rounded-card border border-line p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Notifications {unreadCount > 0 && <span className="ml-1 rounded-full bg-fg px-2 py-0.5 text-xs text-bg">{unreadCount}</span>}
        </h2>
        {unreadCount > 0 && (
          <button className="text-sm text-muted hover:text-fg transition-colors" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>
      {items.length === 0 ? <p className="mt-3 text-sm text-muted">You're all caught up.</p> : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((n) => (
            <li key={n.id} className="py-3">
              <p className={cx('text-sm', !n.read_at && 'font-semibold')}>{n.title}</p>
              {n.body && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{n.body}</p>}
              <p className="mt-1 text-xs text-muted">{new Date(n.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AccountSecurity() {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const res = await api<{ message: string }>('/auth/change-password', {
        body: { currentPassword, newPassword },
      });
      setSuccess(res.message || 'Password changed successfully. Other sessions have been signed out.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out of all devices? You will be signed out immediately.')) {
      return;
    }
    setLoggingOutAll(true);
    try {
      await api('/auth/logout-all', { method: 'POST' });
      await logout();
    } catch (err: any) {
      setError(err.message || 'Could not log out of all devices.');
      setLoggingOutAll(false);
    }
  };

  return (
    <div className="rounded-card border border-line p-6 space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Security & Password</h2>
          <p className="text-xs text-muted">Manage your login credentials and active device sessions.</p>
        </div>
      </div>

      <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Current Password
          </label>
          <input
            type="password"
            required
            className={inputCls}
            placeholder="••••••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={10}
              className={inputCls}
              placeholder="Min. 10 chars"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={10}
              className={inputCls}
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs flex items-center gap-2 text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Updating…' : 'Change password'}
        </Button>
      </form>

      <div className="border-t border-line pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-fg">Active Sessions & Devices</p>
          <p className="text-xs text-muted">
            Changing your password signs out other devices automatically. You can also sign out everywhere now.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLogoutAll}
          disabled={loggingOutAll}
          className="text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10 shrink-0"
        >
          <LogOut className="h-3.5 w-3.5 mr-1" />
          {loggingOutAll ? 'Logging out…' : 'Log out of all devices'}
        </Button>
      </div>
    </div>
  );
}

export default function Account() {
  const { me, status, logout } = useAuth();
  if (status === 'loading') return <Page className="py-12"><Skeleton className="h-40" /></Page>;
  if (!me) return <Navigate to="/login?next=/account" replace />;
  return (
    <Page className="max-w-3xl space-y-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{me.stage_name ?? me.display_name ?? 'My account'}</h1>
          <p className="mt-1 text-sm text-muted">{me.email} · {me.role}</p>
        </div>
        <Button variant="outline" onClick={() => void logout()}>Log out</Button>
      </div>
      {me.role === 'artist' && <ArtistStatus />}
      {(me.role === 'admin' || me.role === 'moderator') && <div className="rounded-card border border-line p-6"><h2 className="font-semibold">Administration</h2><p className="mt-1 text-sm text-muted">Review artists and music, handle reports and manage the platform.</p><div className="mt-4"><LinkButton to="/admin" size="sm">Open admin portal</LinkButton></div></div>}
      {me.role === 'listener' && <div className="rounded-card border border-line p-6"><h2 className="font-semibold">Your music</h2><p className="mt-1 text-sm text-muted">Your recently played songs live in Discover.</p><div className="mt-4"><LinkButton to="/discover?tab=recent" variant="outline" size="sm">Recently played</LinkButton></div></div>}
      <Notifications />
      <AccountSecurity />
    </Page>
  );
}

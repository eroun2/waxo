import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Music,
  Sparkles,
  Sun,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { usePlayer } from '../../lib/player';
import { PlayerBar } from '../../components/PlayerBar';
import { useApi } from '../../lib/hooks';
import { ErrorState, Page, Skeleton, cx } from '../../components/ui';
import { Logo } from '../../components/Layout';
import type { ArtistMe } from './shared';

const NAV = [
  { to: '/studio', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/studio/upload', label: 'Upload Music', icon: Upload },
  { to: '/studio/songs', label: 'My Songs', icon: Music },
  { to: '/studio/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/studio/profile', label: 'Artist Profile', icon: User },
  { to: '/studio/notifications', label: 'Notifications', icon: Bell },
];

export default function StudioLayout() {
  const { me, status, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { current } = usePlayer();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMobileMenuOpen(false);
  }, [pathname]);

  const isArtist = status === 'authed' && me?.role === 'artist';
  const artist = useApi<ArtistMe>(isArtist ? '/artists/me' : null);
  const notes = useApi<{ unread: number }>(isArtist ? '/notifications?limit=1' : null);

  useEffect(() => {
    const handler = () => {
      notes.refetch();
    };
    window.addEventListener('waxo:notifications-updated', handler);
    return () => window.removeEventListener('waxo:notifications-updated', handler);
  }, [notes.refetch]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Skeleton className="h-64 w-80" />
      </div>
    );
  }
  if (!me) return <Navigate to="/login?next=/studio" replace />;
  if (me.role !== 'artist') return <Navigate to="/account" replace />;
  if (artist.error && !artist.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-4">
        <ErrorState message={artist.error} onRetry={artist.refetch} />
      </div>
    );
  }
  if (!artist.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Skeleton className="h-64 w-80" />
      </div>
    );
  }
  const a = artist.data;
  const unreadCount = notes.data?.unread ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg selection:bg-fuchsia-500 selection:text-white">
      {/* Dedicated Self-Contained Studio Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-md">
        <Page className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Logo to="/studio" imgClassName="h-9 sm:h-11 max-h-11 w-auto max-w-[120px] sm:max-w-[155px]" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-bold text-fuchsia-400 shrink-0">
              <Sparkles className="h-3.5 w-3.5" /> STUDIO
            </span>
          </div>

          {/* Quick Actions & Artist Identity */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/studio/upload"
              className="hidden sm:inline-flex items-center gap-2 rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-fuchsia-600 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Music
            </Link>

            <Link
              to="/studio/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/60 hover:bg-surface text-fg transition-colors"
              aria-label="Studio Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>

            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/60 hover:bg-surface text-fg transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-zinc-600" />}
            </button>

            {/* Artist Info Badge */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-line bg-surface/60 py-1 pl-1.5 pr-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-500/20 text-xs font-bold text-fuchsia-400">
                {(a.stage_name || 'A')[0].toUpperCase()}
              </span>
              <div className="text-left text-xs">
                <p className="font-semibold leading-none truncate max-w-[120px]">{a.stage_name}</p>
                <p className="text-[10px] text-muted leading-tight mt-0.5">{a.district || 'Artist'}</p>
              </div>
            </div>

            {/* Sign Out */}
            <button
              onClick={() => void logout()}
              title="Sign Out of Studio"
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-rose-400 hover:border-rose-500/30 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface lg:hidden"
              aria-label="Toggle Studio Menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </Page>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-line bg-bg lg:hidden">
            <Page className="py-3 space-y-1">
              <div className="mb-2 px-3 py-2 rounded-xl bg-surface/60 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-500/20 text-xs font-bold text-fuchsia-400">
                  {(a.stage_name || 'A')[0].toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-xs">{a.stage_name}</p>
                  <p className="text-[10px] text-muted">{a.district}</p>
                </div>
              </div>
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-fg text-bg font-semibold' : 'text-muted hover:bg-surface hover:text-fg'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {to.endsWith('notifications') && unreadCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </Page>
          </div>
        )}
      </header>

      {/* Portal Main Body */}
      <main className={cx('flex-1', current && 'pb-24')}>
        <Page className="py-6 sm:py-8">
          {/* Approval Banner if not active */}
          {a.approval_status !== 'active' && (
            <div role="status" className="mb-6 rounded-card border border-amber-500/30 bg-amber-500/10 p-4 text-sm sm:p-5 text-amber-200">
              {a.approval_status === 'pending' && <><strong>Your artist profile is under review.</strong> You can complete your details now. Music uploads unlock as soon as our moderation team approves your account.</>}
              {a.approval_status === 'rejected' && <><strong>Your profile needs changes.</strong> {a.review_note && <>“{a.review_note}” </>}Update your details from your <Link className="underline font-semibold" to="/studio/profile">artist profile editor</Link>.</>}
              {a.approval_status === 'suspended' && <><strong>Your artist account is suspended.</strong> {a.review_note}</>}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
            {/* Desktop Sidebar Navigation */}
            <nav aria-label="Studio Navigation" className="hidden lg:flex flex-col gap-1.5">
              <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                Creator Studio
              </div>
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                      isActive ? 'bg-fg font-semibold text-bg shadow-sm' : 'text-muted hover:bg-surface hover:text-fg'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {to.endsWith('notifications') && unreadCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Mobile horizontal pill navigation */}
            <nav aria-label="Studio Navigation Mobile" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cx(
                      'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                      isActive ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:bg-surface hover:text-fg'
                    )
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  {to.endsWith('notifications') && unreadCount > 0 && (
                    <span className="rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Studio Content Outlet */}
            <div className="min-w-0">
              <Outlet context={{ artist: a, reload: artist.refetch }} />
            </div>
          </div>
        </Page>
      </main>

      {/* Dedicated Studio Footer */}
      <footer className="mt-auto border-t border-line bg-surface/30 py-6 text-xs text-muted">
        <Page className="flex flex-wrap items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} WaXo Creator Studio · Independent Music Ecosystem</p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Active Session · {a.stage_name} ({a.district})
          </p>
        </Page>
      </footer>

      <PlayerBar />
    </div>
  );
}

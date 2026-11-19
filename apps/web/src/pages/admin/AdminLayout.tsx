import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Copyright,
  Flag,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Music,
  ScrollText,
  Shield,
  Sun,
  Tags,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { usePlayer } from '../../lib/player';
import { PlayerBar } from '../../components/PlayerBar';
import { useApi } from '../../lib/hooks';
import { Page, Skeleton, cx } from '../../components/ui';
import { Logo } from '../../components/Layout';
import { can } from './shared';

interface Queues {
  queues: {
    pendingArtists: number;
    pendingSongs: number;
    failedSongs: number;
    openCopyright: number;
    openReports: number;
  };
}

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/music', label: 'Music Review', icon: Music, perm: 'music.review', badge: 'pendingSongs' },
  { to: '/admin/artists', label: 'Artists Review', icon: Users, perm: 'artists.review', badge: 'pendingArtists' },
  { to: '/admin/listeners', label: 'Listeners', icon: UserCog, perm: 'users.manage' },
  { to: '/admin/reports', label: 'Reported Content', icon: Flag, perm: 'reports.handle', badge: 'openReports' },
  { to: '/admin/copyright', label: 'Copyright Claims', icon: Copyright, perm: 'reports.handle', badge: 'openCopyright' },
  { to: '/admin/districts', label: 'Districts', icon: Globe2, perm: 'districts.manage' },
  { to: '/admin/genres', label: 'Genres', icon: Tags, perm: 'genres.manage' },
  { to: '/admin/analytics', label: 'Platform Analytics', icon: BarChart3, perm: 'analytics.view' },
  { to: '/admin/accounts', label: 'Admin Accounts', icon: Shield, perm: 'admins.manage' },
  { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText, perm: 'audit.view' },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
] as const;

export default function AdminLayout() {
  const { me, status, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { current } = usePlayer();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMobileMenuOpen(false);
  }, [pathname]);

  const staff = status === 'authed' && (me?.role === 'admin' || me?.role === 'moderator');
  const dash = useApi<Queues>(staff ? '/admin/dashboard' : null);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Skeleton className="h-64 w-80" />
      </div>
    );
  }
  if (!me) return <Navigate to="/login?next=/admin" replace />;
  if (!staff) return <Navigate to="/" replace />;
  const q = dash.data?.queues;

  const visibleNav = NAV.filter((n) => can(me, 'perm' in n ? n.perm : undefined));

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg selection:bg-amber-500 selection:text-black">
      {/* Dedicated Self-Contained Admin Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-md">
        <Page className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Logo to="/admin" imgClassName="h-9 sm:h-11 max-h-11 w-auto max-w-[120px] sm:max-w-[155px]" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold text-amber-400 shrink-0">
              <Shield className="h-3.5 w-3.5" /> ADMIN<span className="hidden sm:inline"> CONTROL</span>
            </span>
          </div>

          {/* Quick Actions & Admin Identity */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/60 hover:bg-surface text-fg transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-zinc-600" />}
            </button>

            {/* Staff Info Badge */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-line bg-surface/60 py-1 pl-2 pr-3 text-xs">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                {(me.display_name ?? me.email ?? 'A')[0].toUpperCase()}
              </span>
              <div className="text-left">
                <span className="font-semibold text-fg">{me.admin_role ?? me.role}</span>
                <span className="hidden md:inline text-muted text-[11px]"> · {me.email}</span>
              </div>
            </div>

            {/* Sign Out */}
            <button
              onClick={() => void logout()}
              title="Sign Out of Admin Portal"
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-rose-400 hover:border-rose-500/30 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface lg:hidden"
              aria-label="Toggle Admin Menu"
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
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                  {(me.display_name ?? me.email ?? 'A')[0].toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-xs">{me.email}</p>
                  <p className="text-[10px] text-muted">{me.admin_role ?? me.role}</p>
                </div>
              </div>
              {visibleNav.map((n) => {
                const count = 'badge' in n && q ? q[n.badge] : 0;
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={'end' in n ? n.end : false}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-fg text-bg font-semibold' : 'text-muted hover:bg-surface hover:text-fg'
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{n.label}</span>
                    {count > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </Page>
          </div>
        )}
      </header>

      {/* Portal Main Body */}
      <main className={cx('flex-1', current && 'pb-24')}>
        <Page className="py-6 sm:py-8">
          <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:gap-8">
            {/* Desktop Sidebar Navigation */}
            <nav aria-label="Admin Navigation" className="hidden lg:flex flex-col gap-1">
              <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                Admin Console
              </div>
              {visibleNav.map((n) => {
                const count = 'badge' in n && q ? q[n.badge] : 0;
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={'end' in n ? n.end : false}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                        isActive ? 'bg-fg font-semibold text-bg shadow-sm' : 'text-muted hover:bg-surface hover:text-fg'
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{n.label}</span>
                    {count > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Mobile horizontal pill navigation */}
            <nav aria-label="Admin Navigation Mobile" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden">
              {visibleNav.map((n) => {
                const count = 'badge' in n && q ? q[n.badge] : 0;
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={'end' in n ? n.end : false}
                    className={({ isActive }) =>
                      cx(
                        'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                        isActive ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:bg-surface hover:text-fg'
                      )
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{n.label}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Admin Content Outlet */}
            <div className="min-w-0">
              <Outlet />
            </div>
          </div>
        </Page>
      </main>

      {/* Dedicated Admin Footer */}
      <footer className="mt-auto border-t border-line bg-surface/30 py-6 text-xs text-muted">
        <Page className="flex flex-wrap items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} WaXo Management Console · Authorized Personnel Only · Strict Confidentiality</p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            Session: {me.email} ({me.admin_role ?? me.role})
          </p>
        </Page>
      </footer>

      <PlayerBar />
    </div>
  );
}

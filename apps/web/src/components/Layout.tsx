import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  Flame,
  Home,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  Sparkles,
  Sun,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { usePlayer } from '../lib/player';
import { PlayerBar } from './PlayerBar';
import { btn, cx, Page } from './ui';
import logoImg from '../assets/logo.png';

const NAV = [
  { to: '/', label: 'Home', end: true, icon: Home, iconCls: 'text-zinc-400 group-hover:text-fg' },
  { to: '/discover', label: 'Discover', icon: Compass, iconCls: 'text-violet-400' },
  { to: '/trending', label: 'Trending', icon: Flame, iconCls: 'text-amber-500' },
  { to: '/artists', label: 'Artists', icon: Users, iconCls: 'text-sky-400' },
];

export function Logo({ className, imgClassName, to = '/' }: { className?: string; imgClassName?: string; to?: string }) {
  return (
    <Link to={to} aria-label="WaXo" className={cx('flex items-center shrink-0 transition-all duration-200 hover:opacity-90', className)}>
      <img
        src={logoImg}
        alt="WaXo"
        className={cx('object-contain drop-shadow-sm', imgClassName || 'h-10 sm:h-12 w-auto max-w-[150px] sm:max-w-[180px]')}
      />
    </Link>
  );
}

function SearchBox({ className, onDone }: { className?: string; onDone?: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 2) {
      nav(`/search?q=${encodeURIComponent(q.trim())}`);
      onDone?.();
    }
  };
  return (
    <form onSubmit={submit} role="search" className={cx('relative group flex items-center', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-violet-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search songs and artists"
        placeholder="Search songs, artists…"
        className="h-10 w-full rounded-full border border-line bg-surface/80 pl-10 pr-9 py-2 text-xs sm:text-sm text-fg placeholder:text-muted focus:border-violet-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all shadow-xs"
      />
      {q ? (
        <button
          type="button"
          onClick={() => setQ('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-surface hover:text-fg transition-colors"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 hidden xl:flex items-center justify-center h-5 px-1.5 rounded border border-line bg-bg text-[10px] font-semibold text-muted">
          /
        </span>
      )}
    </form>
  );
}

function Header() {
  const { me, status, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'group flex items-center gap-2 rounded-full px-3.5 xl:px-4 py-1.5 text-xs xl:text-sm font-semibold tracking-tight transition-all duration-200',
      isActive
        ? 'bg-bg text-fg shadow-xs border border-line/80 font-bold'
        : 'text-muted hover:bg-surface/80 hover:text-fg'
    );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <Page className="flex h-16 sm:h-18 items-center justify-between gap-4">
        {/* Left Zone: Brand */}
        <div className="flex items-center shrink-0">
          <Logo />
        </div>

        {/* Center Zone: Segmented Navigation Dock */}
        <nav
          aria-label="Main"
          className="hidden lg:flex items-center gap-1 rounded-full border border-line/60 bg-surface/50 p-1 backdrop-blur-md shadow-xs"
        >
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink key={n.to} to={n.to} end={n.end} className={navLinkClass}>
                <Icon className={cx('h-4 w-4 transition-transform duration-200 group-hover:scale-110', n.iconCls)} />
                <span>{n.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Right Zone: Search, Controls, & Authentication */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <SearchBox className="hidden md:block w-36 lg:w-44 xl:w-56 focus-within:w-48 lg:focus-within:w-56 xl:focus-within:w-64 transition-all duration-300" />

          {/* Theme switcher */}
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex h-10 w-10 p-2.5 items-center justify-center rounded-full border border-line bg-surface/60 text-muted transition-all hover:bg-surface hover:text-fg shadow-xs"
          >
            {theme === 'dark' ? (
              <Sun className="h-4.5 w-4.5 text-amber-400 transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon className="h-4.5 w-4.5 text-indigo-500 transition-transform duration-300 hover:-rotate-12" />
            )}
          </button>

          {/* Auth Area: Sign In / Sign Out */}
          {status === 'authed' && me ? (
            <div className="hidden sm:flex items-center gap-2">
              {me.role === 'artist' && (
                <Link
                  to="/studio"
                  className="flex items-center gap-1.5 h-10 px-3.5 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs font-semibold text-violet-400 hover:bg-violet-500/20 transition-all shadow-xs"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden xl:inline">Studio</span>
                </Link>
              )}
              {(me.role === 'admin' || me.role === 'moderator') && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 h-10 px-3.5 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-all shadow-xs"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden xl:inline">Admin</span>
                </Link>
              )}
              <Link
                to="/account"
                className="flex items-center gap-2 h-10 pl-2 pr-3.5 py-2 rounded-full border border-line bg-surface/60 hover:bg-surface text-xs sm:text-sm font-semibold text-fg transition-all shadow-xs"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400 text-xs font-bold">
                  {(me.stage_name ?? me.display_name ?? 'U')[0].toUpperCase()}
                </span>
                <span className="max-w-[75px] xl:max-w-[120px] truncate">
                  {me.stage_name ?? me.display_name ?? 'Account'}
                </span>
              </Link>
              <button
                onClick={() => void logout()}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/60 text-muted transition-all hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 shadow-xs"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/login"
                className="flex items-center gap-1.5 h-10 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold text-muted hover:text-fg hover:bg-surface transition-all"
              >
                <LogIn className="h-4 w-4 text-zinc-400" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/join"
                className="flex items-center gap-1.5 h-10 px-4 xl:px-5 py-2 rounded-full bg-fg text-bg text-xs sm:text-sm font-bold shadow-md hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <UserPlus className="h-4 w-4" />
                <span>Sign Up</span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="flex h-10 w-10 p-2.5 items-center justify-center rounded-full border border-line bg-surface/60 hover:bg-surface text-fg lg:hidden transition-all shadow-xs"
          >
            {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </Page>

      {/* Mobile Drawer */}
      {open && (
        <div className="border-t border-line bg-bg lg:hidden backdrop-blur-xl">
          <Page className="space-y-4 py-5">
            <SearchBox className="w-full" onDone={() => setOpen(false)} />

            <div className="space-y-1">
              <p className="px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted">Browse</p>
              {NAV.map((n) => {
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors',
                        isActive
                          ? 'bg-surface text-fg border border-line/80'
                          : 'text-muted hover:bg-surface hover:text-fg'
                      )
                    }
                  >
                    <Icon className={cx('h-4.5 w-4.5', n.iconCls)} />
                    {n.label}
                  </NavLink>
                );
              })}
            </div>

            <div className="border-t border-line pt-4">
              <p className="px-3.5 mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted">Account</p>
              {status === 'authed' && me ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-surface/60 border border-line/60">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-sky-400 text-xs font-bold">
                      {(me.stage_name ?? me.display_name ?? 'U')[0].toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-fg">{me.stage_name ?? me.display_name ?? 'My Account'}</p>
                      <p className="truncate text-[10px] text-muted">{me.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {me.role === 'artist' && (
                      <Link to="/studio" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 h-11 rounded-full border border-line bg-surface text-xs font-semibold text-fuchsia-400">
                        <Sparkles className="h-4 w-4" /> Studio
                      </Link>
                    )}
                    {(me.role === 'admin' || me.role === 'moderator') && (
                      <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 h-11 rounded-full border border-line bg-surface text-xs font-semibold text-amber-400">
                        <Shield className="h-4 w-4" /> Admin
                      </Link>
                    )}
                    <Link to="/account" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 h-11 rounded-full border border-line bg-surface text-xs font-semibold text-fg">
                      <User className="h-4 w-4 text-sky-400" /> Account
                    </Link>
                    <button
                      onClick={() => { setOpen(false); void logout(); }}
                      className={cx(
                        'flex items-center justify-center gap-2 h-11 rounded-full border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-400',
                        (me.role === 'artist' || me.role === 'admin' || me.role === 'moderator') && 'col-span-2'
                      )}
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 h-11 rounded-full border border-line bg-surface text-xs font-bold text-fg"
                  >
                    <LogIn className="h-4 w-4 text-zinc-400" /> Sign In
                  </Link>
                  <Link
                    to="/join"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 h-11 rounded-full bg-fg text-bg text-xs font-bold shadow-sm"
                  >
                    <UserPlus className="h-4 w-4" /> Sign Up
                  </Link>
                </div>
              )}
            </div>
          </Page>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const col = 'space-y-2 text-sm text-muted [&_a:hover]:text-fg';
  return (
    <footer className="mt-20 border-t border-line bg-surface/40">
      <Page className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo imgClassName="h-11 sm:h-12" />
          <p className="mt-3 max-w-xs text-sm text-muted">Discover. Stream. Download. Support Local Talent.</p>
          <p className="mt-2 max-w-xs text-sm text-muted">A home for rising and independent musicians, district by district.</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Listen</h3>
          <ul className={col}>
            <li><Link to="/discover">Discover</Link></li>
            <li><Link to="/trending">Trending</Link></li>
            <li><Link to="/artists">Artists</Link></li>
            <li><Link to="/districts">Districts</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Artists</h3>
          <ul className={col}>
            <li><Link to="/upload">Upload music</Link></li>
            <li><Link to="/join?as=artist">Create an artist profile</Link></li>
            <li><Link to="/login">Artist login</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Platform</h3>
          <ul className={col}>
            <li><Link to="/join">Sign up</Link></li>
            <li><Link to="/login">Log in</Link></li>
          </ul>
        </div>
      </Page>
      <Page className="border-t border-line py-6 text-xs text-muted">
        © {new Date().getFullYear()} WaXo. All rights reserved.
      </Page>
    </footer>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function Layout() {
  const { current } = usePlayer();
  const { pathname } = useLocation();
  const hideChrome =
    pathname === '/join' ||
    pathname === '/login' ||
    pathname === '/verify-email' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password';

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg selection:bg-violet-500 selection:text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-fg focus:px-4 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <ScrollToTop />
      {!hideChrome && <Header />}
      <main id="main" className={cx('flex-1', current && !hideChrome && 'pb-24')}><Outlet /></main>
      {!hideChrome && <Footer />}
      {!hideChrome && <PlayerBar />}
    </div>
  );
}

import { Navigate, useSearchParams } from 'react-router-dom';
import {
  Clock,
  Compass,
  Download,
  Flame,
  Headphones,
  History,
  MapPin,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { qs } from '../lib/api';
import { PagedArtists, PagedSongs } from '../components/PagedViews';
import { DistrictSelect, GenreSelect } from '../components/Selects';
import { EmptyState, Page, cx } from '../components/ui';

interface Tab {
  key: string;
  label: string;
  path: string;
  icon: any;
  iconCls: string;
  artists?: boolean;
  filters?: boolean;
  auth?: boolean;
}

const TABS: Tab[] = [
  { key: 'trending', label: 'Trending Now', path: '/discover/trending', icon: Flame, iconCls: 'text-amber-500', filters: true },
  { key: 'new', label: 'New Releases', path: '/discover/new-releases', icon: Zap, iconCls: 'text-emerald-400', filters: true },
  { key: 'rising', label: 'Rising Stars', path: '/discover/rising-stars', icon: TrendingUp, iconCls: 'text-violet-400', artists: true, filters: true },
  { key: 'streamed', label: 'Most Streamed', path: '/discover/most-streamed', icon: Headphones, iconCls: 'text-cyan-400', filters: true },
  { key: 'downloaded', label: 'Most Downloaded', path: '/discover/most-downloaded', icon: Download, iconCls: 'text-indigo-400', filters: true },
  { key: 'added', label: 'Recently Added', path: '/discover/recently-added', icon: Clock, iconCls: 'text-sky-400', filters: true },
  { key: 'featured', label: 'Featured', path: '/discover/featured-songs', icon: Sparkles, iconCls: 'text-amber-400', filters: true },
  { key: 'near', label: 'In Your District', path: '/discover/near-me', icon: MapPin, iconCls: 'text-emerald-400' },
  { key: 'recommended', label: 'Recommended', path: '/discover/recommended', icon: Compass, iconCls: 'text-fuchsia-400' },
  { key: 'recent', label: 'Recently Played', path: '/discover/recently-played', icon: History, iconCls: 'text-zinc-400', auth: true },
];

export default function Discover() {
  const [sp, setSp] = useSearchParams();
  const { status } = useAuth();
  const tab = TABS.find((t) => t.key === sp.get('tab')) ?? TABS[0];
  const district = sp.get('district') ?? '';
  const genre = sp.get('genre') ?? '';
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };
  const visible = TABS.filter((t) => !t.auth || status === 'authed');
  const path = `${tab.path}${tab.filters ? qs({ district, genre }) : ''}`;

  return (
    <Page className="py-8 sm:py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-fg">Discover</h1>
        <p className="text-muted">Explore fresh sounds and rising talent from every district.</p>
      </div>

      <div
        role="tablist"
        aria-label="Discovery categories"
        className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {visible.map((t) => {
          const Icon = t.icon;
          const isSelected = t.key === tab.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isSelected}
              onClick={() => set('tab', t.key)}
              className={cx(
                'group flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-all',
                isSelected
                  ? 'border-fg bg-fg text-bg shadow-sm'
                  : 'border-line bg-surface/40 hover:bg-surface text-muted hover:text-fg'
              )}
            >
              <Icon className={cx('h-4 w-4 transition-transform group-hover:scale-110', t.iconCls)} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab.filters && (
        <div className="mt-5 grid max-w-xl grid-cols-2 gap-3">
          <DistrictSelect value={district} onChange={(v) => set('district', v)} />
          <GenreSelect value={genre} onChange={(v) => set('genre', v)} />
        </div>
      )}

      <div className="mt-8">
        {tab.artists ? (
          <PagedArtists path={path} />
        ) : (
          <PagedSongs
            path={path}
            ranked={tab.key === 'trending' || tab.key === 'streamed' || tab.key === 'downloaded'}
            empty={
              tab.key === 'recent' ? (
                <EmptyState title="Nothing played yet" text="Songs you listen to will show up here." />
              ) : (
                <EmptyState title="No songs here yet" text="Try another category or filter, or check back soon." />
              )
            }
          />
        )}
      </div>
    </Page>
  );
}

export const TrendingRedirect = () => <Navigate to="/discover?tab=trending" replace />;

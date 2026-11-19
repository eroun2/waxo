import { useSearchParams } from 'react-router-dom';
import { qs } from '../lib/api';
import { useApi } from '../lib/hooks';
import type { ArtistCardT, Paged, SongCardT } from '../lib/types';
import { ArtistScroller } from '../components/ArtistViews';
import { PagedArtists, PagedSongs } from '../components/PagedViews';
import { DistrictSelect, GenreSelect } from '../components/Selects';
import { SongList } from '../components/SongViews';
import { EmptyState, ErrorState, Page, Skeleton, cx, inputCls } from '../components/ui';
import { Music2, Search as SearchIcon, Sparkles, Users } from 'lucide-react';

const TYPES = [
  { k: 'all', l: 'All', icon: Sparkles, iconCls: 'text-amber-400' },
  { k: 'songs', l: 'Songs', icon: Music2, iconCls: 'text-violet-400' },
  { k: 'artists', l: 'Artists', icon: Users, iconCls: 'text-sky-400' },
];

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const q = (sp.get('q') ?? '').trim();
  const type = sp.get('type') ?? 'all';
  const district = sp.get('district') ?? '';
  const genre = sp.get('genre') ?? '';
  const sort = sp.get('sort') ?? 'relevance';
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const base = `/search${qs({ q, district, genre, sort })}`;
  const valid = q.length >= 2;

  return (
    <Page className="py-8 sm:py-12">
      <form onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get('q') ?? ''); set('q', v.trim()); }} role="search" className="relative max-w-2xl">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input name="q" key={q} defaultValue={q} autoFocus={!q} aria-label="Search" placeholder="Search songs or artists" className={cx(inputCls, 'h-12 pl-12 text-base focus:border-violet-500/50')} />
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-2">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const isSelected = type === t.k;
            return (
              <button
                key={t.k}
                role="tab"
                aria-selected={isSelected}
                onClick={() => set('type', t.k === 'all' ? '' : t.k)}
                className={cx(
                  'flex h-9 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-all',
                  isSelected ? 'border-fg bg-fg text-bg shadow-sm' : 'border-line bg-surface/40 hover:bg-surface text-muted hover:text-fg'
                )}
              >
                <Icon className={cx('h-4 w-4', t.iconCls)} />
                {t.l}
              </button>
            );
          })}
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:ml-auto sm:flex sm:w-auto">
          <DistrictSelect value={district} onChange={(v) => set('district', v)} className="sm:w-44" />
          <GenreSelect value={genre} onChange={(v) => set('genre', v)} className="sm:w-40" />
          <select aria-label="Sort" value={sort} onChange={(e) => set('sort', e.target.value === 'relevance' ? '' : e.target.value)} className={cx(inputCls, 'sm:w-36')}>
            <option value="relevance">Best match</option><option value="newest">Newest</option><option value="popular">Most popular</option>
          </select>
        </div>
      </div>

      <div className="mt-8">
        {!valid ? <EmptyState title="Search WaXo" text="Type at least 2 characters to find songs and artists." />
          : type === 'songs' ? <PagedSongs path={`${base}&type=songs`} select={(r) => r.songs} empty={<EmptyState title={`No songs found for "${q}"`} text="Check the spelling or try fewer filters." />} />
          : type === 'artists' ? <PagedArtists path={`${base}&type=artists`} select={(r) => r.artists} empty={<EmptyState title={`No artists found for "${q}"`} text="Check the spelling or try fewer filters." />} />
          : <AllResults path={`${base}&type=all`} q={q} />}
      </div>
    </Page>
  );
}

function AllResults({ path, q }: { path: string; q: string }) {
  const { data, error, loading, refetch } = useApi<{ songs?: Paged<SongCardT>; artists?: Paged<ArtistCardT> }>(path);
  if (loading && !data) return <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const songs = data?.songs?.items ?? [];
  const artists = data?.artists?.items ?? [];
  if (!songs.length && !artists.length) return <EmptyState title={`No results for "${q}"`} text="Check the spelling, or try fewer filters." />;
  return (
    <div className="space-y-10">
      {artists.length > 0 && <section><h2 className="mb-4 text-lg font-semibold">Artists</h2><ArtistScroller artists={artists} /></section>}
      {songs.length > 0 && <section><h2 className="mb-4 text-lg font-semibold">Songs</h2><SongList songs={songs} /></section>}
    </div>
  );
}

import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Globe, MapPin, Play, Share2, Users } from 'lucide-react';
import { useApi, usePaged } from '../lib/hooks';
import type { SongCardT } from '../lib/types';
import { toPlayerSong, usePlayer } from '../lib/player';
import { compact, shareLink } from '../lib/format';
import { useToast } from '../lib/toast';
import { Artwork } from '../components/Artwork';
import { SongList } from '../components/SongViews';
import { Button, Chip, EmptyState, ErrorState, Page, Skeleton } from '../components/ui';
import NotFound from './NotFound';

interface ArtistPublic {
  id: string; stage_name: string; slug: string; district: string; district_slug: string; town: string | null; bio: string | null;
  social_links: Record<string, string>; is_verified: boolean; follower_count: number; avatarUrl: string | null; coverUrl: string | null;
  genres: { id: number; name: string; slug: string }[];
}

export default function ArtistProfile() {
  const { slug = '' } = useParams();
  const { data: a, error, loading, refetch } = useApi<ArtistPublic>(`/artists/${encodeURIComponent(slug)}`);
  const songs = usePaged<SongCardT>(`/artists/${encodeURIComponent(slug)}/songs`);
  const player = usePlayer();
  const toast = useToast();

  if (loading && !a) return <Page className="py-10"><Skeleton className="h-48" /><Skeleton className="mt-6 h-40" /></Page>;
  if (error && !a) return error.toLowerCase().includes('not found') ? <NotFound /> : <Page className="py-10"><ErrorState message={error} onRetry={refetch} /></Page>;
  if (!a) return null;

  return (
    <>
      <div className="h-40 bg-surface sm:h-64">{a.coverUrl && <img src={a.coverUrl} alt="" className="h-full w-full object-cover" />}</div>
      <Page>
        <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end">
          <Artwork src={a.avatarUrl} alt={a.stage_name} round className="h-28 w-28 shrink-0 border-4 border-bg sm:h-36 sm:w-36" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-fg">
              {a.stage_name}
              {a.is_verified && <BadgeCheck aria-label="Verified artist" className="h-6 w-6 shrink-0 text-sky-400 fill-sky-400/20" />}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <Link to={`/districts/${a.district_slug}`} className="flex items-center gap-1.5 hover:text-emerald-400 font-medium transition-colors">
                <MapPin className="h-4 w-4 text-emerald-400" />
                {[a.town, a.district].filter(Boolean).join(', ')}
              </Link>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-violet-400" />
                {compact(a.follower_count)} followers
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!songs.items.length}
              onClick={() => player.playSong(toPlayerSong(songs.items[0]), songs.items.map(toPlayerSong))}
              className="shadow-sm shadow-violet-500/20"
            >
              <Play className="h-4 w-4 fill-current text-cyan-400" />
              Play
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if ((await shareLink(`/artists/${a.slug}`, a.stage_name)) === 'copied') toast('Link copied');
              }}
              aria-label="Share artist"
            >
              <Share2 className="h-4 w-4 text-emerald-400" />
              Share
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
          <section>
            <h2 className="mb-4 text-xl font-semibold">Songs</h2>
            {songs.initial ? <Skeleton className="h-48" />
              : songs.error ? <ErrorState message={songs.error} onRetry={songs.reload} />
              : songs.items.length ? <><SongList songs={songs.items} />{songs.hasMore && <div className="mt-4 flex justify-center"><Button variant="outline" onClick={songs.loadMore}>Load more</Button></div>}</>
              : <EmptyState title="No songs yet" text="This artist hasn't published any music yet." />}
          </section>
          <aside className="space-y-6">
            {a.bio && <div><h2 className="mb-2 text-sm font-semibold">About</h2><p className="whitespace-pre-line text-sm text-muted">{a.bio}</p></div>}
            {a.genres.length > 0 && <div><h2 className="mb-2 text-sm font-semibold">Genres</h2><div className="flex flex-wrap gap-2">{a.genres.map((g) => <Chip key={g.id} to={`/discover?tab=trending&genre=${g.slug}`}>{g.name}</Chip>)}</div></div>}
            {Object.keys(a.social_links ?? {}).length > 0 && (
              <div><h2 className="mb-2 text-sm font-semibold">Links</h2>
                <ul className="space-y-2 text-sm">{Object.entries(a.social_links).map(([k, v]) => (
                  <li key={k}><a href={v} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 capitalize text-muted hover:text-fg"><Globe className="h-4 w-4" />{k}</a></li>
                ))}</ul></div>
            )}
          </aside>
        </div>
      </Page>
    </>
  );
}

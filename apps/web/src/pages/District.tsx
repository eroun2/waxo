import { Link, useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useApi } from '../lib/hooks';
import type { ArtistCardT, District as DistrictT, Paged, SongCardT } from '../lib/types';
import { compact } from '../lib/format';
import { Artwork } from '../components/Artwork';
import { SongList } from '../components/SongViews';
import { EmptyState, ErrorState, LinkButton, Page, Section, Skeleton } from '../components/ui';
import NotFound from './NotFound';

export default function District() {
  const { slug = '' } = useParams();
  const districts = useApi<DistrictT[]>('/discover/districts');
  const board = useApi<{ artists: Paged<ArtistCardT>; songs: Paged<SongCardT> }>(`/discover/leaderboard/${encodeURIComponent(slug)}`);
  const d = districts.data?.find((x) => x.slug === slug);

  if (districts.data && !d) return <NotFound />;
  const artists = board.data?.artists.items ?? [];
  const songs = board.data?.songs.items ?? [];
  return (
    <Page className="py-8 sm:py-12">
      <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-4 w-4" />{d?.region ?? 'District'}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{d?.name ?? <Skeleton className="inline-block h-10 w-56 align-middle" />}</h1>
      {d && <p className="mt-2 text-muted">{d.artistCount} artists · {d.songCount} songs</p>}

      {board.error && <div className="mt-8"><ErrorState message={board.error} onRetry={board.refetch} /></div>}
      {board.loading && !board.data && <Skeleton className="mt-8 h-64" />}
      {board.data && !artists.length && !songs.length && (
        <div className="mt-8"><EmptyState title="No music from here yet" text="Be the first artist to represent this district on WaXo." action={<LinkButton to="/join?as=artist">Create an artist profile</LinkButton>} /></div>
      )}

      {artists.length > 0 && (
        <Section title="Top artists this month">
          <ol className="divide-y divide-line rounded-card border border-line">
            {artists.slice(0, 10).map((a, i) => (
              <li key={a.id}>
                <Link to={`/artists/${a.slug}`} className="flex items-center gap-4 p-3 hover:bg-surface sm:p-4">
                  <span className="w-6 text-center text-sm font-semibold tabular-nums text-muted">{i + 1}</span>
                  <Artwork src={a.avatarUrl} alt="" round className="h-11 w-11 shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.stageName}</span><span className="block text-xs text-muted">{compact(a.followerCount)} followers</span></span>
                  <span className="text-sm tabular-nums text-muted">{compact(a.plays30d ?? 0)} plays</span>
                </Link>
              </li>
            ))}
          </ol>
        </Section>
      )}
      {songs.length > 0 && <Section title="Trending in this district" href={`/discover?tab=trending&district=${slug}`}><SongList songs={songs} ranked /></Section>}
    </Page>
  );
}

import type { ArtistCardT, SongCardT } from '../lib/types';
import { usePaged } from '../lib/hooks';
import { ArtistGrid } from './ArtistViews';
import { SongList } from './SongViews';
import { Button, EmptyState, ErrorState, Skeleton } from './ui';
import type { ReactNode } from 'react';

function Footer({ hasMore, loading, loadMore }: { hasMore: boolean; loading: boolean; loadMore: () => void }) {
  return hasMore ? <div className="mt-6 flex justify-center"><Button variant="outline" onClick={loadMore} disabled={loading}>{loading ? 'Loading…' : 'Load more'}</Button></div> : null;
}

export function PagedSongs({ path, ranked, select, empty }: { path: string; ranked?: boolean; select?: (r: any) => any; empty?: ReactNode }) {
  const p = usePaged<SongCardT>(path, select);
  if (p.initial) return <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (p.error && !p.items.length) return <ErrorState message={p.error} onRetry={p.reload} />;
  if (!p.items.length) return <>{empty ?? <EmptyState title="No songs found" text="Try a different filter, or check back soon." />}</>;
  return <><SongList songs={p.items} ranked={ranked} /><Footer {...p} /></>;
}

export function PagedArtists({ path, select, empty }: { path: string; select?: (r: any) => any; empty?: ReactNode }) {
  const p = usePaged<ArtistCardT>(path, select, 24);
  if (p.initial) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>;
  if (p.error && !p.items.length) return <ErrorState message={p.error} onRetry={p.reload} />;
  if (!p.items.length) return <>{empty ?? <EmptyState title="No artists found" text="Try a different search or filter." />}</>;
  return <><ArtistGrid artists={p.items} /><Footer {...p} /></>;
}

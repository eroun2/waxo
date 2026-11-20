import { Link } from 'react-router-dom';
import { BadgeCheck, MapPin, Users } from 'lucide-react';
import type { ArtistCardT } from '../lib/types';
import { compact } from '../lib/format';
import { Artwork } from './Artwork';

export function ArtistCard({ artist }: { artist: ArtistCardT }) {
  return (
    <Link to={`/artists/${artist.slug}`} className="group block w-36 shrink-0 snap-start text-center sm:w-40">
      <div className="relative mx-auto w-fit">
        <Artwork
          src={artist.avatarUrl}
          alt=""
          round
          className="ring-2 ring-transparent transition-all duration-300 group-hover:scale-105 group-hover:ring-violet-500/50"
        />
        {artist.featured && (
          <span className="absolute bottom-1 right-1 rounded-full bg-amber-400 p-1 text-[10px] font-bold text-black shadow-md">
            ★
          </span>
        )}
      </div>
      <p className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-fg">
        <span className="truncate group-hover:underline">{artist.stageName}</span>
        {artist.verified && (
          <BadgeCheck aria-label="Verified" className="h-4 w-4 shrink-0 text-sky-400 fill-sky-400/20" />
        )}
      </p>
      <p className="mt-0.5 flex items-center justify-center gap-1.5 truncate text-xs text-muted">
        <span className="flex items-center gap-0.5 text-emerald-400">
          <MapPin className="h-3 w-3" />
          {artist.district?.name ?? 'Unknown'}
        </span>
        <span>·</span>
        <span className="flex items-center gap-0.5">
          <Users className="h-3 w-3 text-violet-400" />
          {compact(artist.followerCount)}
        </span>
      </p>
    </Link>
  );
}

export function ArtistScroller({ artists }: { artists: ArtistCardT[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
      {artists.map((a) => (
        <ArtistCard key={a.id} artist={a} />
      ))}
    </div>
  );
}

export function ArtistGrid({ artists }: { artists: ArtistCardT[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {artists.map((a) => (
        <div key={a.id} className="flex justify-center [&>a]:w-full">
          <ArtistCard artist={a} />
        </div>
      ))}
    </div>
  );
}

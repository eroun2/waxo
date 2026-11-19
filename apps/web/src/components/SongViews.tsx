import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Clock,
  Download,
  Flag,
  Headphones,
  Heart,
  ListEnd,
  ListPlus,
  MapPin,
  MoreHorizontal,
  Pause,
  Play,
  Share2,
  User,
} from 'lucide-react';
import type { SongCardT } from '../lib/types';
import { toPlayerSong, usePlayer, type PlayerSong } from '../lib/player';
import { api } from '../lib/api';
import { compact, fmtTime, shareLink } from '../lib/format';
import { useToast } from '../lib/toast';
import { Artwork } from './Artwork';
import { cx } from './ui';

export async function downloadSong(songId: string, toast: (m: string) => void) {
  try {
    const { url } = await api<{ url: string }>(`/songs/${songId}/download-url`);
    window.location.assign(url);
    toast('Download started');
  } catch (e) {
    toast((e as Error).message);
  }
}

export function SongMenu({ song }: { song: PlayerSong & { title: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const p = usePlayer();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const item = 'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-hover transition-colors';
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`More options for ${song.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-fg"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-2xl backdrop-blur-md"
        >
          <button role="menuitem" className={item} onClick={act(() => { p.playNext(song); toast('Playing next'); })}>
            <ListEnd className="h-4 w-4 text-violet-400" />
            Play next
          </button>
          <button role="menuitem" className={item} onClick={act(() => { p.addToQueue(song); toast('Added to queue'); })}>
            <ListPlus className="h-4 w-4 text-cyan-400" />
            Add to queue
          </button>
          <Link role="menuitem" to={`/artists/${song.artistSlug}`} className={item} onClick={() => setOpen(false)}>
            <User className="h-4 w-4 text-sky-400" />
            Go to artist
          </Link>
          <button
            role="menuitem"
            className={item}
            onClick={act(async () => {
              if ((await shareLink(`/songs/${song.id}`, `${song.title} by ${song.artistName}`)) === 'copied') toast('Link copied');
            })}
          >
            <Share2 className="h-4 w-4 text-emerald-400" />
            Share
          </button>
          {song.downloadsEnabled && (
            <button role="menuitem" className={item} onClick={act(() => void downloadSong(song.id, toast))}>
              <Download className="h-4 w-4 text-indigo-400" />
              Download
            </button>
          )}
          <Link role="menuitem" to={`/songs/${song.id}/report`} className={item} onClick={() => setOpen(false)}>
            <Flag className="h-4 w-4 text-rose-400" />
            Report
          </Link>
        </div>
      )}
    </div>
  );
}

function SoundWave() {
  return (
    <div className="flex h-4 items-end gap-0.5">
      <span className="w-0.5 rounded-full bg-cyan-400 animate-soundwave-1" />
      <span className="w-0.5 rounded-full bg-violet-400 animate-soundwave-2" />
      <span className="w-0.5 rounded-full bg-emerald-400 animate-soundwave-3" />
    </div>
  );
}

export function SongRow({ song, list, rank }: { song: SongCardT; list: SongCardT[]; rank?: number }) {
  const p = usePlayer();
  const [liked, setLiked] = useState(false);
  const isCurrent = p.current?.id === song.id;
  const isPlaying = isCurrent && p.playing;
  const ps = toPlayerSong(song);
  const onPlay = () => (isCurrent ? p.toggle() : p.playSong(ps, list.map(toPlayerSong)));

  const rankBadge = () => {
    if (rank === 1) return <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 font-bold text-amber-400 border border-amber-500/30 text-xs">1</span>;
    if (rank === 2) return <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-300/15 font-bold text-slate-300 border border-slate-300/30 text-xs">2</span>;
    if (rank === 3) return <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-700/15 font-bold text-amber-600 border border-amber-600/30 text-xs">3</span>;
    return <span className="w-6 shrink-0 text-center text-sm tabular-nums text-muted">{rank}</span>;
  };

  return (
    <div
      className={cx(
        'group flex items-center gap-3 rounded-xl p-2 transition-all hover:bg-surface',
        isCurrent ? 'bg-surface/90 border-l-2 border-l-violet-500' : 'border-l-2 border-l-transparent'
      )}
    >
      {rank !== undefined && <div className="w-7 shrink-0 flex justify-center">{rankBadge()}</div>}
      <button
        onClick={onPlay}
        aria-label={`${isPlaying ? 'Pause' : 'Play'} ${song.title}`}
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg group-hover:shadow-md"
      >
        <Artwork src={song.artworkUrl} alt="" className="!rounded-lg" />
        <span
          className={cx(
            'absolute inset-0 flex items-center justify-center transition-all',
            isCurrent
              ? 'bg-black/60 text-cyan-400 opacity-100'
              : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'
          )}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={`/songs/${song.id}`}
            className={cx(
              'block truncate font-semibold hover:underline',
              isCurrent ? 'text-violet-400' : 'text-fg'
            )}
          >
            {song.title}
          </Link>
          {isPlaying && <SoundWave />}
        </div>
        <div className="flex items-center gap-1.5 truncate text-xs text-muted">
          <Link to={`/artists/${song.artist.slug}`} className="hover:text-fg hover:underline">
            {song.artist.name}
          </Link>
          {song.artist.verified && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400 fill-sky-400/20" aria-label="Verified" />
          )}
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        {song.genre && (
          <span className="rounded-md border border-line bg-surface/80 px-2 py-0.5 text-xs font-medium text-muted">
            {song.genre.name}
          </span>
        )}
        {song.district && (
          <span className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
            <MapPin className="h-3 w-3" />
            {song.district.name}
          </span>
        )}
      </div>

      <span className="hidden items-center gap-1 text-xs tabular-nums text-muted sm:flex">
        <Headphones className="h-3 w-3 text-cyan-400" />
        {compact(song.streamCount)}
      </span>

      <button
        onClick={() => setLiked((l) => !l)}
        aria-label={liked ? 'Unlike' : 'Like'}
        className={cx(
          'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          liked ? 'text-rose-500' : 'text-muted hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100'
        )}
      >
        <Heart className={cx('h-4 w-4', liked && 'fill-current')} />
      </button>

      <span className="hidden w-10 text-right text-xs tabular-nums text-muted sm:block">
        {fmtTime(song.durationSeconds)}
      </span>

      <SongMenu song={ps} />
    </div>
  );
}

export function SongCard({ song, list }: { song: SongCardT; list: SongCardT[] }) {
  const p = usePlayer();
  const isCurrent = p.current?.id === song.id;
  const isPlaying = isCurrent && p.playing;
  const onPlay = () => (isCurrent ? p.toggle() : p.playSong(toPlayerSong(song), list.map(toPlayerSong)));

  return (
    <div className="group w-40 shrink-0 snap-start sm:w-44">
      <div className="relative overflow-hidden rounded-xl">
        <Link to={`/songs/${song.id}`} aria-label={song.title} className="block overflow-hidden rounded-xl">
          <Artwork src={song.artworkUrl} alt="" className="transition-transform duration-300 group-hover:scale-105" />
        </Link>
        <button
          onClick={onPlay}
          aria-label={`${isPlaying ? 'Pause' : 'Play'} ${song.title}`}
          className={cx(
            'absolute bottom-2.5 right-2.5 flex h-11 w-11 items-center justify-center rounded-xl bg-fg text-bg shadow-xl transition-all duration-200 hover:scale-105',
            isPlaying
              ? 'bg-gradient-to-tr from-violet-600 to-cyan-500 text-white opacity-100 ring-2 ring-violet-400'
              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-fg'
          )}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          )}
        </button>
      </div>

      <div className="mt-2.5">
        <Link
          to={`/songs/${song.id}`}
          className={cx(
            'block truncate text-sm font-semibold hover:underline',
            isCurrent ? 'text-violet-400' : 'text-fg'
          )}
        >
          {song.title}
        </Link>
        <div className="mt-0.5 flex items-center gap-1">
          <Link to={`/artists/${song.artist.slug}`} className="truncate text-xs text-muted hover:text-fg">
            {song.artist.name}
          </Link>
          {song.artist.verified && (
            <BadgeCheck className="h-3 w-3 shrink-0 text-sky-400 fill-sky-400/20" aria-label="Verified" />
          )}
        </div>
      </div>
    </div>
  );
}

export function SongScroller({ songs }: { songs: SongCardT[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
      {songs.map((s) => (
        <SongCard key={s.id} song={s} list={songs} />
      ))}
    </div>
  );
}

export function SongList({ songs, ranked }: { songs: SongCardT[]; ranked?: boolean }) {
  return (
    <div className="space-y-1">
      {songs.map((s, i) => (
        <SongRow key={s.id} song={s} list={songs} rank={ranked ? i + 1 : undefined} />
      ))}
    </div>
  );
}

import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Download,
  Heart,
  ListMusic,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { usePlayer } from '../lib/player';
import { fmtTime } from '../lib/format';
import { useToast } from '../lib/toast';
import { Artwork } from './Artwork';
import { downloadSong } from './SongViews';
import { cx } from './ui';
import { useState } from 'react';

const icon = 'flex h-10 w-10 items-center justify-center rounded-xl transition-all hover:bg-surface disabled:opacity-40';
const pct = (t: number, d: number) => (d > 0 ? Math.min(100, (t / d) * 100) : 0);

function Seek({ className }: { className?: string }) {
  const p = usePlayer();
  return (
    <input
      type="range"
      aria-label="Seek"
      className={cx('seek', className)}
      min={0}
      max={Math.max(p.duration, 1)}
      step={1}
      value={Math.min(p.time, p.duration || 0)}
      style={{ '--p': `${pct(p.time, p.duration)}%` } as CSSProperties}
      onChange={(e) => p.seek(Number(e.target.value))}
      disabled={!p.duration}
    />
  );
}

function PlayPause({ big }: { big?: boolean }) {
  const p = usePlayer();
  return (
    <button
      onClick={p.toggle}
      aria-label={p.playing ? 'Pause' : 'Play'}
      className={cx(
        'flex items-center justify-center rounded-2xl bg-fg text-bg shadow-md transition-all duration-200 hover:scale-105 active:scale-95',
        p.playing && 'bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-violet-500/30',
        big ? 'h-16 w-16' : 'h-11 w-11'
      )}
    >
      {p.loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : p.playing ? (
        <Pause className={cx('fill-current', big ? 'h-7 w-7' : 'h-5 w-5')} />
      ) : (
        <Play className={cx('ml-0.5 fill-current', big ? 'h-7 w-7' : 'h-5 w-5')} />
      )}
    </button>
  );
}

/** Persistent mini player. Opens the full-screen player on tap. */
export function PlayerBar() {
  const p = usePlayer();
  const [liked, setLiked] = useState(false);
  if (!p.current) return null;
  const s = p.current;

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] shadow-2xl backdrop-blur-lg"
        role="region"
        aria-label="Music player"
      >
        {/* Top mini progress line on mobile */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-line md:hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-all duration-150"
            style={{ width: `${pct(p.time, p.duration)}%` }}
          />
        </div>

        <div className="mx-auto grid h-20 max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-3 sm:px-6 md:grid-cols-[1.2fr_2fr_1.2fr]">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => p.setExpanded(true)}
              className="flex min-w-0 items-center gap-3 text-left group"
              aria-label="Open full-screen player"
            >
              <Artwork
                src={s.artworkUrl}
                alt=""
                className="h-12 w-12 shrink-0 !rounded-xl shadow-sm transition-transform group-hover:scale-105"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold group-hover:underline text-fg">
                  {s.title}
                </span>
                <span className="block truncate text-xs text-muted">
                  {p.error ?? s.artistName}
                </span>
              </span>
            </button>
            <button
              onClick={() => setLiked((l) => !l)}
              aria-label={liked ? 'Unlike' : 'Like'}
              className={cx(
                'ml-1 hidden h-8 w-8 items-center justify-center rounded-lg transition-colors sm:flex',
                liked ? 'text-rose-500' : 'text-muted hover:text-rose-500'
              )}
            >
              <Heart className={cx('h-4 w-4', liked && 'fill-current')} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <button
                className={cx(
                  icon,
                  'hidden sm:flex',
                  p.shuffle ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted hover:text-fg'
                )}
                onClick={p.toggleShuffle}
                aria-pressed={p.shuffle}
                aria-label="Shuffle"
              >
                <Shuffle className="h-4 w-4" />
              </button>
              <button
                className={cx(icon, 'hidden sm:flex text-fg')}
                onClick={p.prev}
                aria-label="Previous"
              >
                <SkipBack className="h-5 w-5 fill-current" />
              </button>
              <PlayPause />
              <button className={cx(icon, 'text-fg')} onClick={p.next} aria-label="Next">
                <SkipForward className="h-5 w-5 fill-current" />
              </button>
              <button
                className={cx(
                  icon,
                  'hidden sm:flex',
                  p.repeat !== 'off' ? 'text-violet-400 bg-violet-500/10' : 'text-muted hover:text-fg'
                )}
                onClick={p.cycleRepeat}
                aria-label={`Repeat ${p.repeat}`}
              >
                {p.repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </button>
            </div>
            <div className="hidden w-full max-w-md items-center gap-2 md:flex">
              <span className="w-10 text-right text-xs tabular-nums text-muted">{fmtTime(p.time)}</span>
              <Seek />
              <span className="w-10 text-xs tabular-nums text-muted">{fmtTime(p.duration)}</span>
            </div>
          </div>

          <div className="hidden items-center justify-end gap-2 md:flex">
            <button
              className={icon}
              onClick={() => p.setVolume(p.volume > 0 ? 0 : 0.9)}
              aria-label={p.volume > 0 ? 'Mute' : 'Unmute'}
            >
              {p.volume > 0 ? (
                <Volume2 className="h-5 w-5 text-cyan-400" />
              ) : (
                <VolumeX className="h-5 w-5 text-rose-400" />
              )}
            </button>
            <input
              type="range"
              aria-label="Volume"
              className="seek w-24"
              min={0}
              max={1}
              step={0.01}
              value={p.volume}
              style={{ '--p': `${p.volume * 100}%` } as CSSProperties}
              onChange={(e) => p.setVolume(Number(e.target.value))}
            />
            <button
              className={icon}
              onClick={() => p.setExpanded(true)}
              aria-label="Expand player"
            >
              <Maximize2 className="h-4 w-4 text-muted hover:text-fg" />
            </button>
          </div>
        </div>
      </div>
      {p.expanded && <FullPlayer />}
    </>
  );
}

function FullPlayer() {
  const p = usePlayer();
  const toast = useToast();
  const [liked, setLiked] = useState(false);
  const s = p.current!;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg pt-[env(safe-area-inset-top)] backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <button className={icon} onClick={() => p.setExpanded(false)} aria-label="Close player">
          <ChevronDown className="h-6 w-6" />
        </button>
        <span className="text-sm font-semibold tracking-wide text-muted uppercase">Now Playing</span>
        <button className={icon} onClick={p.clearQueue} aria-label="Stop and clear queue">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 pb-10 md:grid-cols-2 md:items-start md:gap-12">
        <div className="mx-auto w-full max-w-sm md:max-w-none">
          <div className="relative overflow-hidden rounded-2xl shadow-2xl">
            <Artwork src={s.artworkUrl} alt={`${s.title} artwork`} className="w-full" />
          </div>
          <div className="mt-6 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold tracking-tight text-fg">{s.title}</h2>
              <Link
                to={`/artists/${s.artistSlug}`}
                onClick={() => p.setExpanded(false)}
                className="mt-1 block text-base text-violet-400 hover:underline"
              >
                {s.artistName}
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <button
                className={cx('flex h-10 w-10 items-center justify-center rounded-xl transition-colors', liked ? 'text-rose-500' : 'text-muted hover:text-rose-500')}
                onClick={() => setLiked((l) => !l)}
                aria-label={liked ? 'Unlike' : 'Like'}
              >
                <Heart className={cx('h-5 w-5', liked && 'fill-current')} />
              </button>
              {s.downloadsEnabled && (
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-indigo-400"
                  onClick={() => void downloadSong(s.id, toast)}
                  aria-label="Download"
                >
                  <Download className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
          {p.error && <p role="alert" className="mt-3 text-sm text-rose-500 font-medium">{p.error}</p>}
          <div className="mt-6">
            <Seek />
          </div>
          <div className="mt-2 flex justify-between text-xs tabular-nums text-muted font-medium">
            <span>{fmtTime(p.time)}</span>
            <span>{fmtTime(p.duration)}</span>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button
              className={cx(icon, p.shuffle ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted hover:text-fg')}
              onClick={p.toggleShuffle}
              aria-pressed={p.shuffle}
              aria-label="Shuffle"
            >
              <Shuffle className="h-5 w-5" />
            </button>
            <button className={icon} onClick={p.prev} aria-label="Previous">
              <SkipBack className="h-6 w-6 fill-current" />
            </button>
            <PlayPause big />
            <button className={icon} onClick={p.next} aria-label="Next">
              <SkipForward className="h-6 w-6 fill-current" />
            </button>
            <button
              className={cx(icon, p.repeat !== 'off' ? 'text-violet-400 bg-violet-500/10' : 'text-muted hover:text-fg')}
              onClick={p.cycleRepeat}
              aria-label={`Repeat ${p.repeat}`}
            >
              {p.repeat === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface/40 p-4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg">
            <ListMusic className="h-4 w-4 text-violet-400" />
            Up Next · {p.queue.length} songs
          </h3>
          <ul className="space-y-1">
            {p.queue.map((q, i) => (
              <li
                key={`${q.id}-${i}`}
                className={cx(
                  'flex items-center gap-3 rounded-xl p-2.5 transition-colors',
                  i === p.index ? 'bg-surface font-semibold border-l-2 border-violet-500' : 'hover:bg-surface/70'
                )}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => p.jumpTo(i)}
                  aria-label={`Play ${q.title}`}
                >
                  <Artwork src={q.artworkUrl} alt="" className="h-10 w-10 shrink-0 !rounded-lg" />
                  <span className="min-w-0">
                    <span className={cx('block truncate text-sm', i === p.index ? 'text-violet-400' : 'text-fg')}>
                      {q.title}
                    </span>
                    <span className="block truncate text-xs text-muted">{q.artistName}</span>
                  </span>
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                  onClick={() => p.removeFromQueue(i)}
                  aria-label={`Remove ${q.title} from queue`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

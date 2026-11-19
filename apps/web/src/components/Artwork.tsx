import { Music2, User } from 'lucide-react';
import { cx } from './ui';

/** Square artwork with a styled gradient placeholder. `round` is for artist avatars. */
export function Artwork({ src, alt, round, className }: { src: string | null | undefined; alt: string; round?: boolean; className?: string }) {
  return (
    <div className={cx('relative aspect-square overflow-hidden bg-surface shadow-sm transition-transform duration-300', round ? 'rounded-full' : 'rounded-card', className)}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
      ) : (
        <div
          className={cx(
            'flex h-full w-full items-center justify-center',
            round
              ? 'bg-gradient-to-tr from-sky-500/20 via-surface to-violet-500/20 text-sky-400'
              : 'bg-gradient-to-tr from-violet-500/20 via-surface to-cyan-500/20 text-violet-400'
          )}
          aria-hidden
        >
          {round ? <User className="h-1/3 w-1/3" /> : <Music2 className="h-1/3 w-1/3" />}
        </div>
      )}
    </div>
  );
}

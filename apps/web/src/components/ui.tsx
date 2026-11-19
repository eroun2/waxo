import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg';
const variants = { primary: 'bg-fg text-bg hover:opacity-90', outline: 'border border-line hover:bg-surface', ghost: 'hover:bg-surface' };
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-sm', lg: 'h-12 px-7 text-base' };
type V = keyof typeof variants; type S = keyof typeof sizes;
export const btn = (v: V = 'primary', s: S = 'md', extra = '') => cx(base, variants[v], sizes[s], extra);

export function Button({ variant = 'primary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: V; size?: S }) {
  return <button {...p} className={btn(variant, size, className)} />;
}
export function LinkButton({ to, variant = 'primary', size = 'md', className, children }: { to: string; variant?: V; size?: S; className?: string; children: ReactNode }) {
  return <Link to={to} className={btn(variant, size, className)}>{children}</Link>;
}

export const inputCls = 'h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm placeholder:text-muted focus:border-fg focus:outline-none';

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx('animate-pulse rounded-xl bg-surface', className)} />;

export function Spinner({ className }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={cx('inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-violet-500', className)} />;
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface/30 px-6 py-12 text-center">
      <p className="font-semibold text-fg">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-rose-500/20 bg-rose-500/5 px-6 py-8 text-center">
      <p className="font-semibold text-rose-500">We couldn't load this</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Section({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <section className="mt-10 sm:mt-14">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl text-fg">{title}</h2>
        {href && <Link to={href} className="shrink-0 text-sm font-medium text-violet-400 hover:text-violet-300 hover:underline">See all →</Link>}
      </div>
      {children}
    </section>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-7xl px-4 sm:px-6', className)}>{children}</div>;
}

const GENRE_COLORS: Record<string, string> = {
  afro: 'hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400',
  dance: 'hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400',
  hip: 'hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-400',
  r: 'hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400',
  bax: 'hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-400',
  kadongo: 'hover:border-yellow-500/40 hover:bg-yellow-500/10 hover:text-yellow-400',
  traditional: 'hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400',
  gospel: 'hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-400',
};

export const Chip = ({ to, children, active }: { to: string; children: ReactNode; active?: boolean }) => {
  const text = typeof children === 'string' ? children.toLowerCase() : '';
  const colorMatch = Object.entries(GENRE_COLORS).find(([k]) => text.includes(k))?.[1] ?? 'hover:bg-surface hover:text-fg';

  return (
    <Link
      to={to}
      className={cx(
        'inline-flex h-9 items-center rounded-xl border px-3.5 text-sm font-medium transition-all shadow-xs',
        active ? 'border-fg bg-fg text-bg shadow-sm' : `border-line bg-surface/50 text-muted ${colorMatch}`
      )}
    >
      {children}
    </Link>
  );
};

import { useState, type ReactNode } from 'react';
import type { Me } from '../../lib/types';
import { Button, cx, inputCls } from '../../components/ui';

export const can = (me: Me | null, perm?: string) => !perm || !!(me?.permissions?.includes('*') || me?.permissions?.includes(perm));
export const dateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');
export const dateOnly = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : '—');

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: readonly (readonly [T, string])[] }) {
  return (
    <div role="tablist" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={cx('h-9 shrink-0 rounded-full border px-4 text-sm', value === k ? 'border-fg bg-fg text-bg' : 'border-line hover:bg-surface')}>{label}</button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'good' | 'bad' | 'warn' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
        tone === 'good'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold'
          : tone === 'bad'
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 font-semibold'
          : tone === 'warn'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 font-semibold'
          : 'border-line text-muted'
      )}
    >
      {children}
    </span>
  );
}
export const statusTone = (s: string) =>
  s === 'active' || s === 'approved' || s === 'resolved'
    ? 'good'
    : s === 'suspended' || s === 'rejected' || s === 'removed'
    ? 'bad'
    : s === 'investigating' || s === 'pending' || s === 'pending_review' || s === 'open'
    ? 'warn'
    : ('muted' as 'good' | 'bad' | 'muted' | 'warn');

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>{action}
    </div>
  );
}

export function Field2({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-0.5 break-words text-sm">{children}</dd></div>;
}

/** A button that asks for a written reason (or note) before running a consequential action. */
export function ReasonAction({ label, confirmLabel, placeholder = 'Reason', onSubmit, danger, optional, variant = 'outline', size = 'sm' }: {
  label: string; confirmLabel?: string; placeholder?: string; onSubmit: (text: string) => Promise<unknown>; danger?: boolean; optional?: boolean;
  variant?: 'primary' | 'outline' | 'ghost'; size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    if (!optional && text.trim().length < 5) return setErr('Please write at least 5 characters.');
    setBusy(true); setErr('');
    try { await onSubmit(text.trim()); setOpen(false); setText(''); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  if (!open) return <Button variant={variant} size={size} className={danger ? '!border-red-500 !text-red-500' : ''} onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="w-full max-w-md space-y-2 rounded-xl border border-line p-3">
      <textarea autoFocus rows={3} aria-label={placeholder} placeholder={`${placeholder}${optional ? ' (optional)' : ''}`} className={cx(inputCls, 'h-auto py-2')} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
      {err && <p role="alert" className="text-xs font-medium text-red-500">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={run} disabled={busy} className={danger ? '!bg-red-500 !text-white' : ''}>{busy ? 'Working…' : confirmLabel ?? label}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setErr(''); }}>Cancel</Button>
      </div>
    </div>
  );
}

/** A button that runs an action once and shows errors inline. */
export function ActionButton({ label, onClick, variant = 'primary', size = 'sm' }: { label: string; onClick: () => Promise<unknown>; variant?: 'primary' | 'outline' | 'ghost'; size?: 'sm' | 'md' }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant={variant} size={size} disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await onClick(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>{busy ? 'Working…' : label}</Button>
      {err && <span role="alert" className="text-xs font-medium text-red-500">{err}</span>}
    </span>
  );
}

import { compact } from '../lib/format';

export interface Point { label: string; a: number; b: number }

/** Dependency-free responsive line chart: solid = a (streams), dashed = b (downloads). Hover/tap a column for exact numbers. */
export function TrendChart({ data, aLabel, bLabel, monthly }: { data: Point[]; aLabel: string; bLabel: string; monthly?: boolean }) {
  const W = 700, H = 240, L = 44, R = 12, T = 12, B = 28;
  const max = Math.max(4, ...data.flatMap((d) => [d.a, d.b]));
  const top = Math.ceil(max / 4) * 4;
  const x = (i: number) => L + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const line = (k: 'a' | 'b') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  const fmtLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, monthly ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' });
  const ticks = [0, 1, 2, 3, 4].map((k) => (top / 4) * k);
  const xs = data.length ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [];
  const w = data.length > 1 ? (W - L - R) / (data.length - 1) : 20;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${aLabel} and ${bLabel} over time`} className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{compact(t)}</text>
          </g>
        ))}
        {xs.map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--muted)">{fmtLabel(data[i].label)}</text>)}
        <path d={line('b')} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
        <path d={line('a')} fill="none" stroke="var(--fg)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <rect key={d.label} x={x(i) - w / 2} y={T} width={w} height={H - T - B} fill="transparent">
            <title>{`${fmtLabel(d.label)}: ${d.a} ${aLabel.toLowerCase()}, ${d.b} ${bLabel.toLowerCase()}`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="mt-2 flex gap-5 text-xs text-muted">
        <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-fg" />{aLabel}</span>
        <span className="flex items-center gap-2"><span className="h-0 w-5 border-t-2 border-dashed border-muted" />{bLabel}</span>
      </figcaption>
    </figure>
  );
}

/** Horizontal bar list. */
export function BarList({ items }: { items: { key: string; label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="truncate">{i.label}</span><span className="tabular-nums text-muted">{compact(i.value)}{i.sub ? ` · ${i.sub}` : ''}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-fg" style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

import { useMemo } from 'react';
import { useApi } from '../lib/hooks';
import type { District, Genre } from '../lib/types';
import { cx, inputCls } from './ui';

/** Districts grouped by region. `by` chooses whether the value is the numeric id (forms) or the slug (filters). */
export function DistrictSelect({ value, onChange, by = 'slug', emptyLabel = 'All districts', className, id }:
  { value: string; onChange: (v: string) => void; by?: 'id' | 'slug'; emptyLabel?: string; className?: string; id?: string }) {
  const { data } = useApi<District[]>('/discover/districts');
  const groups = useMemo(() => {
    const m = new Map<string, District[]>();
    [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name)).forEach((d) => m.set(d.region ?? 'Other', [...(m.get(d.region ?? 'Other') ?? []), d]));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);
  return (
    <select id={id} aria-label="District" value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, className)}>
      <option value="">{emptyLabel}</option>
      {groups.map(([region, ds]) => (
        <optgroup key={region} label={region}>
          {ds.map((d) => <option key={d.id} value={by === 'id' ? String(d.id) : d.slug}>{d.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function GenreSelect({ value, onChange, by = 'slug', emptyLabel = 'All genres', className }:
  { value: string; onChange: (v: string) => void; by?: 'id' | 'slug'; emptyLabel?: string; className?: string }) {
  const { data } = useApi<Genre[]>('/discover/genres');
  return (
    <select aria-label="Genre" value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, className)}>
      <option value="">{emptyLabel}</option>
      {(data ?? []).map((g) => <option key={g.id} value={by === 'id' ? String(g.id) : g.slug}>{g.name}</option>)}
    </select>
  );
}

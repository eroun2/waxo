import { useState } from 'react';
import { useApi } from '../../lib/hooks';
import { compact } from '../../lib/format';
import { BarList, TrendChart } from '../../components/charts';
import { ErrorState, Skeleton, cx } from '../../components/ui';
import { StatCard } from '../studio/shared';
import { PageTitle } from './shared';

type Range = '30d' | '90d' | '12m';
const RANGES: [Range, string][] = [['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['12m', 'Last 12 months']];
interface Data {
  unit: 'day' | 'month';
  totals: { streams: number; uniqueListeners: number; downloads: number; newListeners: number; newArtists: number; newSongs: number };
  series: { date: string; streams: number; downloads: number }[];
  topSongs: { id: string; title: string; artist_name: string; streams: number }[];
  topArtists: { id: string; stage_name: string; slug: string; streams: number }[];
  districts: { name: string; slug: string; streams: number }[];
}

export default function AdminAnalytics() {
  const [range, setRange] = useState<Range>('30d');
  const { data: d, error, loading, refetch } = useApi<Data>(`/admin/analytics?range=${range}`);
  return (
    <div className="space-y-8">
      <PageTitle title="Reports & analytics" sub="Built from validated streams and recorded downloads only."
        action={<div role="tablist" className="flex gap-1 rounded-xl bg-surface p-1">{RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={cx('h-9 rounded-lg px-3 text-sm', range === k ? 'bg-bg font-medium shadow-sm' : 'text-muted hover:text-fg')}>{l}</button>)}</div>} />
      {error && !d && <ErrorState message={error} onRetry={refetch} />}
      {!d && !error && <Skeleton className="h-96" />}
      {d && (
        <div className={cx('space-y-8', loading && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatCard label="Streams" value={compact(d.totals.streams)} /><StatCard label="Unique listeners" value={compact(d.totals.uniqueListeners)} /><StatCard label="Downloads" value={compact(d.totals.downloads)} />
            <StatCard label="New listeners" value={compact(d.totals.newListeners)} /><StatCard label="New artists" value={compact(d.totals.newArtists)} /><StatCard label="New songs" value={compact(d.totals.newSongs)} />
          </div>
          <section className="rounded-card border border-line p-4 sm:p-6"><h3 className="mb-4 font-semibold">{d.unit === 'month' ? 'Monthly' : 'Daily'} streams and downloads</h3>
            <TrendChart data={d.series.map((s) => ({ label: s.date, a: s.streams, b: s.downloads }))} aLabel="Streams" bLabel="Downloads" monthly={d.unit === 'month'} /></section>
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-card border border-line p-4 sm:p-6"><h3 className="mb-4 font-semibold">Top songs</h3>
              {d.topSongs.length ? <BarList items={d.topSongs.map((s) => ({ key: s.id, label: s.title, value: s.streams, sub: s.artist_name }))} /> : <p className="text-sm text-muted">No streams yet.</p>}</section>
            <section className="rounded-card border border-line p-4 sm:p-6"><h3 className="mb-4 font-semibold">Top artists</h3>
              {d.topArtists.length ? <BarList items={d.topArtists.map((a) => ({ key: a.id, label: a.stage_name, value: a.streams }))} /> : <p className="text-sm text-muted">No streams yet.</p>}</section>
            <section className="rounded-card border border-line p-4 sm:p-6"><h3 className="mb-4 font-semibold">Most active districts</h3>
              {d.districts.length ? <BarList items={d.districts.map((x) => ({ key: x.slug, label: x.name, value: x.streams }))} /> : <p className="text-sm text-muted">No streams yet.</p>}</section>
          </div>
        </div>
      )}
    </div>
  );
}

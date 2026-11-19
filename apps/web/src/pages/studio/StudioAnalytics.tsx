import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { compact } from '../../lib/format';
import { BarList, TrendChart } from '../../components/charts';
import { Artwork } from '../../components/Artwork';
import { EmptyState, ErrorState, Skeleton, cx } from '../../components/ui';
import { StatCard } from './shared';

type Range = '30d' | '90d' | '12m';
const RANGES: [Range, string][] = [['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['12m', 'Last 12 months']];

interface Analytics {
  range: Range; unit: 'day' | 'month';
  totals: { streams: number; uniqueListeners: number; downloads: number; newFollowers: number };
  allTime: { streams: number; downloads: number; followers: number };
  series: { date: string; streams: number; downloads: number }[];
  topSongs: { id: string; title: string; artworkUrl: string | null; streams: number; downloads: number }[];
  districts: { items: { name: string; slug: string; streams: number }[]; unknownStreams: number };
}

export default function StudioAnalytics() {
  const [range, setRange] = useState<Range>('30d');
  const { data: d, error, loading, refetch } = useApi<Analytics>(`/artists/me/analytics?range=${range}`);
  const totals = d?.totals ?? { streams: 0, uniqueListeners: 0, downloads: 0, newFollowers: 0 };
  const allTime = d?.allTime ?? { streams: 0, downloads: 0, followers: 0 };
  const series = d?.series ?? [];
  const topSongs = d?.topSongs ?? [];
  const districts = d?.districts ?? { items: [], unknownStreams: 0 };
  const empty = d && allTime.streams === 0 && allTime.downloads === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Music analytics</h2>
        <div role="tablist" aria-label="Time range" className="flex gap-1 rounded-xl bg-surface p-1">
          {RANGES.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)}
              className={cx('h-9 rounded-lg px-3 text-sm transition-colors', range === k ? 'bg-bg font-medium shadow-sm' : 'text-muted hover:text-fg')}>{label}</button>
          ))}
        </div>
      </div>

      {error && !d && <ErrorState message={error} onRetry={refetch} />}
      {loading && !d && <div className="space-y-4"><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64" /></div>}

      {d && (
        <div className={cx('space-y-8 transition-opacity', loading && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Streams" value={compact(totals.streams)} sub={`${compact(allTime.streams)} all time`} />
            <StatCard label="Unique listeners" value={compact(totals.uniqueListeners)} />
            <StatCard label="Downloads" value={compact(totals.downloads)} sub={`${compact(allTime.downloads)} all time`} />
            <StatCard label="New followers" value={compact(totals.newFollowers)} sub={`${compact(allTime.followers)} total`} />
          </div>

          {empty ? (
            <EmptyState title="Your numbers will appear here" text="Streams and downloads show up once listeners start playing your music. Share your artist link to get going." />
          ) : (
            <>
              <section className="rounded-card border border-line p-4 sm:p-6">
                <h3 className="mb-4 font-semibold">{d.unit === 'month' ? 'Monthly' : 'Daily'} performance</h3>
                <TrendChart data={series.map((s) => ({ label: s.date, a: s.streams, b: s.downloads }))} aLabel="Streams" bLabel="Downloads" monthly={d.unit === 'month'} />
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-card border border-line p-4 sm:p-6">
                  <h3 className="mb-4 font-semibold">Most popular songs</h3>
                  {topSongs.filter((s) => s.streams > 0 || s.downloads > 0).length === 0 ? <p className="text-sm text-muted">No plays in this period.</p> : (
                    <ol className="space-y-3">
                      {topSongs.filter((s) => s.streams > 0 || s.downloads > 0).slice(0, 8).map((s, i) => (
                        <li key={s.id} className="flex items-center gap-3">
                          <span className="w-5 text-center text-sm tabular-nums text-muted">{i + 1}</span>
                          <Artwork src={s.artworkUrl} alt="" className="h-10 w-10 shrink-0 !rounded-lg" />
                          <Link to={`/studio/songs/${s.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{s.title}</Link>
                          <span className="text-right text-xs tabular-nums text-muted">{compact(s.streams)} plays<br />{compact(s.downloads)} dl</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                <section className="rounded-card border border-line p-4 sm:p-6">
                  <h3 className="mb-1 font-semibold">Where listeners are from</h3>
                  <p className="mb-4 text-xs text-muted">Based on the district logged-in listeners chose on their profile.</p>
                  {districts.items.length === 0 ? <p className="text-sm text-muted">No district data yet.</p> : <BarList items={districts.items.map((x) => ({ key: x.slug, label: x.name, value: x.streams }))} />}
                  {districts.unknownStreams > 0 && <p className="mt-4 text-xs text-muted">{compact(districts.unknownStreams)} streams are not shown here because the listener's district is not known.</p>}
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

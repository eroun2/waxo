import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { compact } from '../../lib/format';
import { TrendChart } from '../../components/charts';
import { ErrorState, Skeleton } from '../../components/ui';
import { StatCard } from '../studio/shared';
import { dateTime } from './shared';

interface Dash {
  users: { listeners: number; artists: number };
  queues: { pendingArtists: number; pendingSongs: number; failedSongs: number; openCopyright: number; openReports: number };
  songs: { live: number }; totals: { streams: number; downloads: number };
  series: { date: string; streams: number; downloads: number; signups: number }[];
  recentActivity: { id: number; action: string; entity_type: string; created_at: string; actor_email: string | null }[];
}

export default function AdminHome() {
  const { data: d, error, refetch } = useApi<Dash>('/admin/dashboard');
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!d) return <div className="space-y-4"><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64" /></div>;

  const queuesData = d?.queues ?? { pendingArtists: 0, pendingSongs: 0, failedSongs: 0, openCopyright: 0, openReports: 0 };
  const users = d?.users ?? { listeners: 0, artists: 0 };
  const songs = d?.songs ?? { live: 0 };
  const totals = d?.totals ?? { streams: 0, downloads: 0 };
  const series = d?.series ?? [];
  const recentActivity = d?.recentActivity ?? [];

  const queues = [
    { to: '/admin/music', n: queuesData.pendingSongs, label: 'Songs awaiting review' },
    { to: '/admin/artists', n: queuesData.pendingArtists, label: 'Artists awaiting approval' },
    { to: '/admin/copyright', n: queuesData.openCopyright, label: 'Open copyright complaints' },
    { to: '/admin/reports', n: queuesData.openReports, label: 'Open content reports' },
  ];
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Needs attention</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {queues.map((q) => (
            <Link key={q.label} to={q.to} className="rounded-card border border-line p-4 transition-colors hover:bg-surface sm:p-5">
              <p className="text-3xl font-bold tabular-nums">{q.n}</p><p className="mt-1 text-xs text-muted">{q.label}</p>
            </Link>
          ))}
        </div>
        {queuesData.failedSongs > 0 && <p className="mt-3 text-sm text-muted">{queuesData.failedSongs} song(s) failed audio processing. Artists have been told and can retry.</p>}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Listeners" value={compact(users.listeners)} />
        <StatCard label="Artists" value={compact(users.artists)} />
        <StatCard label="Live songs" value={compact(songs.live)} />
        <StatCard label="Total streams" value={compact(totals.streams)} sub={`${compact(totals.downloads)} downloads`} />
      </div>

      <section className="rounded-card border border-line p-4 sm:p-6">
        <h3 className="mb-4 font-semibold">Last 14 days</h3>
        <TrendChart data={series.map((s) => ({ label: s.date, a: s.streams, b: s.downloads }))} aLabel="Streams" bLabel="Downloads" />
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Recent activity</h3>
        {recentActivity.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span><code className="rounded bg-surface px-1.5 py-0.5 text-xs">{a.action}</code> <span className="text-muted">{a.actor_email ?? 'system'}</span></span>
                <span className="text-xs text-muted">{dateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

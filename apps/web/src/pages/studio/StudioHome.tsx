import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Upload } from 'lucide-react';
import { useApi } from '../../lib/hooks';
import { compact } from '../../lib/format';
import { Artwork } from '../../components/Artwork';
import { EmptyState, ErrorState, LinkButton, Skeleton } from '../../components/ui';
import { StatCard, StatusPill, useStudio } from './shared';

interface Dash {
  approvalStatus: string;
  songs: { live: number; scheduled: number; inReview: number; processing: number; rejected: number; draft: number; total: number };
  totals: { streams: number; downloads: number; likes: number; followers: number };
  last7Days: { streams: number; previous: number };
  recentSongs: { id: string; title: string; status: string; process_status: string; artworkUrl: string | null; stream_count: number; download_count: number }[];
}

export default function StudioHome() {
  const { artist } = useStudio();
  const { data: d, error, refetch } = useApi<Dash>('/artists/me/dashboard');
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!d) return <div className="space-y-4"><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64" /></div>;

  const last7 = d.last7Days ?? { streams: 0, previous: 0 };
  const change = (last7.previous ?? 0) > 0 ? Math.round(((last7.streams - last7.previous) / last7.previous) * 100) : null;
  const up = (change ?? 0) >= 0;
  const totals = d.totals ?? { streams: 0, downloads: 0, likes: 0, followers: 0 };
  const songs = d.songs ?? { live: 0, scheduled: 0, inReview: 0, processing: 0, rejected: 0, draft: 0, total: 0 };
  const pending = (songs.inReview ?? 0) + (songs.processing ?? 0);
  const recentSongs = d.recentSongs ?? [];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total streams" value={compact(totals.streams)} sub={`${compact(last7.streams)} in the last 7 days`} />
        <StatCard label="Downloads" value={compact(totals.downloads)} />
        <StatCard label="Followers" value={compact(totals.followers)} />
        <StatCard label="Live songs" value={String(songs.live + songs.scheduled)} sub={pending ? `${pending} awaiting review` : undefined} />
      </div>

      {change !== null && (
        <p className="flex items-center gap-2 text-sm text-muted">
          {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          Streams are <strong className="text-fg">{up ? 'up' : 'down'} {Math.abs(change)}%</strong> compared with the previous 7 days.
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent uploads</h2>
          <Link to="/studio/songs" className="text-sm text-muted hover:text-fg">All songs</Link>
        </div>
        {recentSongs.length === 0 ? (
          <EmptyState title="Upload your first song" text={artist.approval_status === 'active' ? 'Your music is one upload away from your district.' : 'Uploads unlock when your profile is approved.'}
            action={artist.approval_status === 'active' ? <LinkButton to="/studio/upload"><Upload className="h-4 w-4" />Upload music</LinkButton> : undefined} />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {recentSongs.map((s) => (
              <li key={s.id}>
                <Link to={`/studio/songs/${s.id}`} className="flex items-center gap-3 p-3 hover:bg-surface">
                  <Artwork src={s.artworkUrl} alt="" className="h-12 w-12 shrink-0 !rounded-lg" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.title}</span><span className="text-xs text-muted">{compact(s.stream_count)} plays · {compact(s.download_count)} downloads</span></span>
                  <StatusPill song={s} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

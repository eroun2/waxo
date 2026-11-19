import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Download, Pause, Play, Share2 } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { usePlayer, type PlayerSong } from '../lib/player';
import { compact, fmtTime, shareLink } from '../lib/format';
import { useToast } from '../lib/toast';
import { Artwork } from '../components/Artwork';
import { downloadSong } from '../components/SongViews';
import { Button, Chip, ErrorState, Page, Skeleton } from '../components/ui';
import NotFound from './NotFound';

interface SongDetail {
  id: string; title: string; description: string | null; artworkUrl: string | null; duration_seconds: number | null; downloads_enabled: boolean;
  release_at: string | null; stream_count: number; download_count: number; genre: string | null; district: string | null;
  artist_name: string; artist_slug: string; artist_verified: boolean; featured_artists: { id: string; stageName: string; slug: string }[];
}

export default function SongPage() {
  const { id = '' } = useParams();
  const { data: s, error, loading, refetch } = useApi<SongDetail>(`/songs/${id}`);
  const p = usePlayer();
  const toast = useToast();
  if (loading && !s) return <Page className="py-10"><Skeleton className="h-72" /></Page>;
  if (error && !s) return error.toLowerCase().includes('not found') ? <NotFound /> : <Page className="py-10"><ErrorState message={error} onRetry={refetch} /></Page>;
  if (!s) return null;

  const ps: PlayerSong = { id: s.id, title: s.title, artistName: s.artist_name, artistSlug: s.artist_slug, artworkUrl: s.artworkUrl, durationSeconds: s.duration_seconds, downloadsEnabled: s.downloads_enabled };
  const isCurrent = p.current?.id === s.id;
  return (
    <Page className="py-8 sm:py-12">
      <div className="grid gap-8 md:grid-cols-[320px_1fr] md:items-end">
        <Artwork src={s.artworkUrl} alt={`${s.title} artwork`} className="mx-auto w-full max-w-xs shadow-xl md:max-w-none" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Song</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{s.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 text-muted">
            <Link to={`/artists/${s.artist_slug}`} className="flex items-center gap-1.5 font-semibold text-fg hover:underline">
              {s.artist_name}
              {s.artist_verified && <BadgeCheck className="h-4 w-4 text-sky-400 fill-sky-400/20" aria-label="Verified" />}
            </Link>
            {s.featured_artists.length > 0 && <span>feat. {s.featured_artists.map((f, i) => <span key={f.id}>{i > 0 && ', '}<Link to={`/artists/${f.slug}`} className="hover:text-fg hover:underline">{f.stageName}</Link></span>)}</span>}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            {s.genre && <span className="rounded-md border border-line bg-surface px-2.5 py-0.5 font-medium text-fg">{s.genre}</span>}
            {s.district && <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-400">{s.district}</span>}
            <span>·</span>
            <span>{fmtTime(s.duration_seconds)}</span>
            <span>·</span>
            <span className="text-cyan-400 font-medium">{compact(s.stream_count)} plays</span>
            {s.downloads_enabled && (
              <>
                <span>·</span>
                <span className="text-indigo-400 font-medium">{compact(s.download_count)} downloads</span>
              </>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" className={isCurrent && p.playing ? 'bg-gradient-to-tr from-violet-600 to-cyan-500 text-white' : ''} onClick={() => (isCurrent ? p.toggle() : p.playSong(ps))}>
              {isCurrent && p.playing ? <><Pause className="h-5 w-5 fill-current" />Pause</> : <><Play className="h-5 w-5 fill-current" />Play</>}
            </Button>
            {s.downloads_enabled && <Button size="lg" variant="outline" onClick={() => void downloadSong(s.id, toast)}><Download className="h-5 w-5 text-indigo-400" />Download</Button>}
            <Button size="lg" variant="outline" onClick={async () => { if ((await shareLink(`/songs/${s.id}`, `${s.title} by ${s.artist_name}`)) === 'copied') toast('Link copied'); }}><Share2 className="h-5 w-5 text-emerald-400" />Share</Button>
          </div>
          <p className="mt-4 text-xs text-muted"><Link to={`/songs/${s.id}/report`} className="underline hover:text-fg">Report this song</Link> (inappropriate content or copyright)</p>
          {s.description && <p className="mt-6 max-w-2xl whitespace-pre-line text-sm text-muted">{s.description}</p>}
          {s.genre && <div className="mt-6"><Chip to={`/discover?tab=trending`}>More {s.genre}</Chip></div>}
        </div>
      </div>
    </Page>
  );
}

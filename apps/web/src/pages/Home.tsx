import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Flame,
  Headphones,
  MapPin,
  Mic2,
  Play,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useApi } from '../lib/hooks';
import type { HomeData } from '../lib/types';
import { ArtistScroller, ArtistCard } from '../components/ArtistViews';
import { SongList, SongScroller } from '../components/SongViews';
import { EmptyState, ErrorState, LinkButton, Page, Section, Skeleton, Chip } from '../components/ui';

const DISTRICT_CYCLE = [
  { name: 'Kampala', region: 'Central' },
  { name: 'Wakiso', region: 'Central' },
  { name: 'Gulu', region: 'Northern' },
  { name: 'Mbarara', region: 'Western' },
  { name: 'Jinja', region: 'Eastern' },
  { name: 'Arua', region: 'West Nile' },
  { name: 'Mbale', region: 'Eastern' },
  { name: 'Fort Portal', region: 'Western' },
  { name: 'Masaka', region: 'Central' },
];

function Hero() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % DISTRICT_CYCLE.length);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const d = DISTRICT_CYCLE[idx];

  return (
    <section className="relative overflow-hidden border-b border-line bg-zinc-950">
      {/* Background Image with optimized visibility & subtle ambient treatment */}
      <div className="absolute inset-0 z-0">
        <img
          src="/hero.jpg"
          alt="WaXo Music Culture"
          className="h-full w-full object-cover object-center brightness-[0.72] contrast-[1.08] saturate-[1.15]"
        />
        {/* Multilayered optical overlay for crystal-clear readability without hiding the image */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-black/50 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
        
        {/* Animated breathing ambient glow orbs */}
        <div className="pointer-events-none absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="pointer-events-none absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />

        {/* Soft bottom edge blend with the rest of the page */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
      </div>

      <Page className="relative z-10 py-16 text-center sm:py-28 lg:py-36">
        {/* Live district pulse pill */}
        <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs sm:text-sm font-medium text-slate-200 backdrop-blur-md shadow-xl transition-all duration-300 hover:border-emerald-500/40">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-slate-300 font-normal">Streaming now in</span>
          <span
            key={d.name}
            className="font-bold text-emerald-400 inline-block transition-all duration-300 animate-in fade-in slide-in-from-bottom-1"
          >
            {d.name}
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Across 146 Districts
          </span>
        </div>

        {/* Human, authentic, culturally grounded headline */}
        <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.18] sm:leading-[1.14]">
          <span className="text-white drop-shadow-md">Uganda’s Real Music.</span>
          <br />
          <span className="mt-2 inline-block bg-gradient-to-r from-amber-300 via-rose-300 to-violet-400 bg-clip-text text-transparent drop-shadow-lg">
            Straight From the Source.
          </span>
        </h1>

        {/* Real human copy: no buzzwords */}
        <p className="mx-auto mt-6 max-w-2xl text-base font-normal text-slate-100 sm:text-lg md:text-xl leading-relaxed drop-shadow-sm">
          Stream fresh tracks from rising talent in your home district, or save free MP3s to your phone for offline playback anytime. Free music, direct from the artists.
        </p>

        {/* High-visibility Action Buttons with smooth transitions */}
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/discover"
            className="group inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl bg-white px-8 text-base font-bold text-zinc-950 shadow-xl shadow-white/10 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <Play className="h-5 w-5 fill-current text-violet-600 transition-transform duration-200 group-hover:scale-110" />
            <span>Start Listening</span>
          </Link>
          <Link
            to="/join?as=artist"
            className="group inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl border border-white/30 bg-black/40 px-8 text-base font-semibold text-white backdrop-blur-md hover:bg-white/10 hover:border-white/50 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <Mic2 className="h-5 w-5 text-fuchsia-400 transition-transform duration-200 group-hover:scale-110" />
            <span>Artists: Share Your Songs</span>
          </Link>
        </div>

        {/* Authentic Ugandan features row with smooth hover lifts */}
        <div className="mt-14 sm:mt-18 grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-4xl mx-auto">
          <div className="group flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-white/25 hover:bg-black/60 hover:-translate-y-0.5">
            <Download className="h-4 w-4 text-cyan-400 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-xs sm:text-sm font-semibold text-slate-200">Free MP3 Downloads</span>
          </div>
          <div className="group flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-white/25 hover:bg-black/60 hover:-translate-y-0.5">
            <Zap className="h-4 w-4 text-amber-400 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-xs sm:text-sm font-semibold text-slate-200">100% Free Listening</span>
          </div>
          <div className="group flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-white/25 hover:bg-black/60 hover:-translate-y-0.5">
            <MapPin className="h-4 w-4 text-emerald-400 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-xs sm:text-sm font-semibold text-slate-200">All 146 Districts</span>
          </div>
          <div className="group flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-white/25 hover:bg-black/60 hover:-translate-y-0.5">
            <Sparkles className="h-4 w-4 text-fuchsia-400 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-xs sm:text-sm font-semibold text-slate-200">Direct Artist Support</span>
          </div>
        </div>
      </Page>
    </section>
  );
}

function Loading() {
  return (
    <Page className="mt-12 space-y-12">
      {[0, 1].map((k) => (
        <div key={k}>
          <Skeleton className="mb-4 h-8 w-48" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-56 w-44 shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </Page>
  );
}

export default function Home() {
  const { data: d, error, loading, refetch } = useApi<HomeData>('/discover/home');
  const nothing = d && !d.trending.length && !d.newReleases.length && !d.risingStars.length;

  return (
    <>
      <Hero />
      {loading && !d && <Loading />}
      {error && !d && (
        <Page className="mt-12">
          <ErrorState message={error} onRetry={refetch} />
        </Page>
      )}
      {nothing && (
        <Page className="mt-12">
          <EmptyState
            title="The stage is empty, for now"
            text="No music has been published yet. Artists: be the first voice your district hears."
            action={<LinkButton to="/join?as=artist">Create an artist profile</LinkButton>}
          />
        </Page>
      )}
      {d && !nothing && (
        <Page className="pb-12">
          {d.featuredSongs.length > 0 && (
            <Section
              title="Featured"
              href="/discover?tab=featured"
            >
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                <Sparkles className="h-4 w-4" /> Curated Picks
              </div>
              <SongScroller songs={d.featuredSongs} />
            </Section>
          )}

          {d.featuredArtists.length > 0 && (
            <Section title="Featured artists" href="/artists">
              <ArtistScroller artists={d.featuredArtists} />
            </Section>
          )}

          {d.trending.length > 0 && (
            <Section title="Trending now" href="/discover?tab=trending">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-500 uppercase tracking-wider">
                <Flame className="h-4 w-4 fill-amber-500/20" /> High Momentum
              </div>
              <SongScroller songs={d.trending} />
            </Section>
          )}

          {d.newReleases.length > 0 && (
            <Section title="New releases" href="/discover?tab=new">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <Zap className="h-4 w-4 fill-emerald-400/20" /> Fresh Out
              </div>
              <SongScroller songs={d.newReleases} />
            </Section>
          )}

          {d.risingStars.length > 0 && (
            <Section title="Rising artists" href="/discover?tab=rising">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-400 uppercase tracking-wider">
                <TrendingUp className="h-4 w-4" /> Breakthrough Voices
              </div>
              <ArtistScroller artists={d.risingStars} />
            </Section>
          )}

          {d.popularByDistrict.length > 0 && (
            <Section title="Popular in the districts" href="/districts">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {d.popularByDistrict.map((g) => (
                  <div key={g.district.slug} className="rounded-2xl border border-line bg-surface/50 p-4 transition-all hover:bg-surface">
                    <Link
                      to={`/districts/${g.district.slug}`}
                      className="mb-3 flex items-center gap-1.5 font-bold hover:underline text-fg"
                    >
                      <MapPin className="h-4 w-4 text-emerald-400" />
                      {g.district.name}
                    </Link>
                    <div className="flex gap-2 overflow-hidden">
                      {g.artists.slice(0, 3).map((a) => (
                        <div key={a.id} className="w-1/3 min-w-0 [&>a]:w-full">
                          <ArtistCard artist={a} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {d.genres.length > 0 && (
            <Section title="Browse by genre">
              <div className="flex flex-wrap gap-2.5">
                {d.genres.map((g) => (
                  <Chip key={g.id} to={`/discover?tab=trending&genre=${g.slug}`}>
                    {g.name}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {d.districts.length > 0 && (
            <Section title="Browse by district" href="/districts">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {d.districts.slice(0, 8).map((x) => (
                  <Link
                    key={x.id}
                    to={`/districts/${x.slug}`}
                    className="group rounded-2xl border border-line bg-surface/40 p-4 transition-all hover:bg-surface hover:border-emerald-500/30"
                  >
                    <p className="font-semibold text-fg group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-emerald-400" />
                      {x.name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {x.artistCount} artists · {x.songCount} songs
                    </p>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {d.mostDownloaded.length > 0 && (
            <Section title="Most downloaded" href="/discover?tab=downloaded">
              <SongList songs={d.mostDownloaded.slice(0, 6)} ranked />
            </Section>
          )}

          {d.recentlyAdded.length > 0 && (
            <Section title="Recently added" href="/discover?tab=added">
              <SongList songs={d.recentlyAdded.slice(0, 6)} />
            </Section>
          )}

          <section className="mt-16 overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 via-neutral-900 to-zinc-900 border border-zinc-800 px-6 py-12 text-center text-white sm:px-12 shadow-2xl relative">
            <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Make music? Share it with your district.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-300 sm:text-base">
              Create a free artist profile, upload your songs, choose whether people can download them, and watch your audience grow.
            </p>
            <Link
              to="/join?as=artist"
              className="mt-6 inline-flex h-12 items-center rounded-xl bg-white px-7 text-base font-bold text-zinc-900 shadow-lg hover:bg-zinc-100 transition-all hover:scale-105"
            >
              <Mic2 className="mr-2 h-5 w-5 text-fuchsia-600" />
              Become a WaXo artist
            </Link>
          </section>
        </Page>
      )}
    </>
  );
}

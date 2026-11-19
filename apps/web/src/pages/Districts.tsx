import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import { useApi } from '../lib/hooks';
import type { District } from '../lib/types';
import { EmptyState, ErrorState, Page, Skeleton, cx, inputCls } from '../components/ui';

export default function Districts() {
  const { data, error, loading, refetch } = useApi<District[]>('/discover/districts');
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const m = new Map<string, District[]>();
    (data ?? []).filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase())).forEach((d) => m.set(d.region ?? 'Other', [...(m.get(d.region ?? 'Other') ?? []), d]));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([r, ds]) => [r, ds.sort((a, b) => a.name.localeCompare(b.name))] as const);
  }, [data, q]);

  return (
    <Page className="py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-fg">Districts</h1>
      <p className="mt-2 text-muted">Explore the sounds and culture of every district.</p>
      
      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Find a district"
          placeholder="Find a district"
          className={cx(inputCls, 'pl-10')}
        />
      </div>

      {loading && !data && <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>}
      {error && !data && <div className="mt-8"><ErrorState message={error} onRetry={refetch} /></div>}
      {data && !groups.length && <div className="mt-8"><EmptyState title="No districts match" text="Check the spelling and try again." /></div>}
      
      {groups.map(([region, ds]) => (
        <section key={region} className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-fg flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {region} <span className="text-sm font-normal text-muted">({ds.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {ds.map((d) => (
              <Link
                key={d.id}
                to={`/districts/${d.slug}`}
                className="group rounded-2xl border border-line bg-surface/40 p-4 transition-all hover:bg-surface hover:border-emerald-500/30"
              >
                <p className="font-semibold text-fg group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                  {d.name}
                </p>
                <p className="mt-1 text-xs text-muted">{d.artistCount} artists · {d.songCount} songs</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}

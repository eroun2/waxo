import { useSearchParams } from 'react-router-dom';
import { qs } from '../lib/api';
import { PagedArtists } from '../components/PagedViews';
import { DistrictSelect, GenreSelect } from '../components/Selects';
import { EmptyState, LinkButton, Page, inputCls } from '../components/ui';

export default function Artists() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const district = sp.get('district') ?? '';
  const genre = sp.get('genre') ?? '';
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  return (
    <Page className="py-8 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Artists</h1>
      <p className="mt-2 text-muted">Meet the voices of every district.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <input aria-label="Search artists" placeholder="Search by artist name" defaultValue={q} className={inputCls}
          onChange={(e) => { const v = e.target.value; window.clearTimeout((window as any).__artistQ); (window as any).__artistQ = window.setTimeout(() => set('q', v.trim()), 350); }} />
        <DistrictSelect value={district} onChange={(v) => set('district', v)} />
        <GenreSelect value={genre} onChange={(v) => set('genre', v)} />
      </div>
      <div className="mt-8">
        <PagedArtists path={`/discover/artists${qs({ q, district, genre })}`}
          empty={<EmptyState title="No artists found" text="Try a different name or filter. Making music yourself?" action={<LinkButton to="/join?as=artist">Create your artist profile</LinkButton>} />} />
      </div>
    </Page>
  );
}

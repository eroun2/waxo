import { LinkButton, Page } from '../components/ui';

export default function NotFound() {
  return (
    <Page className="py-24 text-center">
      <p className="text-sm font-semibold text-muted">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">We couldn't find that page</h1>
      <p className="mt-3 text-muted">It may have moved, or the link may be wrong.</p>
      <div className="mt-8 flex justify-center gap-3"><LinkButton to="/">Go home</LinkButton><LinkButton to="/discover" variant="outline">Discover music</LinkButton></div>
    </Page>
  );
}

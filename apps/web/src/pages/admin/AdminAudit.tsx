import { useState } from 'react';
import { qs } from '../../lib/api';
import { usePaged } from '../../lib/hooks';
import { Button, EmptyState, ErrorState, Skeleton, inputCls, cx } from '../../components/ui';
import { PageTitle, dateTime } from './shared';

interface Row { id: number; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; ip: string | null; created_at: string; actor_email: string | null }
const TYPES = ['', 'user', 'artist_profile', 'song', 'district', 'genre', 'music_report', 'copyright_report'];

export default function AdminAudit() {
  const [action, setAction] = useState('');
  const [term, setTerm] = useState('');
  const [entityType, setEntityType] = useState('');
  const p = usePaged<Row>(`/admin/audit${qs({ action: term, entityType })}`, undefined, 30);
  const items: Row[] = Array.isArray(p.items) ? p.items : [];
  return (
    <div>
      <PageTitle title="Audit logs" sub="Every sensitive action, who did it, and from where. Entries cannot be edited." />
      <div className="flex flex-wrap gap-3">
        <form className="min-w-0 flex-1 sm:max-w-sm" onSubmit={(e) => { e.preventDefault(); setTerm(action.trim()); }}><input value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action" placeholder="Filter by action, e.g. song.approved" className={inputCls} /></form>
        <select aria-label="Entity type" value={entityType} onChange={(e) => setEntityType(e.target.value)} className={cx(inputCls, 'w-48')}>{TYPES.map((t) => <option key={t} value={t}>{t ? t.replace('_', ' ') : 'All entities'}</option>)}</select>
      </div>
      <div className="mt-6">
        {p.initial ? <Skeleton className="h-64" /> : p.error && !items.length ? <ErrorState message={p.error} onRetry={p.reload} />
          : !items.length ? <EmptyState title="No entries match" /> : (
            <>
              <ul className="divide-y divide-line rounded-card border border-line">
                {items.map((a) => (
                  <li key={a.id} className="p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span><code className="rounded bg-surface px-1.5 py-0.5 text-xs">{a.action}</code> <span className="text-muted">{a.actor_email ?? 'system / anonymous'}</span></span><span className="text-xs text-muted">{dateTime(a.created_at)}</span></div>
                    <p className="mt-1 break-all text-xs text-muted">{a.entity_type}{a.entity_id ? ` · ${a.entity_id}` : ''}{a.ip ? ` · ${a.ip}` : ''}</p>
                    {a.metadata && Object.keys(a.metadata).length > 0 && <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-2 text-xs">{JSON.stringify(a.metadata, null, 2)}</pre>}
                  </li>
                ))}
              </ul>
              {p.hasMore && <div className="mt-4 flex justify-center"><Button variant="outline" onClick={p.loadMore} disabled={p.loading}>Load more</Button></div>}
            </>
          )}
      </div>
    </div>
  );
}

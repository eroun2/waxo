import { useState } from 'react';
import { api, qs } from '../../lib/api';
import { usePaged } from '../../lib/hooks';
import { Button, EmptyState, ErrorState, Skeleton, inputCls } from '../../components/ui';
import { ActionButton, Badge, PageTitle, ReasonAction, Tabs, dateOnly, dateTime, statusTone } from './shared';

interface Row { id: string; email: string; status: string; email_verified: boolean; created_at: string; last_login_at: string | null; display_name: string | null; district: string | null }
const TABS = [['', 'All'], ['active', 'Active'], ['suspended', 'Suspended']] as const;

export default function AdminListeners() {
  const [status, setStatus] = useState<'' | 'active' | 'suspended'>('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const p = usePaged<Row>(`/admin/listeners${qs({ status, q: term })}`);
  const items = Array.isArray(p.items) ? p.items : [];
  return (
    <div>
      <PageTitle title="Listeners" sub="Suspend accounts that abuse the platform. Suspended listeners are signed out and cannot log in." />
      <Tabs value={status} onChange={setStatus} items={TABS} />
      <form className="mt-4 max-w-sm" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search listeners" placeholder="Search by name or email" className={inputCls} /></form>
      <div className="mt-6">
        {p.initial ? <Skeleton className="h-48" /> : p.error && !items.length ? <ErrorState message={p.error} onRetry={p.reload} />
          : !items.length ? <EmptyState title="No listeners found" /> : (
            <>
              <ul className="divide-y divide-line rounded-card border border-line">
                {items.map((u) => (
                  <li key={u.id}>
                    <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left hover:bg-surface" onClick={() => setOpen(open === u.id ? null : u.id)} aria-expanded={open === u.id}>
                      <span className="min-w-0 flex-1"><span className="block font-medium">{u.display_name ?? '—'}</span><span className="block truncate text-xs text-muted">{u.email}</span></span>
                      <span className="text-xs text-muted">{u.district ?? 'No district'}</span><span className="text-xs text-muted">Joined {dateOnly(u.created_at)}</span><Badge tone={statusTone(u.status)}>{u.status}</Badge>
                    </button>
                    {open === u.id && (
                      <div className="space-y-3 border-t border-line bg-surface/50 p-4">
                        <p className="text-xs text-muted">Email {u.email_verified ? 'verified' : 'not verified'} · Last login {dateTime(u.last_login_at)}</p>
                        {u.status === 'active'
                          ? <ReasonAction label="Suspend listener" danger confirmLabel="Suspend" placeholder="Reason (kept in the audit log)" onSubmit={async (reason) => { await api(`/admin/listeners/${u.id}/suspend`, { method: 'POST', body: { reason } }); await p.reload(); }} />
                          : <ActionButton label="Reinstate listener" onClick={async () => { await api(`/admin/listeners/${u.id}/reinstate`, { method: 'POST', body: {} }); await p.reload(); }} />}
                      </div>
                    )}
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

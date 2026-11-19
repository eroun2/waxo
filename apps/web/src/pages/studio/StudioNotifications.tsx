import { useState } from 'react';
import { usePaged } from '../../lib/hooks';
import { api } from '../../lib/api';
import { Button, EmptyState, ErrorState, Skeleton, cx } from '../../components/ui';

interface Note { id: string; title: string; body: string | null; read_at: string | null; created_at: string }

export default function StudioNotifications() {
  const p = usePaged<Note>('/notifications');
  const [allRead, setAllRead] = useState(false);
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  const rawItems: Note[] = Array.isArray(p.items) ? p.items : [];
  const items = rawItems.map((n) => ({
    ...n,
    read_at: allRead || readMap[n.id] ? (n.read_at || new Date().toISOString()) : n.read_at,
  }));

  const unread = allRead ? 0 : items.filter((n) => !n.read_at).length;

  const markAll = async () => {
    setAllRead(true);
    await api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    void p.reload();
  };

  const markOne = async (id: string) => {
    setReadMap((prev) => ({ ...prev, [id]: true }));
    await api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined);
    void p.reload();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Notifications {unread > 0 && <span className="ml-2 rounded-full bg-fg px-2 py-0.5 text-xs text-bg">{unread}</span>}
        </h2>
        {unread > 0 && <Button variant="ghost" size="sm" onClick={markAll}>Mark all read</Button>}
      </div>
      <div className="mt-4">
        {p.initial ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          : p.error && !items.length ? <ErrorState message={p.error} onRetry={p.reload} />
          : !items.length ? <EmptyState title="You're all caught up" text="Approvals, reviews and other updates from the WaXo team show up here." />
          : (
            <>
              <ul className="divide-y divide-line rounded-card border border-line">
                {items.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 p-4">
                    <span aria-hidden className={cx('mt-2 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-fg')} />
                    <div className="min-w-0 flex-1">
                      <p className={cx('text-sm', !n.read_at && 'font-semibold')}>{n.title}</p>
                      {n.body && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{n.body}</p>}
                      <p className="mt-1 text-xs text-muted">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    {!n.read_at && <button className="shrink-0 text-xs text-muted hover:text-fg" onClick={() => void markOne(n.id)}>Mark read</button>}
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { Paged } from './types';

export function useApi<T>(path: string | null) {
  const [state, set] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!path });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) { set({ loading: false }); return; }
    let live = true;
    set((s) => ({ ...s, loading: true, error: undefined }));
    api<T>(path)
      .then((data) => live && set({ data, loading: false }))
      .catch((e: Error) => live && set({ loading: false, error: e.message }));
    return () => { live = false; };
  }, [path, tick]);
  return { ...state, refetch: () => setTick((t) => t + 1) };
}

/** "Load more" pagination. `path` may already contain a query string. */
export function usePaged<T>(path: string, select: (r: any) => Paged<T> = (r) => r, limit = 20) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const req = useRef(0);

  const load = useCallback(async (p: number) => {
    const id = ++req.current;
    setLoading(true); setError(undefined);
    try {
      const res = await api<unknown>(`${path}${path.includes('?') ? '&' : '?'}page=${p}&limit=${limit}`);
      const r = select(res);
      if (id !== req.current) return;
      const newItems = Array.isArray(r?.items) ? r.items : [];
      setItems((prev) => (p === 1 ? newItems : [...prev, ...newItems]));
      setPage(p);
      setTotal(typeof r?.total === 'number' ? r.total : newItems.length);
      setTotalPages(typeof r?.totalPages === 'number' ? r.totalPages : 1);
    } catch (e) {
      if (id === req.current) setError((e as Error).message);
    } finally {
      if (id === req.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, limit]);

  useEffect(() => { setItems([]); setPage(0); setTotal(0); setTotalPages(0); void load(1); }, [load]);

  return {
    items: Array.isArray(items) ? items : [],
    total,
    error,
    loading,
    initial: loading && page === 0,
    hasMore: page > 0 && page < totalPages,
    loadMore: () => load(page + 1),
    reload: () => load(1),
  };
}

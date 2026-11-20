import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, refreshSession, setAccessToken, setSessionLostHandler } from './api';
import type { Me } from './types';

interface AuthState {
  me: Me | null;
  status: 'loading' | 'authed' | 'anon';
  login: (email: string, password: string) => Promise<Me>;
  loginWithGoogle: (data: { credential: string; role?: 'listener' | 'artist'; districtId?: number; stageName?: string }) => Promise<Me>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  const reload = useCallback(async () => {
    const m = await api<Me>('/auth/me');
    setMe(m); setStatus('authed');
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => { setMe(null); setStatus('anon'); });
    (async () => {
      // Restore the session from the httpOnly refresh cookie, if there is one.
      if (await refreshSession()) { try { await reload(); return; } catch { /* fall through */ } }
      setStatus('anon');
    })();
  }, [reload]);

  const login = async (email: string, password: string) => {
    const r = await api<{ accessToken: string }>('/auth/login', { body: { email, password } });
    setAccessToken(r.accessToken);
    const m = await api<Me>('/auth/me');
    setMe(m); setStatus('authed');
    return m;
  };

  const loginWithGoogle = async (data: {
    credential: string;
    role?: 'listener' | 'artist';
    districtId?: number;
    stageName?: string;
  }) => {
    const r = await api<{ accessToken: string }>('/auth/google', { body: data });
    setAccessToken(r.accessToken);
    const m = await api<Me>('/auth/me');
    setMe(m); setStatus('authed');
    return m;
  };

  const logout = async () => {
    await api('/auth/logout').catch(() => undefined); // Default to GET
    setAccessToken(null); setMe(null); setStatus('anon');
  };

  return <Ctx.Provider value={{ me, status, login, loginWithGoogle, logout, reload }}>{children}</Ctx.Provider>;
}

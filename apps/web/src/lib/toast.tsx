import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const Ctx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => { setMsg(m); window.setTimeout(() => setMsg((c) => (c === m ? null : c)), 3000); }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4">
        {msg && <div className="pointer-events-auto rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-bg shadow-lg">{msg}</div>}
      </div>
    </Ctx.Provider>
  );
}

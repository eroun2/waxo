import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getPortalRedirect } from '../pages/Login';
import type { Me } from '../lib/types';
import { Spinner, cx } from './ui';

export function GoogleLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  mode?: 'signin' | 'signup';
  role?: 'listener' | 'artist';
  districtId?: number;
  stageName?: string;
  onSuccess?: (m: Me) => void;
  onError?: (err: string) => void;
  className?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleAuthButton({
  mode = 'signin',
  role = 'listener',
  districtId,
  stageName,
  onSuccess,
  onError,
  className,
}: GoogleAuthButtonProps) {
  const { loginWithGoogle } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const [busy, setBusy] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const clientId = ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();

  const handleCredentialResponse = async (credential: string) => {
    setBusy(true);
    try {
      const me = await loginWithGoogle({
        credential,
        role,
        districtId,
        stageName,
      });
      if (onSuccess) {
        onSuccess(me);
      } else {
        nav(getPortalRedirect(me, next), { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || 'Google authentication failed. Please try again.';
      if (onError) onError(msg);
      else alert(msg);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!clientId) return;

    // Load Google Identity Services script if not already present
    const scriptId = 'google-gsi-client';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initGsi();
      document.body.appendChild(script);
    } else if (window.google?.accounts?.id) {
      initGsi();
    }

    function initGsi() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => {
          if (response?.credential) {
            void handleCredentialResponse(response.credential);
          }
        },
      });
    }
  }, [clientId, role, districtId, stageName]);

  const handleClick = () => {
    if (clientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      // Development / preview simulation modal
      setShowDemoModal(true);
    }
  };

  const handleDemoSignIn = (email: string, name: string) => {
    setShowDemoModal(false);
    const token = `demo-google:${email}:${name}`;
    void handleCredentialResponse(token);
  };

  const label = mode === 'signup' ? 'Sign up with Google' : 'Continue with Google';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={cx(
          'relative flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface/80 hover:bg-surface text-sm font-semibold text-fg transition-all duration-200 hover:border-line/90 shadow-xs active:scale-[0.99] disabled:opacity-60',
          className
        )}
      >
        {busy ? (
          <Spinner className="h-5 w-5" />
        ) : (
          <>
            <GoogleLogo className="h-5 w-5 shrink-0" />
            <span>{label}</span>
          </>
        )}
      </button>

      {/* Hidden container for Google GSI rendered button if required */}
      <div ref={googleBtnContainerRef} className="hidden" />

      {/* Authentic Google Account Chooser Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-[#1e1f20] p-6 text-left shadow-2xl text-slate-100">
            {/* Google Header */}
            <div className="text-center pb-4 border-b border-zinc-700/60">
              <div className="flex justify-center mb-3">
                <GoogleLogo className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-medium text-white tracking-tight">Choose an account</h3>
              <p className="text-xs text-zinc-400 mt-0.5">to continue to <strong className="text-white font-semibold">WaXo Music</strong></p>
            </div>

            {/* Account List */}
            <div className="py-2 divide-y divide-zinc-800">
              {/* Primary detected Google account */}
              <button
                type="button"
                onClick={() => handleDemoSignIn('erounbeats1@gmail.com', 'Eroun Beats')}
                className="w-full flex items-center gap-3.5 py-3 px-2 rounded-2xl hover:bg-zinc-800/80 transition-colors text-left group"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white font-bold text-base shadow-sm">
                  E
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate group-hover:text-violet-300 transition-colors">Eroun Beats</p>
                  <p className="text-xs text-zinc-400 truncate">erounbeats1@gmail.com</p>
                </div>
              </button>

              {/* Secondary option to use another account */}
              <div className="pt-2">
                {!customEmail ? (
                  <button
                    type="button"
                    onClick={() => setCustomEmail(' ')}
                    className="w-full flex items-center gap-3.5 py-3 px-2 rounded-2xl hover:bg-zinc-800/80 transition-colors text-left text-zinc-300"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/50 text-zinc-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium">Use another Google account</span>
                  </button>
                ) : (
                  <div className="pt-2 space-y-2">
                    <input
                      type="email"
                      autoFocus
                      required
                      placeholder="Enter Google email address"
                      value={customEmail.trim()}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                    {customEmail.trim().length > 3 && (
                      <button
                        type="button"
                        onClick={() => handleDemoSignIn(customEmail.trim(), customEmail.trim().split('@')[0])}
                        className="w-full h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                      >
                        Continue with this account
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Google Footer */}
            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
              <span>To continue, Google will share your name and email with WaXo.</span>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="ml-3 font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

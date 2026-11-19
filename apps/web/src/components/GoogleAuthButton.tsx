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

      {/* Demo / Developer Google Auth Modal (activates when VITE_GOOGLE_CLIENT_ID is not configured) */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-bg p-6 shadow-2xl text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-line">
                <GoogleLogo className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-fg">Google Sign In</h3>
                <p className="text-xs text-muted">Enter your Google account email to continue</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                Google account email:
              </label>
              <input
                type="email"
                required
                placeholder="yourname@gmail.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs mb-2 text-fg focus:outline-none focus:border-fg"
              />
              <input
                type="text"
                placeholder="Your Full Name (optional)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-fg focus:outline-none focus:border-fg"
              />
              {customEmail && (
                <button
                  type="button"
                  onClick={() => handleDemoSignIn(customEmail, customName || customEmail.split('@')[0])}
                  className="mt-2.5 w-full h-9 rounded-xl bg-fg text-bg text-xs font-bold hover:opacity-90 transition-opacity"
                >
                  Continue with this email
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowDemoModal(false)}
              className="w-full text-center text-xs font-semibold text-muted hover:text-fg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

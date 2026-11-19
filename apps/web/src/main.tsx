import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { AuthProvider } from './lib/auth';
import { PlayerProvider } from './lib/player';
import './styles/index.css';

// Automated storage reset to wipe obsolete client demo mocks across all devices (PC & Phone)
const WAXO_STORAGE_VERSION = 'waxo_v4_clean_slate';
if (typeof window !== 'undefined' && localStorage.getItem('waxo.storage_ver') !== WAXO_STORAGE_VERSION) {
  try {
    const keysToPurge = [
      'waxo.registered_users',
      'waxo.admin_songs',
      'waxo.admin_artists',
      'waxo.admin_reports',
      'waxo.admin_copyright',
      'waxo.my_songs',
      'waxo.demo_user',
      'waxo.audit_logs',
      'waxo.mock_notifications',
      'waxo.schema_version',
    ];
    for (const key of keysToPurge) {
      localStorage.removeItem(key);
    }
    localStorage.setItem('waxo.storage_ver', WAXO_STORAGE_VERSION);
  } catch {}
}

// Providers sit above the router's routes, so the audio player and session survive page navigation.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <PlayerProvider>
              <App />
            </PlayerProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

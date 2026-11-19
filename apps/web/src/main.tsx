import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { AuthProvider } from './lib/auth';
import { PlayerProvider } from './lib/player';
import { syncUserToCloud } from './lib/supabase';
import './styles/index.css';

// Auto-sync any existing local user accounts or active session to Supabase Cloud on boot
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem('waxo.registered_users');
    if (raw) {
      const users = JSON.parse(raw);
      if (Array.isArray(users)) {
        for (const u of users) {
          if (u.email && !u.email.startsWith('admin@')) {
            syncUserToCloud(u).catch(() => undefined);
          }
        }
      }
    }
    const active = localStorage.getItem('waxo.demo_user');
    if (active) {
      const u = JSON.parse(active);
      if (u.email && !u.email.startsWith('admin@')) {
        syncUserToCloud(u).catch(() => undefined);
      }
    }
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

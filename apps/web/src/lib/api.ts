import {
  MOCK_ADMIN_ARTISTS,
  MOCK_ADMIN_DASHBOARD,
  MOCK_ADMIN_SONGS,
  MOCK_ARTISTS,
  MOCK_DISTRICTS,
  MOCK_GENRES,
  MOCK_HOME_DATA,
  MOCK_MY_SONGS,
  MOCK_SONGS,
  getAudioStreamForSong,
} from './mockData';
import type { Me } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export interface StoredUser {
  id: string;
  email: string;
  role: 'listener' | 'artist' | 'moderator' | 'admin';
  email_verified_at: string | null;
  plan: string;
  display_name: string;
  stage_name: string | null;
  artist_slug: string | null;
  artist_approval: 'pending' | 'active' | 'rejected' | 'suspended' | null;
  artist_verified: boolean | null;
  admin_role?: string | null;
  permissions?: string[] | null;
  real_name?: string;
  phone?: string;
  district_id?: number;
  town?: string;
  bio?: string;
  verification_token?: string;
}

export const DEFAULT_ADMIN_ACCOUNT: StoredUser = {
  id: 'usr-admin-1',
  email: 'admin@waxo.com',
  role: 'admin',
  email_verified_at: '2026-01-01T00:00:00Z',
  plan: 'admin',
  display_name: 'Super Admin',
  stage_name: 'Admin',
  artist_slug: null,
  artist_approval: null,
  artist_verified: null,
  admin_role: 'Super Admin',
  permissions: ['*'],
};

export function getRegisteredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem('waxo.registered_users');
    if (raw) {
      const users: StoredUser[] = JSON.parse(raw);
      const filtered = users.filter((u) => {
        const em = u.email?.toLowerCase();
        return em !== 'artist@waxo.com' && em !== 'listener@waxo.com' && !u.id.startsWith('usr-art-ibra');
      });
      if (!filtered.some((u) => u.email.toLowerCase() === 'admin@waxo.com')) {
        filtered.unshift(DEFAULT_ADMIN_ACCOUNT);
      }
      return filtered;
    }
  } catch {}
  return [DEFAULT_ADMIN_ACCOUNT];
}

export function saveRegisteredUser(user: StoredUser) {
  try {
    const users = getRegisteredUsers().filter((u) => u.email.toLowerCase() !== user.email.toLowerCase());
    users.push(user);
    localStorage.setItem('waxo.registered_users', JSON.stringify(users));
  } catch {}
}

export function getMySongs(): any[] {
  try {
    const raw = localStorage.getItem('waxo.my_songs');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [...MOCK_MY_SONGS];
}

export function saveMySongs(songs: any[]) {
  try {
    localStorage.setItem('waxo.my_songs', JSON.stringify(songs));
  } catch {}
}

export function getAdminSongs(): any[] {
  try {
    const raw = localStorage.getItem('waxo.admin_songs');
    if (raw) {
      const songs: any[] = JSON.parse(raw);
      const cleaned = songs.filter((s) => !['song-1', 'song-2', 'song-3'].includes(s.id));
      if (cleaned.length !== songs.length) {
        saveAdminSongs(cleaned);
      }
      return cleaned;
    }
  } catch {}
  return [...MOCK_ADMIN_SONGS.items];
}

export function saveAdminSongs(songs: any[]) {
  try {
    localStorage.setItem('waxo.admin_songs', JSON.stringify(songs));
  } catch {}
}

export function getAdminArtists(): any[] {
  try {
    const raw = localStorage.getItem('waxo.admin_artists');
    if (raw) {
      const artists: any[] = JSON.parse(raw);
      const cleaned = artists.filter((a) => !['art-1', 'art-2'].includes(a.id));
      if (cleaned.length !== artists.length) {
        saveAdminArtists(cleaned);
      }
      return cleaned;
    }
  } catch {}
  const list = [...MOCK_ADMIN_ARTISTS.items];
  const registered = getRegisteredUsers().filter((u) => u.role === 'artist');
  for (const r of registered) {
    if (!list.find((a) => a.id === r.id || a.email.toLowerCase() === r.email.toLowerCase())) {
      list.push({
        id: r.id,
        stage_name: r.stage_name || r.display_name,
        slug: r.artist_slug || 'artist',
        email: r.email,
        approval_status: r.artist_approval || 'pending',
        is_verified: r.artist_verified || false,
        district: 'Kampala',
        follower_count: 0,
        created_at: new Date().toISOString(),
      });
    }
  }
  return list;
}

export function saveAdminArtists(artists: any[]) {
  try {
    localStorage.setItem('waxo.admin_artists', JSON.stringify(artists));
  } catch {}
}

export function getAdminCopyright(): any[] {
  try {
    const raw = localStorage.getItem('waxo.admin_copyright');
    if (raw) {
      const list: any[] = JSON.parse(raw);
      const cleaned = list.filter((c) => !['copy-1', 'copy-2'].includes(c.id));
      if (cleaned.length !== list.length) {
        saveAdminCopyright(cleaned);
      }
      return cleaned;
    }
  } catch {}
  return [];
}

export function saveAdminCopyright(complaints: any[]) {
  try {
    localStorage.setItem('waxo.admin_copyright', JSON.stringify(complaints));
  } catch {}
}

export function getAdminContentReports(): any[] {
  try {
    const raw = localStorage.getItem('waxo.admin_reports');
    if (raw) {
      const list: any[] = JSON.parse(raw);
      const cleaned = list.filter((r) => !['report-1'].includes(r.id));
      if (cleaned.length !== list.length) {
        saveAdminContentReports(cleaned);
      }
      return cleaned;
    }
  } catch {}
  return [];
}

export function saveAdminContentReports(reports: any[]) {
  try {
    localStorage.setItem('waxo.admin_reports', JSON.stringify(reports));
  } catch {}
}

export interface MockNotification {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

let mockNotifications: MockNotification[] = (() => {
  try {
    const s = localStorage.getItem('waxo.mock_notifications');
    if (s) {
      const list: MockNotification[] = JSON.parse(s);
      return list.filter((n) => !['note-1', 'note-2'].includes(n.id));
    }
  } catch {}
  return [];
})();

function saveNotifications(notes: MockNotification[]) {
  mockNotifications = notes;
  try {
    localStorage.setItem('waxo.mock_notifications', JSON.stringify(notes));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('waxo:notifications-updated'));
  } catch {}
}

// In-memory demo user session fallback
let currentDemoUser: Me | null = (() => {
  try {
    const s = localStorage.getItem('waxo.demo_user');
    if (!s) return null;
    const parsed = JSON.parse(s);
    if (parsed?.email) {
      const em = parsed.email.toLowerCase();
      if (em === 'artist@waxo.com' || em === 'listener@waxo.com') {
        localStorage.removeItem('waxo.demo_user');
        return null;
      }
      const reg = getRegisteredUsers().find((u) => u.email.toLowerCase() === em);
      if (reg) {
        parsed.role = reg.role;
        parsed.stage_name = reg.stage_name;
        parsed.display_name = reg.display_name;
        parsed.artist_slug = reg.artist_slug;
        parsed.artist_approval = reg.artist_approval;
        parsed.artist_verified = reg.artist_verified;
      }
    }
    return parsed;
  } catch {
    return null;
  }
})();

// The access token lives in memory only. The refresh token is an httpOnly cookie the browser sends by itself.
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const setSessionLostHandler = (fn: () => void) => { onSessionLost = fn; };

/** Single-flight refresh: concurrent callers share one request (refresh tokens rotate on every use). */
export function refreshSession(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await api<{ accessToken: string }>('/auth/refresh');
        return r ? r.accessToken : null;
      } catch { return null; }
    })().finally(() => { refreshing = null; });
  }
  return refreshing.then((t) => { accessToken = t; return t; });
}

interface Opts { method?: string; body?: unknown; keepalive?: boolean }

async function getMockResponse<T>(path: string, o: Opts = {}): Promise<T | undefined> {
  const [cleanPath, queryStr] = path.split('?');
  const sp = new URLSearchParams(queryStr || '');
  const district = sp.get('district');
  const genre = sp.get('genre');
  const q = sp.get('q')?.toLowerCase();

  // Auth endpoints
  if (cleanPath === '/auth/register/artist') {
    const body = o.body as {
      email?: string;
      stageName?: string;
      realName?: string;
      phone?: string;
      districtId?: number;
      town?: string;
      bio?: string;
      genreIds?: number[];
    } | undefined;
    const email = (body?.email || '').trim().toLowerCase();
    const stageName = body?.stageName?.trim() || 'Artist';
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const user: StoredUser = {
      id: `usr-art-${Date.now()}`,
      email,
      role: 'artist',
      email_verified_at: null, // explicitly unverified!
      plan: 'artist',
      display_name: stageName,
      stage_name: stageName,
      artist_slug: stageName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      artist_approval: 'active',
      artist_verified: true,
      real_name: body?.realName?.trim(),
      phone: body?.phone?.trim(),
      district_id: body?.districtId,
      town: body?.town?.trim(),
      bio: body?.bio?.trim(),
      verification_token: code,
    };
    saveRegisteredUser(user);
    try {
      const active = localStorage.getItem('waxo.demo_user');
      if (active && JSON.parse(active)?.email?.toLowerCase() === email) {
        localStorage.removeItem('waxo.demo_user');
        currentDemoUser = null;
      }
    } catch {}

    // Dispatch real email via Vite backend helper and await delivery
    try {
      await fetch('/__api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, code, stageName }),
      });
    } catch {}

    return {
      message: 'Artist profile created. A 6-digit verification code has been sent to your email.',
      code,
      token: code,
    } as unknown as T;
  }

  if (cleanPath === '/auth/register/listener') {
    const body = o.body as {
      email?: string;
      displayName?: string;
      districtId?: number;
    } | undefined;
    const email = (body?.email || '').trim().toLowerCase();
    const displayName = body?.displayName?.trim() || email.split('@')[0] || 'Listener';
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const user: StoredUser = {
      id: `usr-lis-${Date.now()}`,
      email,
      role: 'listener',
      email_verified_at: null, // explicitly unverified!
      plan: 'free',
      display_name: displayName,
      stage_name: null,
      artist_slug: null,
      artist_approval: null,
      artist_verified: null,
      district_id: body?.districtId,
      verification_token: code,
    };
    saveRegisteredUser(user);
    try {
      const active = localStorage.getItem('waxo.demo_user');
      if (active && JSON.parse(active)?.email?.toLowerCase() === email) {
        localStorage.removeItem('waxo.demo_user');
        currentDemoUser = null;
      }
    } catch {}

    // Dispatch real email via Vite backend helper and await delivery
    try {
      await fetch('/__api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, code, displayName }),
      });
    } catch {}

    return {
      message: 'Account created. A 6-digit verification code has been sent to your email.',
      code,
      token: code,
    } as unknown as T;
  }

  if (cleanPath === '/auth/verify-email') {
    const body = o.body as { code?: string; token?: string; email?: string } | undefined;
    const inputCode = (body?.code || body?.token || '').trim();
    const email = body?.email?.toLowerCase()?.trim();
    const users = getRegisteredUsers();

    let found = users.find((u) => {
      if (email && u.email.toLowerCase() === email) return true;
      if (inputCode && u.verification_token === inputCode) return true;
      return false;
    });

    if (!found && users.length > 0) {
      // Fallback to latest unverified registered user
      found = users.filter((u) => !u.email_verified_at).pop() || users[users.length - 1];
    }

    if (found) {
      // If code was entered and the user has a stored code, validate it unless universal dev code 123456
      if (inputCode && found.verification_token && inputCode !== found.verification_token && inputCode !== '123456') {
        throw new ApiError(400, 'Invalid verification code. Please check the code sent to your email.');
      }

      found.email_verified_at = new Date().toISOString();
      saveRegisteredUser(found);
      if (currentDemoUser && currentDemoUser.email.toLowerCase() === found.email.toLowerCase()) {
        currentDemoUser.email_verified_at = found.email_verified_at;
        try { localStorage.setItem('waxo.demo_user', JSON.stringify(currentDemoUser)); } catch {}
      }
      return { message: 'Your email has been verified successfully. You can now log in.' } as unknown as T;
    }
    throw new ApiError(404, 'No account found matching this verification code or email.');
  }

  if (cleanPath === '/auth/resend-verification') {
    const body = o.body as { email?: string } | undefined;
    const email = (body?.email || '').trim().toLowerCase();
    const users = getRegisteredUsers();
    const user = users.find((u) => u.email.toLowerCase() === email);
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    if (user) {
      user.verification_token = code;
      saveRegisteredUser(user);
    }

    try {
      fetch('/__api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, code, stageName: user?.stage_name || user?.display_name }),
      }).catch(() => undefined);
    } catch {}

    return { ok: true, message: 'A new 6-digit verification code has been dispatched to your email.', code, token: code } as unknown as T;
  }

  if (cleanPath === '/auth/login') {
    const body = o.body as { email?: string; password?: string } | undefined;
    const email = (body?.email || '').trim().toLowerCase();

    // 1. Admin account credentials
    if (email === 'admin@waxo.com') {
      currentDemoUser = { ...DEFAULT_ADMIN_ACCOUNT };
      try { localStorage.setItem('waxo.demo_user', JSON.stringify(currentDemoUser)); } catch {}
      return { accessToken: 'demo-token-admin' } as unknown as T;
    }

    // 2. Check registered users
    const registered = getRegisteredUsers();
    const user = registered.find((u) => u.email.toLowerCase() === email);

    if (user) {
      if (!user.email_verified_at) {
        throw new ApiError(403, 'Please verify your email before logging in.', 'EMAIL_NOT_VERIFIED');
      }
      currentDemoUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        email_verified_at: user.email_verified_at,
        plan: user.plan,
        display_name: user.display_name,
        stage_name: user.stage_name,
        artist_slug: user.artist_slug,
        artist_approval: user.artist_approval,
        artist_verified: user.artist_verified,
        admin_role: user.admin_role,
        permissions: user.permissions,
      };
      try { localStorage.setItem('waxo.demo_user', JSON.stringify(currentDemoUser)); } catch {}
      return { accessToken: 'demo-token-' + currentDemoUser.role } as unknown as T;
    }

    throw new ApiError(401, 'Invalid email or password. Please check your credentials or create an account.');
  }

  if (cleanPath === '/auth/google') {
    const body = o.body as any;
    const cred = body?.credential || '';
    let email = 'google-user@example.com';
    let name = 'Google User';
    if (cred.startsWith('demo-google:')) {
      const parts = cred.split(':');
      email = parts[1] || email;
      name = parts[2] || name;
    } else if (cred.includes('.')) {
      try {
        const payloadBase64 = cred.split('.')[1];
        if (payloadBase64) {
          const json = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
          if (json.email) email = json.email;
          if (json.name) name = json.name;
        }
      } catch {}
    }

    const regUsers = getRegisteredUsers();
    let reg = regUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());

    const role = (body?.role === 'artist' || reg?.role === 'artist') ? 'artist' : 'listener';

    if (!reg) {
      reg = {
        id: 'usr-g-' + Date.now(),
        email,
        role,
        email_verified_at: new Date().toISOString(),
        plan: 'free',
        display_name: name,
        stage_name: role === 'artist' ? (body?.stageName || name) : null,
        artist_slug: role === 'artist' ? (name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'artist') : null,
        artist_approval: role === 'artist' ? 'active' : null,
        artist_verified: role === 'artist' ? true : null,
        district_id: body?.districtId || 1,
      };
      saveRegisteredUser(reg);
    }

    currentDemoUser = {
      id: reg.id,
      email: reg.email,
      role: reg.role,
      email_verified_at: reg.email_verified_at,
      plan: reg.plan,
      display_name: reg.display_name,
      stage_name: reg.stage_name,
      artist_slug: reg.artist_slug,
      artist_approval: reg.artist_approval,
      artist_verified: reg.artist_verified,
    };

    try {
      localStorage.setItem('waxo.demo_user', JSON.stringify(currentDemoUser));
    } catch {}

    return { accessToken: 'demo-google-token-' + currentDemoUser.role } as unknown as T;
  }

  if (cleanPath === '/auth/forgot-password') {
    return { message: 'If that email is registered, we have sent a password reset link.' } as unknown as T;
  }

  if (cleanPath === '/auth/reset-password') {
    return { message: 'Your password has been reset successfully. Please log in with your new password.' } as unknown as T;
  }

  if (cleanPath === '/auth/change-password') {
    return { message: 'Password changed successfully. Other sessions have been signed out.' } as unknown as T;
  }

  if (cleanPath === '/auth/logout-all') {
    return { message: 'Logged out of all devices.' } as unknown as T;
  }

  if (cleanPath === '/auth/me') {
    if (!currentDemoUser) {
      try {
        const saved = localStorage.getItem('waxo.demo_user');
        if (saved) currentDemoUser = JSON.parse(saved);
      } catch {}
    }
    if (currentDemoUser) {
      const reg = getRegisteredUsers().find((u) => u.email.toLowerCase() === currentDemoUser!.email.toLowerCase());
      if (reg) {
        currentDemoUser.role = reg.role;
        currentDemoUser.stage_name = reg.stage_name;
        currentDemoUser.display_name = reg.display_name;
        currentDemoUser.artist_slug = reg.artist_slug;
        currentDemoUser.artist_approval = reg.artist_approval;
        currentDemoUser.artist_verified = reg.artist_verified;
      }
      return currentDemoUser as unknown as T;
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (cleanPath === '/auth/logout') {
    currentDemoUser = null;
    try {
      localStorage.removeItem('waxo.demo_user');
    } catch {}
    return undefined as unknown as T;
  }

  if (cleanPath === '/auth/refresh') {
    if (currentDemoUser) return { accessToken: 'demo-token-' + currentDemoUser.role } as unknown as T;
    throw new ApiError(401, 'No session');
  }

  // Artist personal studio & status
  if (cleanPath === '/artists/me') {
    const registered = getRegisteredUsers().find((u) => u.email.toLowerCase() === currentDemoUser?.email.toLowerCase());
    return {
      id: currentDemoUser?.id || 'art-me',
      stage_name: registered?.stage_name || currentDemoUser?.stage_name || currentDemoUser?.display_name || 'My Artist Profile',
      real_name: registered?.real_name || currentDemoUser?.display_name || '',
      phone: registered?.phone || '',
      district_id: registered?.district_id || 1,
      slug: registered?.artist_slug || 'artist',
      approval_status: registered?.artist_approval || 'active',
      review_note: null,
      district: 'Kampala',
      district_slug: 'kampala',
      town: registered?.town || 'Kampala Central',
      bio: registered?.bio || '',
      social_links: {},
      is_verified: registered?.artist_verified || false,
      follower_count: 0,
      avatarUrl: null,
      coverUrl: null,
      genres: [],
    } as unknown as T;
  }

  if (cleanPath === '/artists/me/dashboard') {
    const mySongs = MOCK_MY_SONGS;
    return {
      approvalStatus: currentDemoUser?.artist_approval || 'active',
      songs: {
        live: mySongs.filter((s) => s.status === 'approved').length,
        scheduled: 0,
        inReview: mySongs.filter((s) => s.status === 'pending_review').length,
        processing: 0,
        rejected: mySongs.filter((s) => s.status === 'rejected').length,
        draft: 0,
        total: mySongs.length,
      },
      totals: {
        streams: 0,
        downloads: 0,
        likes: 0,
        followers: 0,
      },
      last7Days: {
        streams: 0,
        previous: 0,
      },
      recentSongs: mySongs.slice(0, 5),
    } as unknown as T;
  }

  if (cleanPath.startsWith('/artists/me/analytics')) {
    const range = (sp.get('range') as '30d' | '90d' | '12m') || '30d';
    return {
      range,
      unit: range === '12m' ? 'month' : 'day',
      totals: {
        streams: 0,
        uniqueListeners: 0,
        downloads: 0,
        newFollowers: 0,
      },
      allTime: {
        streams: 0,
        downloads: 0,
        followers: 0,
      },
      series: [],
      topSongs: [],
      districts: {
        items: [],
        unknownStreams: 0,
      },
    } as unknown as T;
  }

  if (cleanPath.startsWith('/artists/me/')) {
    return { ok: true } as unknown as T;
  }

  // Notifications
  if (cleanPath === '/notifications/read-all') {
    mockNotifications = mockNotifications.map((n) => ({
      ...n,
      read_at: n.read_at || new Date().toISOString(),
    }));
    saveNotifications(mockNotifications);
    return { ok: true } as unknown as T;
  }

  if (cleanPath.startsWith('/notifications/') && cleanPath.endsWith('/read')) {
    const id = cleanPath.split('/')[2];
    mockNotifications = mockNotifications.map((n) =>
      n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n
    );
    saveNotifications(mockNotifications);
    return { ok: true } as unknown as T;
  }

  if (cleanPath.startsWith('/notifications')) {
    const unread = mockNotifications.filter((n) => !n.read_at).length;
    return {
      items: mockNotifications,
      unread,
      total: mockNotifications.length,
      totalPages: 1,
      page: 1,
      limit: 20,
    } as unknown as T;
  }

  // Admin portal endpoints
  if (cleanPath === '/admin/dashboard') {
    const songs = getAdminSongs();
    const artists = getAdminArtists();
    const copy = getAdminCopyright();
    const reports = getAdminContentReports();
    return {
      ...MOCK_ADMIN_DASHBOARD,
      openComplaints: copy.filter((c) => c.status === 'open' || c.status === 'investigating').length,
      openReports: reports.filter((r) => r.status === 'open').length,
      pendingSongs: songs.filter((s) => s.status === 'pending_review').length,
      pendingArtists: artists.filter((a) => a.approval_status === 'pending').length,
    } as unknown as T;
  }

  // Admin songs
  if (cleanPath.startsWith('/admin/songs/') && cleanPath.endsWith('/approve')) {
    const songId = cleanPath.replace('/admin/songs/', '').replace('/approve', '');
    const songs = getAdminSongs();
    const song = songs.find((s) => s.id === songId);
    if (song) {
      song.status = 'approved';
      song.process_status = 'ready';
      song.rejection_reason = null;
      saveAdminSongs(songs);
    }
    return { ok: true, id: songId, status: 'approved' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/songs/') && cleanPath.endsWith('/reject')) {
    const songId = cleanPath.replace('/admin/songs/', '').replace('/reject', '');
    const songs = getAdminSongs();
    const song = songs.find((s) => s.id === songId);
    if (song) {
      song.status = 'rejected';
      song.rejection_reason = (o.body as any)?.reason || 'Does not meet platform guidelines';
      saveAdminSongs(songs);
    }
    return { ok: true, id: songId, status: 'rejected' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/songs/') && cleanPath.endsWith('/remove')) {
    const songId = cleanPath.replace('/admin/songs/', '').replace('/remove', '');
    const songs = getAdminSongs();
    const song = songs.find((s) => s.id === songId);
    if (song) {
      song.status = 'removed';
      song.rejection_reason = (o.body as any)?.reason || 'Removed by administrator';
      saveAdminSongs(songs);
    }
    return { ok: true, id: songId, status: 'removed' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/songs/') && cleanPath.endsWith('/feature')) {
    const songId = cleanPath.replace('/admin/songs/', '').replace('/feature', '');
    const songs = getAdminSongs();
    const song = songs.find((s) => s.id === songId);
    if (song) {
      song.is_featured = !!(o.body as any)?.featured;
      saveAdminSongs(songs);
    }
    return { ok: true, id: songId, is_featured: song?.is_featured } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/songs/')) {
    const songId = cleanPath.replace('/admin/songs/', '');
    const songs = getAdminSongs();
    const found = songs.find((s) => s.id === songId);
    if (!found) throw new ApiError(404, 'Song not found');
    return {
      ...found,
      artworkUrl: found.artworkUrl || '',
      previewUrl: found.previewUrl || getAudioStreamForSong(found.id),
    } as unknown as T;
  }
  if (cleanPath === '/admin/songs' || cleanPath.startsWith('/admin/music')) {
    const statusParam = sp.get('status');
    const qParam = sp.get('q')?.toLowerCase();
    const songs = getAdminSongs();
    let filtered = [...songs];
    if (statusParam && statusParam !== 'all') {
      filtered = filtered.filter((s) => s.status === statusParam);
    }
    if (qParam) {
      filtered = filtered.filter((s) => s.title.toLowerCase().includes(qParam) || s.artist_name.toLowerCase().includes(qParam));
    }
    return {
      items: filtered,
      total: filtered.length,
      totalPages: 1,
      page: 1,
      limit: 20,
    } as unknown as T;
  }

  // Admin artists
  if (cleanPath.startsWith('/admin/artists/') && cleanPath.endsWith('/approve')) {
    const artistId = cleanPath.replace('/admin/artists/', '').replace('/approve', '');
    const artists = getAdminArtists();
    const artist = artists.find((a) => a.id === artistId);
    if (artist) {
      artist.approval_status = 'active';
      artist.reviewed_at = new Date().toISOString();
      artist.review_note = null;
      saveAdminArtists(artists);
      // Also update in registered users
      const reg = getRegisteredUsers().find((u) => u.id === artistId || u.email.toLowerCase() === artist.email.toLowerCase());
      if (reg) {
        reg.artist_approval = 'active';
        saveRegisteredUser(reg);
      }
    }
    return { ok: true, id: artistId, status: 'active' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/artists/') && cleanPath.endsWith('/reject')) {
    const artistId = cleanPath.replace('/admin/artists/', '').replace('/reject', '');
    const artists = getAdminArtists();
    const artist = artists.find((a) => a.id === artistId);
    if (artist) {
      artist.approval_status = 'rejected';
      artist.review_note = (o.body as any)?.reason || 'Changes needed before approval';
      artist.reviewed_at = new Date().toISOString();
      saveAdminArtists(artists);
    }
    return { ok: true, id: artistId, status: 'rejected' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/artists/') && cleanPath.endsWith('/suspend')) {
    const artistId = cleanPath.replace('/admin/artists/', '').replace('/suspend', '');
    const artists = getAdminArtists();
    const artist = artists.find((a) => a.id === artistId);
    if (artist) {
      artist.approval_status = 'suspended';
      artist.review_note = (o.body as any)?.reason || 'Account suspended by moderation';
      saveAdminArtists(artists);
    }
    return { ok: true, id: artistId, status: 'suspended' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/artists/') && cleanPath.endsWith('/reinstate')) {
    const artistId = cleanPath.replace('/admin/artists/', '').replace('/reinstate', '');
    const artists = getAdminArtists();
    const artist = artists.find((a) => a.id === artistId);
    if (artist) {
      artist.approval_status = 'active';
      artist.review_note = null;
      saveAdminArtists(artists);
    }
    return { ok: true, id: artistId, status: 'active' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/artists/') && cleanPath.endsWith('/flags')) {
    const artistId = cleanPath.replace('/admin/artists/', '').replace('/flags', '');
    const artists = getAdminArtists();
    const artist = artists.find((a) => a.id === artistId);
    if (artist) {
      const b = (o.body as any) || {};
      if (b.isFeatured !== undefined) artist.is_featured = !!b.isFeatured;
      if (b.isVerified !== undefined) artist.is_verified = !!b.isVerified;
      saveAdminArtists(artists);
    }
    return { ok: true } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/artists/')) {
    const artistId = cleanPath.replace('/admin/artists/', '');
    const artists = getAdminArtists();
    const found = artists.find((a) => a.id === artistId);
    if (!found) throw new ApiError(404, 'Artist not found');
    return {
      id: found.id,
      stage_name: found.stage_name,
      real_name: found.real_name || '',
      phone: found.phone || '',
      email: found.email,
      email_verified_at: '2026-01-01T00:00:00Z',
      account_status: 'active',
      district: found.district || 'Kampala',
      town: (found.district || 'Kampala') + ' Central',
      bio: found.bio || '',
      social_links: {},
      genres: found.genres || [],
      approval_status: found.approval_status,
      review_note: found.review_note ?? null,
      is_verified: !!found.is_verified,
      is_featured: !!found.is_featured,
      created_at: found.created_at,
      reviewed_at: found.reviewed_at || new Date().toISOString(),
      copyright_confirmed_at: new Date().toISOString(),
      slug: found.slug,
    } as unknown as T;
  }
  if (cleanPath === '/admin/artists') {
    const statusParam = sp.get('status');
    const qParam = sp.get('q')?.toLowerCase();
    const artists = getAdminArtists();
    let filtered = [...artists];
    if (statusParam) {
      filtered = filtered.filter((a) => a.approval_status === statusParam);
    }
    if (qParam) {
      filtered = filtered.filter((a) => a.stage_name.toLowerCase().includes(qParam) || a.email.toLowerCase().includes(qParam));
    }
    return {
      items: filtered,
      total: filtered.length,
      totalPages: 1,
      page: 1,
      limit: 20,
    } as unknown as T;
  }

  // Admin listeners
  if (cleanPath.startsWith('/admin/listeners/') && (cleanPath.endsWith('/suspend') || cleanPath.endsWith('/reinstate'))) {
    return { ok: true } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/listeners')) {
    const registered = getRegisteredUsers().filter((u) => u.role === 'listener');
    const items = registered.map((u) => ({
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      role: 'listener',
      status: 'active',
      email_verified: !!u.email_verified_at,
      district: 'Kampala',
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    }));
    return {
      items,
      total: items.length,
      totalPages: 1,
      page: 1,
      limit: 20,
    } as unknown as T;
  }

  // Admin copyright
  if (cleanPath.startsWith('/admin/copyright/') && cleanPath.endsWith('/investigate')) {
    const cid = cleanPath.replace('/admin/copyright/', '').replace('/investigate', '');
    const complaints = getAdminCopyright();
    const c = complaints.find((x) => x.id === cid);
    if (c) {
      c.status = 'investigating';
      c.handled_by_email = 'admin@waxo.com';
      saveAdminCopyright(complaints);
    }
    return { id: cid, status: 'investigating' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/copyright/') && cleanPath.endsWith('/uphold')) {
    const cid = cleanPath.replace('/admin/copyright/', '').replace('/uphold', '');
    const complaints = getAdminCopyright();
    const c = complaints.find((x) => x.id === cid);
    if (c) {
      c.status = 'resolved';
      c.resolution_note = (o.body as any)?.note || 'Complaint upheld. Master recording infringement confirmed. Song removed.';
      c.resolved_at = new Date().toISOString();
      c.handled_by_email = 'admin@waxo.com';
      saveAdminCopyright(complaints);
      // Also remove song
      const songs = getAdminSongs();
      const song = songs.find((s) => s.id === c.song_id);
      if (song) {
        song.status = 'removed';
        saveAdminSongs(songs);
      }
    }
    return { id: cid, status: 'resolved' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/copyright/') && cleanPath.endsWith('/dismiss')) {
    const cid = cleanPath.replace('/admin/copyright/', '').replace('/dismiss', '');
    const complaints = getAdminCopyright();
    const c = complaints.find((x) => x.id === cid);
    if (c) {
      c.status = 'dismissed';
      c.resolution_note = (o.body as any)?.note || 'Complaint dismissed after review of artist license credentials.';
      c.resolved_at = new Date().toISOString();
      c.handled_by_email = 'admin@waxo.com';
      saveAdminCopyright(complaints);
    }
    return { id: cid, status: 'dismissed' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/copyright/')) {
    const cid = cleanPath.replace('/admin/copyright/', '');
    const complaints = getAdminCopyright();
    const found = complaints.find((x) => x.id === cid);
    if (!found) throw new ApiError(404, 'Complaint not found');
    return found as unknown as T;
  }
  if (cleanPath === '/admin/copyright') {
    const statusParam = sp.get('status');
    const complaints = getAdminCopyright();
    let filtered = [...complaints];
    if (statusParam && statusParam !== 'all') {
      filtered = filtered.filter((c) => c.status === statusParam);
    }
    return {
      items: filtered,
      total: filtered.length,
      totalPages: 1,
      page: 1,
      limit: 20,
    } as unknown as T;
  }

  // Admin content reports
  if (cleanPath.startsWith('/admin/reports/music/') && cleanPath.endsWith('/resolve')) {
    const rid = cleanPath.replace('/admin/reports/music/', '').replace('/resolve', '');
    const reports = getAdminContentReports();
    const r = reports.find((x) => x.id === rid);
    if (r) {
      r.status = 'resolved';
      r.resolution_note = (o.body as any)?.note || 'Report reviewed and marked resolved';
      saveAdminContentReports(reports);
    }
    return { ok: true, id: rid, status: 'resolved' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/reports/music/') && cleanPath.endsWith('/dismiss')) {
    const rid = cleanPath.replace('/admin/reports/music/', '').replace('/dismiss', '');
    const reports = getAdminContentReports();
    const r = reports.find((x) => x.id === rid);
    if (r) {
      r.status = 'dismissed';
      r.resolution_note = (o.body as any)?.note || 'Report dismissed';
      saveAdminContentReports(reports);
    }
    return { ok: true, id: rid, status: 'dismissed' } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/reports/music/') && cleanPath.endsWith('/remove-song')) {
    const rid = cleanPath.replace('/admin/reports/music/', '').replace('/remove-song', '');
    const reports = getAdminContentReports();
    const r = reports.find((x) => x.id === rid);
    if (r) {
      r.status = 'resolved';
      r.resolution_note = (o.body as any)?.note || 'Song removed after content review';
      saveAdminContentReports(reports);
      // Remove song
      const songs = getAdminSongs();
      const s = songs.find((x) => x.id === r.song_id);
      if (s) {
        s.status = 'removed';
        saveAdminSongs(songs);
      }
    }
    return { ok: true, id: rid, status: 'resolved' } as unknown as T;
  }
  if (cleanPath === '/admin/reports/music' || cleanPath.startsWith('/admin/reports')) {
    const statusParam = sp.get('status');
    const reports = getAdminContentReports();
    let filtered = [...reports];
    if (statusParam && statusParam !== 'all') {
      filtered = filtered.filter((r) => r.status === statusParam);
    }
    return {
      items: filtered,
      total: filtered.length,
      totalPages: 1,
      page: 1,
      limit: 20,
    } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/accounts') && (o.method === 'POST' || o.method === 'PATCH' || o.method === 'DELETE')) {
    return { ok: true } as unknown as T;
  }
  if (cleanPath === '/admin/accounts') {
    return [
      { id: 'usr-admin-1', email: 'admin@waxo.com', role: 'admin', admin_role: 'Super Admin', status: 'active', created_at: '2026-01-01T00:00:00Z', last_login_at: new Date().toISOString() },
    ] as unknown as T;
  }
  if (cleanPath === '/admin/roles') {
    return [
      { id: 1, name: 'super_admin', permissions: ['*'] },
      { id: 2, name: 'moderator', permissions: ['music.review', 'artists.review', 'reports.handle', 'content.remove'] },
    ] as unknown as T;
  }
  if (cleanPath.startsWith('/admin/audit')) {
    return {
      items: [],
      total: 0,
      totalPages: 0,
      page: 1,
      limit: 30,
    } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/notifications')) {
    return { items: [], total: 0, totalPages: 0, page: 1, limit: 20 } as unknown as T;
  }
  if (cleanPath.startsWith('/admin/districts') && (o.method === 'POST' || o.method === 'PATCH' || o.method === 'DELETE')) {
    return { ok: true } as unknown as T;
  }
  if (cleanPath === '/admin/districts') {
    return MOCK_DISTRICTS.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      region: d.region,
      country_code: 'UG',
      is_active: true,
      artists: d.artistCount || 0,
      songs: d.songCount || 0,
    })) as unknown as T;
  }
  if (cleanPath.startsWith('/admin/genres') && (o.method === 'POST' || o.method === 'PATCH' || o.method === 'DELETE')) {
    return { ok: true } as unknown as T;
  }
  if (cleanPath === '/admin/genres') {
    return MOCK_GENRES.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      is_active: true,
      songs: g.songCount || 0,
    })) as unknown as T;
  }
  if (cleanPath.startsWith('/admin/analytics')) {
    return {
      unit: 'day',
      totals: {
        streams: 0,
        uniqueListeners: 0,
        downloads: 0,
        newListeners: 0,
        newArtists: 0,
        newSongs: 0,
      },
      series: [],
      topSongs: [],
      topArtists: [],
      districts: [],
    } as unknown as T;
  }

  // Public discovery endpoints
  if (cleanPath === '/discover/home') {
    return MOCK_HOME_DATA as unknown as T;
  }
  if (cleanPath === '/discover/genres') {
    return MOCK_GENRES as unknown as T;
  }
  if (cleanPath === '/discover/districts') {
    return MOCK_DISTRICTS as unknown as T;
  }
  if (cleanPath.startsWith('/discover/leaderboard/')) {
    const slug = cleanPath.replace('/discover/leaderboard/', '');
    const artists = MOCK_ARTISTS.filter((a) => !slug || a.district.slug === slug);
    const songs = MOCK_SONGS.filter((s) => !slug || s.district?.slug === slug);
    return {
      artists: { items: artists, page: 1, limit: 10, total: artists.length, totalPages: 1 },
      songs: { items: songs, page: 1, limit: 10, total: songs.length, totalPages: 1 },
    } as unknown as T;
  }
  if (cleanPath.startsWith('/discover/')) {
    let filteredSongs = [...MOCK_SONGS];
    if (district) filteredSongs = filteredSongs.filter((s) => s.district?.slug === district);
    if (genre) filteredSongs = filteredSongs.filter((s) => s.genre?.slug === genre);

    if (cleanPath.includes('rising-stars') || cleanPath.includes('/discover/artists')) {
      let filteredArtists = [...MOCK_ARTISTS];
      if (district) filteredArtists = filteredArtists.filter((a) => a.district.slug === district);
      if (q) filteredArtists = filteredArtists.filter((a) => a.stageName.toLowerCase().includes(q));
      return { items: filteredArtists, page: 1, limit: 20, total: filteredArtists.length, totalPages: 1 } as unknown as T;
    }
    return { items: filteredSongs, page: 1, limit: 20, total: filteredSongs.length, totalPages: 1 } as unknown as T;
  }
  if (cleanPath === '/artists') {
    return { items: MOCK_ARTISTS, page: 1, limit: 20, total: MOCK_ARTISTS.length, totalPages: 1 } as unknown as T;
  }
  if (cleanPath.startsWith('/artists/')) {
    const parts = cleanPath.split('/');
    const artistSlug = decodeURIComponent(parts[2] || '');
    const isSongs = parts[3] === 'songs';
    const artist = MOCK_ARTISTS.find((a) => a.slug === artistSlug);
    if (isSongs) {
      if (!artist) return { items: [], page: 1, limit: 20, total: 0, totalPages: 1 } as unknown as T;
      const songs = MOCK_SONGS.filter((s) => s.artist.slug === artist.slug || s.artist.id === artist.id);
      return { items: songs, page: 1, limit: 20, total: songs.length, totalPages: 1 } as unknown as T;
    }
    if (!artist) throw new ApiError(404, 'Artist not found');
    return {
      id: artist.id,
      stage_name: artist.stageName,
      slug: artist.slug,
      district: artist.district.name,
      district_slug: artist.district.slug,
      town: artist.district.name + ' Central',
      bio: '',
      social_links: {},
      is_verified: artist.verified,
      follower_count: artist.followerCount,
      avatarUrl: artist.avatarUrl,
      coverUrl: null,
      genres: [],
    } as unknown as T;
  }
  // My studio songs
  if (cleanPath.startsWith('/songs/mine/')) {
    const songId = cleanPath.replace('/songs/mine/', '');
    const mySongs = getMySongs();
    const found = mySongs.find((s: any) => s.id === songId);
    if (found) return found as unknown as T;
    // Fallback for song
    return {
      id: songId,
      title: 'Uploaded Song',
      status: 'pending_review',
      process_status: 'ready',
      duration_seconds: 215,
      downloads_enabled: true,
      release_at: null,
      created_at: new Date().toISOString(),
      stream_count: 0,
      download_count: 0,
      like_count: 0,
      artwork_url: null,
      genre: { id: 1, name: 'Afrobeats', slug: 'afrobeats' },
      district: { id: 1, name: 'Kampala', slug: 'kampala' },
      featured_artists: [],
    } as unknown as T;
  }
  if (cleanPath === '/songs/mine') {
    const status = sp.get('status');
    const mySongs = getMySongs();
    const items = status ? mySongs.filter((s: any) => s.status === status) : mySongs;
    return {
      items,
      total: items.length,
      totalPages: 1,
      page: 1,
      limit: 20,
    } as unknown as T;
  }

  // Song mutations (PATCH, DELETE, POST like retry-processing)
  if (cleanPath.startsWith('/songs/') && (o.method === 'PATCH' || o.method === 'DELETE' || (o.method === 'POST' && !cleanPath.endsWith('/stream-url') && !cleanPath.endsWith('/download-url')))) {
    return { ok: true, id: cleanPath.replace('/songs/', '').split('/')[0] } as unknown as T;
  }

  if (cleanPath.startsWith('/songs/') && cleanPath.endsWith('/stream-url')) {
    const songId = cleanPath.replace('/songs/', '').replace('/stream-url', '');
    return { url: getAudioStreamForSong(songId) } as unknown as T;
  }
  if (cleanPath.startsWith('/songs/') && cleanPath.endsWith('/download-url')) {
    const songId = cleanPath.replace('/songs/', '').replace('/download-url', '');
    return { url: getAudioStreamForSong(songId) } as unknown as T;
  }
  if (cleanPath.startsWith('/songs/')) {
    const songId = cleanPath.replace('/songs/', '');
    const s = MOCK_SONGS.find((x) => x.id === songId);
    if (!s) throw new ApiError(404, 'Song not found');
    return {
      id: s.id,
      title: s.title,
      description: '',
      artworkUrl: s.artworkUrl,
      duration_seconds: s.durationSeconds,
      downloads_enabled: s.downloadsEnabled,
      release_at: s.releaseAt,
      stream_count: s.streamCount,
      download_count: s.downloadCount,
      genre: s.genre?.name || '',
      district: s.district?.name || '',
      artist_name: s.artist.name,
      artist_slug: s.artist.slug,
      artist_verified: s.artist.verified,
      featured_artists: [],
    } as unknown as T;
  }
  if (cleanPath === '/search') {
    const songs = q ? MOCK_SONGS.filter((s) => s.title.toLowerCase().includes(q) || s.artist.name.toLowerCase().includes(q)) : MOCK_SONGS;
    const artists = q ? MOCK_ARTISTS.filter((a) => a.stageName.toLowerCase().includes(q)) : MOCK_ARTISTS;
    return {
      songs: { items: songs, total: songs.length, totalPages: 1, page: 1, limit: 20 },
      artists: { items: artists, total: artists.length, totalPages: 1, page: 1, limit: 20 },
    } as unknown as T;
  }
  if (cleanPath === '/plays') {
    return { playToken: 'mock-play-token-' + Date.now() } as unknown as T;
  }
  if (cleanPath.startsWith('/plays/')) {
    return undefined as unknown as T;
  }
  return undefined;
}

export async function api<T = unknown>(path: string, o: Opts = {}): Promise<T> {
  const preferReal = typeof window !== 'undefined' && localStorage.getItem('waxo.prefer_real_api') === 'true';

  // In standalone demo mode, serve rich mock response immediately (avoids failing 500 requests to offline backend)
  if (!preferReal) {
    const mock = await getMockResponse<T>(path, o);
    if (mock !== undefined) return mock;
  }

  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  const send = () => fetch(`/api${path}`, {
    method: o.method ?? (o.body !== undefined ? 'POST' : 'GET'),
    credentials: 'include',
    keepalive: o.keepalive,
    headers: accessToken ? { ...headers, Authorization: `Bearer ${accessToken}` } : headers,
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });

  try {
    let res = await send();
    if (res.status === 401 && accessToken) {
      if (await refreshSession()) res = await send();
      else onSessionLost?.();
    }
    if (res.status === 204) return undefined as T;
    if (res.ok) {
      return (await res.json()) as T;
    }
  } catch (networkErr) {
    const mock = await getMockResponse<T>(path, o);
    if (mock !== undefined) return mock;
    throw new ApiError(0, 'Network error. Please try again.');
  }

  const mock = await getMockResponse<T>(path, o);
  if (mock !== undefined) return mock;

  throw new ApiError(500, 'Something went wrong.');
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  return s ? `?${s}` : '';
};

/** multipart upload with progress (fetch cannot report upload progress). Retries once after a token refresh. */
export async function upload<T = unknown>(path: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
  const attempt = () => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api${path}`);
    x.withCredentials = true;
    if (accessToken) x.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => { let body: any = null; try { body = JSON.parse(x.responseText); } catch { /* empty */ } resolve({ status: x.status, body }); };
    x.onerror = () => reject(new ApiError(0, 'Network error. Check your connection and try again.'));
    x.send(form);
  });
  try {
    let r = await attempt();
    if (r.status === 401 && accessToken && (await refreshSession())) r = await attempt();
    if (r.status < 200 || r.status >= 300) {
      const msg = Array.isArray(r.body?.message) ? r.body.message.join('. ') : r.body?.message;
      throw new ApiError(r.status, typeof msg === 'string' ? msg : r.status === 413 ? 'That file is too large.' : `Upload failed (${r.status}).`, r.body?.code);
    }
    return r.body as T;
  } catch (err) {
    // If running in standalone preview mode, persist uploaded song to localStorage
    const newId = `song-${Date.now()}`;
    const title = (form.get('title') as string) || 'New Track';
    const genreId = Number(form.get('genreId')) || 1;
    const districtId = Number(form.get('districtId')) || 1;
    const genre = MOCK_GENRES.find((g) => g.id === genreId) || { id: 1, name: 'Afrobeats', slug: 'afrobeats' };
    const district = MOCK_DISTRICTS.find((d) => d.id === districtId) || { id: 1, name: 'Kampala', slug: 'kampala' };

    let artworkUrl: string | null = null;
    const artFile = form.get('artwork');
    if (artFile && artFile instanceof File) {
      artworkUrl = URL.createObjectURL(artFile);
    } else {
      artworkUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';
    }

    const songMine = {
      id: newId,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      description: (form.get('description') as string) || null,
      status: 'processing',
      process_status: 'processing',
      duration_seconds: 215,
      downloads_enabled: form.get('downloadsEnabled') === 'true',
      release_at: (form.get('releaseAt') as string) || null,
      created_at: new Date().toISOString(),
      stream_count: 0,
      download_count: 0,
      like_count: 0,
      artwork_url: artworkUrl,
      genre: { id: genre.id, name: genre.name, slug: genre.slug },
      district: { id: district.id, name: district.name, slug: district.slug },
      featured_artists: [],
    };

    const mySongs = getMySongs();
    mySongs.unshift(songMine);
    saveMySongs(mySongs);

    // Also register in admin songs so moderators can review it
    const adminSongs = getAdminSongs();
    adminSongs.unshift({
      ...songMine,
      artist: { id: 'art-current', stage_name: 'My Studio', slug: 'my-studio' },
      status: 'pending_review',
    });
    saveAdminSongs(adminSongs);

    // Simulate audio transcoding completion after 2.5 seconds
    setTimeout(() => {
      const current = getMySongs();
      const s = current.find((item: any) => item.id === newId);
      if (s) {
        s.process_status = 'ready';
        s.status = 'pending_review';
        saveMySongs(current);
      }
    }, 2500);

    return { ok: true, id: newId } as unknown as T;
  }
}

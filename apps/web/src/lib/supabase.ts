import type { StoredUser } from './api';

export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://jdhdidkhdlltpjreizre.supabase.co';

export const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkaGRpZGtoZGxsdHBqcmVpenJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwOTI0NDAsImV4cCI6MjExMDY2ODQ0MH0.bsElinsLH7gKGEiPwj0XaPm0UzAZsPG2awwUf_TvF9M';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function supabaseRest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${endpoint.replace(/^\/+/, '')}`;
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      if (res.status === 404) return null;
      console.warn(`[Supabase] ${options.method || 'GET'} ${endpoint} failed:`, res.status);
      return null;
    }
    if (res.status === 204) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn('[Supabase] Network exception:', err);
    return null;
  }
}

/**
 * Persists a user account (listener or artist) to the central Supabase PostgreSQL database.
 * This guarantees that when an account is registered on a mobile phone, it is stored
 * centrally in the cloud and can be logged in from any laptop or desktop.
 */
export async function syncUserToCloud(user: StoredUser, rawPassword?: string): Promise<boolean> {
  try {
    const email = user.email.trim().toLowerCase();
    const existing = await supabaseRest<any[]>(`users?email=eq.${encodeURIComponent(email)}&select=id`);

    let userId = existing?.[0]?.id;
    const pwd = rawPassword || user.password_hash || 'waxo_pwd_hash';

    if (!userId) {
      // Create user row
      const inserted = await supabaseRest<any[]>('users', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          email,
          password_hash: pwd,
          role: user.role,
          plan: user.plan || 'free',
          status: 'active',
          email_verified_at: user.email_verified_at || null,
        }),
      });
      userId = inserted?.[0]?.id;
    } else {
      // Update verified status and password if provided
      const patchData: any = {
        email_verified_at: user.email_verified_at || null,
        role: user.role,
      };
      if (rawPassword || user.password_hash) {
        patchData.password_hash = rawPassword || user.password_hash;
      }
      await supabaseRest(`users?id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(patchData),
      });
    }

    if (!userId) return false;

    // Attach profile according to role
    if (user.role === 'listener') {
      const listenerExists = await supabaseRest<any[]>(`listener_profiles?user_id=eq.${userId}&select=user_id`);
      const districtId = Number(user.district_id) || 8;
      if (!listenerExists || listenerExists.length === 0) {
        await supabaseRest('listener_profiles', {
          method: 'POST',
          body: JSON.stringify({
            user_id: userId,
            display_name: user.display_name || email.split('@')[0],
            district_id: districtId, // 8 = Kampala
          }),
        });
      } else {
        await supabaseRest(`listener_profiles?user_id=eq.${userId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            display_name: user.display_name || email.split('@')[0],
          }),
        });
      }
    } else if (user.role === 'artist') {
      const artistExists = await supabaseRest<any[]>(`artist_profiles?user_id=eq.${userId}&select=id`);
      const stageName = user.stage_name || user.display_name || 'Artist';
      const slug = user.artist_slug || stageName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const districtId = Number(user.district_id) || 8;

      if (!artistExists || artistExists.length === 0) {
        await supabaseRest('artist_profiles', {
          method: 'POST',
          body: JSON.stringify({
            user_id: userId,
            stage_name: stageName,
            slug,
            real_name: user.real_name || stageName,
            phone: user.phone || '',
            district_id: districtId,
            town: user.town || 'Kampala Central',
            bio: user.bio || '',
            approval_status: user.artist_approval || 'pending',
            is_verified: user.artist_verified || false,
          }),
        });
      } else {
        const patchBody: any = {
          stage_name: stageName,
        };
        // Never overwrite existing approved profile with pending from local storage
        if (user.artist_approval === 'active') {
          patchBody.approval_status = 'active';
          patchBody.is_verified = true;
        }
        await supabaseRest(`artist_profiles?user_id=eq.${userId}`, {
          method: 'PATCH',
          body: JSON.stringify(patchBody),
        });
      }
    }

    return true;
  } catch (err) {
    console.warn('[Supabase] Failed to sync user to cloud:', err);
    return false;
  }
}

/**
 * Looks up a user account in Supabase by email.
 * If found, transforms it into standard StoredUser format.
 */
export async function syncUserFromCloud(email: string): Promise<StoredUser | null> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const rows = await supabaseRest<any[]>(
      `users?email=eq.${encodeURIComponent(cleanEmail)}&select=*,artist_profile:artist_profiles!artist_profiles_user_id_fkey(*),listener_profiles(*)&limit=1`
    );

    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    const artist = Array.isArray(r.artist_profile) ? r.artist_profile[0] : r.artist_profile;
    const listener = Array.isArray(r.listener_profiles) ? r.listener_profiles[0] : r.listener_profiles;

    const stored: StoredUser = {
      id: r.id,
      email: r.email,
      role: r.role,
      email_verified_at: r.email_verified_at,
      plan: r.plan || 'free',
      display_name: artist?.stage_name || listener?.display_name || r.email.split('@')[0],
      stage_name: artist?.stage_name || null,
      artist_slug: artist?.slug || null,
      artist_approval: artist?.approval_status || null,
      artist_verified: artist?.is_verified ?? null,
      admin_role: r.role === 'admin' ? 'Super Admin' : null,
      permissions: r.role === 'admin' ? ['*'] : null,
      real_name: artist?.real_name,
      phone: artist?.phone,
      district_id: artist?.district_id || listener?.district_id || 8,
      town: artist?.town,
      bio: artist?.bio,
      password_hash: r.password_hash,
    };

    return stored;
  } catch (err) {
    console.warn('[Supabase] Failed to fetch user by email:', err);
    return null;
  }
}

/**
 * Pulls all user accounts from Supabase so the admin portal
 * and client authentication have full cross-device synchronization.
 */
export async function syncAllUsersFromCloud(): Promise<StoredUser[]> {
  try {
    const rows = await supabaseRest<any[]>(
      `users?select=*,artist_profile:artist_profiles!artist_profiles_user_id_fkey(*),listener_profiles(*)&limit=200`
    );

    if (!rows || !Array.isArray(rows)) return [];

    return rows.map((r) => {
      const artist = Array.isArray(r.artist_profile) ? r.artist_profile[0] : r.artist_profile;
      const listener = Array.isArray(r.listener_profiles) ? r.listener_profiles[0] : r.listener_profiles;

      return {
        id: r.id,
        email: r.email,
        role: r.role,
        email_verified_at: r.email_verified_at,
        plan: r.plan || 'free',
        display_name: artist?.stage_name || listener?.display_name || r.email.split('@')[0],
        stage_name: artist?.stage_name || null,
        artist_slug: artist?.slug || null,
        artist_approval: artist?.approval_status || (r.role === 'artist' ? 'pending' : null),
        artist_verified: artist?.is_verified ?? null,
        admin_role: r.role === 'admin' ? 'Super Admin' : null,
        permissions: r.role === 'admin' ? ['*'] : null,
        real_name: artist?.real_name,
        phone: artist?.phone,
        district_id: artist?.district_id || listener?.district_id || 8,
        town: artist?.town,
        bio: artist?.bio,
        password_hash: r.password_hash,
      };
    });
  } catch (err) {
    console.warn('[Supabase] Failed to fetch all users:', err);
    return [];
  }
}

/**
 * Saves uploaded song metadata to Supabase so that songs uploaded on mobile
 * appear in the admin queue on laptops and desktops.
 */
export async function syncSongToCloud(song: any): Promise<boolean> {
  try {
    // 1. Ensure artist profile exists in Supabase
    let artistId = song.artist?.id;
    let artistRows: any[] | null = null;

    if (artistId) {
      artistRows = await supabaseRest<any[]>(`artist_profiles?id=eq.${artistId}&select=id`);
    }

    if (!artistRows || artistRows.length === 0) {
      // Try resolving by artist email or stage name
      artistId = undefined;
      const email = song.artist?.email;
      if (email) {
        const u = await supabaseRest<any[]>(`users?email=eq.${encodeURIComponent(email)}&select=id,artist_profile:artist_profiles!artist_profiles_user_id_fkey(id)`);
        const ap = Array.isArray(u?.[0]?.artist_profile) ? u![0].artist_profile[0] : u?.[0]?.artist_profile;
        if (ap?.id) artistId = ap.id;
      }
    }

    if (!artistId) {
      console.warn('[Supabase] No artist profile found to associate song with.');
      return false;
    }

    await supabaseRest('songs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        artist_id: artistId,
        title: song.title,
        slug: song.slug || song.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description: song.description || null,
        genre_id: Number(song.genre?.id) || 1,
        district_id: Number(song.district?.id) || 8,
        artwork_key: song.artwork_url || null,
        master_key: 'uploads/' + song.id + '.mp3',
        duration_seconds: song.duration_seconds || 215,
        process_status: song.process_status || 'ready',
        status: song.status || 'pending_review',
        downloads_enabled: song.downloads_enabled ?? true,
        ownership_confirmed_at: new Date().toISOString(),
        stream_count: song.stream_count || 0,
        download_count: song.download_count || 0,
      }),
    });

    return true;
  } catch (err) {
    console.warn('[Supabase] Failed to sync song to cloud:', err);
    return false;
  }
}

/**
 * Pulls all songs from Supabase PostgreSQL.
 */
export async function syncAllSongsFromCloud(): Promise<any[]> {
  try {
    const rows = await supabaseRest<any[]>(
      `songs?select=*,artist:artist_profiles!songs_artist_id_fkey(*),genre:genres(*),district:districts(*)&order=created_at.desc&limit=200`
    );

    if (!rows || !Array.isArray(rows)) return [];

    return rows.map((s) => ({
      id: s.id,
      title: s.title,
      slug: s.slug,
      description: s.description,
      artist_name: s.artist?.stage_name || 'Artist',
      artist: {
        id: s.artist?.id,
        stage_name: s.artist?.stage_name || 'Artist',
        slug: s.artist?.slug || 'artist',
      },
      genre: (s.genre && typeof s.genre === 'object' && s.genre.id && s.genre.name && s.genre.slug) ? { id: s.genre.id, name: s.genre.name, slug: s.genre.slug } : { id: 1, name: 'Afrobeats', slug: 'afrobeats' },
      district: (s.district && typeof s.district === 'object' && s.district.id && s.district.name && s.district.slug) ? { id: s.district.id, name: s.district.name, slug: s.district.slug } : { id: 8, name: 'Kampala', slug: 'kampala' },
      artwork_url: s.artwork_key || null,
      artworkUrl: s.artwork_key || null,
      duration_seconds: s.duration_seconds || 215,
      process_status: s.process_status || 'ready',
      status: s.status || 'pending_review',
      downloads_enabled: s.downloads_enabled ?? true,
      stream_count: Number(s.stream_count) || 0,
      download_count: Number(s.download_count) || 0,
      like_count: Number(s.like_count) || 0,
      created_at: s.created_at,
    }));
  } catch (err) {
    console.warn('[Supabase] Failed to fetch songs from cloud:', err);
    return [];
  }
}

/**
 * Updates an artist profile's approval status directly in Supabase PostgreSQL.
 * Matches by artist profile id, user id, or email.
 */
export async function updateArtistApprovalInCloud(
  identifier: string,
  status: 'active' | 'rejected' | 'suspended',
  reviewNote?: string | null,
  isVerified?: boolean
): Promise<boolean> {
  try {
    const body: any = {
      approval_status: status,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null,
    };
    if (status === 'active' || isVerified) {
      body.is_verified = true;
    }

    // 1. Try updating by artist_profiles.id
    let res = await supabaseRest(`artist_profiles?id=eq.${encodeURIComponent(identifier)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    // 2. Try updating by artist_profiles.user_id
    if (!res || (Array.isArray(res) && res.length === 0)) {
      res = await supabaseRest(`artist_profiles?user_id=eq.${encodeURIComponent(identifier)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    }

    // 3. If identifier might be an email, look up user_id
    if (!res || (Array.isArray(res) && res.length === 0)) {
      const u = await supabaseRest<any[]>(`users?email=eq.${encodeURIComponent(identifier.toLowerCase())}&select=id`);
      if (u && u[0]?.id) {
        await supabaseRest(`artist_profiles?user_id=eq.${u[0].id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
    }

    return true;
  } catch (err) {
    console.warn('[Supabase] Failed to update artist approval in cloud:', err);
    return false;
  }
}

/**
 * Updates artist verification / featured flags in Supabase PostgreSQL.
 */
export async function updateArtistFlagsInCloud(
  identifier: string,
  flags: { isFeatured?: boolean; isVerified?: boolean }
): Promise<boolean> {
  try {
    const body: any = {};
    if (flags.isFeatured !== undefined) body.is_featured = !!flags.isFeatured;
    if (flags.isVerified !== undefined) body.is_verified = !!flags.isVerified;

    let res = await supabaseRest(`artist_profiles?id=eq.${encodeURIComponent(identifier)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (!res || (Array.isArray(res) && res.length === 0)) {
      await supabaseRest(`artist_profiles?user_id=eq.${encodeURIComponent(identifier)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Failed to update artist flags in cloud:', err);
    return false;
  }
}

/**
 * Updates song moderation status in Supabase PostgreSQL.
 */
export async function updateSongStatusInCloud(
  songId: string,
  status: string,
  _rejectionReason?: string | null
): Promise<boolean> {
  try {
    const body: any = {
      status,
      process_status: status === 'approved' ? 'ready' : undefined,
    };
    await supabaseRest(`songs?id=eq.${encodeURIComponent(songId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return true;
  } catch (err) {
    console.warn('[Supabase] Failed to update song status in cloud:', err);
    return false;
  }
}

export interface Paged<T> { items: T[]; page: number; limit: number; total: number; totalPages: number }

export interface SongCardT {
  id: string; title: string; slug: string; durationSeconds: number | null; downloadsEnabled: boolean; releaseAt: string | null;
  streamCount: number; downloadCount: number; likeCount: number; artworkUrl: string | null;
  artist: { id: string; name: string; slug: string; verified: boolean };
  genre: { name: string; slug: string } | null; district: { name: string; slug: string } | null;
  trendingScore?: number;
}
export interface ArtistCardT {
  id: string; stageName: string; slug: string; avatarUrl: string | null; verified: boolean; featured: boolean;
  district: { name: string; slug: string }; followerCount: number; momentum?: number; plays30d?: number;
}
export interface Genre { id: number; name: string; slug: string; songCount: number }
export interface District { id: number; name: string; slug: string; region: string | null; artistCount: number; songCount: number }

export interface HomeData {
  trending: SongCardT[]; newReleases: SongCardT[]; recentlyAdded: SongCardT[]; mostDownloaded: SongCardT[]; featuredSongs: SongCardT[];
  risingStars: ArtistCardT[]; featuredArtists: ArtistCardT[]; genres: Genre[]; districts: District[];
  popularByDistrict: { district: { name: string; slug: string }; artists: ArtistCardT[] }[];
}

export interface Me {
  id: string; email: string; role: 'listener' | 'artist' | 'moderator' | 'admin'; email_verified_at: string | null; plan: string;
  display_name: string | null; stage_name: string | null; artist_slug: string | null;
  artist_approval: 'pending' | 'active' | 'rejected' | 'suspended' | null; artist_verified: boolean | null;
  admin_role?: string | null; permissions?: string[] | null;
}

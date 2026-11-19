import type { ArtistCardT, District, Genre, HomeData, SongCardT } from './types';

export const MOCK_GENRES: Genre[] = [
  { id: 1, name: 'Afrobeats', slug: 'afrobeats', songCount: 0 },
  { id: 2, name: 'Dancehall', slug: 'dancehall', songCount: 0 },
  { id: 3, name: 'Hip Hop', slug: 'hip-hop', songCount: 0 },
  { id: 4, name: 'R&B / Soul', slug: 'r-and-b', songCount: 0 },
  { id: 5, name: 'Bax Ragga', slug: 'bax-ragga', songCount: 0 },
  { id: 6, name: 'Kadongo Kamu', slug: 'kadongo-kamu', songCount: 0 },
  { id: 7, name: 'Traditional & Folk', slug: 'traditional', songCount: 0 },
  { id: 8, name: 'Gospel', slug: 'gospel', songCount: 0 },
];

export const MOCK_DISTRICTS: District[] = [
  { id: 1, name: 'Kampala', slug: 'kampala', region: 'Central', artistCount: 0, songCount: 0 },
  { id: 2, name: 'Wakiso', slug: 'wakiso', region: 'Central', artistCount: 0, songCount: 0 },
  { id: 3, name: 'Gulu', slug: 'gulu', region: 'Northern', artistCount: 0, songCount: 0 },
  { id: 4, name: 'Mbarara', slug: 'mbarara', region: 'Western', artistCount: 0, songCount: 0 },
  { id: 5, name: 'Jinja', slug: 'jinja', region: 'Eastern', artistCount: 0, songCount: 0 },
  { id: 6, name: 'Mbale', slug: 'mbale', region: 'Eastern', artistCount: 0, songCount: 0 },
  { id: 7, name: 'Fort Portal', slug: 'fort-portal', region: 'Western', artistCount: 0, songCount: 0 },
  { id: 8, name: 'Arua', slug: 'arua', region: 'Northern', artistCount: 0, songCount: 0 },
  { id: 9, name: 'Masaka', slug: 'masaka', region: 'Central', artistCount: 0, songCount: 0 },
  { id: 10, name: 'Lira', slug: 'lira', region: 'Northern', artistCount: 0, songCount: 0 },
  { id: 11, name: 'Soroti', slug: 'soroti', region: 'Eastern', artistCount: 0, songCount: 0 },
  { id: 12, name: 'Kasese', slug: 'kasese', region: 'Western', artistCount: 0, songCount: 0 },
];

export const MOCK_ARTISTS: ArtistCardT[] = [];

export const MOCK_SONGS: SongCardT[] = [];

export const MOCK_HOME_DATA: HomeData = {
  trending: [],
  newReleases: [],
  recentlyAdded: [],
  mostDownloaded: [],
  featuredSongs: [],
  risingStars: [],
  featuredArtists: [],
  genres: MOCK_GENRES,
  districts: MOCK_DISTRICTS,
  popularByDistrict: [],
};

export function getAudioStreamForSong(_songId: string): string {
  return '';
}

export const MOCK_ADMIN_DASHBOARD = {
  users: { listeners: 0, artists: 0 },
  queues: { pendingArtists: 0, pendingSongs: 0, failedSongs: 0, openCopyright: 0, openReports: 0 },
  songs: { live: 0 },
  totals: { streams: 0, downloads: 0 },
  series: [],
  recentActivity: [],
};

export const MOCK_ADMIN_SONGS = {
  items: [] as any[],
  total: 0,
  totalPages: 1,
  page: 1,
  limit: 20,
};

export const MOCK_MY_SONGS: any[] = [];

export const MOCK_ADMIN_ARTISTS = {
  items: [] as any[],
  total: 0,
  totalPages: 1,
  page: 1,
  limit: 20,
};

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import type { SongCardT } from './types';

export interface PlayerSong {
  id: string; title: string; artistName: string; artistSlug: string; artworkUrl: string | null;
  durationSeconds: number | null; downloadsEnabled: boolean;
}
export const toPlayerSong = (s: SongCardT): PlayerSong => ({
  id: s.id, title: s.title, artistName: s.artist.name, artistSlug: s.artist.slug, artworkUrl: s.artworkUrl,
  durationSeconds: s.durationSeconds, downloadsEnabled: s.downloadsEnabled,
});

type Repeat = 'off' | 'all' | 'one';
interface PlayerApi {
  queue: PlayerSong[]; index: number; current: PlayerSong | null;
  playing: boolean; loading: boolean; error: string | null;
  time: number; duration: number; volume: number; shuffle: boolean; repeat: Repeat; expanded: boolean;
  playSong: (song: PlayerSong, list?: PlayerSong[]) => void;
  toggle: () => void; next: () => void; prev: () => void; seek: (t: number) => void;
  setVolume: (v: number) => void; toggleShuffle: () => void; cycleRepeat: () => void; setExpanded: (v: boolean) => void;
  addToQueue: (s: PlayerSong) => void; playNext: (s: PlayerSong) => void; removeFromQueue: (i: number) => void;
  jumpTo: (i: number) => void; clearQueue: () => void;
}
const Ctx = createContext<PlayerApi>(null as unknown as PlayerApi);
export const usePlayer = () => useContext(Ctx);

const sessionId = (() => {
  try {
    let id = sessionStorage.getItem('waxo.session');
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('waxo.session', id); }
    return id;
  } catch { return crypto.randomUUID(); }
})();

interface Track { songId: string; token: string | null; starting: boolean; listened: number; lastT: number }

/**
 * Lives above the router, so one <audio> element keeps playing while people navigate.
 * Listening is reported to the server (POST /plays + heartbeats); the server decides what counts as a stream.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<PlayerSong[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => { const v = Number(localStorage.getItem('waxo.vol')); return Number.isFinite(v) && v > 0 ? v : 0.9; });
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>('off');
  const [expanded, setExpanded] = useState(false);

  // Latest values for use inside audio event handlers.
  const live = useRef({ queue, index, shuffle, repeat });
  live.current = { queue, index, shuffle, repeat };
  const loadId = useRef(0);
  const pendingSeek = useRef<number | null>(null);
  const retried = useRef(false);
  const track = useRef<Track | null>(null);

  // ----- play tracking -----
  const beat = useCallback((final = false) => {
    const t = track.current;
    if (!t?.token) return;
    api(`/plays/${t.token}/heartbeat`, { body: { seconds: Math.floor(t.listened) }, keepalive: final }).catch(() => undefined);
  }, []);

  const startPlay = useCallback(async () => {
    const t = track.current;
    if (!t || t.token || t.starting) return;
    t.starting = true;
    try {
      const r = await api<{ playToken: string }>('/plays', { body: { songId: t.songId, sessionId } });
      if (track.current === t) t.token = r.playToken;
    } catch { /* e.g. owner previewing an unreleased song: nothing to count */ }
    finally { t.starting = false; }
  }, []);

  const endTrack = useCallback(() => { beat(true); track.current = null; }, [beat]);

  // ----- loading a song -----
  const loadIndex = useCallback(async (i: number, resumeAt?: number) => {
    const audio = audioRef.current;
    const song = live.current.queue[i];
    if (!audio || !song) return;
    const id = ++loadId.current;
    endTrack();
    setIndex(i); setLoading(true); setError(null); setTime(resumeAt ?? 0);
    if (resumeAt === undefined) { setDuration(song.durationSeconds ?? 0); retried.current = false; }
    pendingSeek.current = resumeAt ?? null;
    try {
      const { url } = await api<{ url: string }>(`/songs/${song.id}/stream-url`);
      if (id !== loadId.current) return;
      audio.src = url;
      await audio.play();
    } catch (e) {
      if (id !== loadId.current) return;
      if ((e as Error).name === 'NotAllowedError') setPlaying(false);
      else { setError((e as Error).message || 'This song could not be played.'); setPlaying(false); }
    } finally {
      if (id === loadId.current) setLoading(false);
    }
  }, [endTrack]);

  // ----- controls -----
  const playSong = useCallback((song: PlayerSong, list?: PlayerSong[]) => {
    const q = list && list.some((s) => s.id === song.id) ? list : [song];
    live.current.queue = q;
    setQueue(q);
    void loadIndex(q.findIndex((s) => s.id === song.id));
  }, [loadIndex]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !a.src) return;
    if (a.paused) void a.play().catch(() => undefined); else a.pause();
  }, []);

  const next = useCallback((auto = false) => {
    const { queue: q, index: i, shuffle: sh, repeat: rp } = live.current;
    if (!q.length) return;
    let n = i + 1;
    if (sh && q.length > 1) { do { n = Math.floor(Math.random() * q.length); } while (n === i); }
    if (n >= q.length) {
      if (rp === 'all') n = 0;
      else { if (auto) audioRef.current?.pause(); return; }
    }
    void loadIndex(n);
  }, [loadIndex]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const { index: i } = live.current;
    if (a.currentTime > 3 || i <= 0) { a.currentTime = 0; setTime(0); return; }
    void loadIndex(i - 1);
  }, [loadIndex]);

  const seek = useCallback((t: number) => { const a = audioRef.current; if (a) { a.currentTime = t; setTime(t); } }, []);
  const setVolume = useCallback((v: number) => { setVolumeState(v); try { localStorage.setItem('waxo.vol', String(v)); } catch { /* ignore */ } }, []);

  const addToQueue = useCallback((s: PlayerSong) => {
    if (!live.current.queue.length) { playSong(s); return; }
    setQueue((q) => [...q, s]);
  }, [playSong]);
  const playNext = useCallback((s: PlayerSong) => {
    if (!live.current.queue.length) { playSong(s); return; }
    setQueue((q) => { const c = [...q]; c.splice(live.current.index + 1, 0, s); return c; });
  }, [playSong]);
  const jumpTo = useCallback((i: number) => void loadIndex(i), [loadIndex]);

  const clearQueue = useCallback(() => {
    loadId.current++;
    endTrack();
    const a = audioRef.current;
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    live.current.queue = [];
    setQueue([]); setIndex(-1); setPlaying(false); setTime(0); setDuration(0); setExpanded(false);
  }, [endTrack]);

  const removeFromQueue = useCallback((i: number) => {
    const { queue: q, index: cur } = live.current;
    if (q.length <= 1) { clearQueue(); return; }
    const nq = q.filter((_, k) => k !== i);
    live.current.queue = nq;
    setQueue(nq);
    if (i < cur) setIndex(cur - 1);
    else if (i === cur) void loadIndex(Math.min(cur, nq.length - 1));
  }, [clearQueue, loadIndex]);

  // ----- audio element events -----
  useEffect(() => {
    const a = audioRef.current!;
    const onPlay = () => {
      setPlaying(true);
      const song = live.current.queue[live.current.index];
      if (song && !track.current) track.current = { songId: song.id, token: null, starting: false, listened: 0, lastT: a.currentTime };
      void startPlay();
    };
    const onPause = () => { setPlaying(false); beat(); };
    const onTime = () => {
      const t = a.currentTime;
      setTime(t);
      const tr = track.current;
      if (tr) { const d = t - tr.lastT; if (!a.paused && d > 0 && d < 1.5) tr.listened += d; tr.lastT = t; }
    };
    const onMeta = () => {
      if (Number.isFinite(a.duration)) setDuration(a.duration);
      if (pendingSeek.current !== null) { a.currentTime = pendingSeek.current; pendingSeek.current = null; }
    };
    const onEnded = () => {
      endTrack();
      if (live.current.repeat === 'one') { a.currentTime = 0; void a.play().catch(() => undefined); }
      else next(true);
    };
    const onError = () => {
      // Signed URLs expire. Fetch a fresh one once and resume where we were.
      if (!retried.current && a.currentTime > 0) { retried.current = true; void loadIndex(live.current.index, a.currentTime); }
      else if (a.src) { setError('Playback failed. Check your connection and try again.'); setPlaying(false); }
    };
    const onHide = () => beat(true);
    a.addEventListener('play', onPlay); a.addEventListener('pause', onPause); a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta); a.addEventListener('ended', onEnded); a.addEventListener('error', onError);
    window.addEventListener('pagehide', onHide);
    return () => {
      a.removeEventListener('play', onPlay); a.removeEventListener('pause', onPause); a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('ended', onEnded); a.removeEventListener('error', onError);
      window.removeEventListener('pagehide', onHide);
    };
  }, [beat, endTrack, loadIndex, next, startPlay]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => beat(), 10_000);
    return () => window.clearInterval(id);
  }, [playing, beat]);

  // ----- lock screen / headset controls -----
  const current = index >= 0 ? queue[index] ?? null : null;
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title, artist: current.artistName,
      artwork: current.artworkUrl ? [{ src: current.artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', toggle); ms.setActionHandler('pause', toggle);
    ms.setActionHandler('previoustrack', prev); ms.setActionHandler('nexttrack', () => next());
    ms.setActionHandler('seekto', (d) => { if (d.seekTime !== undefined) seek(d.seekTime); });
  }, [current, toggle, prev, next, seek]);

  const value = useMemo<PlayerApi>(() => ({
    queue, index, current, playing, loading, error, time, duration, volume, shuffle, repeat, expanded,
    playSong, toggle, next: () => next(), prev, seek, setVolume,
    toggleShuffle: () => setShuffle((s) => !s),
    cycleRepeat: () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    setExpanded, addToQueue, playNext, removeFromQueue, jumpTo, clearQueue,
  }), [queue, index, current, playing, loading, error, time, duration, volume, shuffle, repeat, expanded,
       playSong, toggle, next, prev, seek, setVolume, addToQueue, playNext, removeFromQueue, jumpTo, clearQueue]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="auto" />
    </Ctx.Provider>
  );
}

-- Validated stream events + indexes for trending / discovery queries.
ALTER TABLE streams ADD COLUMN IF NOT EXISTS play_token text UNIQUE;          -- unguessable per-play secret
ALTER TABLE streams ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_streams_counted_time ON streams(created_at) WHERE counted;
CREATE INDEX IF NOT EXISTS idx_streams_listener ON streams(song_id, user_id, created_at) WHERE counted;
CREATE INDEX IF NOT EXISTS idx_streams_ip_time ON streams(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_downloads_time ON downloads(created_at);
CREATE INDEX IF NOT EXISTS idx_songs_released ON songs(release_at DESC) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_recently_played_user ON recently_played(user_id, played_at DESC);

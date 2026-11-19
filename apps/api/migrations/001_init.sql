-- WaXo core schema (PostgreSQL 16)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE user_role AS ENUM ('listener','artist','moderator','admin');
CREATE TYPE account_status AS ENUM ('pending','active','suspended','rejected');
CREATE TYPE song_status AS ENUM ('draft','processing','pending_review','approved','scheduled','rejected','removed');
CREATE TYPE audio_process_status AS ENUM ('queued','processing','ready','failed');
CREATE TYPE report_status AS ENUM ('open','investigating','resolved','dismissed');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

-- Reference data (multi-district / multi-country ready)
CREATE TABLE districts (
  id serial PRIMARY KEY,
  name text NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'UG',
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, name)
);
CREATE TABLE genres (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE admin_roles (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Accounts
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'listener',
  status account_status NOT NULL DEFAULT 'active',
  admin_role_id int REFERENCES admin_roles(id),
  email_verified_at timestamptz,
  last_login_at timestamptz,
  plan text NOT NULL DEFAULT 'free',            -- future: subscriptions
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (role NOT IN ('moderator','admin') OR admin_role_id IS NOT NULL)
);
CREATE TRIGGER trg_users_upd BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip inet,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE listener_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_key text,
  district_id int REFERENCES districts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE artist_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  real_name text NOT NULL,                      -- private: never return in public APIs
  phone text NOT NULL,
  district_id int NOT NULL REFERENCES districts(id),
  town text,
  bio text,
  avatar_key text,
  cover_key text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_verified boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  featured_until timestamptz,
  copyright_confirmed_at timestamptz,
  approval_status account_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_artist_district ON artist_profiles(district_id) WHERE approval_status='active';
CREATE INDEX idx_artist_name_trgm ON artist_profiles USING gin (stage_name gin_trgm_ops);
CREATE TRIGGER trg_artist_upd BEFORE UPDATE ON artist_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE artist_genres (
  artist_id uuid REFERENCES artist_profiles(id) ON DELETE CASCADE,
  genre_id int REFERENCES genres(id),
  PRIMARY KEY (artist_id, genre_id)
);

-- Music
CREATE TABLE albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  artwork_key text,
  release_date date,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_id, slug)
);
CREATE TRIGGER trg_albums_upd BEFORE UPDATE ON albums FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE, -- primary owner
  album_id uuid REFERENCES albums(id) ON DELETE SET NULL,
  track_number int,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  genre_id int REFERENCES genres(id),
  district_id int REFERENCES districts(id),
  artwork_key text,
  master_key text NOT NULL,                     -- original file, private bucket
  stream_key text,                              -- optimized stream rendition (private, signed URL)
  download_key text,                            -- downloadable rendition (private, signed URL)
  duration_seconds int,
  original_mime text,
  file_size_bytes bigint,
  process_status audio_process_status NOT NULL DEFAULT 'queued',
  status song_status NOT NULL DEFAULT 'draft',
  downloads_enabled boolean NOT NULL DEFAULT false,
  release_at timestamptz,
  rejection_reason text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  is_featured boolean NOT NULL DEFAULT false,
  ownership_confirmed_at timestamptz NOT NULL,  -- artist confirmed rights at upload
  price_cents int CHECK (price_cents IS NULL OR price_cents >= 0), -- future: paid downloads
  stream_count bigint NOT NULL DEFAULT 0,       -- denormalised counters, maintained by server
  download_count bigint NOT NULL DEFAULT 0,
  like_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_id, slug),
  CHECK (status NOT IN ('approved','scheduled') OR process_status = 'ready')
);
CREATE INDEX idx_songs_public ON songs(release_at DESC) WHERE status IN ('approved','scheduled');
CREATE INDEX idx_songs_district ON songs(district_id, stream_count DESC) WHERE status='approved';
CREATE INDEX idx_songs_genre ON songs(genre_id, release_at DESC) WHERE status='approved';
CREATE INDEX idx_songs_artist ON songs(artist_id);
CREATE INDEX idx_songs_title_trgm ON songs USING gin (title gin_trgm_ops);
CREATE TRIGGER trg_songs_upd BEFORE UPDATE ON songs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE song_artists (                      -- featured / collaborating artists
  song_id uuid REFERENCES songs(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES artist_profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'featured',
  PRIMARY KEY (song_id, artist_id)
);

-- Server-validated events
CREATE TABLE streams (
  id bigserial PRIMARY KEY,
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  ip_hash text NOT NULL,
  seconds_listened int NOT NULL CHECK (seconds_listened >= 0),
  district_id int REFERENCES districts(id),
  counted boolean NOT NULL DEFAULT false,       -- passed threshold + abuse checks
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_streams_song_time ON streams(song_id, created_at) WHERE counted;
CREATE INDEX idx_streams_abuse ON streams(song_id, ip_hash, created_at);

CREATE TABLE downloads (
  id bigserial PRIMARY KEY,
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ip_hash text NOT NULL,
  district_id int REFERENCES districts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_downloads_song_time ON downloads(song_id, created_at);

-- Engagement
CREATE TABLE followers (
  listener_id uuid REFERENCES users(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES artist_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listener_id, artist_id)
);
CREATE INDEX idx_followers_artist ON followers(artist_id);

CREATE TABLE likes (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  song_id uuid REFERENCES songs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);
CREATE INDEX idx_likes_song ON likes(song_id);

CREATE TABLE playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_playlists_owner ON playlists(owner_id);
CREATE TABLE playlist_songs (
  playlist_id uuid REFERENCES playlists(id) ON DELETE CASCADE,
  song_id uuid REFERENCES songs(id) ON DELETE CASCADE,
  position int NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, song_id)
);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_song ON comments(song_id, created_at DESC);

CREATE TABLE recently_played (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  song_id uuid REFERENCES songs(id) ON DELETE CASCADE,
  played_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

-- Moderation
CREATE TABLE copyright_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  reporter_name text NOT NULL,
  reporter_email citext NOT NULL,
  reporter_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  claim_details text NOT NULL,
  evidence_urls text[] NOT NULL DEFAULT '{}',
  status report_status NOT NULL DEFAULT 'open',
  resolution_note text,
  handled_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX idx_copyright_status ON copyright_reports(status, created_at);

CREATE TABLE music_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status report_status NOT NULL DEFAULT 'open',
  handled_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX idx_music_reports_status ON music_reports(status, created_at);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- Seed: roles and genres (add districts from the admin portal)
INSERT INTO admin_roles(name, permissions) VALUES
 ('super_admin','["*"]'),
 ('moderator','["music.review","artists.review","reports.handle","content.remove"]');
INSERT INTO genres(name, slug) VALUES
 ('Afrobeat','afrobeat'),('Hip Hop','hip-hop'),('Gospel','gospel'),('Dancehall','dancehall'),
 ('R&B','rnb'),('Reggae','reggae'),('Traditional','traditional'),('Pop','pop'),('Other','other');
COMMIT;

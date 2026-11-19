-- Migration 007: Add Google Auth support
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

COMMIT;

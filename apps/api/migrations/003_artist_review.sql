-- Admin review notes (rejection / suspension reasons) and a fast approval queue.
ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS review_note text;
CREATE INDEX IF NOT EXISTS idx_artist_status_queue ON artist_profiles(approval_status, created_at);

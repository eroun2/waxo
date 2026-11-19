-- Moderators handle queues and reports. Everything else is super-admin only ('*').
UPDATE admin_roles SET permissions = '["music.review","artists.review","reports.handle","content.remove"]'::jsonb WHERE name = 'moderator';

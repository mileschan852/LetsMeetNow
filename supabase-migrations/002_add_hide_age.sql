-- Add hide_age column to lmn_users table for the "Hide my age" checkbox
-- This is a simple boolean flag, separate from the purchased hide_age_until feature

ALTER TABLE lmn_users ADD COLUMN IF NOT EXISTS hide_age boolean DEFAULT false;

-- Add hide_age column to hkmod_users table for consistency (if HKMOD also needs it later)
-- ALTER TABLE hkmod_users ADD COLUMN IF NOT EXISTS hide_age boolean DEFAULT false;

-- App admins table for both HKMOD and LMN
-- Supports dynamic admin management via bot commands

CREATE TABLE IF NOT EXISTS app_admins (
  app text NOT NULL,           -- 'hkmod' or 'lmn'
  username text NOT NULL,      -- Telegram username (without @)
  added_by text,               -- Who added this admin
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (app, username)
);

-- Enable RLS (or keep disabled for simple access)
-- ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- Insert default admins for both apps
INSERT INTO app_admins (app, username, added_by) VALUES
  ('hkmod', 'HKMembersOnly', 'system'),
  ('hkmod', 'MilesChan852', 'system'),
  ('lmn', 'HKMembersOnly', 'system'),
  ('lmn', 'MilesChan852', 'system')
ON CONFLICT (app, username) DO NOTHING;

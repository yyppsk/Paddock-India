CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'content_manager', 'super_admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text NOT NULL DEFAULT '',
  ip_address text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx ON email_verification_tokens (user_id);

CREATE TABLE IF NOT EXISTS content_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  panel_key text NOT NULL UNIQUE,
  nav_label text NOT NULL,
  nav_detail text NOT NULL DEFAULT '',
  eyebrow text NOT NULL DEFAULT '',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  progress numeric(5,4) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  is_nav_item boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_sections_public_idx
  ON content_sections (is_published, sort_order, progress);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS content_sections_set_updated_at ON content_sections;
CREATE TRIGGER content_sections_set_updated_at
BEFORE UPDATE ON content_sections
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO content_sections (
  slug,
  panel_key,
  nav_label,
  nav_detail,
  eyebrow,
  title,
  body,
  sort_order,
  progress,
  is_nav_item,
  is_published,
  settings
) VALUES
  ('home', 'home', 'Home', 'Welcome', 'Paddock India Racing', 'Spa Track', 'Race through the Ardennes, from the opening grid to the final chicane.', 10, 0.0000, true, true, '{"tone":"hero","links":[]}'::jsonb),
  ('grid', 'grid', 'Grid', 'Start', 'Start Grid', 'Lights Out', 'The paddock clears, the race line opens, and the cars settle into position.', 20, 0.0800, true, true, '{"tone":"race","links":[]}'::jsonb),
  ('climb', 'climb', 'Climb', 'Raidillon', 'Climb', 'Eau Rouge. Raidillon.', 'A fast uphill charge gives the lap its first dramatic change of rhythm.', 30, 0.2600, true, true, '{"tone":"race","links":[]}'::jsonb),
  ('sector', 'sector', 'Sector', 'Race line', 'Sector Run', 'Hold The Line', 'Performance, handling, and timing details can live here as the car builds speed.', 40, 0.4200, true, true, '{"tone":"quiet","links":[]}'::jsonb),
  ('social', 'social', 'Social', 'Chicane', 'First Chicane', 'Join The Grid', '', 50, 0.5800, true, true, '{"tone":"social","links":[{"label":"Discord","href":"https://discord.gg/paddockindia","text":"discord.gg/paddockindia"},{"label":"Instagram","href":"https://instagram.com/paddockindia.racing","text":"@paddockindia.racing"},{"label":"YouTube","href":"https://youtube.com/@paddockindia","text":"@paddockindia"}]}'::jsonb),
  ('paddock', 'paddock', 'Paddock', 'Events', 'Paddock', 'Community Pit Lane', 'Use this area for stalls, event notes, sponsors, gallery links, or partner callouts.', 60, 0.7200, true, true, '{"tone":"quiet","links":[]}'::jsonb),
  ('about', 'about', 'About', 'Story', 'About', 'Built For The Grid', 'Paddock India is a motorsport-first community experience for drivers, builders, and race fans.', 70, 0.8400, true, true, '{"tone":"contact","links":[]}'::jsonb),
  ('contact', 'contact', 'Contact', 'Finish', 'Finish', 'Contact Us', 'Reach the team after the final sector.', 80, 0.9400, true, true, '{"tone":"contact","links":[{"label":"Email","href":"mailto:hello@paddockindia.racing","text":"hello@paddockindia.racing"},{"label":"Phone","href":"tel:+15550149117","text":"+1 555 014 9117"},{"label":"Location","text":"Francorchamps inspired, globally online"}]}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

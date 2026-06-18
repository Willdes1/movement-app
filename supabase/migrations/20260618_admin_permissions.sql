-- Admin Portal partner permissions.
--
-- Two tiers of admin access:
--   • OWNER  — profiles.is_owner = true (Will + any existing is_admin account).
--              Sees every tab + the owner-only Access Control manager.
--   • PARTNER — a row in admin_permissions (NOT profiles.is_admin). Access is
--              driven entirely by allowed_tabs. Kept off profiles.is_admin on
--              purpose: (a) the protect_admin_role trigger blocks revoking
--              is_admin, and (b) partners must NOT be DB-level admins, so they
--              can never read owner-only data even via raw queries.

-- ── Owner flag ────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- Promote every current admin to owner (this is how Will becomes the owner).
UPDATE profiles SET is_owner = true WHERE is_admin = true AND is_owner = false;

-- ── Partner permissions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_permissions (
  user_id      uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  allowed_tabs text[] NOT NULL DEFAULT '{}',
  active       boolean NOT NULL DEFAULT true,
  note         text,
  granted_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

-- A partner may read ONLY their own permission row (so AuthContext can resolve
-- their allowed tabs client-side). All writes + cross-user reads go through the
-- owner-only service-role API.
CREATE POLICY "admin_perms_self_select" ON admin_permissions
  FOR SELECT USING (user_id = auth.uid());

GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permissions TO service_role;

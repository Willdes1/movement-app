-- token_usage was created by hand (no migration) and is locked down under
-- Supabase's Data-API policy: service_role has INSERT but NOT SELECT. That's
-- why read-after-write verification (INSERT ... RETURNING) failed on it and the
-- cost row never landed — the RETURNING needs SELECT.
--
-- Granting SELECT lets the verified writes read the row back, restoring FULL
-- verification (and silencing the [VERIFY_DEGRADED] fallback in verifiedInsert).
--
-- Additive + reversible. Safe to run anytime. Reverse with:
--   REVOKE SELECT, UPDATE, DELETE ON public.token_usage FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_usage TO service_role;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260707_token_usage_grants.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

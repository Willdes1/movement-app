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

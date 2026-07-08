-- Receipts bucket for the Spend Tracker's manual-expense receipt uploads (tax trail).
--
-- Uploads are done SERVER-SIDE via the service role (/api/admin/upload-receipt),
-- so no storage INSERT policy is needed — the service role bypasses storage RLS.
-- Public read so the exported CSV's receipt links open for a tax preparer.
-- (Paths are timestamped + user-scoped, so they're not easily guessable. If you
--  later want these fully private, switch to signed URLs — ask and I'll wire it.)
--
-- Idempotent: creates the bucket if missing, and ensures it's public if it already
-- exists but was created private (which is why past uploads produced dead links).

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260707_receipts_bucket.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

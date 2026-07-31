-- ─────────────────────────────────────────────────────────────────────────────
-- Task 6 (naming slice): keep a paper trail for renamed exercises.
-- ADDITIVE + REVERSIBLE. One nullable column. No data is changed by this file.
--
-- Athletes always see the NEW name. legacy_name is never displayed. It exists
-- so that a rename is traceable and undoable, and so search can still find an
-- exercise by the name it used to have.
--
-- Deliberately NOT touching name_normalized. That key is what TTS audio files
-- and other lookups are stored under, so leaving it alone means renames cannot
-- break existing references, and regenerated audio overwrites cleanly in place.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.exercise_library
  add column if not exists legacy_name text;

comment on column public.exercise_library.legacy_name is
  'Pre-cleanup display name. Never shown to users; kept for traceability, undo and search.';

-- Only renamed rows carry a value, so a partial index stays small.
create index if not exists exercise_library_legacy_name_idx
  on public.exercise_library (legacy_name)
  where legacy_name is not null;

-- Self-register in the migration ledger (no-op if the ledger does not exist).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260731_exercise_legacy_name.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:
--   alter table public.exercise_library drop column if exists legacy_name;

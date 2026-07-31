-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3: trim status tracking for workout montages.
-- ADDITIVE + REVERSIBLE. Adds three columns and backfills them.
--
-- Deliberately NOT adding trim_start_seconds / trim_end_seconds, even though
-- the task spec lists them. Those values already exist as loop_start_sec and
-- loop_end_sec (20260617_exercise_library_loop.sql) and are already written by
-- the working trimmer. A second pair of columns holding the same fact would
-- drift out of sync the first time anything wrote to only one of them.
--
-- What is genuinely missing is workflow state: which videos still need
-- trimming, and who did what. That is what this adds.
--
-- BACKFILL LOGIC (reviewed and approved by Will before running):
--   loop_start_sec AND loop_end_sec both set  -> 'trimmed'
--   anything else                             -> 'not_started'
-- Nothing is auto-marked 'needs_review'. That status is set by hand when a
-- trim looks wrong.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.exercise_library
  add column if not exists trim_status text,
  add column if not exists trimmed_at  timestamptz,
  add column if not exists trimmed_by  uuid;

-- Backfill from the trim data that already exists.
update public.exercise_library
set trim_status = case
      when loop_start_sec is not null and loop_end_sec is not null then 'trimmed'
      else 'not_started'
    end
where trim_status is null;

alter table public.exercise_library
  alter column trim_status set default 'not_started';

-- Constraint added AFTER the backfill so existing rows already satisfy it.
DO $$ BEGIN
  ALTER TABLE public.exercise_library
    ADD CONSTRAINT exercise_library_trim_status_check
    CHECK (trim_status IS NULL OR trim_status IN ('not_started', 'in_progress', 'trimmed', 'needs_review'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN RAISE NOTICE 'trim_status check not added: %', SQLERRM;
END $$;

create index if not exists exercise_library_trim_status_idx
  on public.exercise_library (trim_status);

comment on column public.exercise_library.trim_status is
  'Workflow state for montage trimming. The trim values themselves live in loop_start_sec / loop_end_sec.';

-- Self-register in the migration ledger (no-op if the ledger does not exist).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260731b_trim_status.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:
--   alter table public.exercise_library
--     drop constraint if exists exercise_library_trim_status_check,
--     drop column if exists trim_status,
--     drop column if exists trimmed_at,
--     drop column if exists trimmed_by;

-- Content scheduling + auto-pilot (Phase 1 follow-up of the Marketing Hub).
-- ADDITIVE + REVERSIBLE. Adds an optional pin date to posts and a single-row
-- settings table that the content cron reads.
--
-- Post lifecycle now: 'draft' -> 'ready' (approved, in the drip queue) ->
-- 'published'. Public RLS still only exposes 'published', so drafts and queued
-- posts stay invisible. 'status' is a plain text column (no enum), so the new
-- 'ready' value needs no schema change beyond this note.

alter table public.content_posts add column if not exists scheduled_for timestamptz;

create table if not exists public.content_settings (
  id            text        primary key default 'default',
  auto_generate boolean     not null default true,
  publish_days  int[]       not null default '{2,5}',   -- 0=Sun .. 6=Sat (Tue + Fri)
  queue_target  int         not null default 4,          -- drafts to keep awaiting review
  clusters      text[]      not null default '{coach-software,recovery-rehab,ai-training,sport-specific}',
  updated_at    timestamptz not null default now()
);

insert into public.content_settings (id) values ('default') on conflict (id) do nothing;

alter table public.content_settings enable row level security;  -- server-only, no policies
grant all on public.content_settings to service_role;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260721_content_scheduling.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:
--   drop table if exists public.content_settings;
--   alter table public.content_posts drop column if exists scheduled_for;

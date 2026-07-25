-- YouTube quota instrumentation (Task 1, phase 1). ADDITIVE + REVERSIBLE.
-- Logs every YouTube Data API call so we can measure real per-video unit cost
-- before and after the curation refactor, drive a live quota meter, and verify
-- the "304 is free" ETag assumption. Written by lib/youtube.ts via the service
-- role; read by the admin quota endpoint.

create table if not exists public.youtube_api_usage (
  id                uuid        primary key default gen_random_uuid(),
  endpoint          text        not null,       -- search | videos | playlistItems | channels
  unit_cost         int         not null,       -- nominal quota units for this call
  http_status       int,
  success           boolean     not null default true,
  not_modified      boolean     not null default false,  -- 304 (ETag hit); used to verify the free-304 assumption
  quota_exceeded    boolean     not null default false,
  is_fallback       boolean     not null default false,  -- reserved for the capped search.list fallback (refactor phase)
  video_id          text,
  curation_batch_id text,
  error             text,
  created_at        timestamptz not null default now()
);

create index if not exists youtube_api_usage_created_idx on public.youtube_api_usage (created_at desc);

alter table public.youtube_api_usage enable row level security;  -- server-only, no policies
grant all on public.youtube_api_usage to service_role;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260724_youtube_api_usage.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RECORD OF HAND-CREATED TABLES (observed from code, NOT authoritative).
-- These two tables were created directly in Supabase with no migration file.
-- Captured here so the repo has a written reference. A full, verified backfill
-- of their real definitions (types, defaults, constraints, extra columns) is a
-- SEPARATE task. Do not treat the notes below as complete or exact.
--
--   approved_yt_channels  (observed):
--     channel_id text, channel_name text, audience_focus text,
--     priority int, active boolean            -- upsert conflict target: channel_id
--
--   exercise_video_candidates  (observed):
--     exercise_id -> exercise_library.id, youtube_video_id text, url text,
--     title text, channel_id text, channel_title text, thumbnail_url text,
--     duration_seconds int, view_count int, ai_relevance_score numeric,
--     ai_reasoning text, status text ('proposed' | 'queued' | ...),
--     source_label text            -- added by 20260601_curation_source_label.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- To undo:  drop table if exists public.youtube_api_usage;

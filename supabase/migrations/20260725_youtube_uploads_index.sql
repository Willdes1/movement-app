-- ─────────────────────────────────────────────────────────────────────────────
-- Task 1 refactor: cached channel uploads index + trigram matching.
-- ADDITIVE + REVERSIBLE. Nothing existing is dropped or rewritten.
--
-- Why: discovery currently costs 100 units per search.list call, which is what
-- caps curation at ~19 videos/day. Caching each approved channel's uploads via
-- playlistItems.list (1 unit per 50 videos) lets matching happen locally at
-- effectively zero quota. Note that ETag/304 responses were measured on
-- 2026-07-25 and DO still cost quota, so the saving has to come from removing
-- the call, not from making it conditional.
-- ─────────────────────────────────────────────────────────────────────────────

-- Trigram matching. Added now rather than later on purpose: creating this
-- extension and its GIN indexes against an already-populated 15k+ row table is
-- a far more disruptive migration than creating them against an empty one.
create extension if not exists pg_trgm;

-- Uploads playlist id per approved channel. Sourced from
-- channels.list -> contentDetails.relatedPlaylists.uploads (not derived by
-- rewriting the UC prefix, which is not reliable for every channel).
alter table public.approved_yt_channels
  add column if not exists uploads_playlist_id text;

create table if not exists public.youtube_channel_videos (
  video_id          text        primary key,
  channel_id        text        not null,
  title             text        not null default '',
  description       text        not null default '',
  published_at      timestamptz,
  -- YouTube's developer policies require stored API data to be refreshed or
  -- deleted on a cycle. This column is what the refresh/prune job enforces, and
  -- it is cited in docs/youtube-quota-extension.md.
  last_refreshed_at timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists ycv_channel_idx   on public.youtube_channel_videos (channel_id);
create index if not exists ycv_refreshed_idx on public.youtube_channel_videos (last_refreshed_at);
create index if not exists ycv_published_idx on public.youtube_channel_videos (channel_id, published_at desc);

-- Trigram prefilter indexes. Postgres narrows to roughly the top 50 candidates
-- by similarity, then Node does the precise scoring (abbreviation expansion,
-- equipment, unilateral). Pulling every cached row into Node instead would mean
-- paging past PostgREST's default 1,000 row cap on every curation run.
create index if not exists ycv_title_trgm_idx
  on public.youtube_channel_videos using gin (title gin_trgm_ops);
create index if not exists ycv_description_trgm_idx
  on public.youtube_channel_videos using gin (description gin_trgm_ops);

-- Foreign key, added defensively.
--
-- approved_yt_channels was created by hand with no migration file, so its exact
-- definition has never been verified in the repo. A unique constraint on
-- channel_id is known to exist because discover-channels upserts with
-- onConflict: 'channel_id' successfully in production, but the constraint's
-- name and the column's exact type are not known here. This block therefore
-- adds the FK only if it can, and leaves the table usable if it cannot.
--
-- Scope note: this cascades on DELETE only. Deactivating a channel sets
-- active = false, which is an UPDATE, so the FK does NOT clean up cached rows
-- for deactivated channels. That is handled by the prune step in the refresh
-- job, which removes rows for channels that are inactive or absent.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ycv_channel_fk'
  ) THEN
    ALTER TABLE public.youtube_channel_videos
      ADD CONSTRAINT ycv_channel_fk
      FOREIGN KEY (channel_id)
      REFERENCES public.approved_yt_channels (channel_id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table     THEN RAISE NOTICE 'approved_yt_channels missing, FK skipped';
  WHEN undefined_object    THEN RAISE NOTICE 'no unique constraint on approved_yt_channels.channel_id, FK skipped';
  WHEN invalid_foreign_key THEN RAISE NOTICE 'channel_id type mismatch, FK skipped';
  WHEN others              THEN RAISE NOTICE 'FK skipped: %', SQLERRM;
END $$;

alter table public.youtube_channel_videos enable row level security;  -- server-only, no policies
grant all on public.youtube_channel_videos to service_role;

-- Self-register in the migration ledger (no-op if the ledger does not exist).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260725_youtube_uploads_index.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- To undo:
--   drop table if exists public.youtube_channel_videos;
--   alter table public.approved_yt_channels drop column if exists uploads_playlist_id;
--   -- pg_trgm is left in place; dropping it would affect anything else using it.
-- ─────────────────────────────────────────────────────────────────────────────

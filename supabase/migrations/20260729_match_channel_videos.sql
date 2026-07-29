-- ─────────────────────────────────────────────────────────────────────────────
-- Task 1: trigram prefilter for local exercise -> video matching.
-- ADDITIVE + REVERSIBLE. Creates one read-only function. No table changes.
--
-- Why a function instead of a client-side query: PostgREST cannot order by
-- similarity(), and pulling all ~5,900 cached rows into Node on every curation
-- run would page past the default 1,000 row cap and ship megabytes each time.
-- This narrows to a handful of candidates in Postgres using the GIN trigram
-- index from 20260725, and Node does the precise scoring (equipment,
-- unilateral, token overlap) on what comes back.
--
-- Cost: zero YouTube quota. This is the call that replaces search.list.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.match_channel_videos(
  q            text,
  match_limit  int  default 50,
  min_sim      real default 0.10
)
returns table (
  video_id    text,
  channel_id  text,
  title       text,
  description text,
  sim         real
)
language sql
stable
as $$
  select
    v.video_id,
    v.channel_id,
    v.title,
    v.description,
    greatest(
      similarity(v.title, q),
      similarity(v.description, q) * 0.5   -- description is weaker evidence
    )::real as sim
  from public.youtube_channel_videos v
  where (v.title % q or v.description % q)
    and greatest(similarity(v.title, q), similarity(v.description, q) * 0.5) >= min_sim
  order by sim desc
  limit greatest(1, least(match_limit, 200))
$$;

comment on function public.match_channel_videos is
  'Task 1 trigram prefilter. Returns the closest cached uploads for an exercise name. Scoring is finished in Node (lib/video-matching.ts).';

-- Server-only, same posture as the table it reads.
revoke all on function public.match_channel_videos(text, int, real) from public, anon, authenticated;
grant execute on function public.match_channel_videos(text, int, real) to service_role;

-- Self-register in the migration ledger (no-op if the ledger does not exist).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260729_match_channel_videos.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:
--   drop function if exists public.match_channel_videos(text, int, real);

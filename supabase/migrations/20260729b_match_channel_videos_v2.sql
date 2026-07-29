-- ─────────────────────────────────────────────────────────────────────────────
-- Task 1: faster trigram prefilter. REPLACES the function from
-- 20260729_match_channel_videos.sql. No table changes, still read-only.
--
-- Problem with v1: it trigram-matched against `description` as well as `title`.
-- Descriptions run to thousands of characters, so their trigram sets are huge
-- and the GIN scan was costing roughly 600ms per exercise. The dry run only got
-- through 72 of 300 exercises before hitting the time budget.
--
-- Fix: prefilter on `title` only, which is short and indexes well. The
-- description still contributes to the score, but in Node, using the text
-- already returned in the row. Same information, a fraction of the work.
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
    similarity(v.title, q)::real as sim
  from public.youtube_channel_videos v
  where v.title % q
    and similarity(v.title, q) >= min_sim
  order by similarity(v.title, q) desc
  limit greatest(1, least(match_limit, 200))
$$;

comment on function public.match_channel_videos is
  'Task 1 trigram prefilter, v2. Title-only match for speed; description is scored in Node (lib/video-matching.ts).';

revoke all on function public.match_channel_videos(text, int, real) from public, anon, authenticated;
grant execute on function public.match_channel_videos(text, int, real) to service_role;

DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260729b_match_channel_videos_v2.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo: re-run 20260729_match_channel_videos.sql to restore v1.

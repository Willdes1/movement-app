-- READ ONLY. Nothing here writes, deletes or alters anything.
-- Paste into the Supabase SQL editor and run. Four questions, four answers.
--
-- Why this matters: Paul is the first person other than the owner to work the
-- admin portal. The Video Trimming tab makes NO API calls. It reads and writes
-- public.exercise_library straight from the browser with the anon key, as
-- whoever is logged in (components/admin/VideoTrimmingTab.tsx, load() and
-- patch()). Video Curation does the same to exercise_video_candidates.
--
-- Granting Paul the "trimming" section in Access Control makes the TAB appear.
-- It does not grant him database access. Whether his work actually saves is
-- decided entirely by the RLS policies on these two tables, and both tables
-- predate the migrations folder, so no file in the repo says what they are.
--
-- The failure mode to watch for is the quiet one: RLS filters rows rather than
-- raising an error, so a restrictive SELECT policy means Paul opens the tab and
-- sees an EMPTY queue. It looks like there is no work to do, not like a
-- permissions problem. He could sit there believing he is done.


-- 1. Is RLS switched on for these tables at all?
--      rls_enabled = false -> no policies apply. Paul can read and write freely.
--                    That means his trimming will work today, but it also means
--                    ANY logged-in user holding the public anon key can rewrite
--                    the exercise library. Worth knowing either way.
--      rls_enabled = true  -> question 2 decides whether he can do anything.
select
  c.relname                as table_name,
  c.relrowsecurity         as rls_enabled,
  c.relforcerowsecurity    as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('exercise_library', 'exercise_video_candidates')
order by c.relname;


-- 2. What policies exist, and who do they apply to?
--    Read the "qual" column. If a policy's condition mentions is_admin, then
--    Paul is excluded, because partner admins are deliberately NOT is_admin
--    (that is what keeps the protect_admin_role trigger out of the way).
--    cmd tells you which operation each policy covers: SELECT policies decide
--    whether he sees the queue, UPDATE policies decide whether his trims save.
select
  tablename,
  policyname,
  cmd,
  roles,
  qual        as using_condition,
  with_check  as write_condition
from pg_policies
where schemaname = 'public'
  and tablename in ('exercise_library', 'exercise_video_candidates')
order by tablename, cmd, policyname;


-- 3. Do plain logged-in users hold table privileges at all?
--    RLS sits on top of GRANTs, not instead of them. If "authenticated" has no
--    UPDATE grant here, Paul cannot write no matter how permissive the policies
--    are, and the tab will report a permission error on save.
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('exercise_library', 'exercise_video_candidates')
  and grantee in ('authenticated', 'anon', 'service_role')
group by table_name, grantee
order by table_name, grantee;


-- 4. How big is the job Paul is being handed, and is the queue non-empty?
--    This is the number he should see in the tab. If he reports a number lower
--    than this, or zero, RLS is filtering his reads and questions 1 to 3 explain
--    why. Compare what he sees against what this says.
select
  count(*)                                                          as with_video_total,
  count(*) filter (where loop_start_sec is null or loop_end_sec is null) as never_trimmed,
  count(*) filter (where trim_status = 'trimmed')                   as marked_trimmed,
  count(*) filter (where trim_status = 'needs_review')              as needs_review
from public.exercise_library
where video_url is not null;

-- READ ONLY. Nothing here writes, deletes or alters anything.
-- Paste into the Supabase SQL editor and run. Three questions, three answers.
--
-- Why this matters: the "Start a Fresh Plan" button on /plan deletes the
-- training_programs row outright. weekly_plans and day_completions both point
-- at that row by program_id. What happens to them depends entirely on how the
-- foreign key was declared, and these tables predate the migrations folder so
-- there is no file in the repo that says.


-- 1. How do the children react when a program row is deleted?
--    delete_rule tells you which of three worlds you are in:
--      CASCADE   - children are removed with the parent. Correct, nothing to do.
--      NO ACTION / RESTRICT - the DELETE fails. The app does not check for an
--                  error there, so it would carry on and insert a SECOND
--                  program row for that user. Queries use .single() on
--                  training_programs by user_id, so two rows makes them throw
--                  and the athlete sees "no program yet" with their plan intact
--                  but unreachable. This is the bad one.
--      (no rows returned) - there is no foreign key at all, so children are
--                  simply orphaned and accumulate forever. Harmless day to day,
--                  untidy, and it hides real row counts.
select
  tc.table_name    as child_table,
  kcu.column_name  as child_column,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.constraint_schema = tc.constraint_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_name = 'training_programs'
order by tc.table_name;


-- 2. Are there already orphans? If either count is above zero, rows have been
--    left behind by past deletes and there is no cascade.
select 'weekly_plans' as table_name, count(*) as orphaned_rows
from weekly_plans wp
left join training_programs tp on tp.id = wp.program_id
where tp.id is null
union all
select 'day_completions', count(*)
from day_completions dc
left join training_programs tp on tp.id = dc.program_id
where tp.id is null;


-- 3. Does anyone already have more than one program row? The app assumes
--    exactly one per user and calls .single(). Anything above 1 here is an
--    athlete whose app is currently broken.
select user_id, count(*) as program_rows
from training_programs
group by user_id
having count(*) > 1;

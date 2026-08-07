-- Durable record of whether an athlete has been through the onboarding
-- questionnaire.
--
-- The problem this fixes: completion was only ever recorded in localStorage,
-- plus a guess in the app that read profiles.name/sport and treated "has some
-- data" as "has onboarded". localStorage is per browser and per device, so the
-- questionnaire came back on a second device, in a private window, or after
-- clearing site data, no matter how carefully it had been filled in. And the
-- name/sport guess cannot tell a completed questionnaire apart from a profile
-- that happens to have a name.
--
-- Two columns, one truth:
--   onboarding_status      null = never seen it, 'completed', or 'skipped'
--   onboarding_updated_at  when that last changed
--
-- 'skipped' is a real state on purpose, not an absence. A skipper should not be
-- ambushed by the modal on every login, but we do want to prompt them later and
-- let them fill it in from Profile, so we have to be able to tell "chose not to
-- now" from "has never been asked".

alter table public.profiles
  add column if not exists onboarding_status     text,
  add column if not exists onboarding_updated_at timestamptz;

do $$
begin
  alter table public.profiles
    add constraint profiles_onboarding_status_check
    check (onboarding_status is null or onboarding_status in ('completed', 'skipped'));
exception
  when duplicate_object then raise notice 'profiles_onboarding_status_check already exists, skipped';
end $$;

comment on column public.profiles.onboarding_status is
  'null = never completed or skipped the onboarding questionnaire; completed; skipped. Replaces the localStorage-only flag, which did not survive a change of device.';

-- Backfill: anyone who already has a sport or a goal recorded has clearly been
-- through it (or filled the same fields in from Profile, which is equivalent).
-- Conservative on purpose: it only ever marks people as done, so the worst case
-- is someone gets asked once more, never that someone is wrongly silenced.
update public.profiles
   set onboarding_status = 'completed',
       onboarding_updated_at = coalesce(updated_at, now())
 where onboarding_status is null
   and (coalesce(sport, '') <> '' or coalesce(goal, '') <> '');

create index if not exists profiles_onboarding_status_idx
  on public.profiles (onboarding_status);

-- Self-register in the migration ledger (guarded — the ledger may not exist yet).
do $$
begin
  insert into public.applied_migrations (filename) values ('20260807_onboarding_status.sql')
  on conflict (filename) do nothing;
exception
  when undefined_table then raise notice 'applied_migrations ledger missing, skipped';
end $$;

-- Rollback:
--   alter table public.profiles
--     drop constraint if exists profiles_onboarding_status_check,
--     drop column if exists onboarding_status,
--     drop column if exists onboarding_updated_at;

-- Coach billing usage counters (monthly; credits reset when the period rolls).
-- ADDITIVE + REVERSIBLE (drop table to undo). Written server-side (service role)
-- as coaches consume AI programs / messages; read by /api/coach/billing-status.

create table if not exists public.coach_usage (
  coach_id         uuid        not null,
  period_month     text        not null,           -- 'YYYY-MM'
  ai_programs_used integer     not null default 0,
  messages_used    integer     not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (coach_id, period_month)
);

alter table public.coach_usage enable row level security;  -- server-only, no policies
grant all on public.coach_usage to service_role;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260708_coach_usage.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:  drop table if exists public.coach_usage;

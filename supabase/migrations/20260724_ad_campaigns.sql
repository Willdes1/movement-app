-- AI Ads Studio campaigns (Marketing Hub Phase 4a). ADDITIVE + REVERSIBLE.
-- Stores the generated campaign plan (keywords, audience, copy, creative,
-- budget) so it persists and can be copied into each platform's ads manager.
-- Server-only via service role.

create table if not exists public.ad_campaigns (
  id           uuid        primary key default gen_random_uuid(),
  name         text,
  platform     text,                                    -- google | meta | instagram | tiktok
  product      text,                                    -- athlete | coach
  objective    text,
  daily_budget numeric,
  plan         jsonb,                                   -- full generated plan
  status       text        not null default 'draft',    -- draft | active | archived
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ad_campaigns_created_idx on public.ad_campaigns (created_at desc);

alter table public.ad_campaigns enable row level security;  -- server-only, no policies
grant all on public.ad_campaigns to service_role;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260724_ad_campaigns.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:  drop table if exists public.ad_campaigns;

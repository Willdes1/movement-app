-- Lead Investigation (Marketing Hub Phase 2). ADDITIVE + REVERSIBLE.
-- Server-only table (no RLS policies): the admin routes read/write via the
-- service role after verifyAdmin(req, 'marketing').

create table if not exists public.leads (
  id             uuid        primary key default gen_random_uuid(),
  business_name  text        not null,
  category       text,                                   -- industry id
  business_type  text,                                   -- independent | multi_location | enterprise
  lead_score     int         not null default 0,
  score_reasons  text[]      not null default '{}',
  address        text,
  city           text,
  region         text,
  country        text,
  phone          text,
  website        text,
  email          text,
  owner_name     text,
  decision_maker text,
  rating         numeric,
  review_count   int,
  location_count int,
  source         text        not null default 'sample',
  source_id      text,
  status         text        not null default 'new',     -- new | qualified | contacted | archived
  notes          text,
  search_label   text,
  metadata       jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Nulls are distinct in Postgres, so this de-dupes real leads (which always have
-- a source_id) without blocking rows that lack one.
create unique index if not exists leads_source_uniq on public.leads (source, source_id);
create index if not exists leads_status_score_idx on public.leads (status, lead_score desc);

alter table public.leads enable row level security;  -- server-only, no policies
grant all on public.leads to service_role;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260721_leads.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:  drop table if exists public.leads;

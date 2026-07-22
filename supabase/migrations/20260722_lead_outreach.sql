-- AI Outreach kits per lead (Marketing Hub Phase 3a). ADDITIVE + REVERSIBLE.
-- One current kit per lead (regenerate overwrites). Server-only via service role.

create table if not exists public.lead_outreach (
  lead_id       uuid        primary key references public.leads(id) on delete cascade,
  email_subject text,
  email_body    text,
  dm_message    text,
  sms_message   text,
  call_script   text,
  tone          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.lead_outreach enable row level security;  -- server-only, no policies
grant all on public.lead_outreach to service_role;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260722_lead_outreach.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:  drop table if exists public.lead_outreach;

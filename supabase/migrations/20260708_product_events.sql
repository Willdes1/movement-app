-- Product telemetry — the customer clickstream (page views + key actions).
-- ADDITIVE + REVERSIBLE (drop table to undo). Separate from harness_events on
-- purpose: harness_events = system health, product_events = user behavior.
--
-- Written server-side (service role) by /api/track; read only through the
-- verifyAdmin()-gated /api/admin/product-events. Surfaced in the Telemetry tab's
-- "Product" view.

create table if not exists public.product_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_name  text        not null,          -- 'page_view' | 'coach_signup' | 'generate_plan_click' | ...
  path        text,                           -- the route the event fired on
  user_id     uuid,                           -- null for logged-out / pre-signup traffic
  role        text,                           -- role snapshot at event time (free/beta/coach/admin/…)
  session_id  text,                           -- anon session grouping (client-generated)
  metadata    jsonb       not null default '{}'::jsonb
);

create index if not exists product_events_created_at_idx on public.product_events (created_at desc);
create index if not exists product_events_name_idx       on public.product_events (event_name);
create index if not exists product_events_user_idx        on public.product_events (user_id);

-- Server-only: RLS on with no policies; the service role bypasses it.
alter table public.product_events enable row level security;
grant all on public.product_events to service_role;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260708_product_events.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:  drop table if exists public.product_events;

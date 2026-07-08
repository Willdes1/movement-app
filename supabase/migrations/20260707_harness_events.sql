-- Stage 2 of Harness Engineering. ADDITIVE + REVERSIBLE (drop table to undo).
-- Records when the app's own safety checks fire (verify_fail / route_error /
-- smoke_fail / migration_drift) so silent failures become visible in
-- Admin → Telemetry. Written server-side by lib/harness-events.ts via the
-- service role; read only through the verifyAdmin()-gated API route.
--
-- Columns match exactly what lib/harness-events.ts already inserts.

create table if not exists public.harness_events (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  event_type        text        not null,          -- verify_fail | route_error | smoke_fail | migration_drift
  severity          text        not null default 'error', -- info | warn | error | critical
  context           text,                           -- e.g. "token_usage:logTokens:seed_library"
  message           text        not null,
  metadata          jsonb       not null default '{}'::jsonb,
  effective_user_id uuid                            -- loose ref (NO FK — telemetry must never fail on a bad id)
);

create index if not exists harness_events_created_at_idx on public.harness_events (created_at desc);
create index if not exists harness_events_type_idx       on public.harness_events (event_type);

-- Lock it down: RLS ON with NO policies → anon/authenticated cannot read or
-- write. Only the service role (server) bypasses RLS. The Telemetry tab reads
-- through a verifyAdmin() API route.
alter table public.harness_events enable row level security;
grant all on public.harness_events to service_role;

-- To undo:  drop table if exists public.harness_events;

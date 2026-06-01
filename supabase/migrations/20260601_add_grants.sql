-- Explicit grants for tables created after Supabase's May 30 Data API policy change.
-- Existing projects are enforced October 30, 2026, but we add these now as best practice.

-- coach_client_notes (created 2026-05-31, was missing grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_client_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_client_notes TO service_role;

-- Future migrations should always include explicit grants like the above.

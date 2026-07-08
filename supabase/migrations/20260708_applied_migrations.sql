-- Stage 3 of Harness Engineering. ADDITIVE + REVERSIBLE (drop table to undo).
-- A ledger of which migration files have actually been applied, so the drift
-- check can tell you if you ever forgot to run one. Written server-side (service
-- role) — either by a migration self-registering on its last line, or by
-- `npm run migration-drift -- --backfill`.
--
-- Going forward EVERY migration file ends with a self-register line:
--   insert into public.applied_migrations (filename)
--   values ('<this_file>.sql') on conflict (filename) do nothing;

create table if not exists public.applied_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);

alter table public.applied_migrations enable row level security;  -- server-only, no policies
grant all on public.applied_migrations to service_role;

-- ── Backfill history ────────────────────────────────────────────────────────
-- Everything already applied to production by hand. The two KNOWN-PENDING files
-- (20260707_receipts_bucket, 20260707_token_usage_grants) are intentionally
-- OMITTED so the drift check flags them until you run them — proving it works.
insert into public.applied_migrations (filename) values
  ('20260526_pgvector_knowledge.sql'),
  ('20260527_coach_invites.sql'),
  ('20260527_knowledge_curator.sql'),
  ('20260527_tts_library.sql'),
  ('20260529_coach_messages.sql'),
  ('20260531_coach_client_notes.sql'),
  ('20260601_add_grants.sql'),
  ('20260601_coach_exercise_library.sql'),
  ('20260601_coach_program_sharing.sql'),
  ('20260601_curation_source_label.sql'),
  ('20260601_exercise_library_clip.sql'),
  ('20260601_exercise_library_source_program.sql'),
  ('20260601_plan_conversion_requests.sql'),
  ('20260601_user_imported_programs.sql'),
  ('20260602_athlete_profile_enhancement.sql'),
  ('20260611_coach_day_completions.sql'),
  ('20260611_coach_join_links.sql'),
  ('20260611_coach_session_logging.sql'),
  ('20260617_exercise_library_loop.sql'),
  ('20260617_exercise_set_logs.sql'),
  ('20260618_account_deletion.sql'),
  ('20260618_admin_permissions.sql'),
  ('20260618_study_hub.sql'),
  ('20260623_coach_voice_cloning.sql'),
  ('20260624_assignment_status_replaced.sql'),
  ('20260630_assignment_pending.sql'),
  ('20260630_assignment_resume_week.sql'),
  ('20260630_coach_field_template.sql'),
  ('20260630_coach_exercise_instructions.sql'),
  ('20260707_harness_events.sql'),
  ('20260708_applied_migrations.sql')      -- this migration, self-registering
on conflict (filename) do nothing;

-- To undo:  drop table if exists public.applied_migrations;

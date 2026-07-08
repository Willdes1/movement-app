# Harness — Migration Workflow & Drift Check

> Stage 3 of Harness Engineering. How migrations get tracked, how to know if you
> forgot to run one, and the safe dry-run order for applying new SQL.

## The ledger (how "did I run it?" is answered)

There's a table, `public.applied_migrations`, that records which migration files
have actually been applied. Two things keep it accurate:

1. **Self-registration.** Every migration file ends with a line that records
   itself. So the moment you paste-and-run a migration, it's tracked — no extra
   step. The guarded form (safe even before the ledger table exists):
   ```sql
   -- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
   DO $$ BEGIN
     INSERT INTO public.applied_migrations (filename)
     VALUES ('<THIS_FILE>.sql') ON CONFLICT (filename) DO NOTHING;
   EXCEPTION WHEN undefined_table THEN NULL; END $$;
   ```
2. **The drift check** compares the files in `supabase/migrations/` against the
   ledger and flags anything unrecorded.

## Checking for drift

**In the app:** Admin → Dev Tools → 📡 **Telemetry** → the **🗄 Migrations** panel.
It shows `✓ all N/N applied` or `⚠ N pending` with the exact filenames. (It diffs
a build-time manifest, `lib/migrations-manifest.json`, against the ledger — this
works on Vercel where raw repo files aren't readable at runtime.)

**From the terminal:** (requires `SUPABASE_SERVICE_ROLE_KEY` in the environment —
it's not in `.env.local` by default, only in Vercel. Add it to `.env.local` to run
locally, or run this in CI/post-deploy where the key exists. The in-app Migrations
panel needs no setup.)
```bash
npm run migration-drift                 # check production
npm run migration-drift -- --staging    # check staging
npm run migration-drift -- --json       # machine-readable (for CI/post-deploy)
```
Exit codes: `0` in sync · `2` ledger table missing · `3` drift detected. On drift
it also writes a `harness_events(migration_drift)` row, so it shows in Telemetry.

### Fixing drift
- **Pending file you HAVE run** (e.g. an old one without a self-register line):
  ```bash
  npm run migration-drift -- --record 20260601_add_grants.sql
  ```
- **Pending file you have NOT run:** run it in the SQL editor. It self-registers.
- **Orphan** (ledger row, no file): the file was renamed/deleted. Remove the row
  by hand if it's truly gone: `delete from applied_migrations where filename = '...';`

## Safe dry-run order for a NEW migration

Once staging exists ([`harness-staging.md`](./harness-staging.md)):

1. **Apply to staging first** — paste the new `.sql` into the *staging* SQL editor.
2. **Verify staging** — `npm run migration-drift -- --staging` shows it applied;
   run the Stage 4 smoke tests against staging (once built).
3. **Only then apply to production** — paste into the production SQL editor. It
   self-registers; the Telemetry Migrations panel flips back to `✓ all applied`.
4. **Confirm** — `npm run migration-drift` (production) exits 0.

Until staging is provisioned, skip step 1–2; the ledger + drift check still
protect you against *forgetting* to run a migration, which is the most common
failure.

# Harness — Staging Database

> Stage 3 of Harness Engineering. Goal: never hand-apply an untested migration to
> live data again. This documents how to stand up a staging Supabase project and
> point the harness tools at it. **You provision it; the code already degrades
> gracefully until you do.**

## Why

Today there is one Supabase project (production). Every migration is pasted into
the live SQL editor by hand — if a migration is wrong, it hits real user data
immediately. Staging gives you a throwaway copy to test the paste against first.

## One-time setup

1. **Create a second Supabase project** — e.g. `atlas-prime-staging` (free tier is
   fine). Same region as production is nice but not required.
2. **Mirror the schema.** In the production project: Database → **Backups** or use
   the SQL editor to dump the schema, then run it in staging. The simplest path:
   run every file in `supabase/migrations/` in order against the new staging
   project. (After this, run the drift check with `--backfill --staging` once so
   the staging ledger matches — see below.)
3. **Grab staging credentials** (Settings → API): the project URL and the
   `service_role` key.
4. **Add them to your local `.env.local`** (never commit these):
   ```
   STAGING_SUPABASE_URL=https://xxxx.supabase.co
   STAGING_SERVICE_ROLE_KEY=eyJhbGci...
   ```
   You can also add them to Vercel later if you want post-deploy checks to run
   against staging, but local is enough to start.

## Using it

Once the env vars exist, the drift check can target staging:

```bash
npm run migration-drift -- --staging            # check staging is in sync
npm run migration-drift -- --backfill --staging # one-time: seed the staging ledger
```

If the staging vars are **not** set, `--staging` prints an informational
"staging not configured — skipping" and exits 0. Nothing breaks; it just no-ops
until you provision the project. That's intentional.

## What NOT to do

- Don't point staging env vars at production. The service_role key bypasses RLS —
  a mistake here writes to live data.
- Don't rely on staging having real users' data. It's a schema mirror for testing
  migrations and smoke tests (Stage 4), not a data copy.

See also: [`harness-migrations.md`](./harness-migrations.md) for the dry-run
workflow that uses this staging project.

# Harness — Smoke Tests

> Stage 4 of Harness Engineering. Catch regressions the type-checker can't, on
> demand or after every deploy. A small server-side suite — no heavy framework.

## What it checks

The suite lives at `POST /api/admin/smoke-test` and runs server-side so it can
reuse the real Stage-1 verified-write helper and the Stage-3 ledger:

| Check | What it proves |
|-------|----------------|
| `db_connectivity` | The service role can reach Postgres. |
| `auth_identity` | The caller passed the admin/cron gate. |
| `harness_events_table` | Stage-2 telemetry table is present. |
| `migration_ledger` | Stage-3 ledger exists and **nothing is pending** (drift = fail). |
| `token_usage_verified_write` | The money path works: `verifiedInsert` writes a marker row to `token_usage`, reads it back, then deletes it (self-cleaning, no cost). |
| `gate:/api/...` | Protected routes reject unauthenticated calls with 401 (auth-layer regression guard). |

On completion it writes one `harness_events` row — `smoke_run` (info) on pass or
`smoke_fail` (error) on failure — so the **last run + timestamp** persists in the
Telemetry tab.

### Intentionally NOT covered against production
Full `generate-plan` end-to-end is **not** run here — it spends Claude tokens and
writes real `training_programs` rows. The suite verifies its *dependencies* (DB
write path, auth, ledger) instead. Run the full path against **staging** once it's
provisioned (see [`harness-staging.md`](./harness-staging.md)).

## How to run

**In the app (no setup):** Admin → Dev Tools → 📡 Telemetry → **▶ Run smoke tests**.
Each check shows ✓ / ✗ / – (skipped) with detail, and the panel remembers the last
run.

**From the terminal / post-deploy** (needs the cron secret, same value as in Vercel):
```bash
CRON_SECRET=xxx npm run smoke-test                        # against production
CRON_SECRET=xxx npm run smoke-test -- https://staging-url # against another target
```
Exit code `0` = all passed, `1` = a check failed (so it can gate a deploy step).

## What green looks like

```
  Smoke test — https://atlasprime.app
  6/6 passed · PASS ✓

  ✓ db_connectivity — service-role reached Postgres
  ✓ auth_identity — cron secret accepted
  ✓ harness_events_table — telemetry table present
  ✓ migration_ledger — all 33 applied
  ✓ token_usage_verified_write — verifiedInsert wrote + read back, then cleaned up
  ✓ gate:/api/admin/harness-events — expected 401, got 401
```

A `✗` on any line means that path regressed — check the detail, and look for the
matching `smoke_fail` row in the Telemetry events feed for the full metadata.

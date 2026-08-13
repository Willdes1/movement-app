# API route auth audit

Generated 2026-08-12, after closing `/api/admin/generate-tts`.

Method: scanned all 83 files under `app/api`. 73 export a mutating handler
(POST/PUT/PATCH/DELETE). A route counts as gated if it calls `verifyAdmin`,
`verifyOwner`, `auth.getUser()`, checks `CRON_SECRET`, or verifies a Stripe
webhook signature. **48 are gated. 25 were not.** One of those 25
(`generate-tts`) is now fixed, leaving **24 open**.

Every one of these is a public URL. No token, no session, no referer check.
A `curl` from anywhere on the internet reaches them.

---

## Tier 1 — fix before billing goes live (data exposure, not just cost)

### `/api/stripe/portal` — hands out other people's billing portals
Takes `userId` **from the request body**, looks up that user's
`stripe_customer_id` with the service-role key, and returns a live Stripe
billing portal URL for them. The portal shows payment methods, invoices and
billing address, and allows cancelling the subscription.

Anyone who has a user id gets someone else's billing portal.

**Why it has not hurt yet:** `BILLING_LIVE` is `false`, so no profile has a
`stripe_customer_id` and the route 404s. **It arms itself the moment billing
turns on**, which is the next roadmap item. Fix it as part of the billing build,
not after.

### `/api/stripe/checkout` — same shape
Also trusts `userId` from the body, and writes a new `stripe_customer_id` onto
whatever profile id it is handed. Lets an attacker attach a Stripe customer to
another user's account.

**Fix for both:** resolve the user from the JWT and ignore the body's `userId`
entirely. The id must come from the token, never the caller.

---

## Tier 2 — money burn

Ranked by damage per call.

| Route | What one call costs | Sustained abuse |
|---|---|---|
| `/api/generate-plan` | 3 Sonnet calls at `max_tokens: 8192`, so up to about **$0.45** | roughly **$1,600/hour** at 1 req/sec |
| `/api/coach/generate-program` | full program generation, Sonnet | comparable |
| `/api/admin/discover-channels` | **500 YouTube quota units** | 20 calls exhausts the entire 10,000/day quota and kills video curation for the day |
| `/api/admin/curate-videos` | Claude Haiku per exercise plus YouTube quota | sustained token + quota drain |
| `/api/tts` | arbitrary caller-supplied text, up to 4096 chars, about **$0.06** | roughly **$220/hour** |
| `/api/admin/ceo-brief` | Sonnet, **and returns business data** in the response | data leak plus spend |
| `/api/admin/ceo-ask` | Sonnet | spend |
| `/api/admin/curate-knowledge` | Sonnet, service-role writes | spend plus corruption |
| `/api/admin/knowledge-search` | embeddings plus Sonnet | spend |
| `/api/admin/seed-knowledge` | service-role writes to the APIE store | corruption |
| `/api/generate-feed` | Sonnet | spend |
| `/api/generate-nutrition` | Sonnet | spend |
| `/api/generate-recovery-plan` | Sonnet | spend |
| `/api/generate-return-to-sport` | Sonnet | spend |
| `/api/generate-exercise-details` | Sonnet | spend |
| `/api/coach/import-program` | Sonnet | spend |
| `/api/launchpad-generate` | Sonnet | spend |

Note `/api/tts` is partly protected in practice: when the caller passes a
`name_normalized` we already voiced, the read-through cache serves storage and
costs nothing. But the route also accepts **arbitrary `text`**, and that path
always pays.

---

## Tier 3 — integrity, low or no direct cost

| Route | Risk |
|---|---|
| `/api/admin/review-knowledge` (PATCH) | service-role edits to the APIE knowledge store |
| `/api/coach/redeem-invite` | service-role; could attach arbitrary users to a coach roster |
| `/api/streaks/update` | writes streak data for any user id |
| `/api/queue-exercise-videos` | service-role writes to the curation queue |
| `/api/notifications/subscribe` | registers a push subscription against any user |
| `/api/video-health/report` | telemetry only (the Task 2 dead-video reporter). Lowest risk of the set, worth leaving open if we want unauthenticated players to report |

---

## Recommended fix order

1. **The two Stripe routes**, during the billing build. Trust the JWT, never the body.
2. **`generate-plan` and `coach/generate-program`.** Highest spend per call, and
   both already receive a logged-in user in practice, so adding `auth.getUser()`
   is a small diff.
3. **`discover-channels` and `curate-videos`**, with `verifyAdmin(req, 'video')`.
   `discover-channels` is the one that can take the whole YouTube integration
   down for a day.
4. **`ceo-brief` and `ceo-ask`**, with `verifyAdmin(req, 'ceo')`. `ceo-brief`
   returns business data to anyone.
5. The rest of the admin knowledge routes with `verifyAdmin`.
6. The remaining user routes with `auth.getUser()`.

Each fix is two lines in the route, matching the pattern in
`app/api/admin/library-cleanup/route.ts`. The cost is in the client call sites:
any caller that does not already send an `Authorization` header needs one, the
way `TTSCurationTab` did.

Re-run the audit with `scripts/` equivalent, or re-scan `app/api` for handlers
lacking a gate marker, after each batch.

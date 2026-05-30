# Agent Context — Movement App
> Full briefing for a new agent to continue this project without any prior conversation history.
> Last updated: 2026-05-29 | Current branch: master | 217 commits

---

## 1. Project Overview

**What it is:** A Next.js 16 fitness app called "Movement" (rename pending — user is choosing a final brand name). Currently deployed at Vercel, connected to Supabase. Hobby plan on both.

**Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Supabase (Postgres + Storage + Realtime + Auth), OpenAI API (TTS + AI features), Anthropic Claude API (MIE agents, program generation, video curation), Stripe (web subscriptions — iOS needs RevenueCat).

**Working directory:** `C:\Dev\movement-app`
**GitHub repo:** `https://github.com/Willdes1/movement-app`
**Vercel auto-deploys:** Every `git push` to master triggers a Vercel production build.

**User:** Will (email: dentalseowill@gmail.com). Non-technical but moves fast. Needs things explained simply. Loves dopamine from progress — always update the Launchpad when features are marked done.

---

## 2. Critical Rules (Never Break These)

- **After every code change: commit and push.** Vercel deploys on push. User cannot see changes until pushed.
- **API keys NEVER in chat.** Go directly to Vercel env vars.
- **GitHub PAT (Willdes1)** is in user's 1Will Gonzalez Google Drive.
- **Password questions:** Tell user it's in their Google Drive — don't give instructions for creating a new one.
- **Every feature must serve the Apple/Google App Store launch goal.** Deprioritize anything that doesn't move the launch needle.
- **Update git-stats at session close:** Run `node scripts/git-stats.js` then commit `lib/git-stats.json`.
- **Launchpad:** Always mark items done in `components/admin/LaunchpadTab.tsx` and commit when a feature ships.
- **Supabase joined relations always return as arrays.** Cast as `Type[]` and use `[0]` index. Use `unknown` as intermediate cast: `(data.field as unknown as Type[] | null)?.[0]`.
- **Vercel Hobby timeout:** Serverless functions max 60s (`export const maxDuration = 60`). For batch work, process in parallel chunks (4 at a time) to stay within limits.

---

## 3. App Architecture

### User Roles
- `admin` — full access, admin portal at `/admin`
- `coach` — coach portal at `/coach/*`
- `beta` / `ff` / `free` — regular app users

### Key Routes
| Path | What it is |
|------|-----------|
| `/today` | Daily workout calendar (main user home) |
| `/for-you` | AI mindset feed |
| `/exercises` | Exercise library |
| `/log` | Workout history |
| `/recovery` | Recovery tracking |
| `/my-coach` | Client-facing coach portal (program + messages) |
| `/account` | User account + coach code entry |
| `/coach/dashboard` | Coach home |
| `/coach/programs` | Program management |
| `/coach/clients` | Client roster |
| `/coach/builder` | AI program builder |
| `/coach/analytics` | Per-client workout compliance |
| `/coach/messages` | Coach ↔ client messaging |
| `/admin` | Admin portal (hash-based tabs) |

### Key Tables (Supabase)
| Table | Purpose |
|-------|---------|
| `profiles` | User profile (name, role, training_level, sports, is_admin) |
| `exercise_library` | 752 exercises with coaching cues, TTS URLs, video URLs |
| `exercise_media` | Manual media overrides (youtube_url, image_url, notes) |
| `exercise_video_candidates` | AI-proposed YouTube videos awaiting review |
| `approved_yt_channels` | Whitelisted YouTube channels for video curation |
| `coach_programs` | Programs created by coaches |
| `coach_program_weeks` | Week structure (days JSON) per program |
| `coach_program_assignments` | Which client is on which program (coach_id, client_id, status) |
| `coach_clients` | Coach ↔ client roster (coach_id, client_id, status) |
| `coach_invite_codes` | Invite codes coaches generate; clients enter in Account |
| `coach_messages` | Real-time messages between coach and client |
| `workout_logs` | User workout completion logs (user_id, logged_at) |
| `knowledge_items` | MIE vector knowledge store (pgvector) |
| `token_usage` | Claude API cost tracking |

### Key Files
| File | Purpose |
|------|---------|
| `app/admin/page.tsx` | Admin portal — all tabs inline (MediaLibraryTab, etc.) |
| `components/admin/LaunchpadTab.tsx` | **Launchpad** — tracks readiness percentages |
| `components/admin/VideoCurationTab.tsx` | Video curation UI |
| `components/admin/TTSCurationTab.tsx` | TTS audio library browser + generate |
| `components/admin/MIETab.tsx` | MIE AI agent UI |
| `components/coach/OnboardingOverlay.tsx` | First-time coach setup wizard |
| `components/ui/MobileMenu.tsx` | Mobile nav drawer (clients) |
| `app/coach/layout.tsx` | Coach portal sidebar + mobile nav |
| `app/coach/messages/page.tsx` | Coach messaging page |
| `app/my-coach/page.tsx` | Client-facing program + messages |
| `app/api/coach/analytics/route.ts` | Per-client workout stats API |
| `app/api/coach/my-program/route.ts` | Client's assigned program API |
| `app/api/coach/redeem-invite/route.ts` | Redeem coach invite code |
| `app/api/admin/curate-videos/route.ts` | AI video curation pipeline |
| `app/api/admin/generate-tts/route.ts` | Batch TTS generation |
| `app/api/tts/route.ts` | Real-time TTS + auto-save |
| `lib/git-stats.json` | Git activity stats (updated at session close) |
| `scripts/git-stats.js` | Generates git-stats.json |

---

## 4. What Was Built This Session (2026-05-28 / 2026-05-29)

### Coach Analytics Dashboard
- **API:** `GET /api/coach/analytics` — JWT-verified, service key. Fetches roster, profiles, active assignments, workout_logs (30d). Groups logs by user counting distinct calendar dates for 7d/30d counts. Returns per-client stats + summary.
- **Page:** `/coach/analytics` — 4 summary cards, activity color coding (green ≥3/7d, blue ≥1/7d, amber daysSince≤10, red inactive), sort controls, inactive alert banner, per-client rows. Click row → `/coach/clients/[id]`.
- **Nav:** Added `Analytics` to coach sidebar.

### TTS Audio Library Browser
- **TTSCurationTab rewrite:** Added sub-tabs — `Generate` (existing) and `Library` (new).
- **Library tab:** Stats strip (total/male/female/missing), search + filter (All/Generated/Missing), rows with `▶ Play` buttons for male (onyx) and female (nova). Uses `new Audio(url)` for inline playback. Playing state shows `⏸ Playing`.
- **Error display fix:** Generate tab now shows red for errors, green for success (previously always green).

### Media Library TTS Columns
- Updated `MediaLibraryTab` in `app/admin/page.tsx`:
  - Added `tts_url_male` and `tts_url_female` to load query from `exercise_library`.
  - Added compact `▶ ♂` (blue) and `▶ ♀` (purple) play buttons in TTS column.
  - Added "Missing TTS" filter.
  - Header stat line shows TTS count.
  - Added `useRef` for audio playback.

### Coach Onboarding Flow
- **File:** `components/coach/OnboardingOverlay.tsx`
- Appears on first visit to `/coach/dashboard` (localStorage key: `coach_onboarded_${userId}`).
- 3 steps: Welcome → Generate Invite Code → Build First Program.
- Dismissible at any step. Detects existing code and skips generation if already done.
- Integrated into `app/coach/dashboard/page.tsx`.

### Video Curation Timeout Fix
- **Problem:** Sequential `for` loop over 50 exercises exceeded 60s Vercel limit.
- **Fix:** Split `processExercises` into `processOne` (single exercise) + chunked parallel runner (4 concurrent via `Promise.all`). 50 exercises now takes ~25s instead of 100s+.

### Coach ↔ Client Messaging
- **SQL migration:** `supabase/migrations/20260529_coach_messages.sql`
  - Table: `coach_messages` (id, coach_id, client_id, sender_id, content, created_at, read_at)
  - RLS: Coaches read/insert own threads. Clients read/insert only for rostered coaches. Both can UPDATE for marking read.
- **Coach page:** `app/coach/messages/page.tsx` — Two-panel layout (client list + thread). Unread badges on client list. Real-time via Supabase channel `coach_msgs_{userId}`. Date dividers, auto-scroll, Enter to send. Mobile: show list OR thread.
- **Client page:** Added Messages tab to `/my-coach` alongside Program tab. Unread badge on tab. Real-time subscription marks read on open.
- **API update:** `app/api/coach/my-program/route.ts` now returns `coachId` in response.
- **Coach nav:** Added `Messages 💬` to coach sidebar.

---

## 5. PENDING: SQL Migration to Run

**The messaging feature will NOT work until this SQL is run in Supabase SQL Editor:**

```sql
CREATE TABLE IF NOT EXISTS coach_messages (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz DEFAULT now() NOT NULL,
  read_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_coach_messages_thread ON coach_messages (coach_id, client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_coach_messages_client ON coach_messages (client_id);
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_read"    ON coach_messages FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY "coach_insert"  ON coach_messages FOR INSERT WITH CHECK (coach_id = auth.uid() AND sender_id = auth.uid());
CREATE POLICY "client_read"   ON coach_messages FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "client_insert" ON coach_messages FOR INSERT WITH CHECK (
  client_id = auth.uid() AND sender_id = auth.uid() AND
  EXISTS (SELECT 1 FROM coach_clients WHERE coach_clients.coach_id = coach_messages.coach_id AND coach_clients.client_id = auth.uid() AND coach_clients.status = 'active')
);
CREATE POLICY "mark_read" ON coach_messages FOR UPDATE
  USING (coach_id = auth.uid() OR client_id = auth.uid())
  WITH CHECK (coach_id = auth.uid() OR client_id = auth.uid());
```

---

## 6. Current Launchpad Status

### F&F Beta Readiness — ~94% (18/19 done)
- Only missing: Exercise videos curated (80%+ of library) — in progress via admin

### Coach Portal Beta Readiness — 79% (11/14 done)
| Item | Status |
|------|--------|
| Programs library | ✅ |
| Program detail (inline editing + status) | ✅ |
| Assign-to-client (search + date picker) | ✅ |
| Exercise swap modal (sets/reps preserved) | ✅ |
| AI generate (periodized plans) | ✅ |
| Template library (zero-cost reuse) | ✅ |
| Client roster + assignment history | ✅ |
| Client portal (clients see assigned plans) | ✅ |
| Coach onboarding flow | ✅ |
| Coach analytics dashboard | ✅ |
| In-app coach ↔ client messaging | ✅ |
| Stripe billing for coach tiers | ❌ |
| Coach affiliate / referral system | ❌ |
| PDF export of programs | ❌ |

### App Store Launch — ~10% (3/25 done)
Critical blockers (in priority order):
1. **RevenueCat** — Stripe alone = App Store rejection for subscriptions
2. **Capacitor wrapper** — PWA → native iOS + Android (nothing submittable without this)
3. **LLC registration** — Required before Apple Developer Program
4. App name finalized (rename pending — shortlist: Hone, Caliber, Athlo, Kime, Vantage, Forge)

---

## 7. Patterns & Lessons Learned

### TypeScript / Supabase Patterns
```typescript
// Supabase joins ALWAYS return arrays — never single objects
// WRONG:
const name = (data.profiles as { name: string } | null)?.name
// RIGHT:
const name = (data.profiles as unknown as { name: string }[] | null)?.[0]?.name
```

### JWT-Authenticated API Routes Pattern
All coach/client API routes use this pattern:
```typescript
export const runtime = 'nodejs'
// 1. Verify caller via anon client with their JWT
const anonClient = createClient(URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
const { data: { user } } = await anonClient.auth.getUser()
// 2. Fetch data via service role key (bypasses RLS)
const supabase = createClient(URL, SERVICE_ROLE_KEY)
```

### Vercel Timeout Pattern
```typescript
export const maxDuration = 60  // max for Hobby plan

// For batch work — process in parallel chunks, not sequentially:
const CONCURRENCY = 4
for (let i = 0; i < items.length; i += CONCURRENCY) {
  const chunk = items.slice(i, i + CONCURRENCY)
  const results = await Promise.all(chunk.map(item => processOne(item)))
}
```

### RLS Safety (Learned the Hard Way)
- Recursive RLS policies caused admin lockout (2026-05-07). Always use `SECURITY DEFINER` functions for cross-role access.
- `protect_admin_role` trigger is live — protects admin role from being changed.
- When in doubt, use service role key in API routes instead of complex RLS.

### Audio Playback Pattern (No DOM element needed)
```typescript
const audioRef = useRef<HTMLAudioElement | null>(null)
function play(url: string, id: string) {
  if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  if (playingId === id) { setPlayingId(null); return }
  const audio = new Audio(url)
  audioRef.current = audio
  setPlayingId(id)
  audio.play()
  audio.onended = () => setPlayingId(null)
}
```

### Supabase Realtime Pattern
```typescript
const channel = supabase
  .channel(`unique_channel_name_${userId}`)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'coach_messages',
    filter: `coach_id=eq.${userId}`,
  }, (payload) => { /* handle */ })
  .subscribe()
return () => { supabase.removeChannel(channel) }
```

---

## 8. TTS Audio System

- **Storage:** Supabase bucket `exercise-tts` → folders `onyx/` (male) and `nova/` (female)
- **File naming:** `{name_normalized}.mp3`
- **DB columns:** `exercise_library.tts_url_male` and `exercise_library.tts_url_female`
- **Coverage:** ~26/752 exercises generated (3%). Run "Generate 25" daily in admin → TTS Audio tab.
- **Cost:** ~$7 total for all 752 exercises. One-time cost, then served free from CDN.
- **Auto-backfill:** When a user triggers TTS for an ungenerates exercise, it generates + saves automatically.
- **Timeout issue:** Batch generation (25 exercises = 50 TTS calls) can hit Vercel 60s limit. Existing `maxDuration = 60` on the route.

---

## 9. Video Curation System

- **Pipeline:** AI searches approved YouTube channels → scores videos via Claude → proposes top 3 per exercise → admin approves
- **Batch size:** Up to 50 exercises per run (now parallel — 4 at a time)
- **Regenerate:** Uses `buildAlternativeQueries` (strips directional terms, core name, "how to" prefix) + all channels + strict scoring (0.35 threshold)
- **Common error:** `"An error o"... is not valid JSON` = Vercel timeout. Reduce batch or fixed by parallelization.

---

## 10. MIE (Movement Intelligence Engine)

- **Phase 1+2 LIVE:** pgvector knowledge store (784 items) + S&C Agent + PT/Rehab Agent
- **Phase 3+4:** Full Agent Council — not yet built
- **Cost tracking:** `token_usage` table; admin UI in Health Monitor

---

## 11. What to Work on Next (Priority Order)

1. **Run the messaging SQL migration** (user needs to do this in Supabase)
2. **RevenueCat integration** — Critical App Store blocker; replaces Stripe for iOS/Android subscriptions
3. **Capacitor wrapper** — Wrap PWA as native iOS/Android app
4. **Coach Portal remaining:** PDF export, Stripe billing for coach tiers
5. **Video curation:** Continue running daily to get to 80%+ coverage
6. **TTS coverage:** Continue running Generate 25 daily

---

## 12. Naming / Branding

- App is currently called "Movement" but rename is planned.
- Shortlist: Hone, Caliber, Athlo, Kime, Vantage, Forge
- Coach portal = "Playbook" (proposed name for that product)
- Strategy: one LLC + multiple product names
- **Do nothing** until user confirms final name

---

## 13. Infrastructure Notes

- **Vercel:** Hobby plan. `dentalseowill-5409` account.
- **Supabase:** Free tier. `main` branch = production.
- **GitHub:** `Willdes1/movement-app`, master branch.
- **Current production commit:** `e65ed5c`
- **Credentials:** GitHub PAT (Willdes1) in user's 1Will Gonzalez Google Drive.
- **Admin portal:** `/admin` — hash-based tab routing (e.g. `/admin#tts`, `/admin#video`, `/admin#launchpad`)

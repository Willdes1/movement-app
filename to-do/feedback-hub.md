# Friends & Family Feedback Hub + Beta Testing Instructions

---

## 1. Friends & Family Feedback Hub

### Goal
Give F&F beta testers a structured way to submit feedback directly in the app, with full admin visibility and a recognition/reward loop when their feedback ships.

### User-Facing: Feedback Tab
A new tab in the app (visible only to `f_and_f` and `beta` role users) with three sections:

| Section | Purpose |
|---|---|
| **💡 Ideas** | Feature requests, new directions |
| **📋 Suggestions** | Improvements to existing features |
| **🐛 Bug Reports** | Broken behavior, crashes, errors |

Each submission captures:
- Category (idea / suggestion / bug)
- Title (short)
- Body (voice-transcribed or typed)
- Severity (bug only): low / medium / high
- Screenshot attachment (optional)
- Submitted by (user_id, display name)
- Timestamp

### Voice Input (Priority Feature)
Users tap a microphone button → app listens → transcribes speech in real time → AI cleans up grammar/punctuation before submission.

**Implementation options (evaluate in order):**
1. **Web Speech API** — built into Chrome/Safari on mobile, zero cost, no API key needed. Works for basic transcription. Grammar cleanup via a small Claude call post-transcription.
2. **OpenAI Whisper API** — higher accuracy, handles background noise better. $0.006/min. Good fallback if Web Speech quality is poor.
3. **Wispr Flow integration** — Wispr Flow is a macOS/iOS system-level tool, not an SDK. No public API to embed. Cannot be integrated directly — option 1 or 2 is the path.

Recommended: start with Web Speech API + Claude grammar pass. Upgrade to Whisper if quality complaints come in.

### Admin Dashboard — Feedback Inbox
New section in admin portal (or sub-tab of existing Users/Activity area):

- Table view: all submissions, sortable by date / category / user / status
- Status workflow: `new` → `reviewing` → `planned` → `shipped` → `declined`
- Filter by: category, status, user, date range
- Each row expandable to see full submission text
- "Mark as Shipped" button → triggers in-app notification to submitting user

### In-App Notification on Ship
When admin marks a submission as shipped:
- User sees notification inside app: "Bug #___ you reported has been fixed — thank you for helping us improve the platform! 🙌"
- Or for ideas/suggestions: "Your suggestion '[title]' just shipped in the latest update!"

### Recognition System (Gamification)
Track per-user: total submissions, accepted count, shipped count.

Badges (display on user profile):
- 🐛 **Bug Hunter** — first bug report submitted
- 🔥 **Power Tester** — 5+ submissions
- ⭐ **Contributor** — 1 accepted/shipped item
- 🏆 **MVP Tester** — 3+ shipped items

Badge display: user profile card, admin user view, and optionally the leaderboard on the feedback tab itself.

### Schema

```sql
CREATE TABLE feedback_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category     text NOT NULL CHECK (category IN ('idea', 'suggestion', 'bug')),
  title        text NOT NULL,
  body         text NOT NULL,
  severity     text CHECK (severity IN ('low', 'medium', 'high')),  -- bugs only
  status       text NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'reviewing', 'planned', 'shipped', 'declined')),
  internal_notes text,      -- admin-only notes
  shipped_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge      text NOT NULL,  -- 'bug_hunter', 'power_tester', 'contributor', 'mvp_tester'
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge)
);
```

RLS: users can INSERT and SELECT their own rows; admin can SELECT/UPDATE all.

### Build Phases
1. Schema + RLS migration
2. Feedback tab UI (typed input first, 3 sections)
3. Voice input (Web Speech API + Claude grammar pass)
4. Admin feedback inbox
5. Status workflow + ship notification
6. Badge system

---

## 2. Friends & Family Beta Testing Instructions

### Goal
A clear, friendly onboarding document sent to F&F testers before launch. Covers setup, navigation, plan generation, daily use, and how to submit feedback.

### Format
- Markdown document (shareable as PDF or in-app welcome screen)
- Plain English, non-technical, step-by-step with numbered instructions
- Screenshots / screen recordings can be added after UI is stable

### Content Outline

```
Welcome to the Beta — Thank You for Being Part of This

GETTING STARTED
1. Download the app / open the link
2. Create your account — use your email
3. Enter promo code [CODE] to unlock the Pro version
4. Set up your profile — add a photo, bio, and title

SETTING UP YOUR TRAINING PROFILE
5. Add your sport(s) and skill level
6. Set your training goals
7. Enter any injuries or restrictions
8. Choose your training days and session length

GENERATING YOUR FIRST PLAN
9. Tap "Generate Plan" — takes about 30 seconds
10. Review your 13-week program
11. Tap any day to see the full session breakdown

DAILY WORKOUT FLOW
12. Open today's workout
13. Follow the session blocks: Morning → Warmup → Workout → Core → Cooldown → Evening
14. Log your reps and sets as you go
15. Mark the session complete

IF YOU MISS A DAY
16. Go to the calendar and tap the missed day
17. Tap "Regenerate this day" — AI will rebuild just that session
18. You don't lose your streak — just pick up and keep going

SUBMITTING FEEDBACK (Important!)
19. Tap the Feedback tab
20. Choose: Idea / Suggestion / Bug Report
21. Tap the mic to speak your feedback, or type it
22. Hit Submit
23. You'll receive a notification when your feedback is reviewed and shipped

YOUR CONTRIBUTIONS MATTER
Every bug you catch and every idea you share gets logged.
When something you submitted ships in an update, you'll be notified —
and you'll earn a badge on your profile recognizing your contribution.
This is your app too. Help us make it great.

QUESTIONS?
[Contact / feedback channel TBD]
```

### Delivery
- Hosted at `/beta-guide` (public URL, no login required) or emailed as PDF
- Also shown as a welcome modal on first login for F&F accounts

### Status
Blocked on: feedback hub build, stable UI for all core flows, promo code system finalized.
Draft the document content once the UI is stable enough to screenshot.

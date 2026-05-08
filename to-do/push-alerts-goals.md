# Push Alerts & Internal Goal Tracking

## Goal
A notification system for in-app alerts + a public-facing goal tracker (GoFundMe-style progress bar) for funding milestones, launch goals, and community campaigns.

---

## Part A — Push Alerts & In-App Notifications

### Notification Types

| Trigger | Message |
|---|---|
| Feedback shipped | "Bug #___ you reported has been fixed — thank you!" |
| Trial ending soon | "Your trial ends in 3 days. Upgrade to keep access." |
| Trial expired | "Your trial has ended. Renew to keep your plan." |
| New plan generated | "Your Week X plan is ready." |
| Milestone hit | "You've completed 4 weeks of training. Keep going." |
| Goal progress | "The community is 68% to the launch goal — help us get there." |
| Coach message | "Your coach left a note on this week's program." |

### Delivery Channels (phased)

**Phase 1 — In-app notifications (bell icon)**
- Stored in DB, shown inside the app
- Unread badge count on nav icon
- Mark as read individually or all at once

**Phase 2 — Email notifications**
- Triggered server-side on status changes
- Transactional email via Resend or Supabase Edge Functions + SendGrid

**Phase 3 — Push notifications (mobile)**
- Requires PWA setup or native app (React Native)
- Web Push API for browser-based push
- Deferred until post-beta

### Schema

```sql
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,  -- 'feedback_shipped', 'trial_ending', 'milestone', 'goal_update', 'coach_note'
  title       text NOT NULL,
  body        text NOT NULL,
  link        text,           -- optional deep link (e.g. /feedback, /plan)
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

---

## Part B — Internal Goal Tracker

### Goal
A public or semi-public progress tracker showing movement toward funding, launch, or community milestones. Similar to GoFundMe progress bars or Kickstarter campaigns.

### Use Cases
- "Help us reach our launch goal of $10,000"
- "We need 500 beta testers by June 1 — we're at 47"
- "Community training challenge: 1,000 workouts logged this month"

### Features
- Progress bar with current / goal amount (or count)
- Percentage complete + raw number
- Short description of what reaching the goal means
- CTA button: "Contribute", "Invite a Friend", "Share"
- Optional: donor/supporter list (anonymized or named, opt-in)
- Admin can create, edit, and close goals

### Where It Lives
- Public-facing: a banner or card on the home/marketing page
- In-app: a card in the "For You" feed or a dedicated page
- Admin: a "Goals" panel to create and manage campaigns

### Schema

```sql
CREATE TABLE platform_goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  goal_type    text NOT NULL CHECK (goal_type IN ('funding', 'users', 'workouts', 'custom')),
  target_value numeric(12, 2) NOT NULL,
  current_value numeric(12, 2) NOT NULL DEFAULT 0,
  unit         text NOT NULL DEFAULT 'USD',  -- 'USD', 'users', 'workouts', etc.
  cta_label    text,
  cta_url      text,
  is_public    boolean NOT NULL DEFAULT true,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'closed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

### Build Phases
1. In-app notification schema + bell icon UI
2. Admin ability to send notifications to specific users or all users
3. Auto-trigger notifications (feedback shipped, trial ending)
4. Goal tracker schema + admin create/edit UI
5. Goal tracker public display (in-app + marketing page)
6. Email notifications (Phase 2)
7. Web push (Phase 3 — post-beta)

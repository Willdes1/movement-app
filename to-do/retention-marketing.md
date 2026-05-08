# Retention Tab & Marketing Automation

## Goal
A retention system in the admin portal that tracks user engagement patterns, automates re-engagement emails, and gives admin tools to run AI-generated marketing campaigns based on user behavior segments.

---

## Where It Lives
Admin Portal → new **"Retention"** tab (alongside Users, Health Monitor, etc.)

---

## Retention Dashboard

### User Segments (auto-calculated)

| Segment | Definition |
|---|---|
| **Active** | Logged in within last 7 days |
| **At Risk** | Logged in 8–21 days ago |
| **Churned** | No login in 22+ days |
| **Trial — Active** | On trial, >3 days remaining |
| **Trial — Expiring** | On trial, ≤3 days remaining |
| **Trial — Expired** | Trial ended, not converted |
| **Plan Generated, Never Logged** | Generated a plan, zero workout logs |
| **Logged Out Mid-Program** | Was active, dropped off mid-plan |

Admin sees a count for each segment with a list of users + their last activity date.

### Actions Per Segment
- Select a segment → "Send Campaign" → opens AI-generated email composer
- Or: manually select individual users → "Send Notification"

---

## Email Campaign System

### AI Email Generator
Admin selects:
- Target segment (e.g. "At Risk — hasn't logged in 10 days")
- Tone: Motivational / Friendly / Urgent / Informational
- Goal: Re-engagement / Trial conversion / Feature announcement / General update

Claude generates:
- Subject line (3 options to choose from)
- Email body (personalized with [first_name] merge tag)
- CTA button text + URL

Admin can edit before sending.

### Email Sending
**Phase 1:** Manual — admin copies email content, sends via their preferred email tool (Gmail, Mailchimp)
**Phase 2:** Integrated — Resend API or SendGrid for transactional + marketing emails from inside the admin panel

### Pre-Built Campaign Templates (auto-generated, admin triggers manually)

| Trigger | Subject Line (example) |
|---|---|
| No login in 7 days | "Don't break your streak — your plan is waiting" |
| No login in 14 days | "Your training plan is ready whenever you are" |
| Trial ends in 3 days | "Your trial ends Friday — upgrade to keep going" |
| Trial expired | "Your trial ended — here's how to continue" |
| Plan generated, no log | "You built your plan — now let's use it" |
| Milestone nearby | "You're 2 workouts away from completing Week 4" |

---

## In-App Alerts (non-email)

Banners and notification cards shown inside the app for:
- Trial ending: "Your trial ends in 3 days. Upgrade now." (with Upgrade button)
- Trial expired: "Your trial has ended. Renew to keep your plan."
- Long absence: "Welcome back! Your Week X plan is ready to continue."
- Goal progress: "The community is 68% to [goal] — help us get there."

These pull from the `notifications` table (defined in push-alerts-goals.md).

---

## Admin Email List Management

- Export any segment as a CSV (email, name, last_login, tier, plan_status)
- Useful for importing into Mailchimp, Klaviyo, or any external email tool
- Filtered by: segment, tier, join date range, active/inactive

---

## Schema

```sql
-- Track email campaign sends (for analytics)
CREATE TABLE email_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid NOT NULL REFERENCES auth.users(id),
  segment       text NOT NULL,
  subject       text NOT NULL,
  body          text NOT NULL,
  recipient_count int NOT NULL DEFAULT 0,
  sent_at       timestamptz,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Track which users received which campaign (for dedup + analytics)
CREATE TABLE email_campaign_recipients (
  campaign_id  uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);
```

---

## Build Phases
1. Retention dashboard — user segments auto-calculated, counts + lists displayed
2. CSV export per segment
3. AI email composer (Claude generates subject + body from segment + tone inputs)
4. In-app alert triggers (trial ending, long absence) — writes to notifications table
5. Email send integration (Resend API — Phase 2)
6. Campaign history + open rate tracking (Phase 3)

---

## Notes
- All email content should match the app's tone: direct, athlete-first, no generic fitness-app fluff
- Never email churned users more than once per 2 weeks (avoid spam/unsubscribe risk)
- Unsubscribe handling is required before any production email sending (CAN-SPAM / GDPR)
- Spanish language support for emails should follow the same language preference as the app (see language-switching.md)

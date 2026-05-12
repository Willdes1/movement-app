# User Error Reporting System
**Priority: HIGH**

## Goal
Allow any user (consumer or coach) to report bugs, broken features, or unexpected behavior directly from within the app. Reports flow into the admin portal as a prioritized queue. Fixed issues trigger an automated thank-you notification to the reporting user.

---

## User-Facing: Report a Problem

### Where It Lives
- Small "Report a Problem" link in the app footer / settings page / any error state
- Optionally: a floating "?" button on every page (admin toggle to show/hide)

### Report Form Fields
- **What went wrong?** — free text (required)
- **Which page or feature?** — dropdown (auto-detected from current route if possible)
- **How bad is it?** — radio: Annoying / Blocks me / App is broken
- **Screenshot** — optional file upload (image)
- **Email** — pre-filled from auth if logged in, optional if not

### Submission
- POST to `/api/report-bug`
- Saves to `bug_reports` table
- Sends admin a push notification / in-portal badge alert

---

## Admin Portal: Bug Reports Tab

### Where It Lives
Admin Portal → **"Bug Reports"** tab (Operations group), with a red badge showing unreviewed count

### Priority Scoring
Auto-scored on submission:
| Score | Criteria |
|---|---|
| **Critical** | "App is broken" severity + multiple reports of same issue |
| **High** | "Blocks me" severity OR reported by a coach/paying user |
| **Medium** | "Annoying" severity from active users |
| **Low** | Single report, edge case, cosmetic |

Duplicate detection: if 3+ users report the same route + description keywords, auto-escalate to Critical.

### Report Card View
Each report shows:
- Severity badge (Critical / High / Medium / Low) with color coding
- User name + role (coach vs user)
- Page/feature reported
- Description
- Screenshot thumbnail (click to expand)
- Timestamp + time since submitted
- Status: **New → In Review → Fixed → Won't Fix**
- "Mark as Fixed" button — triggers user notification

### Status Workflow
1. **New** — just submitted, unread
2. **In Review** — admin opened it
3. **Fixed** — admin marks resolved → auto-notification sent to user
4. **Won't Fix** — admin dismisses with optional reason

### Filters
- By status (New, In Review, Fixed)
- By severity (Critical first by default)
- By user role (coaches, users)
- By page/feature

---

## User Notification on Fix

When admin marks a report as Fixed, the user receives:

**In-app notification:**
> "✓ Issue resolved — Thanks for the report! The problem you flagged with [feature] has been fixed. Your feedback makes the platform better for everyone. 🙏"

**Schema hook:** writes to `notifications` table (existing) with `type: 'bug_resolved'`

---

## Schema

```sql
CREATE TABLE bug_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      text,
  user_role       text,
  page_url        text,
  feature_label   text,
  description     text NOT NULL,
  severity        text NOT NULL DEFAULT 'medium' CHECK (severity IN ('annoying', 'blocks_me', 'broken')),
  priority        text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'fixed', 'wont_fix')),
  screenshot_url  text,
  admin_notes     text,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports, read their own
CREATE POLICY "bug_reports_insert" ON bug_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bug_reports_own_read" ON bug_reports FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Admins can do everything
CREATE POLICY "bug_reports_admin" ON bug_reports FOR ALL TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()));
```

---

## Build Phases
1. Schema + API route (`POST /api/report-bug`)
2. User-facing report form (modal, accessible from footer/settings)
3. Admin Bug Reports tab — full list, priority sorting, status workflow
4. "Mark as Fixed" → in-app notification to user
5. Screenshot upload (Supabase storage bucket `bug-reports`)
6. Duplicate detection + auto-escalation
7. Admin badge/alert (red dot on Bug Reports nav item)

# Project Spend Tracker

## Goal
A tab in the admin portal where all project-related spending is tracked in one place — token costs, subscriptions, tools, services, design work, and any other expenses.

---

## Where It Lives
Admin Portal → new **"Spend"** tab (or sub-tab of the existing Health Monitor).

---

## Spend Categories

| Category | Examples |
|---|---|
| **AI / Token Usage** | Anthropic API (auto-pulled from token_usage table) |
| **Infrastructure** | Vercel, Supabase, domain registrar |
| **Design** | Graphic design, logo work, Figma, Canva Pro |
| **Tools & Software** | Any SaaS tools used for the project |
| **Marketing** | Ads, promotional spend |
| **Legal** | Trademark filing, legal review |
| **Other** | Anything else project-related |

---

## Design Requirements
- **Mobile-first** — fully usable on phone for on-the-go expense entry (e.g. snap a receipt at a coffee shop and log it immediately)
- **Receipt photo capture** — camera/gallery upload on mobile; file upload on desktop. Stored in Supabase storage bucket `receipts`.
- Fast entry: category + amount + photo should be submittable in under 10 seconds

---

## Features

### Auto-Populated: Token Costs
Token usage is already tracked in the `token_usage` table with `input_tokens` and `output_tokens`.
Pull this automatically and apply the current rate ($3.00/M input, $15.00/M output for Sonnet 4.6) to calculate dollar cost per call and cumulative total.

Show:
- Total AI spend to date
- Spend by endpoint (generate-plan, generate-feed, etc.)
- Monthly trend chart

### Manual Entry: Everything Else
A form to log any project expense:
- Date (defaults to today)
- Category (dropdown)
- Description (text)
- Amount (USD)
- Vendor / source
- Receipt photo — camera capture on mobile, file upload on desktop (stored in `receipts` Supabase bucket)
- Notes (optional)

### Dashboard View
- **Total project spend** (AI + manual entries)
- **Spend by category** (bar chart or breakdown table)
- **Monthly burn rate**
- **AI vs. non-AI split**
- Running total from project start (April 18, 2026)

### Export
CSV export of full spend log with date range filter.

---

## Schema

```sql
CREATE TABLE project_expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text NOT NULL,  -- 'infrastructure', 'design', 'tools', 'marketing', 'legal', 'other'
  description text NOT NULL,
  amount_usd  numeric(10, 2) NOT NULL,
  vendor      text,
  notes       text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  added_by    uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

RLS: admin-only.

Token costs are read live from the existing `token_usage` table — no new schema needed for that.

---

## Build Phases
1. Schema + RLS migration + Supabase `receipts` storage bucket
2. Spend tab UI — token costs auto-pulled, monthly breakdown
3. Manual expense entry form (mobile-optimized, receipt photo upload)
4. Total dashboard (all categories combined)
5. CSV export with receipt URL column
6. Monthly trend chart

---

## Seed Data
On first build, add manual entries for known pre-tracker spending:
- Vercel hobby plan subscription
- Supabase plan (if paid)
- Any design work paid to date
- Domain registration
User will provide amounts at build time.

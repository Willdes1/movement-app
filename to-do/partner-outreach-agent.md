# Partner & Influencer Outreach Agent

## Goal
A Launchpad tool (admin-only) that helps find, research, and draft outreach to potential partners — influencers, physical therapists, coaches, sport-specific creators, and brand collaborators.

---

## Where It Lives
Admin Portal → Launchpad → new **"Partners"** section (alongside existing Branding, Legal, Investor prompts).

---

## Target Partner Types

| Type | Examples |
|---|---|
| Sport influencers / athletes | Vanja (snowboarding), skate coaches, pro golfers, MMA fighters |
| Niche sport communities | Duo Group (snowboarding), skate crews, golf clubs, derby leagues |
| Physical therapists | PTs with social presence, clinic owners, DPT educators |
| Fitness coaches & trainers | Online coaches, S&C coaches, sport-specific trainers |
| Fitness/wellness creators | YouTube, Instagram, TikTok — evidence-based content |
| Brand partners | Equipment, apparel, supplement brands aligned with the aesthetic |

---

## Agent Capabilities

### 1. Partner Search
Input: sport/niche, platform (Instagram / YouTube / TikTok / LinkedIn), audience size range, location (optional).

Output: a researched list of potential partners with:
- Name / handle
- Platform + follower count (approximate)
- Content niche
- Why they're a fit for this app
- Estimated collaboration value (high / medium / low)

Implementation: Claude generates a curated shortlist based on the sport/niche input. For live data (real follower counts), a future upgrade could integrate a creator search API (Modash, Creator.co, or similar).

### 2. Outreach Draft Generator
Input: partner name, their niche, collaboration type (affiliate / ambassador / content trade / paid partnership).

Output: a personalized email or DM draft that:
- References their specific content or sport
- Explains the app in 2-3 sentences (non-generic)
- Makes a clear, low-friction ask
- Includes a call to action (free access code, demo link, or call)

Tone options: Professional / Conversational / Direct

### 3. Partner CRM List
A table inside the admin portal to track outreach status:

| Column | Values |
|---|---|
| Name | text |
| Handle / Contact | text |
| Platform | Instagram / YouTube / TikTok / LinkedIn / Email |
| Niche | text |
| Status | prospect → contacted → replied → active → declined |
| Notes | free text |
| Date Added | auto |

Actions:
- Add partner manually
- Auto-add from agent search output
- Edit status and notes inline
- Export list as .csv

### 4. Export
"Export as CSV" button → downloads the current filtered list as a .csv file with all columns.

---

## Schema

```sql
CREATE TABLE partner_prospects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  handle       text,
  platform     text,
  niche        text,
  status       text NOT NULL DEFAULT 'prospect'
               CHECK (status IN ('prospect', 'contacted', 'replied', 'active', 'declined')),
  notes        text,
  contact_info text,
  added_by     uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

RLS: admin-only (is_admin = true).

---

## Build Phases
1. Partners section in Launchpad — search + draft generator (Claude-powered, no live data)
2. Partner CRM table (in-admin list view with status tracking)
3. CSV export
4. Future: live creator search API integration (Modash or similar)

---

## Notes
- Wispr/Vanja and Duo Group are high-priority targets — snowboarding niche is well-aligned with the app's athlete identity
- PTs are a B2B channel as much as a marketing channel — they can become coach portal users
- Keep outreach tone authentic — the app's warrior/athlete philosophy should come through in every message

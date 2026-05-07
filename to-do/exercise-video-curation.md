# Exercise Video Curation — Admin Tool

## When to build this

**Not now.** The impersonation feature has to ship and smoke-test cleanly first, and the coach portal work has to be at a stable checkpoint. When both of those are done and verified, come back to this brief.

## Read first, as always

1. `CLAUDE.md` for current architecture.
2. `to-do/` and `ideas/` for anything related to videos, exercise media, the media library, or admin tooling. Pull the relevant snippets.
3. The current `exercise_library` schema, especially the columns added in the coach-portal migration (`movement_pattern`, `equipment`, `audience`, etc. — the curation tool will use those for matching).

Flag any conflicts before writing code.

## What I'm building

An **admin-only video curation tool** that uses the YouTube Data API to find embed-able demonstration videos for every exercise in our library, restricted to a curated list of trusted channels. The AI proposes 3 candidates per exercise. I review and approve in the admin portal. Once approved, the chosen URL is written to `exercise_library.video_url` and shows up in user/coach-facing exercise views (the user-facing player UI is a separate, later piece of work — this brief is just the curation pipeline and admin review UI).

## Where it lives

Inside the existing admin portal, in or near the media library section. New tab: **"Exercise Video Curation."**

## Schema additions

Two new columns on `exercise_library` (if they don't exist already from earlier work):

- `video_url` (text, nullable) — the approved YouTube URL.
- `video_source` (text, nullable, values: `youtube`, `vimeo`, `custom`) — provenance.
- `video_approved_at` (timestamptz, nullable).
- `video_approved_by` (uuid, nullable, references auth.users).

One new table for candidate proposals (so we can show 3 options per exercise and remember the rejected ones):

```sql
CREATE TABLE exercise_video_candidates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id     uuid NOT NULL REFERENCES exercise_library(id) ON DELETE CASCADE,
  youtube_video_id text NOT NULL,
  url             text NOT NULL,
  title           text,
  channel_id      text,
  channel_title   text,
  description     text,
  duration_seconds int,
  view_count      bigint,
  like_count      int,
  published_at    timestamptz,
  embeddable      boolean NOT NULL,
  ai_relevance_score numeric(3,2),
  ai_reasoning    text,
  status          text NOT NULL DEFAULT 'proposed'
                  CHECK (status IN ('proposed','approved','rejected','superseded')),
  reviewed_at     timestamptz,
  reviewed_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

Show me the schema before migrating, same as always.

## Approved channel list (seed data)

Store as a configuration table or a constant — whichever is easier to update without a code deploy. These are the only channels the curation pipeline searches.

**General strength + form:**
- Squat University
- Jeremy Ethier
- Renaissance Periodization
- Athlean-X (note: filter for embeddable=true at API level, his channel disables embedding on some videos)

**Mobility + lower body resilience:**
- Knees Over Toes Guy (ATG)
- Calisthenicmovement

**Rehab / clinical (for `audience = 'clinical'` exercises):**
- Bob & Brad
- E3 Rehab
- [P]rehab
- Squat University (overlaps both buckets)

Build the table so I can add/remove channels later from the admin UI without a deploy. Each row: `channel_name`, `channel_id` (resolved via API), `audience_focus` (`general` | `clinical` | `both`), `priority` (1 = preferred, 5 = fallback), `active` (bool).

## The pipeline

Standalone script (or admin-triggered job) that runs in the background, not on user request. Steps:

**1. For each exercise without a `video_url`:**
Build a search query from the exercise's `name_display` plus relevant tags (e.g., `"lateral raise dumbbell shoulder"`). If `audience = 'clinical'`, prefer the rehab channels in the search restriction. Otherwise prefer the general strength channels.

**2. Call YouTube Data API v3 search.endpoint:**
Restrict to approved channel IDs only. Filter for `embeddable=true` (do this in the follow-up `videos.list` call, since `search.list` doesn't return that field). Pull the top 5 results.

**3. Pass top 5 to Claude (Anthropic API, `claude-sonnet-4-20250514`)** with the exercise name, our internal cue/description for that exercise from `exercise_library.how`, and the candidate titles + descriptions. Ask Claude to:
- Score relevance 0.0–1.0 (does this video actually demonstrate this exercise correctly).
- Pick the top 3.
- Write a one-sentence reasoning per pick.

Hard rule: Claude does NOT output the URL itself or anything besides the candidate IDs and reasoning. We pass it the candidates, it picks from them. No hallucinated YouTube IDs.

**4. Write the 3 picks to `exercise_video_candidates`** with `status='proposed'` and the AI's score and reasoning.

**5. Logging:** track API quota used, AI tokens spent, exercises processed, exercises skipped (no good results found). Same logging discipline as the coach AI generation log.

**Quota awareness:** YouTube Data API gives 10,000 units/day free, search costs 100/call. Build the pipeline to batch and pause — don't burn the whole quota on the first run. Configurable batch size, default 50 exercises per run.

## Admin review UI

New tab in the admin portal: **"Exercise Video Curation."**

**Top of page:**
- Search bar: filter by exercise name, status (no video / proposed / approved), audience.
- Stats: total exercises, % with approved video, % with proposals waiting, % with no proposals yet.
- "Run curation pipeline" button with batch size selector (warns if it'll exceed remaining daily API quota).

**Per exercise row:**
- Exercise name, audience tag, current status.
- If `proposed`: show all 3 candidates as cards, each with the embedded YouTube preview (use the standard embed iframe with `playsinline=1` and autoplay OFF). Each card shows title, channel, duration, view count, AI relevance score, and AI reasoning.
- **Three buttons per exercise:**
  - "Approve this one" on each candidate card → sets `exercise_library.video_url`, marks all other candidates as `superseded`, marks chosen one as `approved`.
  - "Reject all and regenerate" → wipes the 3 candidates and re-runs the pipeline for that single exercise.
  - "Paste my own URL" → text field, validates it's a YouTube URL, validates the video is embeddable, writes directly to `exercise_library.video_url` with `video_source='custom'`.

**Bulk actions:**
- "Approve all candidates with AI relevance score > 0.85" — for the obvious matches, save me clicks. Shows a confirmation count first.
- "Show me only the borderline ones (0.6–0.85)" — for the cases that actually need my eyes.

## What's explicitly NOT in this build

- **No user-facing player.** That's a separate, later piece. Don't touch user-side exercise views in this brief.
- **No coach overrides yet.** When the coach portal supports it (V2 of coach features), coaches will be able to override `video_url` per-client. Don't build that here.
- **No video downloading or re-hosting.** We embed only. Never download from YouTube, never re-host their content. Non-negotiable for legal reasons.
- **No automatic re-curation.** Once approved, a video stays approved until I manually re-curate it.

## What I want you to do, in order

Pause and confirm at each step.

1. Read `CLAUDE.md`, `to-do/`, `ideas/` and report any conflicts or existing related work.
2. Schema review: propose the column additions and the two new tables. Show me before migrating.
3. API key setup: walk me through getting a YouTube Data API v3 key from Google Cloud Console. Add the key to env vars, never commit it.
4. Build the channel-approval table and seed it with the list above. Resolve channel handles to channel IDs via API.
5. Build the pipeline script. Test it on 5 exercises first. Show me what it wrote to `exercise_video_candidates`.
6. Build the admin UI. Test the embed preview, the approve flow, the reject-and-regenerate flow, and the paste-my-own flow.
7. Run a 50-exercise batch. I review and approve. Iterate on the prompt or scoring if the AI's picks are bad.
8. Then we scale to the full library in batches over a few days, respecting the API quota.

## One smoke test before we call it done

I run the pipeline on a single exercise, see 3 candidates with embedded previews in the admin UI, click approve on one, navigate to the `exercise_library` table directly, and confirm `video_url`, `video_source`, `video_approved_at`, and `video_approved_by` are all populated. Then I open a different exercise, click "paste my own URL," paste a valid YouTube URL, and confirm the same fields populate with `video_source='custom'`.

If both of those work end-to-end, the curation tool is done. If either doesn't, it's not.

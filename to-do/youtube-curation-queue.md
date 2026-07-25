# Atlas Prime: Next Session Work Queue

## How to run this session

Work these tasks one at a time, in the order listed. Do not start the next task until I confirm the current one.

For every task:
1. Read the existing code first and tell me what already exists before you propose anything.
2. Show me the plan and the file list, then pause for my confirmation.
3. Write SQL migrations to a file for my manual review. Do not apply migrations automatically.
4. Reuse existing RLS policies, admin layout patterns, and API route conventions. Do not invent new patterns.
5. Keep diffs tight. No refactors I did not ask for.
6. No em dashes in any copy, comment, or response.
7. End each task with a smoke test I can run myself.

---

## Task 1: YouTube quota audit and curation throughput

**This is the first priority. Everything else in the curation pipeline depends on it.**

Context: I am currently only able to process roughly 19 videos per day before hitting the YouTube Data API limit. I want to process hundreds per day.

Important constraint: do not build anything that spreads requests across multiple Google accounts or multiple Google Cloud projects. That is a direct violation of the YouTube API Services Terms of Service and Google revokes access across every project when they detect it. The fix is to lower the quota cost per video, not to multiply accounts.

What to build:

1. **Quota instrumentation.** Create a `youtube_api_usage` table logging every call: endpoint, unit cost, timestamp, curation batch id, video id, success or failure. Add a helper that wraps every YouTube call so nothing bypasses logging.
2. **Cost audit.** Produce a written breakdown of exactly how many quota units one curated video currently consumes, by endpoint. I want to see where the 10,000 units per day are going.
3. **Replace expensive calls.** `search.list` costs 100 units per call. `videos.list` and `playlistItems.list` cost 1 unit per call and accept up to 50 video IDs per request. Rework the curation pipeline so that:
   - Discovery pulls from channel uploads playlists via `playlistItems.list` instead of keyword `search.list` wherever possible.
   - All metadata fetches are batched at 50 IDs per call.
   - Multiple `part` values are requested in a single call, since extra parts do not increase the cost of `videos.list`.
   - Responses are cached with ETag support so unchanged videos do not burn units on re-fetch.
4. **Quota budget meter.** Add a live quota gauge to the curation tab showing units used today, units remaining, estimated videos remaining at the current rate, and the reset time in Pacific Time.
5. **Backoff handling.** Treat 429 and 403 differently. 429 means retry with exponential backoff. 403 `quotaExceeded` means stop calling and queue for the next reset window. Do not retry 403s in a loop.
6. **Quota extension prep.** Draft the supporting material I need for the YouTube API Services Audit and Quota Extension Form: use case description, expected daily usage, how we store and refresh data, and links to our privacy policy and terms. This is the only legitimate path above 10,000 units per day and reviews take weeks, so I want it submitted early.

Target outcome: a documented per-video unit cost low enough to curate several hundred videos in a single day inside the default quota.

### Corrections to this task (added 2026-07-25, after testing)

**Item 3, ETag caching.** The claim above that ETag support stops unchanged videos from burning
units is **wrong**, and this was tested, not assumed. Firing 100 conditional requests that all
returned 304 moved the Google Cloud Console "Queries per day" counter from 26 to 127. A 304 costs
the same quota as a 200 on this API. Conditional requests therefore save nothing here. The savings
have to come from the **local cache** of channel uploads, which removes the call entirely, rather
than from making the call cheaper. ETag plumbing stays in `lib/youtube.ts` because it saves
bandwidth and parsing, but it must not be counted as a quota optimisation anywhere, including in
the Task 1 item 6 extension form.

**No dependency on Task 6.** An earlier agent summary of this queue claimed Task 1's title
matching depended on the Task 6 abbreviation mapping table. This spec never said that. Task 6's
mapping is referenced by Task 9 item 5 only. The dependency was invented during summarisation and
is void. Decision: **Task 1 ships its own minimal inline abbreviation map in `lib/`**, roughly 20
to 30 entries covering the common cases (1 DB, DB, BB, KB, SA, alt, and similar). Task 6 later
absorbs that map as its seed, and the inline version is deleted at that point. Task 6 is not
pulled forward.

**Confidence threshold is not to be guessed.** On the first index build, matching runs in dry-run
mode with the fallback disabled, logs the score distribution, and presents a histogram. The
threshold is chosen from that real data, and stays configurable either way.

---

## Task 2: Dead video detection

Context: Atlas Prime references around a thousand YouTube videos. If a creator deletes a video, makes it private, or it becomes region blocked, the athlete sees a broken player and we find out from a support complaint. That cannot happen.

What to build:

1. **Health check job.** A scheduled job that batches every stored video ID through `videos.list` at 50 IDs per call. Any ID that is absent from the response has been deleted or made private. For IDs that do return, check `status.privacyStatus`, `status.uploadStatus`, `status.embeddable`, and `contentDetails.regionRestriction`.
2. **Schema.** Add to the video table: `availability_status` (available, deleted_or_private, not_embeddable, region_blocked, unknown), `unavailable_reason`, `last_checked_at`, `consecutive_failures`.
3. **Admin tab.** A "Video Health" section in the admin portal showing flagged videos, the exercises they are attached to, how many programs reference them, and the date they went bad. Include a manual re-check button and a "find replacement" action that drops the exercise back into the curation queue.
4. **Athlete side fallback.** If a video is flagged unavailable, the athlete app shows the written instructions and a graceful message instead of a broken embed. Never render a dead player.
5. **Alerting.** Notify me when anything newly breaks, with a count and a link to the Video Health tab.

Note the cost is trivial. One thousand videos is twenty batched calls, which is twenty quota units. This can run daily without meaningfully touching the curation budget, and it also keeps us compliant with YouTube's requirement to refresh stored API data regularly.

---

## Task 3: Trim status for workout montages

Context: There is currently no way to tell which workout videos have already been trimmed. I check them one by one manually.

What to build:

1. Add `trim_status` (not_started, in_progress, trimmed, needs_review), `trim_start_seconds`, `trim_end_seconds`, `trimmed_at`, and `trimmed_by` to the relevant table.
2. Backfill existing records by inferring status from whatever trim data already exists. Show me the backfill logic before running it.
3. Add a status badge to every workout and exercise row in the admin portal.
4. Add a filter and a counter to the montage section: total, trimmed, remaining, needs review.
5. Add a "next untrimmed" button so I can work straight through the queue without hunting.

---

## Task 4: Mobility videos, montages, and curation

Context: The mobility feature in the athlete app is written instructions only. No videos.

What to build:

1. Extend the mobility movement records to carry the same video fields as strength exercises: YouTube video ID, trim window, and trim status.
2. In the athlete app, mobility movements get the same short looping montage window used in the per workout view, plus an option to open the full video.
3. Add mobility movements to the curation queue using the same tooling as Task 1, not a separate parallel system.
4. **Instruction match check.** This is the important part. Before a mobility video can be approved, run an automated comparison between our written instructions for that movement and the video's title, description, and transcript. Flag any contradiction, for example our instructions say knees stay behind the toes and the video demonstrates the opposite. Surface the flag to me. A human approval is still required. Never auto approve.

---

## Task 5: Voice playback controls in the workout window

Context: The voice feature reads the entire instruction set start to finish with no way to stop it or jump to a section.

What to build:

1. A play button per instruction section, plus a play all button.
2. Working pause, resume, and stop controls that are visible while audio is playing.
3. Audio stops automatically when the athlete navigates away or the component unmounts. No audio ever continues in the background.
4. The currently playing section is visually highlighted.
5. Persist the athlete's speed and voice preference.

---

## Task 6: Movement library standardization and cleanup

Context: The exercise library appears in several places across the admin portal and some of them do not match how exercises appear in the athlete app. Names are also inconsistent and abbreviated.

What to build:

1. **Audit.** List every location in the codebase where the movement library is rendered, admin and athlete, and show me the differences in fields, sorting, and display. Then consolidate onto one shared component and one query pattern.
2. **Naming convention.** Establish a single naming standard and document it. Abbreviated names become full descriptive names. Examples: "1 DB Chest Fly" becomes "Single-Arm Dumbbell Chest Fly", "1 DB Back Row" becomes "Single-Arm Dumbbell Row". Keep the original name in a `legacy_name` column so nothing breaks and I can trace changes.
3. **Rename migration.** Generate the full mapping table of old name to new name as a reviewable file. I will approve it before anything is applied. Do not apply it automatically.
> Note added 2026-07-25: Task 1 does **not** depend on this task's mapping table. Task 1 ships a
> small inline abbreviation map of its own so it is not blocked. When this task builds the real
> mapping, it seeds from that inline map and then deletes it. See the corrections block under
> Task 1.

4. **Unilateral video recleanup.** Many approved videos demonstrate both arms or both legs when the exercise is unilateral. I approved these by mistake and it is a large cleanup. Build a report that flags every exercise whose name indicates single-arm, single-leg, alternating, or offset, and queue those videos for recuration with their approval reset to pending. Give me a count first so I know the size of the job before anything is reset.

---

## Task 7: Design token audit

Context: I want the platform to look like a real engineering team built it, not like a generated app, and I want to be able to change the brand in one place instead of hunting through hundreds of files. This is also the prerequisite for connecting Figma to Claude Code later.

What to build:

1. **Inventory.** Scan the entire codebase and report whether each of these is centralized or hardcoded, and list every hardcoded instance: primary color, accent color, background colors, font families, font sizes, border radius, button heights, card spacing, shadow values, logo paths, icon sizing.
2. **Consolidate.** Move everything into a single semantic token layer with named variables such as `--color-readiness-positive`, `--radius-card`, `--space-card`. Semantic names, not raw values, and not literal color names.
3. **Apply.** Replace hardcoded values across the athlete portal, coach portal, admin portal, and marketing site so all four consume the same tokens.
4. **Responsive audit.** Report every screen that breaks or degrades at small phone width, standard phone, tablet portrait, tablet landscape, laptop, and large desktop. Fix layout issues found. Every screen must work on every device.
5. Do not change any visual design in this task. Same pixels, different plumbing. I want to be able to diff it and see nothing moved.

---

## Task 8: Branding placeholders

Context: Final logo work is going to a designer. I need working placeholders now, built so the real assets drop in without a rewrite.

What to build:

1. Reference the logo through a single token or component so swapping the final files is a one line change.
2. Build the "Create AI Program" loading animation as an inline SVG or Lottie placeholder using the bicep and gear concept: the bicep flexes while the gear rotates, on a loop, subtle rather than flashy. Keep it under a few kilobytes, respect `prefers-reduced-motion`, and stop it when generation completes.
3. Wire up favicon and app icon slots at all required sizes with placeholders, so the app store submission checklist is already satisfied structurally.
4. Do not generate a final logo. That is coming from a human designer.
---

## Task 9: Export the movement library for an animation vendor

Context: I am getting quotes from 3D exercise animation studios so I can own our demonstration content instead of depending on YouTube links forever. The animations have to match our written instructions exactly. If our instructions say one thing and the animation shows another, we look unqualified to a paying customer.

What to build:

1. **Export script.** A repeatable script (not a one time query) that exports the full movement library to CSV and to JSON. Save it in the repo so I can rerun it as the library grows.

2. **Columns to include, one row per movement:**
   - `movement_id`
   - `display_name` (the cleaned up name from Task 6, not the abbreviation)
   - `legacy_name`
   - `category` and `subcategory`
   - `equipment` (specific: barbell, dumbbell, cable, kettlebell, machine, bodyweight, band)
   - `unilateral` (true or false) and `side` if applicable
   - `primary_muscles` and `secondary_muscles`
   - `movement_pattern` (hinge, squat, push, pull, carry, rotation, isometric)
   - `plane_of_motion`
   - `setup_instructions` (full text)
   - `execution_instructions` (full text)
   - `common_faults` or coaching cues if we store them
   - `tempo` or rep guidance if we store it
   - `range_of_motion_notes`
   - `current_youtube_video_id` and `trim_start_seconds` / `trim_end_seconds` so the vendor can see the movement we currently reference
   - `is_mobility` (true or false)
   - `priority_tier` (see below)

3. **Priority tiering.** Add a computed `priority_tier` column based on how many active programs reference the movement. Tier 1 is the most used, Tier 3 is the long tail. I want to quote and produce in waves, most used movements first, not all at once.

4. **Counts summary.** Print a summary before the export: total movements, split by equipment type, split by unilateral vs bilateral, split by mobility vs strength, and count per priority tier. I need these numbers to negotiate a quote.

5. **Instruction quality check.** Flag any movement where the instruction text is missing, under 100 characters, or contains an abbreviation from the Task 6 mapping table. Those need to be fixed before they go to a vendor, because an animator working from a vague instruction will guess and guess wrong.

6. **Vendor-facing packet.** Generate a clean, readable version of the export as a single document, grouped by category, showing only display name, equipment, unilateral flag, and the setup and execution instructions. No internal IDs, no database columns. This is what an animator actually reads.

Deliverables to `/exports`: `movement-library.csv`, `movement-library.json`, `movement-library-vendor-packet.md`, and `movement-library-summary.txt`.

---

## Task 10: Brand asset inventory for the designer

Context: I am briefing a designer on the full identity system and I need to hand them an exact list of every asset slot and size the platform currently uses, so nothing gets missed and nothing gets delivered that we do not need.

What to produce (a written report, no code changes):

1. Every location where a logo, icon, or brand image is currently rendered or referenced. Include the file path, the component, and the current placeholder file.
2. Every favicon and touch icon slot currently declared, including the web manifest entries and the `<head>` tags, with the exact dimensions each one expects.
3. The iOS and Android app icon requirements from our current build config, including every required size and whether we are using Android adaptive icon layers.
4. Every place a brand color or font is hardcoded rather than referenced through a token, cross referenced with the Task 7 audit.
5. The exact viewport breakpoints the app currently uses, so the designer knows what widths to design against.
6. Any social or open graph image slots, with their required dimensions.

Output this as `/exports/brand-asset-inventory.md`. Do not change any files. This task is read only.

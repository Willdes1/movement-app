# YouTube API Services: Audit and Quota Extension

Supporting material for the YouTube API Services Audit and Quota Extension Form.
Prepared 2026-07-31 by Atlas Prime Labs LLC.

> Reviews take weeks, which is why this exists before it is urgently needed. Everything
> below is measured from `youtube_api_usage`, a table that logs every single API call the
> product makes. No figure here is an estimate unless it says so.

---

## 1. Identity

| | |
|---|---|
| Product | Atlas Prime (`https://atlasprime.app`) |
| Company | Atlas Prime Labs LLC (California, USA) |
| Google Cloud project | `movement-app-495418` |
| Contact | will@atlasprime.app |
| Privacy policy | https://atlasprime.app/privacy |
| Terms of service | https://atlasprime.app/terms |

## 2. What the product does

Atlas Prime is an AI training platform. It generates individualised strength, conditioning
and rehabilitation programmes, and every exercise in a programme links to a demonstration
video so the athlete can check their form before performing the movement.

We maintain a library of roughly 2,000 exercises. Each one needs exactly one embedded
YouTube demonstration. YouTube is used strictly as an **embedded demonstration source**:

- Every video plays through the standard **YouTube IFrame Player**. Nothing is downloaded,
  re-hosted, cached as media, stripped of branding, or served outside the official player.
- We only ever embed videos whose `status.embeddable` is `true`, checked at curation time.
- Attribution (channel name and title) is stored and displayed alongside every video.
- We do not modify, overlay, or monetise third-party video content.

## 3. Why the default quota is the binding constraint

A default project receives 10,000 units per day. `search.list` costs **100 units per call**.

Our original pipeline spent roughly **201 units per curated exercise** (two `search.list`
calls plus one batched `videos.list`), which capped us at about 50 exercises a day in
theory and, because of a regeneration path that swept every approved channel, closer to
**19 a day** in practice. At that rate a 2,000 exercise library is a multi-year project.

## 4. What we did about it before asking for more

We treated the default quota as a design constraint first and a request second. Measured
results, all from `youtube_api_usage`:

| Change | Effect |
|---|---|
| Removed a regeneration path that swept every approved channel | ~1,500 units per regenerate down to **0** |
| Replaced `search.list` discovery with a cached channel uploads index built from `playlistItems.list` | 100 units per query down to **1 unit per 50 videos** |
| Local trigram plus rule-based matching against that index (Postgres `pg_trgm` and application scoring) | Discovery for a matched exercise now costs **0 units** |
| Batched every metadata read through `videos.list` at 50 ids per call with all `part` values in one request | 1 unit per 50 videos |
| Hard daily cap on the remaining `search.list` fallback, with per-call logging and a UI label | Paid calls are bounded and visible |

**Measured outcome:** 18,300 videos across 9 channels were indexed for **372 units**, once.
Refreshing that index incrementally costs about **9 units a day**. Equivalent discovery via
`search.list` would have cost roughly 366,000 units.

### On conditional requests

We implemented ETag and `If-None-Match` support and then measured it: firing 100 conditional
requests that all returned `304 Not Modified` moved the Cloud Console daily counter from 26
to 127, an increase of 101. **On this API a 304 costs the same quota as a 200.** We mention
it because conditional requests are commonly assumed to be a quota optimisation and, in our
measurements, they are not. Our savings come from eliminating calls, not from making them
conditional.

## 5. Remaining need

After the work above, quota is consumed by exercises our indexed channels genuinely do not
cover: sport-specific technique work (racquet drills, ballet, fencing, agility) and
rehabilitation movements outside the mainstream strength catalogue. These require a general
`search.list` at 100 units, and there is no cheaper API path for them.

**Expected steady-state daily usage:**

| Purpose | Calls/day | Units/day |
|---|---|---|
| Incremental uploads index refresh (`playlistItems.list`) | ~30 | ~30 |
| Metadata for newly matched videos (`videos.list`, batched 50) | ~20 | ~20 |
| Daily availability health check on ~2,000 stored ids (`videos.list`, batched 50) | ~40 | ~40 |
| Capped `search.list` fallback for uncovered exercises | up to 80 | up to 8,000 |
| **Total** | | **~8,100** |

That fits inside 10,000 with little headroom, and none for growth in the library, additional
approved channels, or coach-supplied exercises. **We are requesting an increase to 100,000
units per day**, which would let the fallback clear the remaining backlog in weeks rather
than months and leave room for the library to grow.

## 6. Data storage and refresh policy

We store the minimum needed to match an exercise to a video, and we refresh or delete it on
a cycle.

**What is stored** (`youtube_channel_videos`): video id, channel id, title, description,
published date, and `last_refreshed_at`. Plus, per approved channel, the channel id and
uploads playlist id.

**What is not stored:** no video files, no thumbnails as files, no transcripts, no comments,
no user data, no watch history, no authenticated user content of any kind. We use only
public metadata and we do not use the Data API to collect anything about YouTube users.

**Refresh and deletion:**

- Every cached row carries `last_refreshed_at`, updated whenever the record is re-fetched.
- The index refresh job runs against the approved channels and updates stored metadata.
- A prune step removes cached rows for channels that are deactivated or removed, so stored
  data never outlives its source approval.
- A daily availability check batches stored video ids through `videos.list`. Videos that are
  deleted, made private, made non-embeddable or region-blocked are flagged and stopped from
  being served to users.
- Stored API data is refreshed or deleted **within 30 days**, in line with the YouTube API
  Services Developer Policies on data storage.

## 7. Compliance notes

- No multi-project or multi-account quota splitting. We considered and explicitly rejected
  it as a violation of the YouTube API Services Terms of Service.
- All playback goes through the official IFrame Player with branding intact.
- Embeddability is checked before a video is ever shown, and re-checked by the daily health
  job.
- Attribution to the source channel is displayed to end users.
- Every API call is logged with endpoint, unit cost, status and purpose, so our own usage is
  auditable on request.

---

*Figures in sections 4 and 5 come from the `youtube_api_usage` table and the Google Cloud
Console quota counters, measured 2026-07-25 to 2026-07-31.*

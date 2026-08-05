# Task 6 item 1: where the exercise library is rendered

Audit date 2026-08-05. 29 files touch `exercise_library`; these are the ones that
**render** it to a human. API routes and generators are excluded.

## The canonical shape

Three surfaces already agree exactly, and they are the ones athletes use most.
Treat this column list as correct and make everything else match it:

```
name_normalized, name_display, how, breathing, core, tip,
video_url, video_source, youtube_start_sec, youtube_end_sec,
loop_start_sec, loop_end_sec, tts_url_male, tts_url_female
```

| Surface | Matches canonical? |
|---|---|
| `app/today/page.tsx` | yes |
| `app/calendar/page.tsx` | yes |
| `components/CoachedSessionCard.tsx` | yes |

## Where the others diverge

| Surface | Missing | Consequence |
|---|---|---|
| `app/plan/page.tsx` | every video column, all TTS | Its exercise sheet **cannot** show a video or a read-aloud button, even when the exercise has both. It also hand-rolls its own copy of the sheet instead of using `ExerciseDetailModal`, with different section labels ("HOW TO DO IT" vs "HOW TO PERFORM", "COACHING TIP" vs "COMMON MISTAKES"). |
| `app/browse/page.tsx` | `video_source`, both trim windows | Selects `video_url` but not the source or trim window, so it cannot render a trimmed loop. Also selects both `tts_url_*` columns and renders no play control at all: dead data. |
| `app/recovery/anatomy/page.tsx` | `core`, all video, all TTS | Core engagement silently absent. Same exercise, less coaching, depending which page you opened it from. |
| `app/mobility/page.tsx` | nothing, but see below | Correct columns, via a two-query fallback. |
| `app/exercises/page.tsx` | TTS | Same two-query fallback. No read-aloud. |
| `app/log/page.tsx` | n/a | Only needs the name. Legitimately narrow, leave alone. |

## The fallback pattern

`app/exercises/page.tsx` and `app/mobility/page.tsx` both issue the query twice:
once with the video columns, and again with a reduced list if the first errors.
That is defensive scaffolding from when those columns did not exist yet. It now
doubles the round trip on any error and hides real failures behind a silent
retry. It should go when these move onto the shared query.

## What consolidation means here

1. One exported column constant plus one typed row shape, so a surface cannot
   quietly select less than the others.
2. `/plan` adopts `ExerciseDetailModal` and its hand-rolled duplicate is deleted.
   This is the single highest-value change: it removes a whole second definition
   of what an exercise looks like.
3. Drop both two-query fallbacks.
4. `/browse`, `/exercises` and `/mobility` gain the read-aloud control they
   already have the data for.

## Not in scope

Admin surfaces (Video Curation, Video Trimming, TTS Curation, Media Library,
Library Cleanup) legitimately select different columns because they exist to
edit different things. They are worth a consistency pass later, but they are not
the reason an athlete sees two different versions of the same exercise.

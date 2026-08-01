# Task 5: Voice playback controls

Roadmap saved 2026-08-01. Plan agreed, not yet built.

---

## What exists today

`hooks/useTTS.ts` is a shared hook, used by three athlete surfaces:
`app/today/page.tsx:75`, `components/CoachedSessionCard.tsx:76`,
`components/ui/ExerciseDetailModal.tsx:93`.

But each one calls `useTTS()` separately, so each gets its **own** `Audio` object.
Controls today are play and stop-from-zero only. No pause, resume, seek, or progress.

## Three bugs found while mapping it

1. **The toggle is broken on `/today` and `CoachedSessionCard`.** `speak()` resolves at
   `audio.play()`, which settles when playback *begins*, not ends. `setSpeakingKey(null)` runs
   immediately after, so the 🔊 reverts to 🔈 a few ms in and a second tap **restarts the clip**
   instead of stopping it. `ExerciseDetailModal` guards on the hook's own `speaking` and works.
2. **Two clips can play at once.** `stop()` only pauses its own hook instance's audio. A tap in a
   workout block and a tap in the coached card overlap.
3. **Audio can start AFTER you leave the page.** No `AbortController` on the `/api/tts` fetch
   (`hooks/useTTS.ts:57`). Navigate away mid-request and the response still lands, creates a blob
   URL and plays. The spec's "no audio ever continues in the background" is not true today.

Also: blob URLs from `URL.createObjectURL` are never revoked, and the client memo key is only an
80-character prefix, so two exercises with the same name and opening text can collide.

## Cost leak found next door

`app/api/tts/route.ts` **regenerates and re-bills OpenAI even when `tts_url_male` already holds a
URL.** There is no server-side read-through check; the only thing preventing a double charge is
the client remembering to pass `preGeneratedUrl`. Fix is a few lines and belongs with this task.

## Speed is free and retroactive

Speed is currently baked into the MP3 at `speed: 0.92` (`app/api/tts/route.ts:37`), which would
normally mean regenerating all ~338 files to make it adjustable. It does not: **`audio.playbackRate`
works on the already-generated files.** Speed control costs nothing and applies retroactively.

---

## Plan

**Foundation: promote the hook to a provider.** New `contexts/TTSContext.tsx`, mounted in
`app/layout.tsx`. One audio object app-wide. This alone fixes the overlap and makes the voice
preference global. Today the ♂/♀ toggle exists **only** in `ExerciseDetailModal`, so `/today`
athletes cannot change voice at all.

Caveat: once the hook lives at layout level it no longer unmounts on navigation, so the existing
unmount-stop (`hooks/useTTS.ts:82`) must be replaced by a `usePathname` effect.

Then, against the spec:

| Spec item | Approach |
|---|---|
| 1. Play per section + play all | `ExerciseDetailModal.tsx:116-121` already builds the section array for rendering. That is the hook point. Queue sections. |
| 2. Pause / resume / stop, visible | Add to the provider. Fix `speaking` so it tracks the `ended` event, not `play()`. |
| 3. Stop on navigate / unmount | `usePathname` effect in the provider + `AbortController` on the fetch. |
| 4. Highlight the playing section | Provider exposes the current section index. |
| 5. Persist speed + voice | localStorage, same as the existing `tts_gender` key. Speed via `playbackRate`. |

**One shared `buildSpeechText`** in `lib/speech-text.ts`. The three call sites currently hand-roll
their own and disagree: `/today` omits breathing and core entirely, and the modal says "Common
mistake:" where `/today` says "Coaching tip:" for the same column. None matches the canonical
server version at `app/api/admin/generate-tts/route.ts:26-33`.

## Files

New: `contexts/TTSContext.tsx`, `lib/speech-text.ts`
Edit: `app/layout.tsx`, `hooks/useTTS.ts`, `app/today/page.tsx`,
`components/CoachedSessionCard.tsx`, `components/ui/ExerciseDetailModal.tsx`,
`app/api/tts/route.ts` (read-through fix)

## Suggested split

1. Provider + the three bug fixes + the server read-through fix
2. Per-section playback, highlighting, speed and voice preference

## Worth doing alongside

`app/browse/page.tsx` and `app/recovery/page.tsx` both **select** `tts_url_male/female` into their
types and never render a play control. Dead data. `/mobility` has no read-aloud either. Once the
provider exists, adding a button to those is trivial.

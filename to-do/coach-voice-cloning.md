# Coach Voice Cloning — "Train in your coach's voice"

## The idea (Will, 2026-06-23)
When a coached client taps the 🔈 listen button on an exercise, the instructions
play back in **their actual coach's voice** (cloned from a short recording) instead
of the generic TTS voice. Hearing *their* coach push them = they work harder. Strong
emotional hook + a premium differentiator no big competitor has.

## How hard is it? — Medium. Very feasible.
Voice cloning is a solved, off-the-shelf capability now:
- **ElevenLabs** "Instant Voice Cloning" — coach records ~1–3 min (sometimes 30s) →
  you get a custom `voice_id`. TTS with that voice_id sounds like them. (Alternatives:
  PlayHT, Cartesia, OpenAI voices are NOT clonable.)
- We already have the whole TTS pipeline to build on: `useTTS` hook, pre-generated
  audio URLs cached on `exercise_library` (`tts_url_male` / `tts_url_female`), and
  on-the-fly generation. A coach voice is "the same thing, different voice_id + cache."

## Architecture fit
1. **Coach records + consents** — a one-time flow in the Coach Portal: read a provided
   script, record (or upload) the sample, tick an explicit **voice-cloning consent**
   box (ElevenLabs requires consent; it's also just the right thing to do).
2. **Create the clone** — server route calls ElevenLabs to create the voice, store the
   returned `voice_id` on the coach (e.g. `profiles.coach_voice_id` or a
   `coach_voices` row + status: pending/ready/failed).
3. **Generate audio in the coach's voice** — a TTS route that, given exercise text +
   the coach's `voice_id`, returns audio. **Cache aggressively** — generate once per
   (coach, exercise) and store the URL (mirror the `tts_url_*` pattern, e.g. a
   `coach_exercise_audio` table keyed by coach_id + name_normalized) so repeat taps cost
   nothing.
4. **Client playback** — in `CoachedSessionCard` / the coached workout, when the active
   program is from a coach who has a ready voice, route the 🔈 button through the coach
   voice (fall back to default TTS if not ready). The card already resolves coach media
   per exercise (`resolveMedia`) — this slots in next to it.

## Gotchas / decisions
- **Cost** — ElevenLabs bills per character + cloned voices need a paid tier. Caching
  per (coach, exercise) keeps it cheap; pre-generating a whole program's audio is the
  bigger spend — make it on-demand first.
- **Consent + likeness** — never clone a voice without explicit, recorded consent.
  ElevenLabs Professional cloning has a verification step.
- **Premium gating** — this is a natural **paid coach upgrade**, alongside the Whisper
  voice-dictation upsell already planned. See `project_coach_pricing` memory.
- **Quality** — mic quality matters; give coaches a "record in a quiet room, phone
  6 inches away" guide. Offer a re-record.

## Phases
1. ✅ **BUILT 2026-06-23** — Single coach voice clone (consent + record/upload + create
   `voice_id`), on-demand cached generation for the coached Today workout, fallback to
   default TTS. Coach Dashboard card (`VoiceCloneCard`), `/api/coach/voice` (clone/status/
   remove) + `/api/coach/voice/speak` (cached synth), `coach_voices` + `coach_exercise_audio`
   tables, `coach-voice-audio` public bucket. Gated by `COACH_VOICE_CLONING` flag +
   `ELEVENLABS_API_KEY`. SQL: `20260623_coach_voice_cloning.sql`.
   - ⏳ Needs: ElevenLabs API key in Vercel (`ELEVENLABS_API_KEY`) + run the migration.
2. Pre-generate the full program's exercise audio when a coach assigns it.
3. Let the athlete choose: coach voice vs. default narrator.
4. Multiple coach voices / "hype line" intros ("Let's go — last set, give me everything").

## Why it's worth it
- Emotional retention lever unique to the coach relationship.
- Premium revenue (coach tier upsell).
- Marketing headline: *"Your coach, in your ear, every rep."*

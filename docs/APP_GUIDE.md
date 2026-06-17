# Atlas Prime — App Guide & Walkthrough

> Living instructions for the whole app, written so they can be turned into:
> - **Onboarding videos** (admin/coach + athlete)
> - A **click-through demo** for the marketing website
> - **App Store / Google Play preview** captions and screenshots
>
> Add a new `##` section per feature as features ship. Keep each section in the
> same three-part shape: **What it is → Admin/Coach steps → Athlete experience.**

---

## 🔁 Movement Preview (GIF-style looping demos)

**What it is:** Every approved exercise video can show a short, muted, auto-looping
clip of just the movement execution — feels like a GIF, but it's the real
coach-approved video, playing inside the app. Tapping it opens the full video.

### Admin / Coach — define the loop (Video Curation tab)
*Surface: `/admin#video` → an approved exercise → ✏ Edit → 🔁 Movement Loop*

1. Open the **Video Curation** tab and pick an exercise that already has an
   **approved video**. Click **✏ Edit**.
2. In the green **🔁 Movement Loop** panel, set the loop window two ways:
   - **Drag the blue `⟮` and `⟯` handles** on the scrubber to bracket the movement
     (e.g. bar down to chest → press up).
   - Or press play and tap **"⟮ Set In to playhead"** / **"Set Out to playhead ⟯"**
     to mark the current frame.
3. Tap **▶ Preview loop** — it plays *only* that segment, muted, on repeat.
4. Tap **💾 Save loop**. A green **"✓ Loop saved: 0:12 → 0:18"** confirms it.

> The original video is never changed — only the loop start/end are stored as
> metadata, so you can re-trim anytime. (DB: `loop_start_sec` / `loop_end_sec` on
> `exercise_library`.)

**Tip for the onboarding video:** the drag-then-"set to playhead" flow takes a
moment to feel natural the first time — demo it slowly once, then at speed.

### Athlete — what users see
- **Exercise library** (`/exercises`): expanding an exercise auto-plays the muted
  **🔁 Movement Preview**; **▶ Watch full video** swaps to the full original.
- **Today / workout calendar**: tapping an exercise opens the detail with the
  same looping preview + full-video toggle.
- **Coached workout** (when a coach has assigned a program): each exercise row
  shows a small inline **looping GIF thumbnail**; tapping expands to the full
  preview alongside set-logging.

**Performance:** previews lazy-mount only when scrolled on-screen (a static poster
shows otherwise), pause when off-screen, resume when you return to the tab/app, and
a concurrent-player cap keeps a screen full of loops smooth on phones.

### Use for marketing
- **Website demo:** show the admin trimming a loop, then the same exercise looping
  in the athlete app — "every demo is hand-curated to the exact rep."
- **Store preview:** a screen-recording of the workout view with several exercises
  looping at once reads as a premium, polished product.

---

## 🏋️ Workout flow, set tracking & history

**What it is:** A streamlined train-from-home flow — a clean dashboard summary,
a focused calendar day view with looping previews + coaching cues per exercise,
a full exercise popup, and per-set tracking with history.

### Athlete experience
- **Dashboard (Today):** a one-line session summary, suggested time commitment,
  equipment needed, a looping preview, a "For You" note, and Start Session — all
  visible without scrolling.
- **Calendar day view:** warm-up shown first; each exercise is a row with an
  auto-looping preview + a short **Coaching Cue**; a bottom box lists equipment +
  rest guidance (warm-ups ~30s, strength 2–3 min, conditioning ~45s).
- **Exercise popup:** full video, How to Perform, Breathing, Core Engagement, and
  **Common Mistakes**; read-aloud; a **📋 Track Workout** button.
- **Track Workout:** per-set Reps / Weight / Notes, **Duplicate Set**, **Add Set**,
  and an opt-in **Track L/R** toggle. Saves to history.
- **History tab:** appears on an exercise once you've logged it — shows each past
  session's date/time, program, and every set's reps × weight, so you can adjust
  weight up or down. (Powered by the `exercise_set_logs` table.)
- **Tips:** small dismissible hints (Dismiss / Not for this workout / Don't remind me).

### Notes
- Shared via `/calendar`, so coached clients get the same experience.
- Equipment is inferred from exercise names (no AI); Common Mistakes reuses the
  existing `tip` field (no new data).

## 📋 Feature sections to add next
<!-- Append a new ## section per shipped feature, same three-part shape. -->
- Plan generation (APIE multi-agent) — onboarding walkthrough
- Coach program builder (AI / manual / PDF import)
- Coached mode (athlete experience under a coach)
- Recovery & return-to-sport protocols

# Ideas Folder
> Add ideas anytime by saying "add this to my ideas folder"

---

## 🔍 Research & Competitive Intelligence (added 2026-04-24)
- **Pain point research across Reddit, review platforms, and fitness communities**: Run deep searches across Reddit (r/fitness, r/xxfitness, r/bodyweightfitness, r/running, sport-specific subs), App Store/Google Play reviews for top fitness apps (Whoop, Strava, Nike Training, Peloton, Fitbod, etc.), and other review platforms. Goal: identify every complaint, missing feature, and unmet need users voice about current fitness apps. Synthesize findings into a prioritized list of problems worth solving — filtered against this app's vision (AI-personalized plans grounded in physical training literature, kinesiology, and personal training principles). This app is already differentiated; the research tells us which pain points to solve next, and which to ignore because they conflict with the vision.

## 👤 Profile & Personalization (added 2026-04-24)
- **Profile picture upload**: The Account tab shows a circle with the user's initial. Let users tap an "Edit" option beneath the circle to upload or change their profile photo. Standard behavior users expect from any modern app.
- **Extended personal profile tab**: Split profile into two tabs — the existing training questionnaire (kept short for onboarding) and a separate "Personal" tab. The personal tab includes: display name, nickname, birthday/age, height, and weight. These fields are optional but feed the AI generator for better personalization (e.g. weight for load progressions, age for recovery pacing). Show a message: "Fill this out for better plan generation." Keeping the onboarding questionnaire short is a priority — this is additive, not required on signup.
- **Account tier labels**: Replace "Free Plan" with role-appropriate labels. Admin accounts show "Admin." Beta/promo users show "Pro" (or similar). Standard users show "Free Plan" with an "Upgrade →" link beneath it — placeholder for now, wired to billing once finalized. Makes account status immediately legible and sets up the upgrade funnel visually before billing is live.

## 🤖 AI & Wearables (added 2026-04-21)
- **Oura Ring integration**: Pull recovery score and readiness data daily. If readiness is low, AI agent automatically shifts that day to rest or light mobility instead of heavy training. High readiness → push intensity.
- **Biometric integration (Oura, Apple Watch, Samsung Galaxy Watch)**: Explore API availability for each device. Based on real-time biometric data (HRV, sleep score, readiness), system recommends: train hard / train moderately / proceed as planned / rest day. If rest day is taken, AI forecasts the weekly impact and dynamically restructures the remaining schedule so the user can plan ahead.
- **Multi-agent architecture**: Multiple specialized AI agents collaborate — one owns the training plan, one owns recovery, one monitors schedule conflicts. They "vote" on what the user should do each day based on current state.
- **Dynamic lifestyle adaptation**: Plan adapts to user habits — prolonged sitting, regular walking, running commutes. Morning routines and pre-workout warmups specifically designed around their daily movement patterns.

## 💰 Billing & Monetization
- **Freemium model**: Free tier shows partial app features. Paid unlocks full plan customization.
- **Undecided**: Token-based per plan OR monthly subscription — needs more thought
- **Promo codes**: Beta testers get free full access via promo code on signup
- **Idea**: Promo code analytics — track how many people signed up per code, conversion to paid

## 📊 Admin & Analytics
- **User breakdown dashboard**: See who finished questionnaire, who is active, who dropped off
- **Profile completion alerts**: Push notification → "Hey, don't forget to finish your profile"
- **Marketing stats**: Use completion/activity data to guide outreach
- **Beta test analysis**: Track beta friends' usage patterns before public launch

## 📰 For You Page — AI Content + Mindset Feed (added 2026-04-22)
- **Dual-layer feed**: Two streams in one page — (1) sport-specific performance tips sourced from the web, (2) mindset coaching drawn from Will's book on Japanese warrior philosophy. Both personalized to the user's sport(s), goals, and profile.
- **Web-scraping AI agent**: Actively searches Reddit, Google, articles, and other sources for tips, tricks, and insights tailored to each user's sport(s). Content refreshes daily and is curated — not a raw feed. Example for skateboarding: "When doing back 50-50s on a ledge — lock front foot into the pocket, pop at 90 degrees, even pressure through both hips, eyes on the end of the ledge." Same depth for every sport.
- **Mindset layer (Japanese warrior system)**: A second AI agent applies principles from Will's book alongside the sport tip. Core concepts: **Mushin** (action without overthinking), **Kaizen** (small improvements compounding over time), **Shokunin** (master the process, not the result), **Zanshin** (relaxed sustained awareness), **Fudoshin** (immovable mind under pressure). Applied per sport — e.g. Mushin for skateboard trick execution, Zanshin for snowboard terrain reading, Fudoshin for tennis composure after a bad point.
- **Practical methods woven in**: Breath control, present-moment cues, nervous system regulation, flow-state training. Not hype — calm, precise, performance-first.
- **Personalization pipeline**: Both agents read the user's sport(s), goals, and skill context. Two skateboarders at different levels see different tips and different mindset applications.
- **Monthly content reset + reminders**: Feed clears monthly to stay fresh. High-value tips are flagged and resurface later as notifications — e.g. "Don't forget this technique when doing back 50-50s" or "Remember — Mushin. Stop overthinking the drop-in."
- **Source material**: Will's book on elite performance through Japanese warrior philosophy is the mindset agent's primary knowledge base.
- **Broader vision**: A feed that trains the whole athlete — body and mind. Makes the app stickier, more actionable, and genuinely different from anything else on the market.

## ⚡ Quick Workout Generator (added 2026-04-22)
- **On-demand quick workouts**: Accessible from the calendar for days when the user can't do their normal session. User inputs: what equipment they have (resistance band, ball, pillow, bodyweight only, etc.), what they want to target (bicep pump, chest, full body, etc.), and how much time they have (15, 25, 35 min). AI generates an effective session on the spot.
- **Inspired by high-efficiency training formats**: Think Jeff Cavaliere-style 25-minute workouts — multiple exercises in sequence, minimal rest, strong pump effect, full training stimulus in a short window. Proven methods, not filler.
- **Travel-first use case**: Primary trigger is travel ("I'm in Las Vegas, I only have a resistance band"). But usable anytime — hotel room, park, home, office break. Works around whatever the user has, not what they wish they had.
- **Calendar placement**: Quick workout button lives on the calendar so it's always one tap away when a scheduled session isn't happening. Does not replace or modify the main program — it's a standalone session logged separately.

## 📊 Stats & Activity Tracking
- **Daily workout stats logging**: Save sets, reps, and weight used per session. End-of-day summary pushed as a notification (or optional email) — "Here's what you did today." Stats feed into a homepage dashboard similar to Apple Watch activity rings and iPhone Fitness app. Shows streaks, volume trends, and progress over time.
- **Accountability nudges**: If no activity is detected by a certain time, send a push notification — "Hey, no activity logged today — still time to move." If they crushed it, send a positive callout: "Great work today — here's your breakdown." Pulls from app logs + Apple Watch / Oura Ring data when integrated.

## 🔔 Notifications & Engagement
- **Streak reminders**: Alert users who haven't logged a session in 2+ days
- **Recovery milestone alerts**: "You've reached Phase 3 — keep going!"
- **Profile nudges**: Auto-reminder if questionnaire is < 50% complete
- **"I missed today" button**: Log a missed session from the calendar; AI auto-restructures the week (actionable — move to TODO when building calendar)

## 🧠 Mindset & Performance (added 2026-04-22 — merged into For You page above)
- **Japanese warrior performance system**: A dedicated AI agent applies principles from Will's book to each sport and user profile. Core concepts: **Mushin** (no-mind — action without overthinking), **Kaizen** (continuous small improvements compounding over time), **Shokunin** (craftsman mindset — master the process, not the result), **Zanshin** (relaxed sustained awareness before, during, and after action), **Fudoshin** (immovable mind — emotionally steady under pressure or criticism).
- **Practical methods built into the app**: Breath control exercises to regulate the nervous system pre-workout, present-moment attention cues to prevent outcome anxiety, repetition protocols to build automatic skill, recovery practices to protect the nervous system, and flow-state training for effortless execution.
- **Sport-specific mindset coaching**: AI adapts these principles per sport — e.g. for Skateboarding: Mushin applied to trick execution without fear-freezing; for Snowboarding: Zanshin applied to reading terrain with calm peripheral awareness; for Tennis: Fudoshin applied to staying composed after a bad point.
- **Mindset tips woven into workouts**: Each session includes a contextual tip — mindfulness, breathing technique, core engagement cue, or a samurai/Japanese Olympian pre-performance ritual. Not hype. Calm, precise, nervous-system-first.
- **Source material**: Will's book on elite performance through Japanese warrior philosophy. Use the book as the AI agent's primary knowledge base — brainstorm with ChatGPT to extract sport-specific applications from each chapter's concepts.
- **Broader vision**: Helps athletes and everyday people perform better in fitness, sports, work, relationships, and life — replacing chaos with control, inconsistency with stability, and pressure with precision.

## ♿ Accessibility
- **Read-aloud workout instructions**: Each exercise has a speaker button that reads instructions aloud using text-to-speech. On iPhone and Android, audio mixes over music rather than pausing it (uses the "mixWithOthers" audio session category). Designed for eyes-free use mid-workout.

## 📱 Mobile & Dispatch ✅ Live
- **Dispatch workflow**: Claude Project on phone ("Movement App Dispatch") handles voice/text commands
- **Commands**: "Add to ideas: [idea]" or "Add to todo: [task]" → Claude formats + outputs SQL to run in Supabase
- **Loop**: Phone dispatch → run SQL in Supabase → mention to Claude Code next session → .md files updated

---
*Last updated: 2026-04-24*

# Profile — Genetics & Identity Questions for Plan Accuracy
**Priority: MEDIUM — Plan quality improvement**

## Goal
Add ethnicity and sex assigned at birth to the user profile to improve plan generation accuracy. Genetics meaningfully influence muscle fiber distribution, hormone baselines, injury risk profiles, and recovery rates. Asking for this data — with a clear privacy explanation — lets the AI generate plans that are more accurate and more personal.

---

## Questions to Add

### 1. Sex Assigned at Birth
> "What sex were you assigned at birth?"
- Male
- Female
- Prefer not to say

**Why it matters:** Biological sex affects hormone profiles (testosterone, estrogen, relaxin), injury risk patterns (ACL risk is significantly higher in females), muscle fiber type distribution, and recovery rates. The APIE uses this to adjust volume recommendations, recovery windows, and injury-risk weighting.

---

### 2. Ethnicity / Genetic Background
> "What is your ethnic background? (optional — helps us personalize your plan)"
- East Asian
- South Asian
- Southeast Asian
- Black / African descent
- White / European descent
- Hispanic / Latino
- Middle Eastern / North African
- Mixed / Multiracial
- Prefer not to say
- Other (free text)

**Why it matters:** Research shows meaningful genetic variation in:
- Muscle fiber type ratios (fast-twitch vs slow-twitch dominance by ancestry)
- Bone density and joint structure differences
- Vitamin D metabolism (impacts recovery and muscle function)
- ACE gene variants (aerobic vs power predisposition)
- ACTN3 gene frequency (sprinter vs endurance predisposition)

The APIE doesn't stereotype — it uses this as one signal among many to fine-tune exercise selection, rep range emphasis, and recovery recommendations.

---

## Privacy Explanation (shown inline before the questions)

> **Why we ask this**
>
> Genetics influence how your body responds to training — muscle fiber composition, hormone baselines, injury risk, and recovery all vary based on biological factors. We use this information solely to generate a more accurate, personalized plan for you. It is never shared with third parties, never used for advertising, and never disclosed to other users.
>
> Both questions are optional. You can skip either one and still get a great plan. [View our Privacy Policy →]

This explanation must appear directly above the questions — not buried in settings.

---

## Where It Lives
- User account/profile setup flow (after sport, goal, experience level)
- Also editable in Settings → Profile at any time

---

## APIE Integration

### Sex-Based Adjustments (S&C Agent + PT/Rehab Agent)
- **Female profiles:** flag higher ACL and shoulder instability risk; adjust plyometric volume; add hip/glute stability emphasis; note relaxin effects if relevant (postpartum flag option)
- **Male profiles:** standard baseline; adjust volume/intensity recommendations per hormonal recovery capacity
- **Prefer not to say:** use conservative/neutral baseline across all parameters

### Ethnicity-Based Adjustments (Sports Specialist + S&C Agent)
- Used as a soft modifier, not a hard rule
- Example: East Asian profiles may lean toward higher fast-twitch fiber ratios → slightly favor explosive/power programming if sport-appropriate
- Never overrides explicit user preferences, sport requirements, or injury restrictions
- Applied subtly — users should feel their plan is personalized, not categorized

---

## Schema Changes

Add to `profiles` table:
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sex_assigned_at_birth text CHECK (sex_assigned_at_birth IN ('male', 'female', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS ethnicity text;
```

No new table needed — these are profile fields.

---

## Build Phases
1. Schema migration (ALTER TABLE profiles)
2. Add questions to profile setup flow with inline privacy explanation
3. Add to Settings → Profile (editable)
4. Inject sex + ethnicity into APIE plan generation prompt
5. PT/Rehab Agent adjustments for sex-based injury risk
6. S&C Agent soft adjustments for ethnicity-based fiber type signals

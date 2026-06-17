# Training Style Intelligence — AI Generation Engine
**Priority: HIGH — Core APIE differentiator**

## Goal
The AI plan generator should understand named training philosophies and legendary coaching styles — not just generic parameters like "hypertrophy" or "strength." When a user says they've trained like Mike Mentzer or love ATHLEAN-X programming, the system should know exactly what that means, adapt to it, and filter it through safety and sport-specificity constraints.

This is a major differentiator. No other platform does this.

---

## Training Styles to Model

### Classic Iron Era
| Figure | Philosophy | Signature Methods |
|---|---|---|
| **Arnold Schwarzenegger** | High volume, muscle confusion, mind-muscle connection, twice-a-day splits | 6-day splits, high reps + heavy weight combo, theatrical pump work |
| **Lou Ferrigno** | Power + size hybrid, heavy compound foundation | High-volume squats + presses, old-school powerlifting crossover |
| **Mike Mentzer / HIT** | Heavy Duty — High Intensity Training | One working set to failure, longer rest, maximum intensity over volume. Anti-volume. |
| **Bill Pearl / "Prats" Era** | Full-body functional strength, old-school bodybuilding | 3x/week full body, compound lifts, minimal isolation |
| **Reg Park** | Strength-first bodybuilding (influenced Arnold) | 5x5 heavy compound base before volume work |
| **Vince Gironda** | Advanced isolation, aesthetic focus | Non-standard exercises, sissy squats, neck press — results before orthodoxy |

### Modern Era
| Figure | Philosophy | Signature Methods |
|---|---|---|
| **ATHLEAN-X (Jeff Cavaliere)** | Science-based, injury prevention, corrective fitness | Full ROM, muscle activation cues, PT-informed programming, no ego lifting |
| **Joe Aesthetics (Joe Lauzon)** | Aesthetic physique + athletic performance | Volume + conditioning hybrid, aesthetics-first but functional |
| **Chris Bumstead (CBum)** | Classic physique, structured periodization | Symmetry-first programming, moderate volume, strong mind-muscle focus |
| **Jeff Nippard** | Evidence-based hypertrophy | Research-backed rep ranges, RIR training, data-driven volume |
| **David Laid** | Aesthetic strength | Powerbuilding — strength base with aesthetic volume layered on |
| **Renaissance Periodization (Mike Israetel)** | Maximum Adaptive Volume (MAV), MEV, MRV framework | Sets-per-week targets per muscle group, evidence-based accumulation |

### Systems / Methodologies
| System | Core Idea |
|---|---|
| **5/3/1 (Jim Wendler)** | Percentage-based strength cycling, slow and steady PRs |
| **Starting Strength (Mark Rippetoe)** | Barbell-only compound lifts, linear progression for beginners |
| **GZCLP / GZCL Method** | Tiered exercise hierarchy (T1/T2/T3), high frequency |
| **Conjugate / Westside** | Max effort + dynamic effort days, concurrent strength development |
| **CrossFit / AMRAP/EMOM** | Functional fitness, time-domain conditioning, community |
| **German Volume Training (GVT)** | 10x10, extreme volume for hypertrophy |

---

## How the System Uses This

### 1. Profile Collection
In the account/profile setup, add a question:
> "Do you follow or prefer a particular training style or coach's method?"
- Dropdown with searchable list of all the above styles
- Free text option: "Something else — describe it"
- Multi-select: "I mix a few styles"

### 2. APIE Integration
When a user selects a training style, the **Strength & Conditioning Agent** and **Sports Specialist Agent** receive it as context:

```
User training style preference: Mike Mentzer / Heavy Duty HIT
Interpretation: Prioritize maximum intensity over volume. Program 1-3 working sets per exercise, taken to absolute failure or beyond (rest-pause, drop sets). Longer rest periods (3-5 min). Low weekly frequency. De-emphasize junk volume.
Safety filter: PT/Rehab Agent must flag if taking-to-failure conflicts with any injury restrictions. Modify accordingly — HIT principles preserved, unsafe exercises substituted.
```

### 3. Safety Filter (PT/Rehab Agent Override)
The PT/Rehab Agent has veto power. If a named style includes movements that conflict with the user's injury profile:
- The style is preserved in philosophy (intensity, structure, rep targets)
- The specific dangerous movement is swapped for a safe equivalent
- The user is informed: "We've adapted your preferred HIT protocol to account for your knee restriction — leg press replaces barbell squat, same intensity prescription."

### 4. Output Language
Plans generated for users with named style preferences should use that style's vocabulary:
- Mike Mentzer → "Rest-pause set," "taken to absolute failure," "one all-out working set"
- ATHLEAN-X → "Full range of motion," "muscle activation focus," "corrective pattern"
- 5/3/1 → "AMRAP set," "training max," "jokers," "first set last"

---

## Knowledge Base Integration
Training styles should also appear in the **Knowledge Base tab** so the founder can explain them in conversations:
> "We understand training philosophies — if a user tells us they train like Mike Mentzer, we know they want HIT, not volume. We adapt the entire program structure to match their mental model of training, not just swap a few exercises."

---

## Build Phases
1. Add training style field to user profile (dropdown + free text)
2. Build style knowledge library (internal JSON/DB — all styles above with their interpretation rules)
3. Inject style context into APIE plan generation prompt (S&C Agent + Sports Specialist)
4. PT/Rehab Agent safety filter for style conflicts
5. Output vocabulary adaptation (plans "speak" the user's style language)
6. Knowledge Base entries for all styles (founder education)
7. Expand style library over time (user feedback, new influencers)

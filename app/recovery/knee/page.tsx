import RecoveryPlaybook, { type PlaybookPhaseData } from '@/components/ui/RecoveryPlaybook'

const KNEE_PHASES: PlaybookPhaseData[] = [
  {
    label: 'P1',
    title: 'Protect',
    sub: 'Reduce swelling, activate quads',
    blocks: [
      {
        type: 'rest',
        title: 'RICE Protocol',
        meta: 'Days 1–5. Swelling control is the first priority — nothing else matters until the joint calms.',
        exercises: [
          {
            name: 'Ice Therapy',
            meta: '20 min on / 40 min off — 4–6x per day',
            how: 'Place ice pack or frozen bag of peas (wrapped in cloth) directly over the knee. Elevate the leg above heart level while iced — prop it on stacked pillows. The combination of ice and elevation dramatically accelerates swelling reduction.',
            cue: 'Ice and elevation together. One without the other is half the treatment.',
            tip: 'Do not use heat in the acute phase. Heat increases blood flow and worsens swelling.',
          },
          {
            name: 'Compression Wrap',
            meta: 'Wear between ice sessions — full day use',
            how: 'Apply elastic bandage starting at the calf and wrapping upward past the knee. Firm compression — not tight enough to cut circulation. Remove at night unless directed otherwise by a physician.',
            tip: 'Compression sleeves (neoprene) work well as an ongoing compression tool during this phase.',
          },
          {
            name: 'Elevation Rest',
            meta: 'Knee above heart level as much of the day as possible',
            how: 'Lie down with the leg elevated on a stack of 2–3 pillows. The knee should be higher than the hip. Gravity assists lymphatic drainage of the inflamed joint.',
          },
          {
            name: 'Protected Weight Bearing',
            meta: 'Walk only as tolerated — use crutches if needed for first 1–3 days',
            how: 'If weight-bearing is painful, use crutches to offload the knee until you can walk without a significant limp. A normal gait pattern is more important than how fast you ditch the crutches.',
            cue: 'Limp = compensatory pattern = other injuries. Walk correctly or use support.',
          },
        ],
      },
      {
        type: 'morning',
        title: 'Early Activation',
        meta: 'These exercises prevent quad atrophy and maintain circulation — begin Day 1',
        exercises: [
          {
            name: 'Ankle Pumps',
            meta: '3 sets of 20 — every hour if possible',
            how: 'Lying on your back, flex the ankle up (dorsiflexion) and point it down (plantarflexion). Continuous pumping motion. This activates the calf pump and drives blood through the leg, reducing clot risk and swelling.',
            cue: 'Gas pedal up and down. Continuous motion. Don\'t stop.',
          },
          {
            name: 'Quad Set (Isometric)',
            meta: '3 sets of 15 — hold 10 seconds each',
            how: 'Lie on your back with leg straight. Roll a small towel under the knee (to keep it slightly bent). Squeeze the quad muscle by pressing the back of the knee down into the towel. Hold 10 seconds. You should see and feel the quad muscle tighten.',
            cue: 'Squish the towel with the back of your knee. That\'s your quad firing.',
            tip: 'Quadriceps shutdown (inhibition) happens rapidly after knee injury. This exercise fights it from Day 1.',
          },
          {
            name: 'Straight Leg Raise',
            meta: '3 sets of 12 — hold 2 seconds at the top',
            how: 'Lie on your back. Bend the uninjured knee, foot flat on the floor. Keep the injured leg straight. Tighten the quad (quad set first), then raise the straight leg to the height of the bent knee. Hold 2 seconds, lower slowly.',
            cue: 'Lock the knee out before you lift. No bent-knee raises.',
            tip: 'If the knee bends during this exercise, the quad isn\'t strong enough yet. Return to quad sets only.',
          },
          {
            name: 'Heel Slides',
            meta: '3 sets of 15 — slide foot toward glutes and back',
            how: 'Lie on your back. Slowly slide the heel of the injured leg toward your glutes, bending the knee as far as comfortable. Hold 2 seconds. Slide back to straight. Tracks knee flexion ROM without weight-bearing.',
            cue: 'Slow and controlled. If it hurts, only go as far as it\'s comfortable — never force range.',
          },
          {
            name: 'Seated Knee Flexion (Gravity-Assisted)',
            meta: '3 sets of 10 — let gravity bend the knee',
            how: 'Sit on a high surface (bed, chair) with legs hanging. Let the injured leg bend under gravity. Use the good foot to gently guide it further if comfortable. Goal: regain pain-free range without forcing it.',
          },
        ],
      },
    ],
  },
  {
    label: 'P2',
    title: 'Stability',
    sub: 'Restore mobility & neuromuscular control',
    blocks: [
      {
        type: 'warmup',
        title: 'Warm-Up',
        meta: '5 min — gentle heat + ankle pumps + knee ROM',
        exercises: [
          {
            name: 'Heat + Mobility Prep',
            meta: '5 min heat, then 2 sets of heel slides + seated flexion',
            how: 'Apply heat pack to the knee for 5 minutes. Follow with 2 sets of heel slides and seated knee flexion to ensure full available range before loading.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Mobility & Stability Training',
        meta: 'Pain-free range only. Zero compensation.',
        exercises: [
          {
            name: 'Terminal Knee Extension (TKE) with Band',
            meta: '3 sets of 15 — resistance band at the back of the knee',
            how: 'Attach a resistance band to a low anchor. Loop the band behind the knee. Stand slightly in front of the anchor so the band pulls the knee into flexion. From slightly bent, extend the knee fully against the band resistance. Hold 1 second at full extension. Release. This directly targets the VMO (inner quad) — the key muscle for knee stability.',
            cue: 'Straighten the knee until it locks. Squeeze at the top.',
            tip: 'TKEs are the most effective early exercise for rebuilding quad function in a weight-bearing position without deep knee bend stress.',
          },
          {
            name: 'Mini Wall Squat (0–30°)',
            meta: '3 sets of 15 — back against wall, very small range',
            how: 'Stand with back flat against a wall, feet shoulder-width apart and about 12 inches from the wall. Slide down the wall until the knees are bent to 30° (very small amount). Hold 5 seconds. Slide back up. Only go as deep as is completely pain-free.',
            cue: '30 degrees is less than you think. That\'s the safe zone right now.',
          },
          {
            name: 'Step-Up (4–6 Inch Step)',
            meta: '3 sets of 10 each leg',
            how: 'Use a low step or thick book stack. Step up with the injured leg leading. Straighten fully at the top. Lower the back leg first (so the injured leg holds position). Step back down. This trains single-leg loading in a controlled range.',
            cue: 'The injured leg does the work going up. Control going down.',
            tip: 'Increase step height only when 3x10 feels easy — never increase height if there\'s any knee pain.',
          },
          {
            name: 'Calf Raises (Bilateral)',
            meta: '3 sets of 20 — both feet, full range',
            how: 'Stand at a wall or chair for light support. Rise up on the balls of both feet (plantarflexion), hold 1 second at the top, lower the heels below neutral if on a step edge. This trains calf strength and maintains ankle mobility — both critical for proper knee loading.',
          },
          {
            name: 'Single-Leg Balance',
            meta: '3 sets — build from 20s → 45s → 60s',
            how: 'Stand on the injured leg with a slight knee bend (5–10°). Keep the knee aligned over the 2nd toe — don\'t let it collapse inward. Hold as long as possible. Eyes open first, then progress to eyes closed.',
            cue: 'Knee over the pinky-side of the foot. Don\'t let it cave in.',
            tip: 'Proprioceptive training (balance) is as important as strength. Ligament injury causes long-term proprioceptive loss — this rebuilds it.',
          },
          {
            name: 'Hip Abductor Clamshell',
            meta: '3 sets of 15 — side-lying, hip and knee at 45°',
            how: 'Lie on the uninjured side. Knees bent to 45°. Feet stacked. Rotate the top knee upward (like a clamshell opening) keeping feet together. Hold 2 seconds. Lower. This trains the hip abductors — critical for preventing knee-valgus collapse.',
            cue: 'Open like a clamshell. Hips don\'t roll back.',
          },
        ],
      },
    ],
  },
  {
    label: 'P3',
    title: 'Strength',
    sub: 'Progressive loading',
    blocks: [
      {
        type: 'warmup',
        title: 'Warm-Up',
        meta: 'Heat + Phase 2 stability sequence before heavy loading',
        exercises: [
          {
            name: 'Full Phase 2 Warm-Up',
            meta: '10 minutes — TKEs, mini squats, calf raises, single-leg balance',
            how: 'Run through 2 sets of each Phase 2 exercise before loading. Knee must be warm, stable, and tracking properly before adding resistance.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Strength Building',
        meta: 'Begin bilateral, progress to unilateral. Slow eccentrics on every rep.',
        exercises: [
          {
            name: 'Leg Press (Bilateral)',
            meta: '3 sets of 12 — moderate weight, 0–60° range',
            how: 'Bilateral leg press machine. Keep feet shoulder-width at mid-plate. Lower the platform by bending the knees to 60° maximum (not beyond — this is Phase 3, not full depth yet). Press back to full extension. Slow 3-second lowering.',
            cue: '60 degrees only. Progress range only as pain allows — never force deeper.',
            tip: 'The leg press is the safest early strength builder because you can control depth precisely and there\'s no balance requirement.',
          },
          {
            name: 'Goblet Squat',
            meta: '3 sets of 10 — bodyweight first, then light DB',
            how: 'Hold a light dumbbell at the chest. Feet shoulder-width, toes slightly turned out. Squat as deep as is comfortable while keeping the chest tall and knees tracking over the 2nd toe. Drive through the entire foot to stand.',
            cue: 'Chest up, knees out, drive through the whole foot.',
            tip: 'Goblet squat naturally encourages proper depth and torso position. Add weight only when depth is pain-free and form is locked in.',
          },
          {
            name: 'Romanian Deadlift',
            meta: '3 sets of 12 — light to moderate DB',
            how: 'Stand holding dumbbells at the thighs. Hinge at the hips, pushing them back, letting the dumbbells slide down the thighs as you lower. Keep the back flat and knees soft (slight bend). Lower until you feel a hamstring stretch (usually mid-shin), then drive hips forward to stand.',
            cue: 'Hip hinge, not a squat. Push the hips back — feel the stretch in the hamstrings.',
          },
          {
            name: 'Lateral Band Walk',
            meta: '3 sets of 15 steps each direction',
            how: 'Place resistance band just above the knees (or at ankles for more challenge). Stand in a mini-squat position. Step sideways, maintaining tension on the band throughout. Keep toes forward and knees pushed outward against the band resistance.',
            cue: 'Stay low. Toes forward. Fight the band\'s pull inward.',
            tip: 'Lateral band walks are the premier exercise for VMO and hip abductor co-activation — the combination that prevents knee-valgus collapse.',
          },
          {
            name: 'Reverse Lunge',
            meta: '3 sets of 10 each leg',
            how: 'Stand with feet together. Step back with one leg, lowering the back knee toward the floor. The front knee stays at or slightly behind the front toes. Push through the front foot to return to standing. Step back — do not alternate in rhythm, do full sets on one side first.',
            cue: 'Front knee stays behind the toes. Most of the load is on the front leg.',
            tip: 'Reverse lunges are safer than forward lunges for knee rehab — the reverse step reduces forward knee shear forces.',
          },
          {
            name: 'Single-Leg Press',
            meta: '3 sets of 10 each leg — 0–60° range',
            how: 'One foot on the leg press platform, other foot off. Same range guidelines as bilateral leg press. This builds unilateral strength and identifies any asymmetry in force production.',
            tip: 'If single-leg press reveals significant weakness or pain compared to the other side, stay bilateral another 1–2 weeks.',
          },
          {
            name: 'Terminal Knee Extension (Loaded)',
            meta: '3 sets of 20 — heavier band than Phase 2',
            how: 'Same TKE movement from Phase 2, now with heavier resistance band. Continue to focus on the VMO contraction at full extension.',
          },
        ],
      },
      {
        type: 'abs',
        title: 'Posterior Chain',
        meta: 'Hip and glute strength is critical for knee protection',
        exercises: [
          {
            name: 'Hip Bridge',
            meta: '3 sets of 15 — hold 2 seconds at the top',
            how: 'Lie on back, knees bent, feet flat. Drive through the heels and squeeze the glutes to raise the hips. Hold at the top with hips fully extended. Lower slowly. Progress to single-leg bridge when bilateral feels easy.',
            cue: 'Squeeze glutes hard at the top. Don\'t let the hips sag sideways.',
          },
          {
            name: 'Single-Leg Hip Bridge',
            meta: '3 sets of 12 each leg',
            how: 'Same as hip bridge but with the non-working leg extended in the air. Drive through the heel of the planted foot. This is significantly harder — expect to see weakness imbalances between sides.',
          },
        ],
      },
    ],
  },
  {
    label: 'P4',
    title: 'Return',
    sub: 'Sport-specific power',
    blocks: [
      {
        type: 'warmup',
        title: 'Full Dynamic Warm-Up',
        meta: '10–15 minutes — must be fully warm before any plyometric work',
        exercises: [
          {
            name: 'Phase 3 Sequence + Activation',
            meta: 'TKEs, goblet squats, lateral band walks — 2 sets each',
            how: 'Complete 2 sets of each major Phase 3 exercise. The knee must be warm, activated, and tracking correctly before any jumping or cutting movements.',
          },
          {
            name: 'Walking Lunges (Dynamic Warm-Up)',
            meta: '2x10 steps each leg',
            how: 'Alternating walking lunges across the floor. Full range, upright torso. These prepare the knee for the unilateral loading that comes with sport.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Return to Sport Progressions',
        meta: 'Bilateral before unilateral. Double-leg landing before single-leg.',
        exercises: [
          {
            name: 'Full-Depth Bodyweight Squat',
            meta: '3 sets of 15 — full depth when pain-free',
            how: 'Full squat to parallel or below (as your hip mobility allows). Heels flat, chest up, knees tracking. This is the goal depth for Phase 4 — you should have been working toward it through Phase 3.',
            cue: 'Hit depth only when it\'s completely pain-free. No heroics.',
          },
          {
            name: 'Bulgarian Split Squat',
            meta: '3 sets of 10 each leg — rear foot elevated',
            how: 'Back foot elevated on a bench or chair. Lower the back knee toward the floor, keeping the front knee over the 2nd toe. Drive through the front heel to stand. Add dumbbells when bodyweight is pain-free.',
            cue: 'Front foot does all the work. Back foot is just a balance point.',
            tip: 'This is one of the most demanding single-leg exercises. Only add weight when form is perfect and pain is zero.',
          },
          {
            name: 'Box Jump (Bilateral)',
            meta: '3 sets of 8 — land softly, absorb the impact',
            how: 'Stand in front of a low box (12–18 inches). Jump onto the box with both feet simultaneously. Land with knees bent and absorb through the full leg — do not land stiff-legged. Step down carefully (do not jump down).',
            cue: 'Land like you\'re trying not to make a noise. Soft knees, full absorption.',
            tip: 'The landing is the test. If the knee hurts on landing, it\'s not ready for Phase 4 loading.',
          },
          {
            name: 'Lateral Shuffles',
            meta: '3 sets of 30 seconds — athletic stance, explosive',
            how: 'Athletic stance (knees bent, hips back, weight centered). Shuffle laterally 5–6 steps, plant and change direction. Stay low throughout. This trains the deceleration mechanics needed for sport.',
            cue: 'Low position. Don\'t let the hips rise as you change direction.',
          },
          {
            name: 'Single-Leg Box Jump',
            meta: '3 sets of 6 each leg — only when bilateral landing is pain-free',
            how: 'Jump from one leg onto the box. Land on the same leg, absorbing fully. If any asymmetry in confidence or pain between legs, stay on bilateral until cleared.',
            tip: 'Passing this test means the knee can handle the forces of unilateral sport movement.',
          },
          {
            name: 'Agility Ladder Drills',
            meta: '3 rounds of each pattern — quick feet, light steps',
            how: 'Two-feet-in ladder runs, lateral shuffles, in-out patterns. Focus on light, reactive footwork. Quick contact time with the ground is the goal — trains the reactive stiffness that protects joints during sport.',
          },
          {
            name: 'Change-of-Direction Runs',
            meta: '3 sets of 5 changes — full speed progression',
            how: 'Set cones 10 yards apart. Sprint, plant, change direction. Begin at 70% speed and increase over sessions to full speed. The plant foot is where the knee is most at risk — test that deceleration-and-redirect motion before returning to unrestricted sport.',
            cue: 'Plant outside foot, drive inside. Lead with the hips.',
          },
        ],
      },
      {
        type: 'cooldown',
        title: 'Return-to-Sport Clearance',
        meta: 'Objective benchmarks before unrestricted return',
        exercises: [
          {
            name: 'Single-Leg Squat Assessment',
            meta: 'Can you do 10 reps each leg without pain or compensations?',
            how: 'Compare depth, knee tracking, and pain between sides. The injured side should be within 90% of the healthy side in depth and smoothness.',
          },
          {
            name: 'Hop Test',
            meta: 'Single-leg hop distance — within 90% of the other leg',
            how: 'Stand on one leg. Hop forward as far as possible and stick the landing. Measure distance. Compare to the other leg. 90% limb symmetry index (LSI) is the minimum standard for return to sport.',
            tip: 'Most physical therapists use this exact test as the official return-to-sport clearance criteria.',
          },
          {
            name: 'Pain Assessment',
            meta: '0/10 pain during all Phase 4 exercises for two consecutive sessions',
            how: 'Two full Phase 4 sessions with zero pain is the minimum gate before unrestricted return to sport.',
          },
        ],
      },
    ],
  },
]

export default function KneePage() {
  return (
    <RecoveryPlaybook
      recoveryId="knee"
      title="Knee Rehab"
      description="General knee rehabilitation — 4-phase return-to-sport protocol"
      phases={KNEE_PHASES}
    />
  )
}

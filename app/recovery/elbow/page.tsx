import RecoveryPlaybook, { type PlaybookPhaseData } from '@/components/ui/RecoveryPlaybook'

const ELBOW_PHASES: PlaybookPhaseData[] = [
  {
    label: 'P1',
    title: 'Protect',
    sub: 'RICE — calm the joint',
    blocks: [
      {
        type: 'rest',
        title: 'RICE Protocol',
        meta: 'Days 1–3. The most important phase. Do not skip it.',
        exercises: [
          {
            name: 'Ice Therapy',
            meta: '20 min on / 40 min off — 4–6x per day',
            how: 'Wrap crushed ice or a frozen gel pack in a thin cloth. Apply to the outer/inner elbow (wherever tender). Keep elbow elevated above heart level — rest it on two stacked pillows while iced.',
            cue: 'Cold is your anti-inflammatory. Don\'t tough through the pain — drown it in ice.',
            tip: 'Avoid direct ice-skin contact. 20 minutes max per session or you risk frostbite.',
          },
          {
            name: 'Compression Wrap',
            meta: 'Wear between ice sessions throughout the day',
            how: 'Apply an elastic bandage (ACE wrap) starting at the wrist and overlapping upward to just above the elbow. Firm but not cutting off circulation. Fingers should not go numb.',
            tip: 'Loosen if you feel tingling, throbbing, or skin color changes.',
          },
          {
            name: 'Elevation Rest',
            meta: 'Keep elbow above heart as much as possible',
            how: 'When sitting or lying, prop the arm on pillows so the elbow and forearm are elevated. This uses gravity to pull swelling fluid away from the joint. The more you elevate, the faster swelling drops.',
            cue: 'Heart pumps up, gravity pulls down — gravity wins at the elbow when it\'s raised.',
          },
          {
            name: 'Complete Joint Rest',
            meta: 'Zero loading on the elbow for 48–72 hours',
            how: 'Avoid any activity that bends or straightens the elbow against resistance. No lifting, no pushing, no pulling with that arm. This phase is not weakness — it\'s the most tactical decision you can make.',
            cue: 'Protect the repair zone. Scar tissue forms faster in an inflamed environment.',
            tip: 'You can still move fingers and wrist gently — this maintains circulation without stressing the elbow.',
          },
        ],
      },
      {
        type: 'morning',
        title: 'Gentle Finger Motion',
        meta: 'Maintain circulation in the hand — elbow stays completely still',
        exercises: [
          {
            name: 'Gentle Finger Flexion & Extension',
            meta: '2x per day — morning and evening',
            how: 'Let the arm rest on a pillow or table. Slowly curl all fingers into a loose fist, then slowly extend them fully flat. Do not bend the elbow or wrist forcefully.',
            cue: 'Just the fingers. Keep everything else still.',
          },
          {
            name: 'Light Fist Squeeze & Release',
            meta: '3 sets of 10 — easy effort only',
            how: 'Lightly squeeze a soft cloth or stress ball. Hold 2 seconds, release fully. This pumps blood through the forearm without loading the elbow joint.',
            tip: 'Stop immediately if this creates elbow pain.',
          },
        ],
      },
    ],
  },
  {
    label: 'P2',
    title: 'Passive ROM',
    sub: 'Gravity restores range',
    blocks: [
      {
        type: 'morning',
        title: 'Morning Mobility',
        meta: 'Gentle motion to reduce morning stiffness — no resistance',
        exercises: [
          {
            name: 'Gravity-Assisted Elbow Extension',
            meta: '3 sets — hold 60 seconds each',
            how: 'Sit upright. Let your arm hang at your side with the palm facing forward. Relax completely and let gravity slowly pull the elbow toward full extension. Do not force it — just breathe and let the weight of the arm work.',
            cue: 'Release and let gravity straighten. You\'re not stretching — you\'re relaxing into range.',
            tip: 'A gentle warmth or mild pulling sensation is normal. Sharp pain means stop.',
          },
          {
            name: 'Gravity-Assisted Elbow Flexion',
            meta: '3 sets of 10 slow reps',
            how: 'Stand or sit. Let the arm hang, then slowly curl it upward using only the weight of the forearm — no muscle activation, just momentum and gravity reversal. Lower it back down fully.',
          },
          {
            name: 'Wrist Circles',
            meta: '10 clockwise, 10 counter-clockwise — elbow stays still',
            how: 'Rest elbow on a table. Make slow circles with the wrist in both directions. This lubricates the wrist and radioulnar joints without stressing the elbow.',
            cue: 'Elbow anchored, wrist free.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Passive ROM Session',
        meta: 'Once daily — pain-free range only, no resistance',
        exercises: [
          {
            name: 'Finger Tendon Glides',
            meta: '10 reps of each position — 2 sets',
            how: 'Move through 5 positions: (1) Fingers straight. (2) Hook fist — bend knuckles, keep fingers straight. (3) Full fist — curl all fingers in. (4) Flat fist — knuckles bent, fingers straight down. (5) Straight fingers again. Hold each for 3 seconds.',
            tip: 'These glide the flexor tendons through their sheaths and keep the forearm healthy during elbow rest.',
          },
          {
            name: 'Forearm Pronation & Supination',
            meta: '3 sets of 15 — slow, full range',
            how: 'Elbow bent to 90°, upper arm at side. Slowly rotate palm up (supination) then palm down (pronation). Use no resistance — just range of motion.',
            cue: 'Think "palm to ceiling, palm to floor." Elbow stays tucked.',
          },
          {
            name: 'Wrist Flexion & Extension (Table-Supported)',
            meta: '3 sets of 15 — no weight',
            how: 'Rest forearm flat on a table with hand hanging over the edge. Gently lift the wrist up (extension) then lower it down (flexion). No weight, no strain.',
          },
          {
            name: 'Passive Elbow Flexion Hold',
            meta: '3 holds of 90 seconds — gravity + light pressure',
            how: 'Sit in a chair. Let the arm hang or rest on the knee. Use the opposite hand to gently guide the elbow toward full flexion — no forcing. Hold where you feel a mild stretch, breathe, and let it release over time.',
            tip: 'Pain-free end range only. If you feel sharp pain, back off 10 degrees.',
          },
        ],
      },
    ],
  },
  {
    label: 'P3',
    title: 'Active ROM',
    sub: 'Full arc under your control',
    blocks: [
      {
        type: 'warmup',
        title: 'Warm-Up',
        meta: '5 minutes — gentle heat + circulation',
        exercises: [
          {
            name: 'Warm Compress',
            meta: '5 min before exercises',
            how: 'Apply a warm (not hot) compress or heating pad to the elbow for 5 minutes. This increases blood flow and tissue extensibility before loading.',
            tip: 'Heat before, ice after. Heat loosens, ice reduces soreness.',
          },
          {
            name: 'Arm Swings (Gentle)',
            meta: '30 seconds each direction',
            how: 'Let the arm swing forward and back like a pendulum. Progress to small circles. Keep the shoulder relaxed. This warms the joint without loading it.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Active ROM Training',
        meta: 'Full arc — your muscles move the joint, no assistance',
        exercises: [
          {
            name: 'Active Elbow Flexion & Extension',
            meta: '3 sets of 15 — full range, controlled speed',
            how: 'Seated with upper arm at side. Actively curl the forearm toward the shoulder, then lower it fully. No weight. Focus on a slow 3-second lowering phase.',
            cue: 'Control the descent. The eccentric (lowering) phase is where healing happens.',
          },
          {
            name: 'Active Supination & Pronation',
            meta: '3 sets of 15 — elbow at 90°',
            how: 'Elbow bent, upper arm against side. Actively rotate palm up and palm down through full range. Hold 1 second at each end.',
          },
          {
            name: 'Wrist Curls (No Weight)',
            meta: '3 sets of 15 — full wrist arc',
            how: 'Forearm resting on a table. Actively curl the wrist up and lower it down. Goal is smooth, full range motion without trembling or guarding.',
          },
          {
            name: 'Prayer Stretch — Flexor',
            meta: '3 holds of 30 seconds',
            how: 'Press palms together in front of the chest (prayer position). Slowly lower the joined hands toward the waist while keeping palms together. You\'ll feel the stretch along the inner forearm and wrist.',
            cue: 'Feel the stretch in the forearm, not the elbow.',
          },
          {
            name: 'Reverse Prayer Stretch — Extensor',
            meta: '3 holds of 30 seconds',
            how: 'Press the backs of your hands together behind your body (reverse prayer). Slowly raise the joined hands toward your back. Stretches the forearm extensors.',
            tip: 'This may feel unusual. Stop if it causes elbow pain — perform as a wrist stretch only.',
          },
          {
            name: 'Towel Wring (Light)',
            meta: '3 sets of 10 each direction',
            how: 'Hold a light, dry hand towel in both hands. Gently twist it in both directions — like wringing water out. Light effort only. This begins training supination and pronation with minimal resistance.',
          },
        ],
      },
      {
        type: 'cooldown',
        title: 'Cool-Down',
        meta: 'Ice after every session this phase',
        exercises: [
          {
            name: 'Post-Session Ice',
            meta: '15–20 minutes after completing exercises',
            how: 'Apply ice pack to the elbow immediately after training. This controls any micro-inflammatory response from increasing the workload.',
          },
        ],
      },
    ],
  },
  {
    label: 'P4',
    title: 'Isometric',
    sub: 'Build strength without movement',
    blocks: [
      {
        type: 'warmup',
        title: 'Warm-Up',
        meta: 'Heat + 5 min of Phase 3 active ROM before loading',
        exercises: [
          {
            name: 'Heat + Active ROM Review',
            meta: '5 min heat, then 2 sets of active elbow flexion/extension',
            how: 'Apply warm compress 5 min. Then perform 2 sets of active elbow flexion/extension from Phase 3 to make sure full range is available before adding isometric loading.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Isometric Loading',
        meta: 'Joint does not move — muscle fires against resistance. Hold 8–10 seconds each.',
        exercises: [
          {
            name: 'Isometric Bicep Hold',
            meta: '3 sets of 10 — hold 10 seconds, rest 10 seconds',
            how: 'Elbow bent to 90°, upper arm at side. Place opposite hand on the wrist/forearm. Press up into the hand as if curling, but resist with the other hand so NO movement occurs. Fire the bicep hard against resistance.',
            cue: 'Push as if you\'re trying to move but refuse to let it. Full contraction, zero motion.',
            tip: 'This is the safest way to load the bicep without joint stress. Ligaments love isometric tension.',
          },
          {
            name: 'Isometric Tricep Push',
            meta: '3 sets of 10 — hold 10 seconds',
            how: 'Stand near a wall. Place the back of your wrist against the wall with elbow slightly bent. Press the wrist backward into the wall as if trying to extend the elbow, but the wall blocks all movement. Fire the tricep.',
            cue: 'Elbow locked. Tricep firing. Wall wins.',
          },
          {
            name: 'Isometric Wrist Flexion',
            meta: '3 sets of 10 — hold 8 seconds',
            how: 'Forearm on table, hand hanging over edge. Press the wrist down (flexion) into the opposite hand placed underneath. Resist with the palm — no wrist movement occurs. Focus on the forearm flexor muscles working.',
          },
          {
            name: 'Isometric Wrist Extension',
            meta: '3 sets of 10 — hold 8 seconds',
            how: 'Same position, but press the back of the hand up into the palm of the opposite hand placed on top. No movement — just forearm extensor contraction.',
            tip: 'Wrist extensors are commonly involved in lateral epicondyle pain (tennis elbow). Build these carefully.',
          },
          {
            name: 'Tennis Ball Squeeze Hold',
            meta: '3 sets of 12 — hold 5 seconds each rep',
            how: 'Squeeze a tennis ball to 50–60% of your max effort. Hold 5 seconds. Release fully. Rest 5 seconds. This trains grip endurance and forearm compression tolerance.',
            cue: 'Half effort, full focus. Don\'t crush it.',
          },
          {
            name: 'Finger Extension Against Resistance',
            meta: '3 sets of 12 — hold 5 seconds each',
            how: 'Place a thick rubber band around your fingers. Open the hand against the rubber band resistance. Hold 5 seconds at full extension. Release. This trains the forearm extensors from the other direction.',
            tip: 'Finger extension training is often neglected but critical for elbow balance. Prevents extensor weakness.',
          },
        ],
      },
    ],
  },
  {
    label: 'P5',
    title: 'Load',
    sub: 'Progressive resistance',
    blocks: [
      {
        type: 'warmup',
        title: 'Warm-Up',
        meta: '5 min heat + active ROM before loading',
        exercises: [
          {
            name: 'Heat + ROM Review',
            meta: '5 min heat, then 2 sets active flexion/extension',
            how: 'Standard warm-up from Phase 3. Confirm full pain-free range before adding resistance.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Progressive Resistance',
        meta: 'Start at 1–2 lbs. Increase only when 3 sets of 12 feel easy.',
        exercises: [
          {
            name: 'Light Dumbbell Curl',
            meta: '3 sets of 12 — 1–3 lbs, slow tempo',
            how: 'Seated, upper arm at side. Curl the dumbbell up through full range, hold 1 second at peak, lower over 3 seconds. The eccentric (lowering) phase is critical — it stimulates tendon remodeling.',
            cue: '1 second up, 1 second hold, 3 seconds down. The slow lowering heals.',
            tip: 'If the lightest dumbbell is too heavy, use a soup can or water bottle. Start ridiculously light — your tendons are still fragile.',
          },
          {
            name: 'Reverse Curl',
            meta: '3 sets of 12 — palm down grip',
            how: 'Same as dumbbell curl but with palm facing down (pronated grip). Targets the brachioradialis — the muscle that connects the forearm to the upper arm and stabilizes the elbow.',
            tip: 'This is often underdeveloped after elbow injuries. Essential for lateral elbow stability.',
          },
          {
            name: 'Hammer Curl',
            meta: '3 sets of 12 — neutral grip (thumb up)',
            how: 'Dumbbell in hand, thumb pointing up toward ceiling throughout the movement. Curl up, control down. Neutral grip reduces forearm rotation stress and trains the brachialis.',
          },
          {
            name: 'Tricep Pushdown (Resistance Band)',
            meta: '3 sets of 15 — light band',
            how: 'Loop a resistance band over a pull-up bar or anchor it overhead. Grip the band with elbow bent to 90°. Extend the elbow fully (push down), hold 1 second, return slowly. Upper arm stays at side.',
            cue: 'Elbow locked at your hip. Push the band to the ground.',
          },
          {
            name: 'Band Pronation & Supination',
            meta: '3 sets of 15 each direction',
            how: 'Hold one end of a light resistance band (or a soup can) with elbow at 90°. Rotate the forearm against band resistance — palm up, then palm down, through full range.',
            tip: 'This builds the often-neglected pronator and supinator muscles that protect the elbow during sport.',
          },
          {
            name: 'Eccentric DB Curl',
            meta: '3 sets of 10 — load the lowering only',
            how: 'Curl the weight up with both hands (so the injured elbow doesn\'t have to do the work of lifting). Then lower it with only the injured arm over a full 4 seconds. Both arms up, one arm down — slow.',
            cue: '4 seconds down. Feel the work in the bicep as it fights gravity.',
            tip: 'Eccentric training is the most evidence-based approach for tendon healing. It\'s not comfortable, but it works.',
          },
          {
            name: 'Wrist Roller (Light)',
            meta: '2 sets to comfortable fatigue',
            how: 'Use a wrist roller or hold a light dumbbell. With forearm extended, roll the wrist up and down (flexion/extension) continuously for 30–45 seconds. Builds forearm endurance.',
          },
        ],
      },
      {
        type: 'cooldown',
        title: 'Post-Session',
        meta: 'Stretch + ice after every resistance session',
        exercises: [
          {
            name: 'Bicep Stretch',
            meta: '2 holds of 30 seconds',
            how: 'Extend arm in front with palm up. Use the opposite hand to gently press the palm down and back, creating a stretch along the underside of the forearm and bicep.',
          },
          {
            name: 'Tricep Cross-Body Stretch',
            meta: '2 holds of 30 seconds',
            how: 'Bring arm across the body. Use opposite hand to press the elbow gently toward the opposite shoulder. Feel the stretch behind the upper arm.',
          },
          {
            name: 'Post-Session Ice',
            meta: '15 minutes after every resistance workout',
            how: 'Apply ice to elbow for 15 minutes. Always. Until you\'re fully cleared for sport, ice is part of the protocol.',
          },
        ],
      },
    ],
  },
  {
    label: 'P6',
    title: 'Return',
    sub: 'Sport-specific loading',
    blocks: [
      {
        type: 'warmup',
        title: 'Full Warm-Up',
        meta: '10 minutes — heat, ROM, activation before any skill work',
        exercises: [
          {
            name: 'Heat + Dynamic Warm-Up',
            meta: '3 min heat, then arm circles, swings, wrist circles',
            how: 'Brief heat, then dynamic warm-up: arm circles (small → large), pendulum swings, wrist circles, finger tendon glides. Full warm-up before any loaded or sport-specific work.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Functional Progressions',
        meta: 'Build load-bearing capacity through progressive functional movements',
        exercises: [
          {
            name: 'Wall Push-Up',
            meta: '3 sets of 15 — elbows slightly bent at bottom',
            how: 'Stand at arm\'s length from a wall. Place hands at shoulder width and shoulder height. Lower chest toward wall (bending elbows), then push back to start. Full range. Week 5–6 only.',
            cue: 'The elbow is now being loaded through a closed chain. This is the start of return to impact.',
          },
          {
            name: 'Incline Push-Up',
            meta: '3 sets of 12 — hands on bench or counter',
            how: 'Progress from wall push-up once 3x15 feels easy. Hands on a bench (hip height), perform full push-up. Lower angle = more load. Move to floor only when incline feels effortless.',
          },
          {
            name: 'Floor Push-Up',
            meta: '3 sets of 10 — full range, controlled',
            how: 'Full floor push-up when ready. Lower chest to 1 inch above floor, extend fully. If any elbow pain, return to incline and give it another week.',
            tip: 'Elbow lockout at the top is fine — keep it controlled, not snapping.',
          },
          {
            name: 'Plank Hold',
            meta: '3 sets — build from 20s → 45s → 60s',
            how: 'Forearms on the ground. Maintain a rigid body line from head to heels. The elbow is bearing weight and stabilizing — this is excellent closed-chain elbow strengthening.',
            cue: 'Squeeze everything — glutes, core, lats. The elbow is just the anchor.',
          },
          {
            name: 'Overhead Reach with Light Weight',
            meta: '3 sets of 12 — 2–3 lbs max',
            how: 'Standing, press a light dumbbell overhead slowly and lower it. This begins loading the elbow in the overhead position, important for skating, snowboarding, and most sports.',
            tip: 'Pain with overhead loading = more time in Phase 5. Don\'t rush this.',
          },
          {
            name: 'Arm Swing Drills (Skateboard / Snowboard)',
            meta: '3 sets of 20 reps each side',
            how: 'Simulate the arm swing pattern of your sport. For skating: pendulum arm swing for pumping a bowl, cross-arm position for carving. For snowboarding: pole-plant simulation, arm-cross for balance. Start unloaded, then add light weight.',
            cue: 'Muscle memory is rebuilt through repetition. Train the pattern before you need it at speed.',
          },
          {
            name: 'Closed-Chain Impact Simulation',
            meta: '3 sets of 20 seconds — graded pressure through the arm',
            how: 'Bear crawl position (hands and knees). Gently shift weight onto hands, hold, shift back. Progress to hold with full weight on hands for 20 seconds. This trains the elbow to accept impact — which is what you\'ll need when you fall or brace on a board.',
            tip: 'The ability to absorb impact through the arm without pain is the final gate before returning to sport.',
          },
        ],
      },
      {
        type: 'cooldown',
        title: 'Return-to-Sport Assessment',
        meta: 'These are the clearance criteria — check each one before returning fully',
        exercises: [
          {
            name: 'Full Range of Motion Check',
            meta: 'Can you fully extend and flex the elbow without pain?',
            how: 'Compare your injured elbow range to the uninjured side. They should be within 5° of each other. If there\'s a significant deficit, continue Phase 5 work.',
          },
          {
            name: 'Strength Check',
            meta: 'Is elbow strength 90%+ of the other side?',
            how: 'Test grip strength, curl strength, and push strength compared to the other arm. An easy test: can you do the same number of push-ups without pain? Same dumbbell weight?',
          },
          {
            name: 'Pain Assessment',
            meta: 'Zero pain at rest and during Phase 5 exercises',
            how: 'Rate pain during all exercises at 0/10. If any exercise scores 2+ out of 10, you\'re not cleared for full return. Sport loading is more demanding than Phase 5 exercises.',
          },
        ],
      },
    ],
  },
]

export default function ElbowPage() {
  return (
    <RecoveryPlaybook
      recoveryId="elbow"
      title="Elbow Recovery"
      description="Hyperextended elbow — 6-phase protocol from RICE to full sport return"
      phases={ELBOW_PHASES}
    />
  )
}

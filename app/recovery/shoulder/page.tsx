import RecoveryPlaybook, { type PlaybookPhaseData } from '@/components/ui/RecoveryPlaybook'

const SHOULDER_PHASES: PlaybookPhaseData[] = [
  {
    label: 'P1',
    title: 'Relief',
    sub: 'Calm pain & reset posture',
    blocks: [
      {
        type: 'rest',
        title: 'Phase 1 Protocol',
        meta: 'Days 1–7. Reduce inflammation. Fix the posture that caused this.',
        exercises: [
          {
            name: 'Ice Therapy',
            meta: '15–20 min — 3–4x per day in the acute phase',
            how: 'Apply ice pack over the front and top of the shoulder. Do not apply directly to skin. Ice reduces prostaglandin release and calms the bursa inflammation driving the impingement pain.',
            tip: 'After the first 72 hours, switch to alternating heat and ice — heat before exercises, ice after.',
          },
          {
            name: 'Activity Modification',
            meta: 'Avoid arm overhead and across body for the first week',
            how: 'The painful arc for impingement is typically 60–120° of shoulder elevation. Avoid reaching overhead, sleeping on the affected shoulder, and reaching across your body. These positions compress the supraspinatus tendon against the acromion.',
            cue: 'The goal is zero compression in the painful arc. Calm first, load later.',
          },
        ],
      },
      {
        type: 'morning',
        title: 'Posture Reset',
        meta: 'Daily — morning and evening. Poor posture is the #1 cause of impingement.',
        exercises: [
          {
            name: 'Scapular Retraction Squeezes',
            meta: '3 sets of 15 — hold 5 seconds each',
            how: 'Sit or stand tall. Pull the shoulder blades together and slightly down (like sliding them into your back pockets). Hold 5 seconds. Release. This activates the middle and lower trapezius — the muscles that pull the shoulder blade back and create space under the acromion.',
            cue: 'Squeeze pennies between your shoulder blades. Don\'t shrug — down and in.',
            tip: 'This single exercise has the highest evidence base for impingement recovery. Do it religiously.',
          },
          {
            name: 'Chin Tucks',
            meta: '3 sets of 15 — head moves back, not down',
            how: 'Standing or seated. Pull your chin straight back — think "make a double chin." Hold 3 seconds. This corrects the forward-head posture that rounds the shoulders and narrows the subacromial space.',
            cue: 'Pull the back of your head toward the wall behind you. Eyes stay level.',
          },
          {
            name: 'Wall Angels',
            meta: '3 sets of 10 — slow and controlled',
            how: 'Stand with back and head against a wall. Arms at your sides with elbows bent to 90°. Slowly slide your arms upward like a snow angel until overhead, then lower. Keep the back of the hands, elbows, and head in contact with the wall the entire time.',
            tip: 'If your hands lose contact with the wall, you\'ve gone as high as your current thoracic mobility allows. Stop there and work from that range.',
          },
          {
            name: 'Pendulum Swings',
            meta: '3 directions — 30 seconds each',
            how: 'Lean forward with the good hand on a table. Let the injured arm hang freely. Use gentle torso motion to swing the arm in small circles (clockwise and counter-clockwise), then forward/back, then side to side. Zero muscle activation in the shoulder — just letting it dangle.',
            cue: 'Dead weight. Your body swings, not your shoulder muscles.',
            tip: 'This decompresses the shoulder joint and maintains passive range without activating the inflamed supraspinatus.',
          },
          {
            name: 'Doorway Pec Stretch (Small Arc)',
            meta: '2 holds of 30 seconds — elbow at 90° only, not overhead',
            how: 'Stand in a doorway. Place elbow and forearm against the door frame at 90° (elbow at shoulder height). Gently lean forward until you feel a mild stretch across the chest and front of the shoulder. Do not raise the arm above 90°.',
            tip: 'Tight chest muscles pull the shoulder blade forward and worsen impingement. This stretch is therapeutic.',
          },
        ],
      },
    ],
  },
  {
    label: 'P2',
    title: 'Mobility',
    sub: 'Restore full range of motion',
    blocks: [
      {
        type: 'warmup',
        title: 'Warm-Up',
        meta: 'Heat + gentle pendulums before every session',
        exercises: [
          {
            name: 'Heat + Pendulums',
            meta: '5 min heat, then 2 minutes of pendulum swings',
            how: 'Apply warm compress to shoulder for 5 minutes. Follow immediately with pendulum swings (Phase 1 protocol). This prepares the joint for active mobility work.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Mobility Restoration',
        meta: 'Regain full range. No forcing — let the tissue yield over time.',
        exercises: [
          {
            name: 'Sleeper Stretch (Posterior Capsule)',
            meta: '3 holds of 30–45 seconds — affected side',
            how: 'Lie on the injured shoulder with the arm out in front at 90°. Use the opposite hand to gently push the forearm toward the floor (internal rotation). You should feel a deep stretch in the back of the shoulder joint.',
            cue: 'Stretch behind the joint, not in front. Posterior capsule tightness is the #1 hidden driver of impingement.',
            tip: 'This stretch is critical but often missed. Tight posterior capsule forces the humeral head forward and upward — directly into the impingement zone.',
          },
          {
            name: 'Cross-Body Shoulder Stretch',
            meta: '3 holds of 30 seconds',
            how: 'Bring the injured arm across the body. Use the opposite hand to gently pull the elbow toward the opposite shoulder. Feel the stretch in the back of the shoulder (posterior deltoid and posterior capsule).',
          },
          {
            name: 'Active-Assisted Flexion (Wand)',
            meta: '3 sets of 15 — good arm assists the injured arm',
            how: 'Hold a broom handle or dowel rod horizontally with both hands. Use the good arm to push/guide the injured arm upward into flexion (raising the rod overhead). The good arm does the lifting — the injured arm just goes along for the ride.',
            cue: 'The good arm is the motor. Injured arm is a passenger.',
            tip: 'This restores overhead range without forcing the rotator cuff to fire in the painful arc.',
          },
          {
            name: 'Thoracic Extension over Foam Roller',
            meta: '3 sets — 10 extensions, 30-second holds',
            how: 'Place foam roller perpendicular to the spine, at mid-back level. Let the head and shoulders fall back over the roller. Hold 30 seconds. Move roller up one segment. Repeat across the mid-thoracic spine (T4–T8).',
            cue: 'Open the chest at the source. Stiff T-spine forces the shoulder to compensate.',
            tip: 'Thoracic mobility directly affects shoulder elevation. One of the most important and most neglected elements of shoulder rehab.',
          },
          {
            name: 'Shoulder External Rotation (Gravity)',
            meta: '3 holds of 60 seconds — let the arm rotate',
            how: 'Lie face down on a bed with the injured arm hanging off the edge, elbow at 90°. Let gravity slowly rotate the forearm down (external rotation). Relax the muscles completely and let the weight of the forearm work.',
            tip: 'Loss of external rotation range is often what drives the impingement pattern. This restores it without forcing.',
          },
          {
            name: 'Shoulder Elevation in Scapular Plane',
            meta: '3 sets of 15 — 30° forward from the side',
            how: 'Raise the arm at 30° forward from directly to the side (scapular plane — thumb pointing up). Raise only to 90° (horizontal) to stay out of the painful arc. Lower slowly. No weight.',
            cue: 'Stay in the scapular plane — it\'s the most biomechanically natural path and avoids the impingement zone.',
          },
        ],
      },
    ],
  },
  {
    label: 'P3',
    title: 'Strengthen',
    sub: 'Rotator cuff activation',
    blocks: [
      {
        type: 'warmup',
        title: 'Warm-Up',
        meta: 'Heat + Phase 1 posture reset + Phase 2 mobility before loading',
        exercises: [
          {
            name: 'Full Warm-Up Sequence',
            meta: '10 minutes — heat, scapular retractions, pendulums, wand',
            how: 'Heat 5 min → scapular retractions 2 sets → pendulums 2 min → wand-assisted flexion 2 sets. Shoulder must be warm and fully mobile before loading the rotator cuff.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Rotator Cuff Activation',
        meta: 'Light resistance only. Never push through impingement pain.',
        exercises: [
          {
            name: 'Side-Lying External Rotation',
            meta: '3 sets of 15 — light DB (1–3 lbs), slow and controlled',
            how: 'Lie on the uninjured side. Injured arm on top, elbow bent to 90°, upper arm resting on the side. Rotate the forearm upward (external rotation) until it points at the ceiling. Hold 1 second. Lower slowly over 3 seconds.',
            cue: 'Elbow stays glued to your side. Only the forearm rotates.',
            tip: 'This directly targets the infraspinatus and teres minor — the muscles that hold the humeral head down and prevent it from migrating upward into the acromion.',
          },
          {
            name: 'Prone Y (Scapular Upward Rotation)',
            meta: '3 sets of 12 — no weight or 1–2 lbs',
            how: 'Lie face down on a bench or bed with arms hanging. Raise both arms into a Y shape (above the head), thumbs up. Squeeze shoulder blades together and downward as you lift. Hold 2 seconds. Lower slowly.',
            cue: 'Think of the Y as the scapula rotating upward. This is the motion that creates room under the acromion.',
          },
          {
            name: 'Prone T (Horizontal Abduction)',
            meta: '3 sets of 12 — no weight or 1 lb',
            how: 'Same position. Raise arms straight out to the sides (T shape), thumbs up. Lead with the shoulder blades retracting. Hold 2 seconds at the top. Lower slowly.',
            tip: 'Prone Y and T target the lower and middle trapezius — the primary stabilizers that control scapular position and unlock impingement-free overhead range.',
          },
          {
            name: 'Prone W (Rotator Cuff + Lower Trap)',
            meta: '3 sets of 12',
            how: 'Same position. Start with arms in Y, then pull elbows down and back toward your hips, rotating the forearms to create a W shape. Squeeze hard at the end position. Hold 2 seconds. Return to Y and repeat.',
            cue: 'Y → pull into W → squeeze. Feel the lower traps and infraspinatus working together.',
          },
          {
            name: 'Band Pull-Aparts',
            meta: '3 sets of 20 — light band, arms at shoulder height',
            how: 'Hold a resistance band at both ends, arms extended in front at shoulder height. Pull the band apart by moving hands apart until fully stretched. Squeeze shoulder blades together at the end. Return slowly.',
            cue: 'Chest up, chin in, pull through your elbows.',
          },
          {
            name: 'Cable Face Pull (or Band)',
            meta: '3 sets of 15 — light resistance, high anchor',
            how: 'Attach a rope or band at face height. Pull toward the face while flaring the elbows high and rotating the forearms outward (external rotation). The hands end up behind the ears at the finish.',
            cue: 'Pull the rope apart and back. Elbows high, hands finish behind the ears.',
            tip: 'Face pulls simultaneously train external rotation, scapular retraction, and posterior deltoid. Best single exercise for chronic shoulder issues.',
          },
        ],
      },
      {
        type: 'abs',
        title: 'Serratus Activation',
        meta: 'The forgotten muscle — critical for scapular upward rotation',
        exercises: [
          {
            name: 'Wall Slides with Reach',
            meta: '3 sets of 10 — arms slide up, reach at the top',
            how: 'Stand facing a wall. Place forearms on wall at chest height. Slide arms up the wall while reaching and protracting the shoulder blades (pushing into the wall). At the top, push forward slightly with the shoulder to activate the serratus anterior.',
            cue: 'Push the wall away with your shoulder blade at the top. That\'s serratus.',
          },
          {
            name: 'Push-Up Plus',
            meta: '3 sets of 12 — at top of push-up, add shoulder protraction',
            how: 'Perform a standard push-up. At full arm extension, add an additional push — let the shoulder blades spread apart and push the upper back slightly toward the ceiling. Hold 1 second, lower back to normal top position.',
            cue: 'Normal push-up + one extra inch of push at the top. That extra inch is the serratus firing.',
          },
        ],
      },
    ],
  },
  {
    label: 'P4',
    title: 'Return',
    sub: 'Full strength & overhead function',
    blocks: [
      {
        type: 'warmup',
        title: 'Full Warm-Up',
        meta: 'Complete warm-up sequence before any heavy loading',
        exercises: [
          {
            name: 'Phase 3 Warm-Up + All Rotator Cuff Activation',
            meta: '15 minutes — heat, posture, mobility, RC activation before pressing',
            how: 'Full Phase 3 warm-up sequence. At this phase, never skip it — the rotator cuff must be warmed and activated before handling heavier loads or overhead work.',
          },
        ],
      },
      {
        type: 'workout',
        title: 'Return to Full Function',
        meta: 'Progressive loading through full range. Pain-free is the only metric that matters.',
        exercises: [
          {
            name: 'DB Lateral Raise',
            meta: '3 sets of 12 — light to moderate weight, thumb up',
            how: 'Standing, arms at sides. Raise dumbbells out to the sides to 90° (shoulder height) with thumbs pointing slightly up. Lower slowly over 3 seconds. Do not shrug or lean.',
            cue: 'Lead with the elbows. Pinky slightly higher than thumb at the top.',
            tip: 'If any pinching at 60–90°, the posterior capsule may still be tight. Return to Phase 2 sleeper stretches.',
          },
          {
            name: 'DB Front Raise',
            meta: '3 sets of 12 — moderate weight',
            how: 'Raise dumbbells in front of you to 90° with palms facing down. Control the lowering. Keep the core engaged — no swinging or leaning back.',
          },
          {
            name: 'Overhead DB Press',
            meta: '3 sets of 10 — seated, pain-free arc only',
            how: 'Seated to remove lower-back compensation. Start with dumbbells at shoulder level, elbows at 90°. Press overhead until arms are nearly fully extended. Lower slowly. If any pain appears, stop at that angle and build from there.',
            cue: 'Press in the scapular plane (arms slightly forward, not directly out to the side). This is the natural overhead path.',
          },
          {
            name: 'Diagonal Pattern Reach (PNF D2)',
            meta: '3 sets of 12 each direction',
            how: 'Standing with a light band or cable low on the opposite side. Reach across to grab the anchor, then sweep the arm diagonally upward and out (like drawing a sword from the opposite hip and pointing it at the sky). Reverse the pattern to return.',
            cue: 'Diagonal patterns mirror real-life and sport movements. This is functional shoulder training.',
          },
          {
            name: 'Single-Arm DB Row',
            meta: '3 sets of 12 — moderate weight, supported',
            how: 'Knee and hand on a bench, opposite leg back. Row the dumbbell from a hanging position to the hip, squeezing the shoulder blade at the top. Lower fully. Strong posterior chain exercise that also trains scapular control.',
          },
          {
            name: 'Narrow-Grip Upright Row (Band)',
            meta: '3 sets of 12 — only if pain-free, elbows below shoulder height',
            how: 'Stand on a resistance band. Pull upward toward the chin with hands close together. Stop when elbows reach shoulder height — do not pull higher as this recreates the impingement position.',
            tip: 'If any shoulder pain, skip this exercise. It is the most provocative movement in the protocol.',
          },
        ],
      },
      {
        type: 'cooldown',
        title: 'Clearance Criteria',
        meta: 'These benchmarks indicate readiness for full sport return',
        exercises: [
          {
            name: 'Pain-Free Full Range',
            meta: 'Zero pain through full elevation, external rotation, and cross-body',
            how: 'Raise arm overhead, externally rotate, cross the body — all pain-free at 0/10.',
          },
          {
            name: 'Symmetric Strength',
            meta: 'Injured shoulder at 90%+ of uninjured side',
            how: 'Compare lateral raise, front raise, and overhead press strength. No significant asymmetry.',
          },
          {
            name: 'Scapular Stability Under Load',
            meta: 'No winging, no shrugging during pressing movements',
            how: 'Have someone watch your shoulder blade during overhead pressing. The blade should stay flat against the rib cage and not pop off ("wing").',
          },
        ],
      },
    ],
  },
]

export default function ShoulderPage() {
  return (
    <RecoveryPlaybook
      recoveryId="shoulder"
      title="Shoulder Impingement"
      description="Subacromial impingement — 4-phase return-to-sport protocol"
      phases={SHOULDER_PHASES}
    />
  )
}

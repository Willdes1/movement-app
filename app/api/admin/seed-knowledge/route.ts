import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { embedBatch } from '@/lib/knowledge-retrieval'
import { logTokens } from '@/lib/log-tokens'

let _admin: SupabaseClient | null = null
function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

// ─── Seed content ──────────────────────────────────────────────────────────────

const TRAINING_PRINCIPLES = [
  {
    title: 'Progressive Overload',
    content: 'Progressive overload is the gradual increase of stress placed on the body during exercise training. To continue making gains, the training stimulus must consistently increase in volume, intensity, frequency, or complexity. Without it, the body adapts to current demand and progress stalls. Methods: increase load 2.5–5% when athlete completes 2 reps above target range; increase volume (sets × reps) before intensity; use technique improvement as a form of overload for beginners.',
  },
  {
    title: 'Periodization — Linear',
    content: 'Linear periodization progresses from high volume/low intensity to low volume/high intensity across a block. Best for beginner and intermediate athletes. A 13-week structure: Weeks 1–4 Foundation — 3–4 sets of 12–15 reps at RPE 6–7; Weeks 5–8 Build — 4–5 sets of 8–10 reps at RPE 7–8; Weeks 9–10 Peak — 4–6 sets of 3–6 reps at RPE 9–10; Weeks 11–13 Maintenance — 3–4 sets of 10–12 reps at RPE 6–7.',
  },
  {
    title: 'Supercompensation',
    content: 'Supercompensation is the physiological process where the body, after a training-induced fatigue state, recovers to a level above the original baseline. The adaptation window is 24–72 hours after the stimulus. Training the same muscle group too soon catches it in the fatigue phase; training too late misses the supercompensation peak. For strength: 48–72hr rest per muscle group. For conditioning: 24–48hr. This is why training split design matters.',
  },
  {
    title: 'SAID Principle — Specificity',
    content: 'Specific Adaptation to Imposed Demands: the body adapts specifically to the type of stress placed on it. Training must mirror the physical demands of the sport. Identify the dominant energy system (ATP-PC for explosiveness, glycolytic for 60–120sec efforts, oxidative for >2min), the primary movement patterns (sagittal, frontal, transverse), and the force vectors involved (horizontal push for sprinting, vertical for jumping). A soccer player needs aerobic base + sprint capacity + change of direction, not just general fitness.',
  },
  {
    title: 'Deload Protocols',
    content: 'A deload is a planned reduction in training volume (50%) and/or intensity (RPE −1 to −2) to allow accumulated fatigue to dissipate and supercompensation to occur. Deloads should be programmed every 4–6 weeks for intermediate/advanced athletes. Signs deload is needed: persistent soreness, decreased performance, disrupted sleep, elevated resting heart rate. Options: passive (full rest), active (50% volume at same intensity), or intensity deload (same volume at 60–70% intensity).',
  },
  {
    title: 'Compound-Before-Isolation Exercise Order',
    content: 'Multi-joint compound exercises must always precede single-joint isolation exercises within a session. Compounds (squat, deadlift, bench, row, overhead press, pull-up) require maximal motor unit recruitment and coordination when fresh. Exercise order: 1) Bilateral compound main lift → 2) Unilateral compound accessory → 3) Horizontal/vertical pull or push complement → 4) Single-joint isolation → 5) Core/corrective. Placing isolations first pre-fatigues primary movers and reduces quality of the most important training stimulus.',
  },
  {
    title: 'Tempo and Time Under Tension',
    content: 'Notation: eccentric-pause-concentric-pause (e.g., 3-1-2-0). Recommendations by goal: Strength — 1–2 sec eccentric, explosive concentric. Hypertrophy — 3–4 sec eccentric, 1–2 sec concentric, peak contraction hold. Power — fast eccentric, maximally explosive concentric. Slowing the eccentric to 3–4 seconds is the single highest-yield tempo modification for muscle development in intermediate athletes. Time under tension of 40–70 seconds per set is the hypertrophy sweet spot.',
  },
  {
    title: 'RPE and Reps In Reserve (RIR)',
    content: 'RPE (1–10 scale) quantifies effort relative to maximum. RPE 10 = maximal effort, no reps left. RIR = reps left in the tank at set end. RIR 0 = failure, RIR 2 = 2 reps left. Foundation phase: RPE 6–7 (RIR 3–4). Build phase: RPE 7–8 (RIR 2–3). Peak phase: RPE 9–10 (RIR 0–1). For beginners, use RPE because true failure is risky — form breaks down before real failure. For advanced: train to RIR 1 on main lifts, RIR 0–1 on accessory work.',
  },
  {
    title: 'Warm-Up Science and Protocols',
    content: 'A proper warm-up raises core temperature, increases synovial fluid viscosity, improves neuromuscular activation, and reduces injury risk by 50–60%. Structure: 1) General cardiovascular activation (5 min light cardio), 2) Dynamic mobility (hip/thoracic/shoulder circles, leg swings — 2×10 each), 3) Activation work (band pull-aparts, clamshells, dead bugs — prime movers), 4) Sport-specific movement ramp (light sets at 50%/70%/85% of working weight). Static stretching before lifting reduces power output by 4–8% — reserve it for cooldown only.',
  },
  {
    title: 'Sleep and Recovery Optimization',
    content: 'Testosterone and growth hormone peak during slow-wave sleep (hours 1–4). Training gains are largely made during this window, not during the session itself. Athletes in high-volume phases need 8–9 hours. Practical protocols: consistent wake time matters more than bedtime; 60–65°F room temp is optimal; avoid screens 60min before bed; magnesium glycinate 200–400mg before sleep enhances slow-wave sleep quality. Rate of recovery determines training frequency — if soreness persists into session day, scale intensity.',
  },
  {
    title: 'Breathing and Intra-Abdominal Pressure',
    content: 'Intra-abdominal pressure (IAP) is the primary spinal stabilization mechanism during lifting. Valsalva maneuver (inhale fully, brace 360-degree core, hold through sticking point) is appropriate for compound lifts at >80% 1RM. For moderate loads: inhale on eccentric/lowering phase, exhale forcefully on concentric/effort phase. Core bracing ≠ sucking in the stomach — it is a 360-degree expansion: front, sides, and back simultaneously. This cue belongs in every coaching note for compound lifts.',
  },
  {
    title: 'Energy System Training — Conditioning',
    content: 'Three energy systems: 1) Phosphocreatine/ATP-PC (0–10 sec): maximal power, sprints, explosive lifts — requires 2–5 min full recovery. 2) Glycolytic (10 sec–2 min): moderate-high intensity, HIIT, circuits — 1–2 min recovery between intervals. 3) Oxidative (>2 min): aerobic base, 60–75% max HR. To improve sport performance: identify primary energy system, train it 2×/week. Skateboarding: ATP-PC dominant. Soccer: mixed glycolytic + oxidative. Distance running: oxidative primary.',
  },
  {
    title: 'Muscle Fiber Types and Training Implications',
    content: 'Type I (slow-twitch): fatigue-resistant, aerobic, activated at low efforts — trained with high-rep, low-load, long-duration work. Type IIa (fast-twitch oxidative): moderate power, recruited at moderate efforts — trained with 8–12 rep hypertrophy ranges. Type IIx (fast-twitch glycolytic): maximal power, fatigues quickly — trained with heavy loads (1–5 reps) and explosive movements. Most athletes have a mix. Explosive sport athletes (sprinters, skateboarders) should include heavy compound work and plyometrics to target Type II fibers.',
  },
  {
    title: 'Mobility vs. Flexibility',
    content: 'Flexibility is passive range of motion (how far you can stretch). Mobility is active range of motion you can control under load. Mobility is trainable and more functionally relevant. An athlete can be flexible but immobile — they can be pushed into a deep squat but cannot actively get there. Mobility training protocols: joint circles (active), 90/90 hip rotations, thoracic extensions over foam roller, ankle dorsiflexion drills. Program mobility in warm-up and cooldown, not as standalone stretching-only sessions.',
  },
  {
    title: 'Plyometric Training and Reactive Strength',
    content: 'Plyometrics train the stretch-shortening cycle (SSC) — the rapid pre-stretch of a muscle before concentric contraction amplifies power output. Key metric: Reactive Strength Index (RSI) = jump height / ground contact time. Higher RSI = more elastic strength. Progression: 1) Landing mechanics (absorb, no knee valgus), 2) Submaximal jump-to-stick, 3) Continuous jumps, 4) Depth jumps. Never program plyometrics on days following very high-volume lower body training — CNS fatigue impairs SSC quality.',
  },
]

const SPORT_PROTOCOLS = [
  {
    title: 'Skateboarding — Physical Demands and Training',
    content: 'Skateboarding is ATP-PC dominant requiring explosive power (ollie height, kickflip snap), proprioception and balance (landing impact absorption), and high ankle/hip mobility. Key muscle groups: tibialis anterior and peroneals (ankle stability), hip flexors (pop mechanics), rotational core (trick execution). Training priorities: 1) Unilateral lower body strength (single-leg press, Bulgarian split squat), 2) Ankle stability (single-leg balance with perturbation), 3) Hip mobility (90/90 stretches, pigeon pose), 4) Reactive strength (drop landings, box jumps). Impact accumulation makes knee and ankle health critical — program 2 recovery days per week of active skate training.',
    metadata: { sport: 'skateboarding' },
  },
  {
    title: 'Basketball — Physical Demands and Training',
    content: 'Basketball is glycolytic-dominant (repeated 2–5 sec sprint bouts, 30–60 sec recovery) requiring vertical jump power, lateral quickness, and aerobic recovery capacity. Physical demands: 150–200 directional changes per game, repeated vertical jump output, upper body for post play and screening. Training priorities: 1) Plyometrics (box jumps, depth jumps for RSI), 2) Lateral COD mechanics (defensive slides, 5-10-5 drill), 3) Hip hinge strength (trap bar deadlift, Romanian deadlift), 4) Aerobic base during offseason for repeat sprint recovery. Warm-up should include ball-handling with defensive slides to prime the CNS for game movements.',
    metadata: { sport: 'basketball' },
  },
  {
    title: 'Soccer — Physical Demands and Training',
    content: 'Soccer outfield players cover 7–10 miles per match across all intensities. Demands: aerobic base (VO2max ≥55 mL/kg/min), 30–40 maximal sprints per match, and deceleration mechanics (highest ACL injury risk is during deceleration, not acceleration). Training priorities: 1) Aerobic base — tempo runs at 70–80% max HR, 2) Sprint development — maximal sprint mechanics, flying 30s, 3) Deceleration training — controlled landing, A-skip deceleration, 4) Rotational core for kicking mechanics. ACL prevention: Nordic hamstring curls are evidence-based (50% ACL reduction). Highest injury risk: match day +1 and −1.',
    metadata: { sport: 'soccer' },
  },
  {
    title: 'Gym / Strength Training — Programming',
    content: 'General gym training priorities depend on goal: Hypertrophy (8–12 reps, 3–4 sets, 65–80% 1RM, 60–90sec rest), Strength (1–6 reps, 4–6 sets, 80–95% 1RM, 3–5min rest), Power (1–5 reps explosive, 70–85% 1RM, full recovery 3–5min). Big 3 compound movements (squat, deadlift, bench press) form the foundation. Minimum frequency for muscle group stimulation: 2× for maintenance, 3–4× for hypertrophy (with different exercises/angles). For advanced lifters: auto-regulation (RPE-based loading) outperforms fixed percentage loading as daily readiness varies ±10–15%.',
    metadata: { sport: 'gym strength weightlifting' },
  },
  {
    title: 'Running and Track — Training Demands',
    content: 'Running training organized by zones based on HR or pace. Zone 1–2 (60–75% max HR): aerobic base, should be 80% of total training volume. Zone 3 (75–85%): tempo, lactate threshold development. Zone 4–5 (85–95%+): VO2max intervals, race pace. Polarized training model (80% easy, 20% hard) outperforms moderate-intensity-only training for endurance adaptation. Injury prevention: hip extension strength and single-leg stability reduce overuse injuries. Strength training 2×/week reduces injury risk by 50% in distance runners. Ground contact time <200ms is a marker of efficient running mechanics.',
    metadata: { sport: 'running track endurance' },
  },
  {
    title: 'Cycling — Physical Demands and Training',
    content: 'Cycling is primarily oxidative with glycolytic demands on climbs and sprints. Key metrics: FTP (Functional Threshold Power), power-to-weight ratio, VO2max. Training zones 1–5 mirror running zones by HR/power. Cadence training: high cadence (90–100 RPM) reduces muscle fatigue and builds cardiovascular efficiency; single-leg pedaling drills improve dead-spot elimination. Off-bike strength: hip extension (deadlift patterns), knee extension (leg press), core anti-rotation for power transfer. Cleat fit and saddle height are the #1 injury prevention variables — check before adding volume.',
    metadata: { sport: 'cycling' },
  },
  {
    title: 'Martial Arts and Combat Sports — Training',
    content: 'Combat sports demand strength, power (explosive striking force), cardiovascular endurance (mixed energy systems), and flexibility. Striking power is generated from the ground up: foot drive → hip rotation → shoulder turn → arm extension. Core rotational strength (Pallof press, cable rotation) directly transfers. Conditioning: mix of aerobic base (shadowboxing rounds at 60–70% HR) and high-intensity intervals (sparring, bag work at 90%+). Grip strength, cervical stability (neck bridges), and hip mobility for kicks are critical. Strength training 2×/week — heavy compound lifts (trap bar deadlift, overhead press) — without overloading CNS before sparring days.',
    metadata: { sport: 'martial arts combat boxing wrestling' },
  },
  {
    title: 'Snowboarding / Skiing — Training Demands',
    content: 'Snowboarding and skiing demand lower body strength under sustained isometric load (constant knee flexion), rotational core stability, and dynamic balance. Key qualities: 1) Lateral leg strength (skating movements, lateral lunges), 2) Isometric quad endurance (wall sits, sissy squat holds), 3) Rotational core (Russian twists, cable rotation), 4) Proprioception (single-leg BOSU work, unstable surface training). Off-season preparation: hip flexor length (limits stance depth), ankle mobility (key for boot responsiveness), and eccentric quad strength (descent loading). ACL and MCL injury prevention: same protocols as skiing — nordic hamstring curls + hip abductor strengthening.',
    metadata: { sport: 'snowboarding skiing' },
  },
  {
    title: 'CrossFit / HIIT — Training Demands',
    content: 'CrossFit and HIIT training combine aerobic capacity, strength, and skill in constantly varied high-intensity workouts. Primary adaptation: cardiovascular efficiency + metabolic conditioning. Programming considerations: 1) Technique must precede intensity — form breakdown under fatigue creates injury, 2) Scale load before scaling rep count, 3) Prioritize posterior chain strength (glute, hamstring) to offset anterior-dominant conditioning patterns, 4) Built-in rest: HIIT adaptations require 48hr recovery between max-intensity sessions. For athletes new to CrossFit: 3 sessions/week max in first 8 weeks. Overhead mobility is the most common limiting factor.',
    metadata: { sport: 'crossfit hiit' },
  },
  {
    title: 'Golf — Physical Demands and Training',
    content: 'Golf is a rotational power sport. Clubhead speed is generated by the kinetic chain: ground force → hip rotation → thoracic rotation → shoulder → arm → club. Training priorities: 1) Hip dissociation (rotate hips independent of shoulders — anti-rotation core work), 2) Thoracic mobility (thoracic rotation stretches, foam roller extensions), 3) Glute and hip strength (drives ground force production), 4) Shoulder external rotation and scapular stability (prevents impingement from repetitive swing), 5) Core anti-lateral flexion (side planks, Pallof press). Lower back is the #1 injury site — avoid heavy axial loading without established hip mobility and core stability first.',
    metadata: { sport: 'golf' },
  },
]

const REHAB_PROTOCOLS = [
  {
    title: 'Knee Injury — Programming Modifications',
    content: 'For athletes with knee injuries (ACL, meniscus, patellofemoral syndrome, general knee pain): AVOID — deep squats below 90° knee flexion, high-impact landing tasks without progressions, exercises that cause knee valgus (knees caving inward), running on hard surfaces during acute phase. PRIORITIZE — terminal knee extensions (VMO activation), straight-leg raises, hip abductor and external rotator strengthening (reduces valgus stress), single-leg press at safe ROM (start at 60° and increase gradually), step-ups, wall sits at 45–60°. Progression: regain full ROM → restore single-leg strength to 90% of contralateral → add plyometrics last. Swelling = immediate load reduction signal.',
    metadata: { restriction_area: 'knee', injury: 'acl meniscus patellofemoral' },
  },
  {
    title: 'Lower Back / SI Joint — Programming Modifications',
    content: 'For athletes with lower back or SI joint issues: AVOID — loaded spine flexion (crunches, sit-ups, rounded-back deadlifts), heavy axial loading during flare-ups, rotation under load without established core stability. PRIORITIZE — McGill Big 3 (bird dog, curl-up modified, side plank) for motor control, hip hinge with neutral spine (Romanian deadlift with perfect form), glute strengthening to reduce lumbar compressive load, thoracic mobility work. NEVER skip: diaphragmatic breathing and core bracing education — most back pain athletes are chronic breath-holders. SI joint specifically: add hip flexor stretching and piriformis work, single-leg exercises to identify and address side asymmetry.',
    metadata: { restriction_area: 'lower back', injury: 'lower_back si_joint disc' },
  },
  {
    title: 'Shoulder Injury — Programming Modifications',
    content: 'For athletes with shoulder injuries (rotator cuff, impingement, labrum, AC joint): AVOID — behind-the-neck press, upright rows, internal rotation under load, overhead pressing with winging scapula, kipping pull-ups, behind-neck pulldowns. PRIORITIZE — rotator cuff isolation (external rotation with band/cable, prone Y/T/W), serratus anterior activation (wall slides, push-up plus), scapular stability before any overhead movement, face pulls (3×15 daily), band pull-aparts (3×20 daily). For impingement: chest-to-bar movements preferred over overhead press. For labrum: avoid positions of apprehension (90°/90° external rotation under load). Maintain pressing-to-pulling volume ratio of 1:2 minimum for shoulder health.',
    metadata: { restriction_area: 'shoulder', injury: 'rotator_cuff impingement labrum' },
  },
  {
    title: 'Hip Injury — Programming Modifications',
    content: 'For athletes with hip injuries (labrum, hip flexor strain, FAI, hip bursitis): AVOID — deep hip flexion beyond comfortable range, loaded single-leg work in end-range flexion, hip impingement positions (flexion + internal rotation + load combined), aggressive stretching during acute phase. PRIORITIZE — 90/90 hip rotations for external rotation mobility, pigeon pose held 90 sec, hip flexor progressive lengthening (kneeling lunge holds), glute medius strengthening (clamshells, lateral band walks), short-arc hip flexor strengthening once acute phase resolved. FAI: avoid squat below parallel and loaded hip flexion past 90°. Hip flexor strains: isometric holds first, then concentric, eccentric loading last.',
    metadata: { restriction_area: 'hip', injury: 'labrum hip_flexor fai bursitis' },
  },
  {
    title: 'Ankle Injury — Programming Modifications',
    content: 'For athletes with ankle injuries (sprain, chronic instability, Achilles tendinopathy): AVOID — high-impact landing without cleared progression, unstable surface training during acute phase, aggressive dorsiflexion loading before tissue healing, excessive calf loading with Achilles tendinopathy (heel drops are therapeutic, not contraindicated in sub-acute phase). PRIORITIZE — proprioception retraining (single-leg balance eyes closed, wobble board), peroneal strengthening (band eversion), calf raise progressions (bilateral → unilateral → weighted), tibialis anterior work, ankle circles 2×15 daily. For chronic instability: lateral hop progressions after demonstrating single-leg balance >30 sec. Achilles: eccentric heel drops on step (3×15 twice daily) are evidence-based.',
    metadata: { restriction_area: 'ankle', injury: 'sprain achilles instability' },
  },
  {
    title: 'Elbow / Wrist Injury — Programming Modifications',
    content: 'For athletes with elbow or wrist injuries (tennis elbow, golfer elbow, wrist sprains, carpal tunnel): AVOID — gripping exercises during acute phase, wrist extension under load (tennis elbow), wrist flexion under load (golfer elbow), push-ups on flat palms if wrist pain (use fists or push-up handles). PRIORITIZE — eccentric wrist curls (tennis elbow: eccentric wrist extension; golfer elbow: eccentric wrist flexion — 3×15 slow), grip strengthening with stress ball or rice bucket, forearm stretching (prayer stretch, reverse prayer), neutral grip exercises (hammer curls, neutral-grip push-up). Substitutions: tricep pushdowns instead of close-grip bench, lat pulldowns instead of pull-ups during acute phase.',
    metadata: { restriction_area: 'elbow wrist', injury: 'tennis_elbow lateral_epicondylitis wrist_sprain' },
  },
  {
    title: 'Neck and Cervical Injury — Programming Modifications',
    content: 'For athletes with neck or cervical spine issues: AVOID — heavy overhead pressing, behind-neck exercises, extreme cervical extension or flexion under load, weighted neck exercises during flare-up, contact sport exposure until cleared. PRIORITIZE — cervical stability over mobility initially (isometric holds in neutral), levator scapulae and upper trap stretching, thoracic mobility to reduce cervical compensation, scapular retraction and depression exercises (rows, face pulls), diaphragmatic breathing to reduce upper trap dominance. Substitutions: dumbbell floor press instead of overhead press, cable rows instead of barbell rows if neck tension during loading. Monitor: any radiation into arms or hands = refer to PT immediately.',
    metadata: { restriction_area: 'neck', injury: 'cervical disc neck_strain' },
  },
]

// ─── Types ─────────────────────────────────────────────────────────────────────

type SeedItem = {
  category: string
  title: string
  content: string
  metadata?: Record<string, unknown>
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Admin auth check
  const authHeader = request.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${process.env.ADMIN_SEED_SECRET}` &&
      process.env.NODE_ENV !== 'development') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = { seeded: 0, skipped: 0, errors: [] as string[] }

  try {
    // Build full seed list: principles + sport protocols + rehab protocols
    const staticItems: SeedItem[] = [
      ...TRAINING_PRINCIPLES.map(p => ({ ...p, category: 'training_principle' })),
      ...SPORT_PROTOCOLS.map(p => ({ ...p, category: 'sport_protocol' })),
      ...REHAB_PROTOCOLS.map(p => ({ ...p, category: 'rehab_protocol' })),
    ]

    // Also pull exercises from exercise_library
    const { data: exercises } = await getSupabaseAdmin()
      .from('exercise_library')
      .select('name_normalized, name_display, how, breathing, core, tip')
      .not('how', 'is', null)

    const exerciseItems: SeedItem[] = (exercises ?? []).map(e => ({
      category: 'exercise',
      title: e.name_display,
      content: [e.how, e.breathing, e.core, e.tip].filter(Boolean).join(' '),
      metadata: { name_normalized: e.name_normalized },
    }))

    const allItems = [...staticItems, ...exerciseItems]

    // Check which titles already exist to skip re-embedding
    const { data: existing } = await getSupabaseAdmin()
      .from('knowledge_items')
      .select('title')
    const existingTitles = new Set((existing ?? []).map(e => e.title))

    const toSeed = allItems.filter(item => !existingTitles.has(item.title))
    if (!toSeed.length) {
      return Response.json({ message: 'All items already seeded', ...results })
    }

    // Embed in batches of 100
    const BATCH = 100
    for (let i = 0; i < toSeed.length; i += BATCH) {
      const batch = toSeed.slice(i, i + BATCH)
      const texts = batch.map(item => `${item.title}: ${item.content}`)
      const embeddings = await embedBatch(texts)

      const rows = batch.map((item, idx) => ({
        category: item.category,
        title: item.title,
        content: item.content,
        metadata: item.metadata ?? {},
        embedding: embeddings[idx],
      }))

      const { error } = await getSupabaseAdmin()
        .from('knowledge_items')
        .upsert(rows, { onConflict: 'title' })

      if (error) {
        results.errors.push(`Batch ${i / BATCH + 1}: ${error.message}`)
      } else {
        results.seeded += batch.length
      }
    }

    // Log token usage estimate (1536-dim embeddings, ~200 tokens per item average)
    const estimatedTokens = toSeed.length * 200
    logTokens({
      operation: 'seed_knowledge',
      route: '/api/admin/seed-knowledge',
      input_tokens: estimatedTokens,
      output_tokens: 0,
      user_id: null,
    })

    return Response.json({
      message: `Seeded ${results.seeded} knowledge items`,
      total: allItems.length,
      ...results,
    })
  } catch (err) {
    console.error('Seed error:', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

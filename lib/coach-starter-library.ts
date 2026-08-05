// The standard exercises and workouts every new coach finds waiting in their
// library, so they never open an empty screen.
//
// PROPOSAL. Nothing is seeded to any coach until Will approves this list.
//
// Chosen to be old-school and universally recognised: a coach of twenty years
// and a coach of two should both look at this and see nothing unfamiliar. No
// novelty movements, no brand-name variations, nothing that needs explaining
// before it can be used.
//
// The names here are matched against the existing 2,050-row exercise_library by
// name_normalized. That is the whole point: these movements are already written,
// already have coaching cues, and mostly already have narration audio, so
// seeding a coach costs nothing. Generation is only ever a fallback for a gap.

/** Same normaliser the rest of the app uses to key exercise_library. */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

export type StarterGroup = {
  key: string
  label: string
  exercises: string[]
}

export const STARTER_EXERCISES: StarterGroup[] = [
  {
    key: 'lower',
    label: 'Lower Body',
    exercises: [
      'Barbell Back Squat',
      'Barbell Front Squat',
      'Goblet Squat',
      'Conventional Deadlift',
      'Romanian Deadlift',
      'Trap Bar Deadlift',
      'Bulgarian Split Squat',
      'Walking Lunge',
      'Leg Press',
      'Lying Leg Curl',
      'Leg Extension',
      'Barbell Hip Thrust',
      'Standing Calf Raise',
    ],
  },
  {
    key: 'push',
    label: 'Upper Body Push',
    exercises: [
      'Barbell Bench Press',
      'Incline Barbell Bench Press',
      'Dumbbell Bench Press',
      'Machine Chest Press',
      'Barbell Overhead Press',
      'Dumbbell Shoulder Press',
      'Dip',
      'Push-Up',
      'Dumbbell Lateral Raise',
      'Cable Triceps Pushdown',
      'Skull Crusher',
    ],
  },
  {
    key: 'pull',
    label: 'Upper Body Pull',
    exercises: [
      'Pull-Up',
      'Chin-Up',
      'Lat Pulldown',
      'Bent-Over Barbell Row',
      'Single-Arm Dumbbell Row',
      'Seated Cable Row',
      'Face Pull',
      'Barbell Curl',
      'Dumbbell Curl',
      'Hammer Curl',
    ],
  },
  {
    key: 'core',
    label: 'Core and Abs',
    // Two halves on purpose. The first six are bracing and anti-rotation work,
    // which is what a coach programmes for trunk stability. The rest are the
    // plain, old-school ab movements every client already knows by name, so a
    // coach can find "crunch" where they expect to find it.
    exercises: [
      'Plank',
      'Side Plank',
      'Hanging Leg Raise',
      'Cable Crunch',
      'Dead Bug',
      'Pallof Press',
      'Crunch',
      'Sit-Up',
      'Reverse Crunch',
      'Bicycle Crunch',
      'Lying Leg Raise',
      'Russian Twist',
      'Flutter Kick',
      'Mountain Climber',
      'V-Up',
      'Ab Wheel Rollout',
    ],
  },
  {
    key: 'carry',
    label: 'Carries and Conditioning',
    exercises: [
      'Farmer Carry',
      'Kettlebell Swing',
    ],
  },
]

export const ALL_STARTER_EXERCISES: string[] =
  STARTER_EXERCISES.flatMap(g => g.exercises)

export type StarterWorkout = {
  key: string
  name: string
  /** One line a coach reads to know when to use it. */
  purpose: string
  exercises: string[]
}

// Recognisable templates, not clever programming. A coach should open one,
// understand it instantly, and start editing rather than studying it.
export const STARTER_WORKOUTS: StarterWorkout[] = [
  {
    key: 'full_body_a',
    name: 'Full Body A',
    purpose: 'Beginner or returning client, twice a week alongside Full Body B.',
    exercises: ['Barbell Back Squat', 'Barbell Bench Press', 'Bent-Over Barbell Row', 'Plank'],
  },
  {
    key: 'full_body_b',
    name: 'Full Body B',
    purpose: 'The alternate day to Full Body A. Hinge and vertical pressing.',
    exercises: ['Romanian Deadlift', 'Barbell Overhead Press', 'Lat Pulldown', 'Dead Bug'],
  },
  {
    key: 'push',
    name: 'Push Day',
    purpose: 'Chest, shoulders and triceps. Day one of a push, pull, legs split.',
    exercises: ['Barbell Bench Press', 'Dumbbell Shoulder Press', 'Incline Barbell Bench Press', 'Dumbbell Lateral Raise', 'Cable Triceps Pushdown'],
  },
  {
    key: 'pull',
    name: 'Pull Day',
    purpose: 'Back and biceps. Day two of a push, pull, legs split.',
    exercises: ['Pull-Up', 'Bent-Over Barbell Row', 'Seated Cable Row', 'Face Pull', 'Barbell Curl'],
  },
  {
    key: 'legs',
    name: 'Leg Day',
    purpose: 'Day three of a push, pull, legs split.',
    exercises: ['Barbell Back Squat', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Lying Leg Curl', 'Standing Calf Raise'],
  },
  {
    key: 'upper',
    name: 'Upper Body',
    purpose: 'Day one of an upper, lower split. Four days a week.',
    exercises: ['Barbell Bench Press', 'Bent-Over Barbell Row', 'Barbell Overhead Press', 'Lat Pulldown', 'Dumbbell Curl'],
  },
  {
    key: 'lower',
    name: 'Lower Body',
    purpose: 'Day two of an upper, lower split.',
    exercises: ['Barbell Back Squat', 'Conventional Deadlift', 'Leg Press', 'Barbell Hip Thrust', 'Standing Calf Raise'],
  },
  {
    key: 'conditioning',
    name: 'Athletic Conditioning Circuit',
    purpose: 'Finisher or standalone conditioning day. Minimal rest, move through it.',
    exercises: ['Kettlebell Swing', 'Goblet Squat', 'Push-Up', 'Farmer Carry', 'Plank'],
  },
]

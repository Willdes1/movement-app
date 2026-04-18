const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const SKATER_PLAN = [
  {
    day: 'Mon',
    label: 'Lower Body Strength',
    type: 'workout',
    color: 'var(--accent)',
    movements: ['Goblet Squat 3×8', 'DB RDL 3×10', 'Step-Up 3×8/side', 'Clamshell 2×15'],
    duration: '50 min',
  },
  {
    day: 'Tue',
    label: 'Mobility + Core',
    type: 'warmup',
    color: 'var(--orange)',
    movements: ['McGill Big 3', 'Cat-Cow', 'Dead Bug 3×8', 'Pallof Press 3×10'],
    duration: '30 min',
  },
  {
    day: 'Wed',
    label: 'Upper Body',
    type: 'workout',
    color: 'var(--accent)',
    movements: ['DB Bench 3×8', 'Single-Arm Row 3×10', 'Lat Pulldown 3×10', 'Face Pull 3×15'],
    duration: '45 min',
  },
  {
    day: 'Thu',
    label: 'Active Recovery',
    type: 'cooldown',
    color: 'var(--yellow)',
    movements: ['10 min walk', 'Hip flexor stretch', 'Pigeon pose', 'Box breathing'],
    duration: '20 min',
  },
  {
    day: 'Fri',
    label: 'Full Body Power',
    type: 'workout',
    color: 'var(--accent)',
    movements: ['Trap Bar Deadlift 4×5', 'BSS Split 3×8', 'DB Push Press 3×6', 'Farmer Carry 3×30m'],
    duration: '55 min',
  },
  {
    day: 'Sat',
    label: 'On-Ice / Skill',
    type: 'morning',
    color: 'var(--green)',
    movements: ['Sport-specific practice', 'Edge work', 'Crossovers', 'Stops & starts'],
    duration: '60–90 min',
  },
  {
    day: 'Sun',
    label: 'Rest',
    type: 'rest',
    color: 'var(--text-dim)',
    movements: ['Full rest day', 'Light walk optional', 'Sleep 8+ hours'],
    duration: '—',
  },
]

const TYPE_BG: Record<string, string> = {
  workout: 'var(--accent-bg)',
  warmup: 'var(--orange-bg)',
  cooldown: 'var(--yellow-bg)',
  morning: 'var(--green-bg)',
  rest: 'rgba(120,130,148,0.06)',
}
const TYPE_BORDER: Record<string, string> = {
  workout: 'var(--accent-border)',
  warmup: 'var(--orange-border)',
  cooldown: 'var(--yellow-border)',
  morning: 'var(--green-border)',
  rest: 'var(--border)',
}

export default function PlanPage() {
  const todayIdx = (new Date().getDay() + 6) % 7 // Mon=0

  return (
    <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Weekly Plan</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 6 }}>Skater performance template</p>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 24, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'inline-block' }}>
        Personalized plans coming soon — set up your profile first
      </div>

      {/* Day scroll strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {DAYS.map((d, i) => (
          <div
            key={d}
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 10,
              background: i === todayIdx ? 'var(--accent)' : 'var(--surface)',
              border: `1px solid ${i === todayIdx ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: i === todayIdx ? '#fff' : 'var(--text-dim)' }}>{d}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SKATER_PLAN.map((day, i) => (
          <div
            key={day.day}
            style={{
              background: i === todayIdx ? TYPE_BG[day.type] : 'var(--surface)',
              border: `1px solid ${i === todayIdx ? TYPE_BORDER[day.type] : 'var(--border)'}`,
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: day.color,
                  minWidth: 28,
                  letterSpacing: '0.04em',
                }}>
                  {day.day}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{day.label}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{day.duration}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {day.movements.map((m, mi) => (
                <span
                  key={mi}
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-mid)',
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { loadProfile } from '@/lib/storage'
import type { UserProfile } from '@/lib/types'

type Activity = { name: string; level: string }
const LEVELS = ['beginner', 'intermediate', 'expert', 'elite', 'pro'] as const

const LEVEL_COLOR: Record<string, { color: string; bg: string; border: string }> = {
  beginner:     { color: 'var(--text-dim)',  bg: 'var(--surface2)',    border: 'var(--border)' },
  intermediate: { color: 'var(--blue)',      bg: 'var(--blue-bg)',     border: 'var(--blue-border)' },
  expert:       { color: 'var(--green)',     bg: 'var(--green-bg)',    border: 'var(--green-border)' },
  elite:        { color: 'var(--purple)',    bg: 'var(--purple-bg)',   border: 'var(--purple-border)' },
  pro:          { color: 'var(--accent)',    bg: 'var(--accent-bg)',   border: 'var(--accent-border)' },
}

export default function AccountPage() {
  const { user, isAdmin, role, signOut, loading, effectiveUserId } = useAuth()
  const userId = effectiveUserId ?? user?.id ?? ''
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile>({})
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')
  const [promoError, setPromoError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Training background
  const [trainingLevel, setTrainingLevel] = useState('')
  const [workoutBackground, setWorkoutBackground] = useState('')
  const [activities, setActivities] = useState<Activity[]>([])
  const [backgroundSaving, setBackgroundSaving] = useState(false)
  const [backgroundSaved, setBackgroundSaved] = useState(false)
  const [newActivityName, setNewActivityName] = useState('')
  const [newActivityLevel, setNewActivityLevel] = useState<string>('beginner')

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [user, loading, router])

  useEffect(() => {
    const p = loadProfile() as UserProfile | null
    if (p) setProfile(p)
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('avatar_url, training_level, workout_background, activities')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url)
        setTrainingLevel(data?.training_level ?? '')
        setWorkoutBackground(data?.workout_background ?? '')
        setActivities(Array.isArray(data?.activities) ? data.activities : [])
      })
  }, [user])

  async function uploadAvatar(file: File) {
    if (!user) return
    setAvatarLoading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/avatar.${ext}`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
      setAvatarUrl(publicUrl)
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setAvatarLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    router.push('/auth')
  }

  async function redeemCode() {
    if (!promoCode.trim() || !user) return
    setPromoLoading(true)
    setPromoError('')
    setPromoMsg('')
    const code = promoCode.trim().toUpperCase()
    try {
      const { data: existing } = await supabase
        .from('promo_redemptions').select('id').eq('user_id', userId).single()
      if (existing) { setPromoError('You have already redeemed a promo code.'); return }

      const { data: promo } = await supabase
        .from('promo_codes').select('id, role, max_uses, uses, expires_at').eq('code', code).single()
      if (!promo) { setPromoError('Code not found. Check spelling and try again.'); return }

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        setPromoError('This code has expired.'); return
      }

      if (promo.max_uses > 0) {
        const { count } = await supabase
          .from('promo_redemptions').select('*', { count: 'exact', head: true }).eq('code_id', promo.id)
        if ((count ?? 0) >= promo.max_uses) { setPromoError('This code has reached its maximum uses.'); return }
      }

      await supabase.from('profiles').update({ role: promo.role }).eq('id', userId)
      await supabase.from('promo_redemptions').insert({ user_id: userId, code_id: promo.id })

      setPromoMsg('Code redeemed! Refreshing your account…')
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      setPromoError('Something went wrong. Try again.')
    } finally {
      setPromoLoading(false)
    }
  }

  async function saveBackground() {
    if (!user) return
    setBackgroundSaving(true)
    await supabase.from('profiles').update({
      training_level: trainingLevel || null,
      workout_background: workoutBackground.trim() || null,
      activities,
    }).eq('id', userId)
    setBackgroundSaving(false)
    setBackgroundSaved(true)
    setTimeout(() => setBackgroundSaved(false), 2500)
  }

  function addActivity() {
    const name = newActivityName.trim()
    if (!name) return
    setActivities(prev => [...prev, { name, level: newActivityLevel }])
    setNewActivityName('')
    setNewActivityLevel('beginner')
  }

  function removeActivity(index: number) {
    setActivities(prev => prev.filter((_, i) => i !== index))
  }

  if (loading || !user) return null

  const firstName = profile?.name?.split(' ')[0]
  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() ?? '?'

  const sports = profile?.sport ? profile.sport.split(', ') : []
  const goals = profile?.goal ? profile.goal.split(', ') : []
  const profileComplete = !!(profile?.name && profile?.sport && profile?.goal)
  const backgroundComplete = !!(trainingLevel)

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>

      {/* Avatar + greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{ position: 'relative', width: 60, height: 60, flexShrink: 0, cursor: 'pointer' }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 4px 16px var(--accent-shadow)', display: 'block' }}
            />
          ) : (
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: avatarLoading ? 14 : 22, fontWeight: 900, color: '#fff',
              boxShadow: '0 4px 16px var(--accent-shadow)',
            }}>
              {avatarLoading ? '…' : initials}
            </div>
          )}
          <div style={{
            position: 'absolute', bottom: 0, right: 0, width: 20, height: 20,
            borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
          }}>
            {avatarLoading ? '·' : '✎'}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }}
          />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 2 }}>
            {firstName ? `Hey, ${firstName}` : 'Your Account'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{user.email}</p>
        </div>
      </div>

      {/* Plan tier badge */}
      {(() => {
        const tiers = {
          admin: { label: 'Admin',      color: 'var(--orange)', bg: 'rgba(255,150,50,0.1)', border: 'rgba(255,150,50,0.25)' },
          beta:  { label: 'Beta Access',color: 'var(--green)',  bg: 'rgba(78,201,122,0.1)', border: 'rgba(78,201,122,0.25)' },
          ff:    { label: 'F&F Beta',   color: '#00b4ff',       bg: 'rgba(0,180,255,0.1)',  border: 'rgba(0,180,255,0.25)' },
          coach: { label: 'Coach',      color: '#a78bfa',       bg: 'rgba(167,139,250,0.1)',border: 'rgba(167,139,250,0.25)' },
          free:  { label: 'Free Plan',  color: 'var(--accent)', bg: 'var(--accent-bg)',     border: 'var(--accent-border)' },
        }
        const tier = tiers[role] ?? tiers.free
        return (
          <div style={{ marginBottom: 20 }}>
            <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: tier.bg, border: `1px solid ${tier.border}`, color: tier.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {tier.label}
            </span>
            {role === 'free' && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
                Upgrade for full AI plan customization — <span style={{ color: 'var(--accent)', fontWeight: 700 }}>coming soon</span>
              </p>
            )}
          </div>
        )
      })()}

      {/* Promo code redemption — free users only */}
      {role === 'free' && (
        <div style={{ marginBottom: 20, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Have a promo code?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, letterSpacing: '0.06em', fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              onClick={redeemCode}
              disabled={promoLoading || !promoCode.trim()}
              style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: promoLoading || !promoCode.trim() ? 'default' : 'pointer', opacity: promoLoading || !promoCode.trim() ? 0.5 : 1 }}
            >
              {promoLoading ? '…' : 'Redeem'}
            </button>
          </div>
          {promoMsg && <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 8, fontWeight: 600 }}>{promoMsg}</p>}
          {promoError && <p style={{ fontSize: 12, color: 'rgba(255,100,100,0.9)', marginTop: 8 }}>{promoError}</p>}
        </div>
      )}

      {/* Profile summary card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-mid)' }}>Athlete Profile</span>
          {profileComplete
            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#4ec97a' }}>✓ Complete</span>
            : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Incomplete</span>}
        </div>
        <SummaryRow label="Name"     value={profile?.name ?? 'Not set'}                                          dim={!profile?.name} />
        <SummaryRow label="Sport(s)" value={sports.length ? sports.join(', ') : 'Not set'}                      dim={!sports.length} />
        <SummaryRow label="Goal(s)"  value={goals.length ? goals.slice(0,2).join(', ') + (goals.length > 2 ? '…' : '') : 'Not set'} dim={!goals.length} />
        <SummaryRow label="Days/week" value={profile?.daysPerWeek ? `${profile.daysPerWeek} days` : 'Not set'}  dim={!profile?.daysPerWeek} last />
      </div>

      {/* ── Training Background card ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-mid)' }}>Training Background</span>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Helps the AI tailor your plan to your real experience level</p>
          </div>
          {backgroundComplete
            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#4ec97a', flexShrink: 0 }}>✓ Set</span>
            : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>Not set</span>}
        </div>

        <div style={{ padding: '16px' }}>

          {/* Training level */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Training Level
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LEVELS.map(level => {
                const active = trainingLevel === level
                const c = LEVEL_COLOR[level]
                return (
                  <button
                    key={level}
                    onClick={() => setTrainingLevel(active ? '' : level)}
                    style={{
                      padding: '8px 14px', borderRadius: 20,
                      border: `1px solid ${active ? c.border : 'var(--border)'}`,
                      background: active ? c.bg : 'var(--surface2)',
                      color: active ? c.color : 'var(--text-dim)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      textTransform: 'capitalize', letterSpacing: '0.04em',
                      touchAction: 'manipulation',
                    }}
                  >
                    {level}
                  </button>
                )
              })}
            </div>
            {trainingLevel && (
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
                {trainingLevel === 'beginner'     && 'Less than 1 year of consistent training.'}
                {trainingLevel === 'intermediate' && '1–3 years of training. Familiar with compound movements.'}
                {trainingLevel === 'expert'       && '3–5 years. Programs your own training with good technique.'}
                {trainingLevel === 'elite'        && 'Competitive athlete. Sport-specific periodization.'}
                {trainingLevel === 'pro'          && 'Professional or semi-professional athlete.'}
              </p>
            )}
          </div>

          {/* Workout background */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Workout Background
            </p>
            <textarea
              value={workoutBackground}
              onChange={e => setWorkoutBackground(e.target.value)}
              placeholder="Describe your training history — programs you've followed, lifting style, sports background, anything the AI should know."
              rows={4}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface2)',
                color: 'var(--text)', fontSize: 13, outline: 'none',
                resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Sport / activity background */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Sport & Activity Background
            </p>

            {/* Existing activities */}
            {activities.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {activities.map((act, i) => {
                  const c = LEVEL_COLOR[act.level] ?? LEVEL_COLOR.beginner
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{act.name}</span>
                      </div>
                      <span style={{
                        padding: '3px 10px', borderRadius: 12,
                        fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                        letterSpacing: '0.05em',
                        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                        flexShrink: 0,
                      }}>
                        {act.level}
                      </span>
                      <button
                        onClick={() => removeActivity(i)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-dim)',
                          cursor: 'pointer', fontSize: 16, padding: '4px 6px',
                          lineHeight: 1, flexShrink: 0, touchAction: 'manipulation',
                        }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add new activity */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={newActivityName}
                onChange={e => setNewActivityName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addActivity() } }}
                placeholder="e.g. Skateboarding, Golf, MMA…"
                style={{
                  flex: 1, minWidth: 140, padding: '9px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <select
                value={newActivityLevel}
                onChange={e => setNewActivityLevel(e.target.value)}
                style={{
                  padding: '9px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
              <button
                onClick={addActivity}
                disabled={!newActivityName.trim()}
                style={{
                  padding: '9px 16px', borderRadius: 8, border: 'none',
                  background: newActivityName.trim() ? 'var(--accent)' : 'var(--surface2)',
                  color: newActivityName.trim() ? '#fff' : 'var(--text-dim)',
                  fontSize: 13, fontWeight: 700, cursor: newActivityName.trim() ? 'pointer' : 'default',
                  touchAction: 'manipulation', whiteSpace: 'nowrap',
                }}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={saveBackground}
            disabled={backgroundSaving}
            style={{
              width: '100%', padding: '13px', borderRadius: 10,
              background: backgroundSaved ? 'var(--green-bg)' : 'var(--accent)',
              color: backgroundSaved ? 'var(--green)' : '#fff',
              fontWeight: 700, fontSize: 14, cursor: backgroundSaving ? 'default' : 'pointer',
              transition: 'background 0.3s, color 0.3s', touchAction: 'manipulation',
              border: backgroundSaved ? '1px solid var(--green-border)' : 'none',
            } as React.CSSProperties}
          >
            {backgroundSaving ? 'Saving…' : backgroundSaved ? '✓ Saved' : 'Save Background'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ActionButton
          label={profileComplete ? 'Edit Profile' : 'Set Up Profile'}
          sub={profileComplete ? 'Update your sport, goals, and preferences' : 'Complete your profile to get a personalized plan'}
          icon="✏️"
          onClick={() => router.push('/profile')}
          primary={!profileComplete}
        />

        {isAdmin && (
          <ActionButton
            label="Admin Panel"
            sub="Manage todos, ideas, promo codes, and users"
            icon="⚙️"
            onClick={() => router.push('/admin')}
          />
        )}

        <ActionButton
          label="Sign Out"
          sub={`Signed in as ${user.email}`}
          icon="→"
          onClick={handleSignOut}
          danger
        />
      </div>
    </div>
  )
}

function SummaryRow({ label, value, dim = false, last = false }: { label: string; value: string; dim?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: dim ? 'var(--text-dim)' : 'var(--text)', textAlign: 'right', maxWidth: 220 }}>{value}</span>
    </div>
  )
}

function ActionButton({ label, sub, icon, onClick, primary = false, danger = false }: {
  label: string; sub: string; icon: string; onClick: () => void; primary?: boolean; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '14px 16px', borderRadius: 14,
        border: `1px solid ${danger ? 'rgba(255,77,77,0.2)' : primary ? 'var(--accent-border)' : 'var(--border)'}`,
        background: primary ? 'var(--accent-bg)' : 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: danger ? 'rgba(255,100,100,0.9)' : primary ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{sub}</div>
      </div>
      <span style={{ color: 'var(--text-dim)', fontSize: 16 }}>›</span>
    </button>
  )
}

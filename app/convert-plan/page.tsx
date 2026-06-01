'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Request = {
  id: string
  file_name: string
  description: string | null
  status: 'pending' | 'in_review' | 'completed' | 'rejected'
  admin_notes: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending Review',  color: 'var(--orange)' },
  in_review: { label: 'In Review',       color: 'var(--accent)' },
  completed: { label: 'Completed',       color: 'var(--green)' },
  rejected:  { label: 'Not Accepted',    color: 'var(--text-dim)' },
}

export default function ConvertPlanPage() {
  const { user, loading: authLoading, effectiveUserId } = useAuth()
  const userId = effectiveUserId ?? user?.id ?? ''
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [requests, setRequests] = useState<Request[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    supabase
      .from('plan_conversion_requests')
      .select('id, file_name, description, status, admin_notes, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRequests((data ?? []) as Request[]))
  }, [user, userId, success])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !user) return
    setUploading(true)
    setError('')

    try {
      // Upload file to Supabase storage
      const path = `conversions/${userId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(path, file)

      if (uploadError) throw new Error(uploadError.message)

      // Create the request record
      const { error: insertError } = await supabase
        .from('plan_conversion_requests')
        .insert({
          user_id: userId,
          file_name: file.name,
          storage_path: path,
          description: description.trim() || null,
          status: 'pending',
        })

      if (insertError) throw new Error(insertError.message)

      setSuccess(true)
      setFile(null)
      setDescription('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (authLoading) return null

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 480, margin: '0 auto' }}>
      <button
        onClick={() => router.back()}
        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 20 }}
      >
        ← Back
      </button>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>Concierge Service</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8 }}>Convert My Plan</h1>
        <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>
          Have an old workout program from a trainer, app, or YouTube? Upload it and we&apos;ll convert it into a fully structured in-app program — with coaching cues, phases, and calendar integration.
        </p>
      </div>

      {/* How it works */}
      <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>How it works</p>
        {[
          { step: '1', text: 'Upload your PDF or DOCX workout plan' },
          { step: '2', text: 'Describe what you want (optional)' },
          { step: '3', text: 'Will reviews and converts it (usually within 24h)' },
          { step: '4', text: 'The program appears in your Programs library' },
        ].map(item => (
          <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>
              {item.step}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, paddingTop: 2 }}>{item.text}</p>
          </div>
        ))}
      </div>

      {success && (
        <div style={{ padding: '16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>Request submitted!</p>
          <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>You&apos;ll hear back within 24 hours. Track your request status below.</p>
        </div>
      )}

      {/* Upload form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
        {/* File drop zone */}
        <div>
          <label style={{ fontWeight: 700, color: 'var(--text-mid)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>
            Workout File (PDF or DOCX)
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '24px', borderRadius: 14, border: `2px dashed ${file ? 'var(--accent)' : 'var(--border)'}`,
              background: file ? 'var(--accent-bg)' : 'var(--surface)',
              textAlign: 'center', cursor: 'pointer',
            }}
          >
            {file ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>📄 {file.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{(file.size / 1024).toFixed(0)} KB · Click to change</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 28, marginBottom: 8 }}>📤</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Tap to upload your plan</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>PDF or DOCX · Max 10MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setSuccess(false) } }}
            style={{ display: 'none' }}
          />
        </div>

        {/* Description */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Tell us about it <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. 'This is my old Athlean-X plan, 4 days a week, I want to keep the same exercises but add coaching cues and fit it into a 13-week structure'"
            rows={3}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5 }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--red)', padding: '10px 14px', background: 'rgba(255,77,77,0.08)', borderRadius: 8, border: '1px solid rgba(255,77,77,0.2)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!file || uploading}
          style={{
            padding: '14px', borderRadius: 12, border: 'none',
            background: !file || uploading ? 'var(--surface2)' : 'var(--accent)',
            color: !file || uploading ? 'var(--text-dim)' : '#fff',
            fontWeight: 800, fontSize: 15, cursor: !file || uploading ? 'default' : 'pointer',
          }}
        >
          {uploading ? 'Uploading…' : 'Submit Conversion Request'}
        </button>
      </form>

      {/* Existing requests */}
      {requests.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>Your Requests</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map(req => {
              const statusInfo = STATUS_LABEL[req.status]
              return (
                <div key={req.id} style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>📄 {req.file_name}</p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statusInfo.color, background: `${statusInfo.color}15`, padding: '2px 8px', borderRadius: 10, border: `1px solid ${statusInfo.color}30`, flexShrink: 0, marginLeft: 8 }}>
                      {statusInfo.label}
                    </span>
                  </div>
                  {req.description && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, lineHeight: 1.5 }}>{req.description}</p>}
                  {req.admin_notes && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Note from Will</p>
                      <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>{req.admin_notes}</p>
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                    {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

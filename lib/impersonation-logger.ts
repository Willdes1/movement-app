import { supabase } from './supabase'

export async function openImpersonationSession({
  adminId,
  targetUserId,
  durationMinutes,
  reason,
}: {
  adminId: string
  targetUserId: string
  durationMinutes: number
  reason?: string
}): Promise<string> {
  const { data, error } = await supabase
    .from('admin_impersonation_log')
    .insert({ admin_id: adminId, target_user_id: targetUserId, duration_chosen: durationMinutes, reason: reason ?? null })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to open session: ${error?.message}`)
  return data.id as string
}

export async function closeImpersonationSession({
  sessionId,
  endedBy,
}: {
  sessionId: string
  endedBy: 'admin_manual' | 'auto_timeout' | 'session_end'
}): Promise<void> {
  await supabase
    .from('admin_impersonation_log')
    .update({ ended_at: new Date().toISOString(), ended_by: endedBy })
    .eq('id', sessionId)
}

export async function logImpersonationAction({
  sessionId,
  adminId,
  targetUserId,
  tableName,
  rowId,
  operation,
  beforeState,
  afterState,
}: {
  sessionId: string
  adminId: string
  targetUserId: string
  tableName: string
  rowId: string
  operation: 'insert' | 'update' | 'delete'
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
}): Promise<string> {
  const { data, error } = await supabase
    .from('admin_impersonation_actions')
    .insert({
      session_id: sessionId,
      admin_id: adminId,
      target_user_id: targetUserId,
      table_name: tableName,
      row_id: rowId,
      operation,
      before_state: beforeState,
      after_state: afterState,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to log action: ${error?.message}`)
  return data.id as string
}

export async function queueSoftDelete({
  actionId,
  tableName,
  rowId,
  rowData,
}: {
  actionId: string
  tableName: string
  rowId: string
  rowData: Record<string, unknown>
}): Promise<void> {
  await supabase.from('admin_soft_delete_queue').insert({
    action_id: actionId,
    table_name: tableName,
    row_id: rowId,
    row_data: rowData,
  })
}

export async function reverseImpersonationAction({
  actionId,
  adminId,
}: {
  actionId: string
  adminId: string
}): Promise<{ success: boolean; message: string }> {
  const { data: action } = await supabase
    .from('admin_impersonation_actions')
    .select('*')
    .eq('id', actionId)
    .single()

  if (!action) return { success: false, message: 'Action not found' }
  if (action.reversed_at) return { success: false, message: 'Already reversed' }

  try {
    if (action.operation === 'update' && action.before_state) {
      const { error } = await supabase.from(action.table_name).update(action.before_state).eq('id', action.row_id)
      if (error) throw error
    } else if (action.operation === 'insert') {
      const { error } = await supabase.from(action.table_name).delete().eq('id', action.row_id)
      if (error) throw error
    } else if (action.operation === 'delete') {
      const { data: queue, error: qErr } = await supabase
        .from('admin_soft_delete_queue')
        .select('*')
        .eq('action_id', actionId)
        .is('restored_at', null)
        .single()
      if (qErr || !queue) return { success: false, message: 'Soft-delete entry not found or already restored' }
      if (new Date(queue.reversible_until) < new Date()) return { success: false, message: 'Reversal window expired (30 days)' }
      const { error: insErr } = await supabase.from(action.table_name).insert(queue.row_data)
      if (insErr) throw insErr
      await supabase
        .from('admin_soft_delete_queue')
        .update({ restored_at: new Date().toISOString(), restored_by: adminId })
        .eq('id', queue.id)
    } else {
      return { success: false, message: 'Unknown operation type' }
    }

    await supabase
      .from('admin_impersonation_actions')
      .update({ reversed_at: new Date().toISOString(), reversed_by: adminId })
      .eq('id', actionId)

    return { success: true, message: 'Reversed successfully' }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Reversal failed' }
  }
}

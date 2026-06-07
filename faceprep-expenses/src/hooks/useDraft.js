import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Autosave a claim form to the claim_drafts table.
 * Debounced — saves ~1.2s after the last change.
 *
 * Usage:
 *   const { saveDraft, deleteDraft } = useDraft(profileId, draftId, formState)
 */
export function useDraft(employeeId, draftId, formState, enabled = true) {
  const timer = useRef(null)
  const currentDraftId = useRef(draftId)

  const persist = useCallback(async (data) => {
    if (!employeeId || !enabled) return
    try {
      if (currentDraftId.current) {
        await supabase.from('claim_drafts')
          .update({ draft_data: data, updated_at: new Date().toISOString() })
          .eq('id', currentDraftId.current)
      } else {
        const { data: created } = await supabase.from('claim_drafts')
          .insert({ employee_id: employeeId, draft_data: data })
          .select().single()
        if (created) currentDraftId.current = created.id
      }
    } catch (e) { /* silent — autosave shouldn't interrupt */ }
  }, [employeeId, enabled])

  useEffect(() => {
    if (!enabled || !formState) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => persist(formState), 1200)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [formState, persist, enabled])

  const deleteDraft = useCallback(async () => {
    if (currentDraftId.current) {
      await supabase.from('claim_drafts').delete().eq('id', currentDraftId.current)
      currentDraftId.current = null
    }
  }, [])

  return { deleteDraft, getDraftId: () => currentDraftId.current }
}

export async function fetchDrafts(employeeId) {
  const { data } = await supabase.from('claim_drafts')
    .select('*').eq('employee_id', employeeId)
    .order('updated_at', { ascending: false })
  return data ?? []
}

export async function deleteDraftById(id) {
  await supabase.from('claim_drafts').delete().eq('id', id)
}

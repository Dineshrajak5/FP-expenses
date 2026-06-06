import { supabase } from './supabase'

/**
 * Process line-item decisions for a claim.
 *
 * Logic:
 * - Save status + note on every fuel/expense entry
 * - If ALL approved → move claim to next stage (pending_finance or approved)
 * - If ALL rejected → reject the claim
 * - If MIX of approved + queried/rejected:
 *     → Create a "residual" child claim for queried items
 *     → Mark the parent claim as partially_approved
 *     → The approved portion's amounts are recalculated and the claim moves forward
 *     → The queried items live in the child claim with status=queried for employee to resubmit
 */
export async function processLineDecisions({ claim, decisions, reviewerId, role, note }) {
  const isManager = role === 'manager' || role === 'admin'

  // 1. Separate items by decision
  const fuelDecisions = {}
  const expDecisions  = {}
  Object.entries(decisions).forEach(([key, val]) => {
    if (key.startsWith('fuel_')) fuelDecisions[key.replace('fuel_', '')] = val
    else expDecisions[key.replace('exp_', '')] = val
  })

  // 2. Update each fuel entry
  if (claim.fuel_entries?.length > 0) {
    await Promise.all(claim.fuel_entries.map(f => {
      const d = fuelDecisions[f.id] ?? { status: 'approved', note: '' }
      return supabase.from('fuel_entries').update({ status: d.status, reviewer_note: d.note || null }).eq('id', f.id)
    }))
  }

  // 3. Update each expense entry
  if (claim.expense_entries?.length > 0) {
    await Promise.all(claim.expense_entries.map(e => {
      const d = expDecisions[e.id] ?? { status: 'approved', note: '' }
      return supabase.from('expense_entries').update({ status: d.status, reviewer_note: d.note || null }).eq('id', e.id)
    }))
  }

  const allDecisions = Object.values(decisions)
  const allApproved  = allDecisions.every(d => d.status === 'approved')
  const allRejected  = allDecisions.every(d => d.status === 'rejected')
  const hasQueried   = allDecisions.some(d => d.status === 'queried')
  const hasApproved  = allDecisions.some(d => d.status === 'approved')

  // 4a. All approved → move claim forward
  if (allApproved) {
    const nextStatus = isManager ? 'pending_finance' : 'approved'
    const updates = {
      status: nextStatus,
      ...(isManager
        ? { manager_id: reviewerId, manager_note: note, manager_at: new Date().toISOString() }
        : { finance_id: reviewerId, finance_note: note, finance_at: new Date().toISOString() }
      ),
    }
    await supabase.from('claims').update(updates).eq('id', claim.id)
    return { type: 'all_approved', nextStatus }
  }

  // 4b. All rejected
  if (allRejected) {
    await supabase.from('claims').update({
      status: 'rejected',
      ...(isManager
        ? { manager_id: reviewerId, manager_note: note, manager_at: new Date().toISOString() }
        : { finance_id: reviewerId, finance_note: note, finance_at: new Date().toISOString() }
      ),
    }).eq('id', claim.id)
    return { type: 'all_rejected' }
  }

  // 4c. Mixed — split the claim
  // Calculate approved amounts
  const approvedFuelAmt = claim.fuel_entries
    ?.filter(f => fuelDecisions[f.id]?.status === 'approved')
    ?.reduce((s, f) => s + Number(f.amount), 0) ?? 0

  const approvedExpAmt = claim.expense_entries
    ?.filter(e => expDecisions[e.id]?.status === 'approved')
    ?.reduce((s, e) => s + Number(e.amount), 0) ?? 0

  // Mark parent claim as partially_approved and move forward with approved amounts
  const nextStatus = isManager ? 'pending_finance' : 'approved'
  await supabase.from('claims').update({
    status: nextStatus,
    is_partial: true,
    partial_fuel_amount: approvedFuelAmt,
    partial_expense_amount: approvedExpAmt,
    ...(isManager
      ? { manager_id: reviewerId, manager_note: note, manager_at: new Date().toISOString() }
      : { finance_id: reviewerId, finance_note: note, finance_at: new Date().toISOString() }
    ),
  }).eq('id', claim.id)

  // Create child claim for queried items
  const queriedFuelEntries = claim.fuel_entries?.filter(f => fuelDecisions[f.id]?.status === 'queried') ?? []
  const queriedExpEntries  = claim.expense_entries?.filter(e => expDecisions[e.id]?.status === 'queried') ?? []
  const rejectedFuelEntries = claim.fuel_entries?.filter(f => fuelDecisions[f.id]?.status === 'rejected') ?? []
  const rejectedExpEntries  = claim.expense_entries?.filter(e => expDecisions[e.id]?.status === 'rejected') ?? []

  const queriedFuelAmt = queriedFuelEntries.reduce((s, f) => s + Number(f.amount), 0)
  const queriedExpAmt  = queriedExpEntries.reduce((s, e) => s + Number(e.amount), 0)

  // Only create child claim if there are queried items (not just rejected)
  let childClaim = null
  if (queriedFuelEntries.length > 0 || queriedExpEntries.length > 0) {
    const { data: child } = await supabase.from('claims').insert({
      employee_id: claim.employee_id,
      period_from: claim.period_from,
      period_to: claim.period_to,
      vehicle_type: claim.vehicle_type,
      fuel_price_band: claim.fuel_price_band,
      fuel_amount: queriedFuelAmt,
      expense_amount: queriedExpAmt,
      status: 'queried',
      parent_claim_id: claim.id,
      fuel_bill_url: queriedFuelEntries.length > 0 ? claim.fuel_bill_url : null,
      submitted_at: new Date().toISOString(),
    }).select().single()

    childClaim = child

    if (child) {
      // Copy queried fuel entries to child
      if (queriedFuelEntries.length > 0) {
        await supabase.from('fuel_entries').insert(
          queriedFuelEntries.map(f => ({
            claim_id: child.id,
            entry_date: f.entry_date,
            from_place: f.from_place,
            to_place: f.to_place,
            purpose: f.purpose,
            distance_km: f.distance_km,
            rate_per_km: f.rate_per_km,
            status: 'pending',
          }))
        )
      }

      // Copy queried expense entries to child
      if (queriedExpEntries.length > 0) {
        await supabase.from('expense_entries').insert(
          queriedExpEntries.map(e => ({
            claim_id: child.id,
            entry_date: e.entry_date,
            expense_type: e.expense_type,
            description: e.description,
            bill_number: e.bill_number,
            amount: e.amount,
            receipt_url: e.receipt_url,
            status: 'pending',
          }))
        )
      }

      // Send a message on the child claim with the query reason
      const queryNotes = [
        ...queriedFuelEntries.map(f => `• Fuel (${f.from_place} → ${f.to_place}): ${fuelDecisions[f.id]?.note || 'Needs clarification'}`),
        ...queriedExpEntries.map(e => `• ${e.expense_type} (${e.description}): ${expDecisions[e.id]?.note || 'Needs clarification'}`),
      ].join('\n')

      await supabase.from('claim_messages').insert({
        claim_id: child.id,
        sender_id: reviewerId,
        message: `The following items need clarification before they can be approved:\n\n${queryNotes}\n\nPlease respond and resubmit.`,
      })
    }
  }

  return {
    type: 'partial',
    approvedAmt: approvedFuelAmt + approvedExpAmt,
    queriedCount: queriedFuelEntries.length + queriedExpEntries.length,
    rejectedCount: rejectedFuelEntries.length + rejectedExpEntries.length,
    childClaimNumber: childClaim?.claim_number,
    nextStatus,
  }
}

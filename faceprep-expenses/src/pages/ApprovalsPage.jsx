import { useEffect, useState } from 'react'
import { displayClaimNumber } from '../lib/claimNumber'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { formatCurrency, formatDate, CLAIM_STATUS } from '../lib/constants'
import { processLineDecisions } from '../lib/approvalLogic'
import LineItemReviewer from '../components/LineItemReviewer'
import ClaimThread from '../components/ClaimThread'
import { CheckCircle, ChevronDown, ChevronUp, SplitSquareHorizontal } from 'lucide-react'

export default function ApprovalsPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [saving, setSaving] = useState(null)
  const [claimNote, setClaimNote] = useState({})
  const [activeTab, setActiveTab] = useState('pending')

  useEffect(() => { if (profile) fetchClaims() }, [profile])

  async function fetchClaims() {
    setLoading(true)
    const pendingStatuses = profile.role === 'finance'
      ? ['pending_finance']
      : ['pending_manager']
    const allStatuses = [...pendingStatuses, 'approved', 'partially_approved', 'rejected']

    const { data } = await supabase
      .from('claims')
      .select(`*, fuel_entries(*), expense_entries(*), profiles!claims_employee_id_fkey(full_name, email)`)
      .in('status', allStatuses)
      .order('submitted_at', { ascending: true })

    setClaims(data ?? [])
    setLoading(false)
  }

  const pendingStatuses = profile?.role === 'finance'
    ? ['pending_finance']
    : ['pending_manager']

  const pending = claims.filter(c => pendingStatuses.includes(c.status))
  const history = claims.filter(c => ['approved', 'partially_approved', 'rejected'].includes(c.status))
  const shown   = activeTab === 'pending' ? pending : history

  async function handleDecisions(claim, decisions) {
    setSaving(claim.id)
    try {
      const result = await processLineDecisions({
        claim,
        decisions,
        reviewerId: profile.id,
        role: profile.role,
        note: claimNote[claim.id] || '',
      })

      if (result.type === 'all_approved') {
        toast(`✅ ${displayClaimNumber(claim, claims)} approved${profile.role === 'manager' ? ' — sent to Finance' : ''}`, 'success')
      } else if (result.type === 'all_rejected') {
        toast(`❌ ${displayClaimNumber(claim, claims)} rejected`, 'error')
      } else if (result.type === 'partial') {
        const msg = [
          `✅ ${displayClaimNumber(claim, claims)} partially approved`,
          result.queriedCount > 0 ? `${result.queriedCount} item(s) queried → ${result.childClaimNumber}` : null,
          result.rejectedCount > 0 ? `${result.rejectedCount} item(s) rejected` : null,
        ].filter(Boolean).join(' · ')
        toast(msg, 'info')
      }

      fetchClaims()
      setExpanded(null)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  function claimStatusBadge(c) {
    const s = CLAIM_STATUS[c.status]
    return <span className={`badge badge-${c.status}`}>{s?.label ?? c.status}</span>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Approvals</div>
          <div className="page-sub">
            Review each line item individually — approve the clean ones, query the rest
          </div>
        </div>
        <div style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '0.5px solid rgba(239,159,39,0.2)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 12, fontWeight: 500 }}>
          {pending.length} pending
        </div>
      </div>

      {/* How it works */}
      <div style={{
        background: 'var(--bg-card)', border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '12px 16px',
        marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap',
      }}>
        {[
          { icon: '✓', color: 'var(--green)', label: 'Approve item', desc: 'Moves forward to Finance' },
          { icon: '?', color: 'var(--purple)', label: 'Query item', desc: 'Sent back to employee as a separate sub-claim' },
          { icon: '✗', color: 'var(--red)', label: 'Reject item', desc: 'Permanently rejected, not resubmittable' },
        ].map(h => (
          <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `color-mix(in srgb, ${h.color} 15%, transparent)`, color: h.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>{h.icon}</div>
            <div><div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{h.label}</div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{h.desc}</div></div>
          </div>
        ))}
      </div>

      <div className="tabs">
        <button className={`tab-item ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>Pending ({pending.length})</button>
        <button className={`tab-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>History ({history.length})</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : shown.length === 0 ? (
        <div className="card"><div className="empty-state"><CheckCircle size={32} style={{ color: 'var(--green)' }} /><div style={{ marginTop: 8 }}>All caught up!</div></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(c => (
            <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Claim header */}
              <div
                style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--brand)', fontWeight: 700 }}>{displayClaimNumber(c, claims)}</span>
                    {claimStatusBadge(c)}
                    {c.parent_claim_id && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <SplitSquareHorizontal size={10} /> Sub-claim (queried items)
                      </span>
                    )}
                    {c.is_partial && (
                      <span style={{ fontSize: 10, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '2px 6px', borderRadius: 10 }}>
                        Partial
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span>👤 {c.profiles?.full_name}</span>
                    <span>📅 {formatDate(c.period_from)} → {formatDate(c.period_to)}</span>
                    <span>🚗 {c.vehicle_type} · {c.fuel_price_band}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(c.total_amount)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                  {formatDate(c.submitted_at)}
                </div>
                {expanded === c.id
                  ? <ChevronUp size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  : <ChevronDown size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              </div>

              {/* Expanded review panel */}
              {expanded === c.id && (
                <div style={{ borderTop: '0.5px solid var(--border)', padding: '20px', background: 'var(--bg-elevated)' }}>
                  {pendingStatuses.includes(c.status) ? (
                    <>
                      <LineItemReviewer
                        claim={c}
                        onSaveLineDecisions={(decisions) => handleDecisions(c, decisions)}
                        saving={saving === c.id}
                      />
                      <div className="divider" />
                      <div style={{ marginBottom: 8 }}>
                        <label className="form-label">Overall note (optional)</label>
                        <input
                          className="inline-input"
                          style={{ marginTop: 4 }}
                          placeholder="e.g. Approved. Please attach invoice for toll."
                          value={claimNote[c.id] || ''}
                          onChange={e => setClaimNote(p => ({ ...p, [c.id]: e.target.value }))}
                        />
                      </div>
                      <div className="divider" />
                      <ClaimThread claimId={c.id} />
                    </>
                  ) : (
                    /* History view — read-only */
                    <div>
                      <div className="grid2" style={{ marginBottom: 16 }}>
                        {c.fuel_entries?.length > 0 && (
                          <div>
                            <div className="section-label">Fuel journeys</div>
                            {c.fuel_entries.map(f => (
                              <div key={f.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: 500 }}>{f.from_place} → {f.to_place}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{f.distance_km} km · {formatCurrency(f.amount)}</div>
                                  {f.reviewer_note && <div style={{ fontSize: 11, color: 'var(--purple)', marginTop: 2 }}>💬 {f.reviewer_note}</div>}
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: f.status === 'approved' ? 'var(--green-bg)' : f.status === 'queried' ? 'var(--purple-bg)' : 'var(--red-bg)', color: f.status === 'approved' ? 'var(--green)' : f.status === 'queried' ? 'var(--purple)' : 'var(--red)' }}>{f.status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {c.expense_entries?.length > 0 && (
                          <div>
                            <div className="section-label">Expenses</div>
                            {c.expense_entries.map(e => (
                              <div key={e.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: 500 }}>{e.expense_type}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{e.description} · {formatCurrency(e.amount)}</div>
                                  {e.reviewer_note && <div style={{ fontSize: 11, color: 'var(--purple)', marginTop: 2 }}>💬 {e.reviewer_note}</div>}
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: e.status === 'approved' ? 'var(--green-bg)' : e.status === 'queried' ? 'var(--purple-bg)' : 'var(--red-bg)', color: e.status === 'approved' ? 'var(--green)' : e.status === 'queried' ? 'var(--purple)' : 'var(--red)' }}>{e.status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {c.is_partial && (
                        <div style={{ background: 'var(--amber-bg)', border: '0.5px solid rgba(239,159,39,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 12, color: 'var(--amber)', marginBottom: 12 }}>
                          ⚡ This claim was partially processed. Queried items were split into a separate sub-claim for employee clarification.
                          {c.partial_fuel_amount !== null && (
                            <span style={{ display: 'block', marginTop: 4, color: 'var(--text-secondary)' }}>
                              Approved: Fuel {formatCurrency(c.partial_fuel_amount)} + Expenses {formatCurrency(c.partial_expense_amount)}
                            </span>
                          )}
                        </div>
                      )}
                      {c.manager_note && <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 6 }}>Manager: {c.manager_note}</div>}
                      {c.finance_note && <div style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 6 }}>Finance: {c.finance_note}</div>}
                      <ClaimThread claimId={c.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

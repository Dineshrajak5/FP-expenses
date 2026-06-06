import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { formatCurrency, formatDate, CLAIM_STATUS } from '../lib/constants'
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

export default function ApprovalsPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [notes, setNotes] = useState({})
  const [processing, setProcessing] = useState(null)

  useEffect(() => { if (profile) fetchClaims() }, [profile])

  async function fetchClaims() {
    setLoading(true)
    const statusFilter = profile.role === 'finance'
      ? 'pending_finance'
      : profile.role === 'manager'
      ? 'pending_manager'
      : ['pending_manager', 'pending_finance']

    let q = supabase
      .from('claims')
      .select(`*, fuel_entries(*), expense_entries(*), profiles!claims_employee_id_fkey(full_name, email, employee_id)`)
      .order('submitted_at', { ascending: true })

    if (Array.isArray(statusFilter)) q = q.in('status', statusFilter)
    else q = q.eq('status', statusFilter)

    const { data } = await q
    setClaims(data ?? [])
    setLoading(false)
  }

  async function handleAction(claimId, action) {
    setProcessing(claimId)
    const note = notes[claimId] || ''
    const claim = claims.find(c => c.id === claimId)

    const isManager = profile.role === 'manager'
    const updates = action === 'approve'
      ? {
          status: isManager ? 'pending_finance' : 'approved',
          ...(isManager
            ? { manager_id: profile.id, manager_note: note, manager_at: new Date().toISOString() }
            : { finance_id: profile.id, finance_note: note, finance_at: new Date().toISOString() }
          ),
        }
      : {
          status: 'rejected',
          ...(isManager
            ? { manager_id: profile.id, manager_note: note, manager_at: new Date().toISOString() }
            : { finance_id: profile.id, finance_note: note, finance_at: new Date().toISOString() }
          ),
        }

    const { error } = await supabase.from('claims').update(updates).eq('id', claimId)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast(
        action === 'approve'
          ? isManager
            ? `${claim.claim_number} approved — sent to Finance`
            : `${claim.claim_number} fully approved!`
          : `${claim.claim_number} rejected`,
        action === 'approve' ? 'success' : 'error'
      )
      fetchClaims()
    }
    setProcessing(null)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Approvals</div>
          <div className="page-sub">
            {profile?.role === 'manager' ? 'Manager-level claims awaiting your approval' : 'Finance-level claims awaiting final sign-off'}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--amber-bg)', color: 'var(--amber)',
          border: '0.5px solid rgba(239,159,39,0.2)',
          borderRadius: 'var(--radius-sm)', padding: '6px 12px',
          fontSize: 12, fontWeight: 500
        }}>
          {loading ? '…' : claims.length} pending
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : claims.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <CheckCircle size={32} style={{ color: 'var(--green)' }} />
            <div style={{ marginTop: 8 }}>All caught up! No pending approvals.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {claims.map(c => (
            <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Header */}
              <div
                style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--brand)', fontWeight: 600 }}>{c.claim_number}</span>
                    <span className={`badge badge-${c.status}`}>{CLAIM_STATUS[c.status]?.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>👤 {c.profiles?.full_name}</span>
                    <span>📅 {formatDate(c.period_from)} → {formatDate(c.period_to)}</span>
                    <span>🚗 {c.vehicle_type} · {c.fuel_price_band}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '1.1rem', fontWeight: 600 }}>{formatCurrency(c.total_amount)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Submitted {formatDate(c.submitted_at)}</div>
                </div>
                {expanded === c.id ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
              </div>

              {/* Expanded detail */}
              {expanded === c.id && (
                <div style={{ borderTop: '0.5px solid var(--border)', padding: '16px 20px', background: 'var(--bg-elevated)' }}>
                  <div className="grid2" style={{ marginBottom: 16 }}>
                    {/* Fuel entries */}
                    {c.fuel_entries?.length > 0 && (
                      <div>
                        <div className="section-label">Fuel journeys · {formatCurrency(c.fuel_amount)}</div>
                        <table>
                          <thead><tr><th>Date</th><th>Route</th><th>KM</th><th>Amount</th></tr></thead>
                          <tbody>
                            {c.fuel_entries.map(f => (
                              <tr key={f.id}>
                                <td style={{ fontSize: 11 }}>{formatDate(f.entry_date)}</td>
                                <td style={{ fontSize: 11 }}>{f.from_place} → {f.to_place}</td>
                                <td style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{f.distance_km} km</td>
                                <td style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{formatCurrency(f.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Expense entries */}
                    {c.expense_entries?.length > 0 && (
                      <div>
                        <div className="section-label">Expenses · {formatCurrency(c.expense_amount)}</div>
                        <table>
                          <thead><tr><th>Type</th><th>Description</th><th>Amount</th></tr></thead>
                          <tbody>
                            {c.expense_entries.map(e => (
                              <tr key={e.id}>
                                <td style={{ fontSize: 11 }}>{e.expense_type}</td>
                                <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{e.description}</td>
                                <td style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{formatCurrency(e.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                    <input
                      className="inline-input"
                      type="text"
                      placeholder="Add a note (optional)…"
                      value={notes[c.id] || ''}
                      onChange={e => setNotes(p => ({ ...p, [c.id]: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleAction(c.id, 'reject')}
                      disabled={processing === c.id}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAction(c.id, 'approve')}
                      disabled={processing === c.id}
                    >
                      {processing === c.id
                        ? <div className="spinner" style={{ width: 12, height: 12 }} />
                        : <CheckCircle size={14} />}
                      {profile.role === 'manager' ? 'Approve → Finance' : 'Final approve'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

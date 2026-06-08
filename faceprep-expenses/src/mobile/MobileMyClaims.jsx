import { useEffect, useState } from 'react'
import { displayClaimNumber } from '../lib/claimNumber'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, CLAIM_STATUS } from '../lib/constants'
import { exportClaimPDF } from '../lib/pdf'
import { getBillUrl } from '../lib/storage'
import ClaimThread from '../components/ClaimThread'
import { ChevronRight, ChevronDown, Download, RefreshCw, Eye, MessageSquare } from 'lucide-react'

const STATUS_COLOR = {
  approved: 'var(--green)', rejected: 'var(--red)', queried: 'var(--purple)',
  pending_manager: 'var(--amber)', pending_finance: 'var(--blue)',
  resubmitted: 'var(--brand)', partially_approved: 'var(--amber)',
}

export default function MobileMyClaims({ onNavigate, onResubmit }) {
  const { profile } = useAuth()
  const [claims, setClaims]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter]     = useState('all')

  useEffect(() => { if (profile) fetchClaims() }, [profile])

  async function fetchClaims() {
    setLoading(true)
    const { data } = await supabase.from('claims')
      .select(`*, fuel_entries(*), expense_entries(*)`)
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false })
    setClaims(data ?? [])
    setLoading(false)
  }

  async function viewBill(url) {
    const signed = await getBillUrl(url)
    if (signed) window.open(signed, '_blank')
  }

  // Hide superseded (resubmitted) claims everywhere
  const visible = claims.filter(c => c.status !== 'resubmitted')
  const filtered = filter === 'all' ? visible
    : filter === 'pending' ? visible.filter(c => ['pending_manager','pending_finance'].includes(c.status))
    : visible.filter(c => c.status === filter)

  const canResubmit = s => ['rejected','queried'].includes(s)

  return (
    <div className="m-screen">
      <div className="m-topbar">
        <div><div className="m-topbar-title">My Claims</div><div className="m-topbar-sub">{claims.length} total</div></div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={fetchClaims}>↻</button>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'approved', label: 'Approved' },
          { id: 'queried', label: 'Queried' },
          { id: 'rejected', label: 'Rejected' },
        ].map(f => (
          <button key={f.id} className={`m-pill ${filter===f.id?'active':''}`} onClick={() => setFilter(f.id)} style={{ flexShrink: 0 }}>{f.label}</button>
        ))}
      </div>

      <div className="m-content">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14 }}>No claims here yet</div>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="m-claim-card">
              {/* Claim header */}
              <div onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginBottom: 4 }}>{displayClaimNumber(c, claims)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(c.period_from)} → {formatDate(c.period_to)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(c.total_amount)}</div>
                    <span className={`badge badge-${c.status}`} style={{ fontSize: 10 }}>{CLAIM_STATUS[c.status]?.label ?? c.status}</span>
                  </div>
                </div>

                {/* Status bar */}
                <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: STATUS_COLOR[c.status] ?? 'var(--text-muted)',
                    width: c.status === 'approved' ? '100%' : c.status === 'pending_finance' ? '66%' : c.status === 'pending_manager' ? '33%' : '100%',
                    transition: 'width 0.3s',
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  {expanded === c.id ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === c.id && (
                <div style={{ borderTop: '0.5px solid var(--border)', marginTop: 8, paddingTop: 14 }}>
                  {c.manager_note && <div style={{ fontSize: 13, color: 'var(--amber)', marginBottom: 6, padding: '8px 12px', background: 'var(--amber-bg)', borderRadius: 8 }}>💬 Manager: {c.manager_note}</div>}
                  {c.finance_note && <div style={{ fontSize: 13, color: 'var(--blue)', marginBottom: 6, padding: '8px 12px', background: 'var(--blue-bg)', borderRadius: 8 }}>💬 Finance: {c.finance_note}</div>}

                  {/* Fuel entries */}
                  {c.fuel_entries?.filter(f => f.from_place).map(f => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f.from_place} → {f.to_place}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{f.distance_km} km · ₹{f.rate_per_km}/km</div>
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{formatCurrency(f.amount)}</div>
                    </div>
                  ))}

                  {/* Expense entries */}
                  {c.expense_entries?.filter(e => e.description).map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{e.expense_type}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{e.description}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {e.receipt_url && (
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)' }} onClick={() => viewBill(e.receipt_url)}>
                            <Eye size={15} />
                          </button>
                        )}
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{formatCurrency(e.amount)}</span>
                      </div>
                    </div>
                  ))}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button className="m-btn m-btn-secondary m-btn-sm" onClick={async () => { try { exportClaimPDF(c, c.fuel_entries, c.expense_entries, profile) } catch(e) { alert('PDF export not supported on this device. Please use desktop.') } }}>
                      <Download size={14} /> PDF
                    </button>
                    {c.fuel_bill_url && (
                      <button className="m-btn m-btn-secondary m-btn-sm" onClick={() => viewBill(c.fuel_bill_url)}>
                        <Eye size={14} /> Fuel bill
                      </button>
                    )}
                    {canResubmit(c.status) && (
                      <button className="m-btn m-btn-sm" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '0.5px solid rgba(245,166,35,0.2)', flex: 1 }}
                        onClick={() => onResubmit(c)}>
                        <RefreshCw size={14} /> Resubmit
                      </button>
                    )}
                  </div>

                  {/* Thread */}
                  <div style={{ marginTop: 14, borderTop: '0.5px solid var(--border)', paddingTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={13} /> Clarification thread
                    </div>
                    <ClaimThread claimId={c.id} />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

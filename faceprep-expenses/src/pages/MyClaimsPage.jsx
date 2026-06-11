import { useEffect, useState } from 'react'
import { displayClaimNumber } from '../lib/claimNumber'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, CLAIM_STATUS, isLiveClaim, countsTowardAmount, PENDING_STATUSES } from '../lib/constants'
import { exportClaimPDF } from '../lib/pdf'
import { getBillUrl } from '../lib/storage'
import ClaimThread from '../components/ClaimThread'
import { FileText, Download, Eye, RefreshCw } from 'lucide-react'
import ClaimStageBar from '../components/ClaimStageBar'

export default function MyClaimsPage({ onResubmit }) {
  const { profile } = useAuth()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

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

  async function handleExport(c) {
    exportClaimPDF(c, c.fuel_entries, c.expense_entries, profile)
  }

  async function viewBill(url) {
    if (!url) return
    const signedUrl = await getBillUrl(url)
    if (signedUrl) window.open(signedUrl, '_blank')
  }

  const liveClaims = claims.filter(isLiveClaim)
  const summaries = {
    total: liveClaims.length,
    pending: liveClaims.filter(c => PENDING_STATUSES.includes(c.status)).length,
    approved: liveClaims.filter(c => c.status === 'approved').length,
    amount: claims.filter(countsTowardAmount).reduce((s, c) => s + Number(c.total_amount || 0), 0),
  }

  const canResubmit = (status) => status === 'rejected' || status === 'queried'

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">My claims</div><div className="page-sub">All your submitted reimbursement claims</div></div>
      </div>

      <div className="stat-grid">
        {[
          { label: 'Total', value: summaries.total, accent: 'var(--brand)' },
          { label: 'Pending', value: summaries.pending, accent: 'var(--amber)' },
          { label: 'Approved', value: summaries.approved, accent: 'var(--green)' },
          { label: 'Total claimed', value: formatCurrency(summaries.amount), accent: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.accent }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
        : claims.length === 0 ? <div className="empty-state"><FileText size={32} /><div>No claims yet.</div></div>
        : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Claim ID</th><th>Period</th><th>Fuel</th><th>Other</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {claims.filter(c => c.status !== 'resubmitted').map(c => (
                  <>
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--brand)' }}>{displayClaimNumber(c, claims)}</td>
                      <td style={{ fontSize: 12 }}>{formatDate(c.period_from)} → {formatDate(c.period_to)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{formatCurrency(c.fuel_amount)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{formatCurrency(c.expense_amount)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{formatCurrency(c.total_amount)}</td>
                      <td><span className={`badge badge-${c.status}`}>{CLAIM_STATUS[c.status]?.label ?? c.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-xs" title="Download PDF" onClick={() => handleExport(c)}><Download size={12} /></button>
                          {canResubmit(c.status) && (
                            <button className="btn btn-xs" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '0.5px solid rgba(239,159,39,0.2)' }} onClick={() => onResubmit(c)}>
                              <RefreshCw size={11} /> Resubmit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {selected?.id === c.id && (
                      <tr key={c.id + '-detail'}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ background: 'var(--bg-elevated)', padding: '16px 20px', borderBottom: '0.5px solid var(--border)' }}>
                            {c.manager_note && <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 8 }}>💬 Manager: {c.manager_note}</div>}
                            {c.finance_note && <div style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 8 }}>💬 Finance: {c.finance_note}</div>}

                            <div className="grid2">
                              {c.fuel_entries?.length > 0 && (
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div className="section-label" style={{ marginBottom: 0 }}>Fuel journeys</div>
                                    {c.fuel_bill_url && <button className="btn btn-ghost btn-xs" style={{ color: 'var(--blue)' }} onClick={() => viewBill(c.fuel_bill_url)}><Eye size={12} /> Fuel bill</button>}
                                  </div>
                                  <table><thead><tr><th>Date</th><th>Route</th><th>KM</th><th>Amount</th></tr></thead>
                                    <tbody>{c.fuel_entries.map(f => (
                                      <tr key={f.id}><td style={{ fontSize: 11 }}>{formatDate(f.entry_date)}</td><td style={{ fontSize: 11 }}>{f.from_place} → {f.to_place}</td><td style={{ fontSize: 11 }}>{f.distance_km} km</td><td style={{ fontSize: 11 }}>{formatCurrency(f.amount)}</td></tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              )}
                              {c.expense_entries?.length > 0 && (
                                <div>
                                  <div className="section-label">Expenses</div>
                                  <table><thead><tr><th>Type</th><th>Description</th><th>Amount</th><th>Bill</th></tr></thead>
                                    <tbody>{c.expense_entries.map(e => (
                                      <tr key={e.id}><td style={{ fontSize: 11 }}>{e.expense_type}</td><td style={{ fontSize: 11 }}>{e.description}</td><td style={{ fontSize: 11 }}>{formatCurrency(e.amount)}</td><td>{e.receipt_url ? <button className="btn btn-ghost btn-xs" style={{ color: 'var(--blue)' }} onClick={() => viewBill(e.receipt_url)}><Eye size={12} /></button> : '—'}</td></tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                            <div style={{ marginBottom: 14 }}>
                              <ClaimStageBar claim={c} />
                            </div>
                            <div className="divider" />
                            <ClaimThread claimId={c.id} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

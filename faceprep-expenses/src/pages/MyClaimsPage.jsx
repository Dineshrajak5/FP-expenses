import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, CLAIM_STATUS } from '../lib/constants'
import { FileText } from 'lucide-react'

export default function MyClaimsPage() {
  const { profile } = useAuth()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!profile) return
    fetchClaims()
  }, [profile])

  async function fetchClaims() {
    setLoading(true)
    const { data } = await supabase
      .from('claims')
      .select(`*, fuel_entries(*), expense_entries(*)`)
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false })
    setClaims(data ?? [])
    setLoading(false)
  }

  const summaries = {
    total: claims.length,
    pending: claims.filter(c => c.status.startsWith('pending')).length,
    approved: claims.filter(c => c.status === 'approved').length,
    amount: claims.reduce((s, c) => s + Number(c.total_amount || 0), 0),
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">My claims</div>
          <div className="page-sub">All your submitted reimbursement claims</div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
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
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : claims.length === 0 ? (
          <div className="empty-state">
            <FileText size={32} />
            <div>No claims submitted yet.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Claim ID</th>
                  <th>Period</th>
                  <th>Vehicle</th>
                  <th>Fuel amt</th>
                  <th>Other</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--brand)' }}>{c.claim_number}</td>
                    <td style={{ fontSize: '12px' }}>{formatDate(c.period_from)} → {formatDate(c.period_to)}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.vehicle_type}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{formatCurrency(c.fuel_amount)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{formatCurrency(c.expense_amount)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: '600' }}>{formatCurrency(c.total_amount)}</td>
                    <td><span className={`badge badge-${c.status}`}>{CLAIM_STATUS[c.status]?.label}</span></td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(c.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded detail */}
        {selected && (
          <div style={{
            marginTop: 16,
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            border: '0.5px solid var(--border-strong)',
          }}>
            <div style={{ fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--brand)' }}>{selected.claim_number}</span>
              {selected.manager_note && (
                <div style={{ fontSize: 11, color: 'var(--amber)' }}>Manager note: {selected.manager_note}</div>
              )}
              {selected.finance_note && (
                <div style={{ fontSize: 11, color: 'var(--blue)' }}>Finance note: {selected.finance_note}</div>
              )}
            </div>

            {selected.fuel_entries?.length > 0 && (
              <>
                <div className="section-label">Fuel journeys</div>
                <table style={{ marginBottom: 16 }}>
                  <thead><tr><th>Date</th><th>Route</th><th>Purpose</th><th>KM</th><th>Rate</th><th>Amount</th></tr></thead>
                  <tbody>
                    {selected.fuel_entries.map(f => (
                      <tr key={f.id}>
                        <td style={{ fontSize: 12 }}>{formatDate(f.entry_date)}</td>
                        <td style={{ fontSize: 12 }}>{f.from_place} → {f.to_place}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f.purpose || '—'}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{f.distance_km} km</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>₹{f.rate_per_km}/km</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{formatCurrency(f.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {selected.expense_entries?.length > 0 && (
              <>
                <div className="section-label">Expense entries</div>
                <table>
                  <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Bill no.</th><th>Amount</th></tr></thead>
                  <tbody>
                    {selected.expense_entries.map(e => (
                      <tr key={e.id}>
                        <td style={{ fontSize: 12 }}>{formatDate(e.entry_date)}</td>
                        <td style={{ fontSize: 12 }}>{e.expense_type}</td>
                        <td style={{ fontSize: 12 }}>{e.description}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>{e.bill_number || 'NA'}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{formatCurrency(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

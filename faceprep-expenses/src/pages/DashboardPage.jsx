import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { displayClaimNumber } from '../lib/claimNumber'
import {
  formatCurrency, formatDate, CLAIM_STATUS,
  isLiveClaim, countsTowardAmount, PENDING_STATUSES
} from '../lib/constants'
import { TrendingUp, Clock, CheckCircle, DollarSign, ArrowRight } from 'lucide-react'

export default function DashboardPage({ onNavigate }) {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, totalAmt: 0 })
  const [recent, setRecent] = useState([])
  const [allClaims, setAllClaims] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    const isManager = ['manager', 'finance', 'admin'].includes(profile.role)

    let q = supabase.from('claims').select('*')
    if (!isManager) q = q.eq('employee_id', profile.id)

    const { data: claims } = await q.order('created_at', { ascending: false })
    if (!claims) { setLoading(false); return }

    setAllClaims(claims)

    // Only count LIVE claims (exclude superseded queried/resubmitted stubs)
    const liveClaims = claims.filter(isLiveClaim)

    setStats({
      total:   liveClaims.length,
      pending: liveClaims.filter(c => PENDING_STATUSES.includes(c.status)).length,
      approved: liveClaims.filter(c => c.status === 'approved').length,
      // Sum only amounts that represent real current money
      totalAmt: claims.filter(countsTowardAmount).reduce((s, c) => s + Number(c.total_amount || 0), 0),
    })

    // Recent list: show live claims only, newest first
    setRecent(liveClaims.slice(0, 6))
    setLoading(false)
  }

  const isManager = ['manager', 'finance', 'admin'].includes(profile?.role)

  const statCards = [
    { label: 'Total claims', value: stats.total, icon: TrendingUp, accent: 'var(--brand)', sub: 'Active claims' },
    { label: 'Pending approval', value: stats.pending, icon: Clock, accent: 'var(--amber)', sub: 'Awaiting action' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, accent: 'var(--green)', sub: 'Processed' },
    { label: 'Total claimed', value: formatCurrency(stats.totalAmt), icon: DollarSign, accent: 'var(--blue)', sub: 'Approved + in-flight' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Good {getGreeting()}, {profile?.full_name?.split(' ')[0]} 👋</div>
          <div className="page-sub">
            {isManager ? 'Team reimbursement overview' : 'Your reimbursement activity'}
          </div>
        </div>
        {profile?.role !== 'finance' && (
          <button className="btn btn-primary" onClick={() => onNavigate('new-claim')}>
            <span>+</span> New claim
          </button>
        )}
      </div>

      <div className="stat-grid">
        {statCards.map(card => (
          <div key={card.label} className="stat-card" style={{ '--accent': card.accent }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">{card.label}</div>
                <div className="stat-value">{loading ? '—' : card.value}</div>
                <div className="stat-sub">{card.sub}</div>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                background: `color-mix(in srgb, ${card.accent} 15%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <card.icon size={16} style={{ color: card.accent }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent claims</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate(isManager ? 'approvals' : 'my-claims')}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            View all <ArrowRight size={13} />
          </button>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <div className="spinner" />
          </div>
        ) : recent.length === 0 ? (
          <div className="empty-state">No claims yet. Submit your first claim to get started.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Claim ID</th>
                  <th>Period</th>
                  {isManager && <th>Employee</th>}
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--brand)' }}>{displayClaimNumber(c, allClaims)}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {formatDate(c.period_from)} → {formatDate(c.period_to)}
                    </td>
                    {isManager && <td style={{ fontSize: '12px' }}>{c.employee_id?.slice(0, 8)}…</td>}
                    <td style={{ fontWeight: '500' }}>{formatCurrency(c.total_amount)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function StatusBadge({ status }) {
  const s = CLAIM_STATUS[status] ?? { label: status }
  return <span className={`badge badge-${status}`}>{s.label}</span>
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

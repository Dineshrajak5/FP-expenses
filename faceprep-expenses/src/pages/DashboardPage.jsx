import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, CLAIM_STATUS } from '../lib/constants'
import { TrendingUp, Clock, CheckCircle, DollarSign, ArrowRight } from 'lucide-react'

export default function DashboardPage({ onNavigate }) {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, totalAmt: 0 })
  const [recent, setRecent] = useState([])
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

    setStats({
      total: claims.length,
      pending: claims.filter(c => c.status.startsWith('pending')).length,
      approved: claims.filter(c => c.status === 'approved').length,
      totalAmt: claims.reduce((s, c) => s + Number(c.total_amount || 0), 0),
    })
    setRecent(claims.slice(0, 6))
    setLoading(false)
  }

  const isManager = ['manager', 'finance', 'admin'].includes(profile?.role)

  const statCards = [
    { label: 'Total claims', value: stats.total, icon: TrendingUp, accent: 'var(--brand)', sub: 'All time' },
    { label: 'Pending approval', value: stats.pending, icon: Clock, accent: 'var(--amber)', sub: 'Awaiting action' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, accent: 'var(--green)', sub: 'Processed' },
    { label: 'Total claimed', value: formatCurrency(stats.totalAmt), icon: DollarSign, accent: 'var(--blue)', sub: 'Sum of approved + pending' },
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
        <button className="btn btn-primary" onClick={() => onNavigate('new-claim')}>
          <span>+</span> New claim
        </button>
      </div>

      {/* Stat cards */}
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

      {/* Recent claims */}
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
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--brand)' }}>{c.claim_number}</td>
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
  const s = CLAIM_STATUS[status] ?? { label: status, color: '#888', bg: '#333' }
  return (
    <span className={`badge badge-${status}`}>
      {s.label}
    </span>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

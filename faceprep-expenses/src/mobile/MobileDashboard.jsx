import { useEffect, useState } from 'react'
import { displayClaimNumber } from '../lib/claimNumber'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatDate, CLAIM_STATUS } from '../lib/constants'
import { signOut } from '../lib/supabase'
import { LogOut, Sun, Moon, ChevronRight, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import FacerepLogo from '../components/FaceprepLogo'
import { useTheme } from '../hooks/useTheme'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const STATUS_ICON = {
  approved:         <CheckCircle size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />,
  rejected:         <AlertCircle size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />,
  queried:          <AlertCircle size={16} style={{ color: 'var(--purple)', flexShrink: 0 }} />,
  pending_manager:  <Clock size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />,
  pending_finance:  <Clock size={16} style={{ color: 'var(--blue)', flexShrink: 0 }} />,
  partially_approved: <CheckCircle size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />,
}

export default function MobileDashboard({ onNavigate, onPendingCount }) {
  const { profile } = useAuth()
  const { theme, toggle } = useTheme()
  const [stats, setStats]   = useState({ total: 0, pending: 0, approved: 0, amount: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  const isApprover = ['manager','finance','admin'].includes(profile?.role)

  useEffect(() => { if (profile) fetchData() }, [profile])

  async function fetchData() {
    setLoading(true)
    let q = supabase.from('claims').select('*')
    if (!isApprover) q = q.eq('employee_id', profile.id)
    const { data } = await q.order('created_at', { ascending: false })
    if (!data) { setLoading(false); return }

    const pending = data.filter(c => ['pending_manager','pending_finance','queried','resubmitted'].includes(c.status))
    setStats({
      total:   data.length,
      pending: pending.length,
      approved: data.filter(c => c.status === 'approved').length,
      amount:  data.reduce((s,c) => s + Number(c.total_amount||0), 0),
    })
    setRecent(data.slice(0, 5))
    onPendingCount?.(isApprover ? pending.length : 0)
    setLoading(false)
  }

  return (
    <div className="m-screen">
      {/* Top bar */}
      <div className="m-topbar">
        <FacerepLogo width={100} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 6 }}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={signOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 6 }}>
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="m-content">
        {/* Greeting */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {greeting()}, {profile?.full_name?.split(' ')[0]} 👋
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {isApprover ? 'Team reimbursement overview' : 'Your claim activity'}
          </div>
        </div>

        {/* Stats */}
        <div className="m-stat-row">
          {[
            { label: 'Total claims', value: loading ? '—' : stats.total,   accent: 'var(--brand)' },
            { label: 'Pending',      value: loading ? '—' : stats.pending,  accent: 'var(--amber)' },
            { label: 'Approved',     value: loading ? '—' : stats.approved, accent: 'var(--green)' },
            { label: 'Total claimed',value: loading ? '—' : formatCurrency(stats.amount), accent: 'var(--blue)' },
          ].map(s => (
            <div key={s.label} className="m-stat" style={{ '--accent': s.accent }}>
              <div className="m-stat-label">{s.label}</div>
              <div className="m-stat-value" style={{ fontSize: s.label === 'Total claimed' ? '1rem' : '1.3rem' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        {profile?.role !== 'finance' && (
          <button className="m-btn m-btn-primary" style={{ marginBottom: 20 }} onClick={() => onNavigate('new-claim')}>
            + New claim
          </button>
        )}

        {/* Recent claims */}
        <div className="m-section">Recent claims</div>
        <div className="m-card">
          {loading ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : recent.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              No claims yet
            </div>
          ) : (
            recent.map(c => (
              <div key={c.id} className="m-list-item" onClick={() => onNavigate('my-claims')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>{displayClaimNumber(c, claims)}</span>
                    <span className={`badge badge-${c.status}`} style={{ fontSize: 10 }}>{CLAIM_STATUS[c.status]?.label ?? c.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatDate(c.period_from)} → {formatDate(c.period_to)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700 }}>{formatCurrency(c.total_amount)}</span>
                  {STATUS_ICON[c.status]}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pending approvals shortcut for managers */}
        {isApprover && stats.pending > 0 && (
          <>
            <div className="m-section">Needs your attention</div>
            <button
              className="m-card"
              style={{ width: '100%', text: 'left', border: '0.5px solid rgba(245,166,35,0.3)', background: 'rgba(245,166,35,0.05)', cursor: 'pointer', padding: 0 }}
              onClick={() => onNavigate('approvals')}
            >
              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--amber-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={20} style={{ color: 'var(--amber)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{stats.pending} claim{stats.pending > 1 ? 's' : ''} pending</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Tap to review and approve</div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
            </button>
          </>
        )}

        {/* User info footer */}
        <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 16, flexShrink: 0 }}>{profile?.full_name?.[0]?.toUpperCase()}</div>
          }
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{profile?.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile?.email}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

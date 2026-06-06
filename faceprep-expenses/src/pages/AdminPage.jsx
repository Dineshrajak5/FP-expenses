import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { ROLES } from '../lib/constants'
import { UserCheck, UserX, Shield } from 'lucide-react'

const ROLE_OPTIONS = ['staff', 'manager', 'finance', 'admin']

export default function AdminPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  async function toggleApproval(user) {
    const newVal = !user.approved
    const { error } = await supabase.from('profiles').update({
      approved: newVal,
      approved_by: newVal ? profile.id : null,
      approved_at: newVal ? new Date().toISOString() : null,
    }).eq('id', user.id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${user.full_name} ${newVal ? 'approved' : 'revoked'}`, newVal ? 'success' : 'info')
    fetchUsers()
  }

  async function updateRole(userId, role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) { toast(error.message, 'error'); return }
    toast('Role updated', 'success')
    fetchUsers()
  }

  const filtered = filter === 'all' ? users : filter === 'pending' ? users.filter(u => !u.approved) : users.filter(u => u.approved)

  const counts = { total: users.length, approved: users.filter(u => u.approved).length, pending: users.filter(u => !u.approved).length }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Admin settings</div><div className="page-sub">Manage user access, roles and approvals</div></div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total users', value: counts.total, accent: 'var(--blue)' },
          { label: 'Approved', value: counts.approved, accent: 'var(--green)' },
          { label: 'Pending approval', value: counts.pending, accent: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.accent }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>User management</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'pending', 'approved'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
        : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>{u.full_name?.[0]?.toUpperCase() ?? '?'}</div>
                        }
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{u.full_name}</span>
                        {u.id === profile.id && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(you)</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--mono)' }}>{u.email}</td>
                    <td>
                      {u.id === profile.id
                        ? <span className="badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}><Shield size={10} /> {ROLES[u.role]}</span>
                        : (
                          <select
                            className="inline-input"
                            value={u.role}
                            onChange={e => updateRole(u.id, e.target.value)}
                            style={{ width: 110, fontSize: 12 }}
                          >
                            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
                          </select>
                        )
                      }
                    </td>
                    <td>
                      {u.approved
                        ? <span className="badge badge-approved">Approved</span>
                        : <span className="badge badge-pending_manager">Pending</span>
                      }
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      {u.id !== profile.id && (
                        <button
                          className={`btn btn-sm ${u.approved ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleApproval(u)}
                        >
                          {u.approved ? <><UserX size={13} /> Revoke</> : <><UserCheck size={13} /> Approve</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="card" style={{ marginTop: 16, background: 'var(--bg-elevated)' }}>
        <div className="section-label">How access works</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { role: 'Staff', color: 'var(--green)', desc: 'Submit claims, view own history, chat on claims' },
            { role: 'Manager', color: 'var(--amber)', desc: 'L1 approval, query/reject, view analytics' },
            { role: 'Finance', color: 'var(--blue)', desc: 'L2 final approval, view all claims and analytics' },
            { role: 'Admin', color: 'var(--purple)', desc: 'Full access + user management + role assignment' },
          ].map(r => (
            <div key={r.role} style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: r.color, marginBottom: 6 }}>{r.role}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

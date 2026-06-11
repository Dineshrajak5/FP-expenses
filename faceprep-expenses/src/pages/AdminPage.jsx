import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { ROLES } from '../lib/constants'
import { UserCheck, UserX, Shield, AlertTriangle, Trash2, Lock, UserPlus } from 'lucide-react'

const ROLE_OPTIONS = ['staff', 'manager', 'finance', 'admin']

export default function AdminPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('users')

  // New user form
  const [newEmail, setNewEmail]     = useState('')
  const [newName, setNewName]       = useState('')
  const [newRole, setNewRole]       = useState('staff')
  const [creating, setCreating]     = useState(false)

  async function handleCreateUser() {
    if (!newEmail || !newName) { toast('Fill in name and email', 'error'); return }
    if (!newEmail.endsWith('@faceprep.in')) { toast('Must be a @faceprep.in email', 'error'); return }
    setCreating(true)
    try {
      const emailClean = newEmail.toLowerCase().trim()

      // Check if user already exists
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('email', emailClean).maybeSingle()

      if (existing) {
        // User exists — update their role and approve them
        const { data, error } = await supabase.rpc('admin_update_user', {
          target_id:    existing.id,
          new_role:     newRole,
          new_approved: true,
          approver_id:  profile.id,
        })
        if (error || !data?.success) throw new Error(error?.message || data?.error)
        toast(`${newName} updated — role set to ${ROLES[newRole]}`, 'success')
      } else {
        // New user — insert profile so they're pre-approved on first login
        const { error } = await supabase.from('profiles').insert({
          email:       emailClean,
          full_name:   newName.trim(),
          role:        newRole,
          approved:    true,
          approved_at: new Date().toISOString(),
          approved_by: profile.id,
        })
        if (error) throw error
        toast(`${newName} added as ${ROLES[newRole]}. They can now log in via Google.`, 'success')
      }
      setNewEmail(''); setNewName(''); setNewRole('staff')
      fetchUsers()
    } catch (err) { toast(err.message, 'error') }
    finally { setCreating(false) }
  }

  // Data wipe state
  const [wipeOpen, setWipeOpen] = useState(false)
  const [secretCode, setSecretCode] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [wiping, setWiping] = useState(false)

  async function handleWipe() {
    if (confirmText !== 'DELETE ALL') {
      toast('Type "DELETE ALL" exactly to confirm', 'error')
      return
    }
    if (!secretCode) {
      toast('Enter the secret code', 'error')
      return
    }
    setWiping(true)
    try {
      // Step 1: Clear all files from the bills bucket via Storage API
      const { data: fileList } = await supabase.storage.from('bills').list('', {
        limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' }
      })
      if (fileList && fileList.length > 0) {
        // list() returns top-level folders (user IDs). List files inside each.
        const allPaths = []
        for (const folder of fileList) {
          if (folder.id === null) {
            // It's a folder — list its contents
            const { data: inner } = await supabase.storage.from('bills').list(folder.name, { limit: 1000 })
            if (inner) inner.forEach(f => allPaths.push(`${folder.name}/${f.name}`))
          } else {
            allPaths.push(folder.name)
          }
        }
        if (allPaths.length > 0) {
          await supabase.storage.from('bills').remove(allPaths)
        }
      }

      // Step 2: Wipe DB records via the SQL function
      const { data, error } = await supabase.rpc('wipe_all_claim_data', { secret_code: secretCode })
      if (error) throw error
      if (!data?.success) {
        toast(data?.error || 'Wipe failed', 'error')
        setWiping(false)
        return
      }
      toast(`✓ Wiped ${data.deleted_claims} claims + all bills. Numbers reset.`, 'success')
      setWipeOpen(false)
      setSecretCode('')
      setConfirmText('')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setWiping(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  async function toggleApproval(user) {
    const newVal = !user.approved
    const { data, error } = await supabase.rpc('admin_update_user', {
      target_id:    user.id,
      new_approved: newVal,
      approver_id:  profile.id,
    })
    if (error || !data?.success) { toast(error?.message || data?.error || 'Update failed', 'error'); return }
    toast(`${user.full_name} ${newVal ? 'approved ✓' : 'revoked'}`, newVal ? 'success' : 'info')
    fetchUsers()
  }

  async function updateRole(userId, newRole) {
    const { data, error } = await supabase.rpc('admin_update_user', {
      target_id: userId,
      new_role:  newRole,
    })
    if (error || !data?.success) { toast(error?.message || data?.error || 'Update failed', 'error'); return }
    toast('Role updated ✓', 'success')
    fetchUsers()
  }

  const filtered = filter === 'all' ? users : filter === 'pending' ? users.filter(u => !u.approved) : users.filter(u => u.approved)

  const counts = { total: users.length, approved: users.filter(u => u.approved).length, pending: users.filter(u => !u.approved).length }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Admin settings</div><div className="page-sub">Manage user access, roles and approvals</div></div>
      </div>

      <div className="tabs">
        <button className={`tab-item ${activeTab==='users'?'active':''}`} onClick={() => setActiveTab('users')}>User management</button>
        <button className={`tab-item ${activeTab==='add'?'active':''}`} onClick={() => setActiveTab('add')}>Add user</button>
        <button className={`tab-item ${activeTab==='danger'?'active':''}`} onClick={() => setActiveTab('danger')}>Danger zone</button>
      </div>

      {/* ── Add user tab ── */}
      {activeTab === 'add' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <h3 style={{ marginBottom: 4 }}>Add a team member</h3>
          <p style={{ fontSize: 13, marginBottom: 20 }}>Pre-register someone so they're approved the moment they first log in with Google.</p>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Full name</label>
            <input type="text" placeholder="e.g. Ravi Kumar" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Email (@faceprep.in)</label>
            <input type="email" placeholder="ravi@faceprep.in" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ROLE_OPTIONS.filter(r => r !== 'admin').map(r => (
                <button key={r}
                  className={`btn btn-sm ${newRole===r?'btn-primary':'btn-secondary'}`}
                  onClick={() => setNewRole(r)}
                >{ROLES[r]}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleCreateUser} disabled={creating} style={{ width: '100%', justifyContent: 'center' }}>
            {creating ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <UserPlus size={15} />}
            {creating ? 'Adding…' : 'Add team member'}
          </button>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            💡 The person still needs to sign in using Google OAuth at fp-expenses.vercel.app. Their access will be active immediately on first login.
          </div>
        </div>
      )}

      {/* ── User management tab ── */}
      {activeTab === 'users' && (<>
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

      </>)}

      {/* ── Danger Zone tab ── */}
      {activeTab === 'danger' && (
      <div className="card" style={{ border: '0.5px solid rgba(232,69,69,0.3)', background: 'rgba(232,69,69,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
          <h3 style={{ color: 'var(--red)', fontSize: 15 }}>Danger zone — testing only</h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, maxWidth: 600 }}>
          Permanently delete <strong>all claims, fuel entries, expense entries, uploaded bill references and messages</strong>.
          Claim numbers reset to RCLAIM-00001. This is irreversible. Use only during the testing period before go-live.
        </p>

        {!wipeOpen ? (
          <button
            className="btn"
            style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '0.5px solid rgba(232,69,69,0.3)' }}
            onClick={() => setWipeOpen(true)}
          >
            <Trash2 size={14} /> Wipe all data…
          </button>
        ) : (
          <div style={{ maxWidth: 420, background: 'var(--bg-card)', border: '0.5px solid rgba(232,69,69,0.3)', borderRadius: 'var(--radius-md)', padding: 18 }}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Lock size={11} /> Secret code
              </label>
              <input
                type="password"
                placeholder="Enter the wipe secret code"
                value={secretCode}
                onChange={e => setSecretCode(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Type <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>DELETE ALL</span> to confirm</label>
              <input
                type="text"
                placeholder="DELETE ALL"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => { setWipeOpen(false); setSecretCode(''); setConfirmText('') }} disabled={wiping}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: 'var(--red)', color: 'white', flex: 1, justifyContent: 'center', opacity: (confirmText === 'DELETE ALL' && secretCode) ? 1 : 0.5 }}
                onClick={handleWipe}
                disabled={wiping || confirmText !== 'DELETE ALL' || !secretCode}
              >
                {wiping ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Trash2 size={14} />}
                {wiping ? 'Wiping…' : 'Permanently delete all data'}
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

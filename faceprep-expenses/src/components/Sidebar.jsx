import {
  LayoutDashboard, FilePlus, FileText, CheckSquare,
  BarChart3, Settings, LogOut, Users, TrendingUp
} from 'lucide-react'
import { signOut } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { ROLES } from '../lib/constants'

const NAV = [
  {
    section: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['staff','manager','finance','admin'] },
      { id: 'new-claim', label: 'New claim', icon: FilePlus, roles: ['staff','manager','admin'] },
      { id: 'my-claims', label: 'My claims', icon: FileText, roles: ['staff','manager','admin'] },
    ],
  },
  {
    section: 'Approvals',
    items: [
      { id: 'approvals', label: 'Approvals', icon: CheckSquare, roles: ['manager','finance','admin'] },
    ],
  },
  {
    section: 'Analytics',
    items: [
      { id: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['manager','finance','admin'] },
      { id: 'team', label: 'Team overview', icon: Users, roles: ['admin'] },
    ],
  },
]

export default function Sidebar({ activePage, onNavigate }) {
  const { profile } = useAuth()
  const role = profile?.role ?? 'staff'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">FP</div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.2 }}>FACE Prep</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Reimbursements</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(section => {
          const visibleItems = section.items.filter(item => item.roles.includes(role))
          if (visibleItems.length === 0) return null
          return (
            <div key={section.section}>
              <div className="nav-section-label">{section.section}</div>
              {visibleItems.map(item => (
                <button
                  key={item.id}
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '8px 10px', marginBottom: '4px'
        }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: '600', color: 'white', flexShrink: 0,
            }}>
              {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name ?? 'Loading…'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%',
                background: role === 'admin' ? 'var(--purple)' : role === 'finance' ? 'var(--blue)' : role === 'manager' ? 'var(--amber)' : 'var(--green)'
              }} />
              {ROLES[role]}
            </div>
          </div>
        </div>
        <button className="nav-item" onClick={signOut} style={{ color: 'var(--red)', width: '100%' }}>
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

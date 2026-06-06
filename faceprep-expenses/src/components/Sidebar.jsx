import { LayoutDashboard, FilePlus, FileText, CheckSquare, BarChart3, LogOut, Users, Settings, Sun, Moon } from 'lucide-react'
import { signOut } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { ROLES } from '../lib/constants'

const NAV = [
  { section: 'Main', items: [
    { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard, roles: ['staff','manager','finance','admin'] },
    { id: 'new-claim',  label: 'New claim',   icon: FilePlus,        roles: ['staff','manager','admin'] },
    { id: 'my-claims',  label: 'My claims',   icon: FileText,        roles: ['staff','manager','admin'] },
  ]},
  { section: 'Approvals', items: [
    { id: 'approvals',  label: 'Approvals',   icon: CheckSquare,     roles: ['manager','finance','admin'] },
  ]},
  { section: 'Analytics', items: [
    { id: 'analytics',  label: 'Analytics',   icon: BarChart3,       roles: ['manager','finance','admin'] },
  ]},
  { section: 'Admin', items: [
    { id: 'admin',      label: 'Admin settings', icon: Settings,     roles: ['admin'] },
  ]},
]

const ROLE_COLORS = { admin: 'var(--purple)', finance: 'var(--blue)', manager: 'var(--amber)', staff: 'var(--green)' }

export default function Sidebar({ activePage, onNavigate }) {
  const { profile } = useAuth()
  const { theme, toggle } = useTheme()
  const role = profile?.role ?? 'staff'

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{
          width: 44, height: 44,
          background: 'linear-gradient(135deg, #D85A30 60%, #B84820 100%)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(216,90,48,0.3)',
          flexShrink: 0,
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <text x="2" y="22" fontFamily="Google Sans, sans-serif" fontSize="18" fontWeight="700" fill="white">FP</text>
          </svg>
        </div>
        <div className="logo-wordmark">FACE Prep</div>
        <div className="logo-sub">Reimbursement Centre</div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(section => {
          const visible = section.items.filter(i => i.roles.includes(role))
          if (!visible.length) return null
          return (
            <div key={section.section}>
              <div className="nav-section-label">{section.section}</div>
              {visible.map(item => (
                <button key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        {/* Theme toggle */}
        <button className="theme-toggle" style={{ width: '100%', marginBottom: 6 }} onClick={toggle}>
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', marginBottom: 4 }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>{profile?.full_name?.[0]?.toUpperCase() ?? 'U'}</div>
          }
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name ?? '…'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: ROLE_COLORS[role], display: 'inline-block' }} />
              {ROLES[role]}
            </div>
          </div>
        </div>
        <button className="nav-item" onClick={signOut} style={{ color: 'var(--red)', width: '100%' }}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  )
}

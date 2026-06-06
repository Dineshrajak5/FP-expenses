import { LayoutDashboard, FilePlus, FileText, CheckSquare, BarChart3, LogOut, Settings, Sun, Moon } from 'lucide-react'
import { signOut } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { ROLES } from '../lib/constants'
import FacerepLogo from './FaceprepLogo'

const NAV = [
  { section: 'Main', items: [
    { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard, roles: ['staff','manager','finance','admin'] },
    { id: 'new-claim',  label: 'New claim',       icon: FilePlus,        roles: ['staff','manager','admin'] },
    { id: 'my-claims',  label: 'My claims',       icon: FileText,        roles: ['staff','manager','admin'] },
  ]},
  { section: 'Approvals', items: [
    { id: 'approvals',  label: 'Approvals',       icon: CheckSquare,     roles: ['manager','finance','admin'] },
  ]},
  { section: 'Analytics', items: [
    { id: 'analytics',  label: 'Analytics',       icon: BarChart3,       roles: ['manager','finance','admin'] },
  ]},
  { section: 'Admin', items: [
    { id: 'admin',      label: 'Admin settings',  icon: Settings,        roles: ['admin'] },
  ]},
]

const ROLE_COLORS = { admin: 'var(--purple)', finance: 'var(--blue)', manager: 'var(--amber)', staff: 'var(--green)' }

export default function Sidebar({ activePage, onNavigate }) {
  const { profile } = useAuth()
  const { theme, toggle } = useTheme()
  const role = profile?.role ?? 'staff'

  return (
    <aside className="sidebar">
      {/* Logo block */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 12px 18px', borderBottom: '0.5px solid var(--border)',
        marginBottom: 14, gap: 6,
      }}>
        <FacerepLogo width={148} />
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--brand)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          textAlign: 'center', lineHeight: 1.2,
        }}>
          Reimbursement Centre
        </div>
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
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={toggle}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 4 }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>{profile?.full_name?.[0]?.toUpperCase() ?? 'U'}</div>
          }
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name ?? '…'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ROLE_COLORS[role], display: 'inline-block' }} />
              {ROLES[role]}
            </div>
          </div>
        </div>
        <button className="nav-item" onClick={signOut} style={{ color: 'var(--red)' }}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  )
}

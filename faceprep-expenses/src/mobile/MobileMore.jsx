import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { signOut } from '../lib/supabase'
import { ROLES } from '../lib/constants'
import FacerepLogo from '../components/FaceprepLogo'
import {
  BarChart3, Settings, Sun, Moon, LogOut,
  ChevronRight, Shield, User
} from 'lucide-react'

const ROLE_COLORS = {
  admin:   'var(--purple)',
  finance: 'var(--blue)',
  manager: 'var(--amber)',
  staff:   'var(--green)',
}

export default function MobileMore({ onNavigate }) {
  const { profile, realProfile } = useAuth()
  const { theme, toggle } = useTheme()
  const role = profile?.role ?? 'staff'
  const isAdmin = realProfile?.role === 'admin'
  const isManager = ['manager', 'finance', 'admin'].includes(role)

  function Row({ icon: Icon, label, onPress, color, chevron = true, subtitle }) {
    return (
      <button
        onClick={onPress}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          width: '100%', padding: '14px 20px',
          background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: '0.5px solid var(--border)',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: !color ? 'var(--bg-elevated)' :
              color === 'var(--blue)'   ? 'rgba(74,158,232,0.12)'  :
              color === 'var(--purple)' ? 'rgba(155,143,238,0.12)' :
              color === 'var(--amber)'  ? 'rgba(245,166,35,0.12)'  :
              color === 'var(--red)'    ? 'rgba(232,69,69,0.12)'   :
              color === 'var(--green)'  ? 'rgba(34,196,122,0.12)'  : 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color: color || 'var(--text-secondary)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
        </div>
        {chevron && <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      </button>
    )
  }

  return (
    <div className="m-screen">
      {/* Header */}
      <div className="m-topbar">
        <div className="m-topbar-title">More</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <FacerepLogo width={80} />
        </div>
      </div>

      <div className="m-content" style={{ padding: 0, paddingBottom: 88 }}>

        {/* Profile card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 20px 16px', borderBottom: '0.5px solid var(--border)',
          background: 'var(--bg-surface)',
        }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0 }}>{profile?.full_name?.[0]?.toUpperCase()}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{profile?.email}</div>
            <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: ROLE_COLORS[role], background: role === 'admin' ? 'rgba(155,143,238,0.12)' : role === 'finance' ? 'rgba(74,158,232,0.12)' : role === 'manager' ? 'rgba(245,166,35,0.12)' : 'rgba(34,196,122,0.12)', padding: '2px 10px', borderRadius: 20 }}>
              <Shield size={10} /> {ROLES[role]}
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ background: 'var(--bg-card)', marginTop: 12, borderRadius: 0 }}>
          {isManager && (
            <Row icon={BarChart3} label="Analytics" color="var(--blue)" onPress={() => onNavigate('analytics')} />
          )}
          {isAdmin && (
            <Row icon={Settings} label="Admin settings" color="var(--purple)" subtitle="Users, roles, data wipe" onPress={() => onNavigate('admin')} />
          )}
        </div>

        {/* Preferences */}
        <div style={{ background: 'var(--bg-card)', marginTop: 12 }}>
          <Row
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            color="var(--amber)"
            chevron={false}
            onPress={toggle}
          />
        </div>

        {/* Sign out */}
        <div style={{ background: 'var(--bg-card)', marginTop: 12 }}>
          <Row icon={LogOut} label="Sign out" color="var(--red)" chevron={false} onPress={signOut} />
        </div>

        {/* App version */}
        <div style={{ padding: '20px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
          FACE Prep Reimbursement Centre · v1.0
        </div>
      </div>
    </div>
  )
}

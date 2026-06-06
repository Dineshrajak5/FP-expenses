import { useAuth } from '../hooks/useAuth'
import { useImpersonate } from '../hooks/useImpersonate'
import { ROLES } from '../lib/constants'

const ROLE_ORDER = ['staff', 'manager', 'finance', 'admin']

const ROLE_STYLES = {
  staff:   { color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'rgba(34,196,122,0.25)' },
  manager: { color: 'var(--amber)',  bg: 'var(--amber-bg)',  border: 'rgba(245,166,35,0.25)' },
  finance: { color: 'var(--blue)',   bg: 'var(--blue-bg)',   border: 'rgba(74,158,232,0.25)' },
  admin:   { color: 'var(--purple)', bg: 'var(--purple-bg)', border: 'rgba(155,143,238,0.25)' },
}

export default function RoleToggle() {
  const { profile } = useAuth()
  const { impersonatedRole, setImpersonatedRole } = useImpersonate()

  // Only show to real admins
  if (profile?.role !== 'admin') return null

  const activeRole = impersonatedRole || 'admin'
  const s = ROLE_STYLES[activeRole]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--bg-card)',
      border: `0.5px solid ${s.border}`,
      borderRadius: 'var(--radius-md)',
      padding: '5px 6px 5px 12px',
      boxShadow: `0 0 0 3px ${s.bg}`,
      transition: 'all 0.2s',
    }}>
      {/* Preview label */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        👁 Previewing as
      </div>

      {/* Role pills */}
      <div style={{ display: 'flex', gap: 3 }}>
        {ROLE_ORDER.map(role => {
          const active = activeRole === role
          const rs = ROLE_STYLES[role]
          return (
            <button
              key={role}
              onClick={() => setImpersonatedRole(role === 'admin' ? null : role)}
              style={{
                padding: '4px 11px',
                borderRadius: 20,
                border: `0.5px solid ${active ? rs.border : 'transparent'}`,
                background: active ? rs.bg : 'transparent',
                color: active ? rs.color : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                fontFamily: 'var(--font)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {ROLES[role]}
            </button>
          )
        })}
      </div>

      {/* Active indicator */}
      {impersonatedRole && (
        <div style={{
          fontSize: 10, fontWeight: 600,
          color: s.color,
          background: s.bg,
          border: `0.5px solid ${s.border}`,
          padding: '2px 8px',
          borderRadius: 20,
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
        }}>
          PREVIEW MODE
        </div>
      )}
    </div>
  )
}

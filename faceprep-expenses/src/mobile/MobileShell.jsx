import { useState } from 'react'
import { LayoutDashboard, FilePlus, FileText, CheckSquare } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import MobileDashboard from './MobileDashboard'
import MobileNewClaim from './MobileNewClaim'
import MobileMyClaims from './MobileMyClaims'
import MobileApprovals from './MobileApprovals'
import '../styles/mobile.css'

const TABS = [
  { id: 'dashboard', label: 'Home',    icon: LayoutDashboard, roles: ['staff','manager','finance','admin'] },
  { id: 'new-claim', label: 'New',     icon: FilePlus,        roles: ['staff','manager','admin'] },
  { id: 'my-claims', label: 'Claims',  icon: FileText,        roles: ['staff','manager','admin'] },
  { id: 'approvals', label: 'Approve', icon: CheckSquare,     roles: ['manager','finance','admin'] },
]

export default function MobileShell() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [resubmitClaim, setResubmitClaim] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const role = profile?.role ?? 'staff'
  const visibleTabs = TABS.filter(t => t.roles.includes(role))

  function handleResubmit(claim) { setResubmitClaim(claim); setTab('new-claim') }
  function handleNavigate(t)     { setResubmitClaim(null);  setTab(t) }

  const pages = {
    'dashboard': <MobileDashboard onNavigate={handleNavigate} onPendingCount={setPendingCount} />,
    'new-claim': <MobileNewClaim  onNavigate={handleNavigate} editClaim={resubmitClaim} />,
    'my-claims': <MobileMyClaims  onNavigate={handleNavigate} onResubmit={handleResubmit} />,
    'approvals': <MobileApprovals onNavigate={handleNavigate} />,
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <div className="m-page-enter" key={tab}>
        {pages[tab] ?? pages['dashboard']}
      </div>
      <nav className="m-bottomnav">
        {visibleTabs.map(t => (
          <button key={t.id} className={`m-nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => handleNavigate(t.id)}>
            <t.icon size={22} strokeWidth={tab === t.id ? 2.2 : 1.6} />
            {t.id === 'approvals' && pendingCount > 0 && <span className="m-nav-dot" />}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

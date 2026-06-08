import { useState } from 'react'
import { LayoutDashboard, FilePlus, FileText, CheckSquare, MoreHorizontal } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import MobileDashboard  from './MobileDashboard'
import MobileNewClaim   from './MobileNewClaim'
import MobileMyClaims   from './MobileMyClaims'
import MobileApprovals  from './MobileApprovals'
import MobileDrafts     from './MobileDrafts'
import MobileMore       from './MobileMore'
import '../styles/mobile.css'

// Pages that don't have bottom nav tabs — reached via More menu
import AnalyticsPage from '../pages/AnalyticsPage'
import AdminPage     from '../pages/AdminPage'

// Bottom nav tabs — max 5, role-filtered
const TABS = [
  { id: 'dashboard', label: 'Home',    icon: LayoutDashboard, roles: ['staff','manager','finance','admin'] },
  { id: 'new-claim', label: 'New',     icon: FilePlus,        roles: ['staff','manager','admin'] },
  { id: 'my-claims', label: 'Claims',  icon: FileText,        roles: ['staff','manager','admin'] },
  { id: 'approvals', label: 'Approve', icon: CheckSquare,     roles: ['manager','finance','admin'] },
  { id: 'more',      label: 'More',    icon: MoreHorizontal,  roles: ['staff','manager','finance','admin'] },
]

export default function MobileShell() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [resubmitClaim, setResubmitClaim] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [draftData, setDraftData] = useState(null)
  const role = profile?.role ?? 'staff'
  const visibleTabs = TABS.filter(t => t.roles.includes(role))

  // More-tab pages should highlight the More tab
  const MORE_PAGES = ['more', 'analytics', 'admin', 'drafts']
  const activeTab = MORE_PAGES.includes(tab) ? 'more' : tab

  function handleResubmit(claim) { setResubmitClaim(claim); setTab('new-claim') }
  function handleNavigate(t)     { setResubmitClaim(null);  setTab(t) }

  const pages = {
    'dashboard': <MobileDashboard  onNavigate={handleNavigate} onPendingCount={setPendingCount} />,
    'new-claim': <MobileNewClaim   onNavigate={handleNavigate} editClaim={resubmitClaim}
                    draftData={draftData?.draft_data ? { ...draftData.draft_data, draftId: draftData.id } : null} />,
    'my-claims': <MobileMyClaims   onNavigate={handleNavigate} onResubmit={handleResubmit} />,
    'approvals': <MobileApprovals  onNavigate={handleNavigate} />,
    'drafts':    <MobileDrafts     onNavigate={handleNavigate}
                    onResumeDraft={(d) => { setDraftData(d); handleNavigate('new-claim') }} />,
    'analytics': (
      // Wrap desktop AnalyticsPage in mobile-friendly scrollable container
      <div className="m-screen">
        <div className="m-topbar">
          <button className="m-back" onClick={() => handleNavigate('more')}>← More</button>
          <div className="m-topbar-title">Analytics</div>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px', paddingBottom: 88, flex: 1 }}>
          <AnalyticsPage />
        </div>
      </div>
    ),
    'admin': (
      <div className="m-screen">
        <div className="m-topbar">
          <button className="m-back" onClick={() => handleNavigate('more')}>← More</button>
          <div className="m-topbar-title">Admin</div>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px', paddingBottom: 88, flex: 1 }}>
          <AdminPage />
        </div>
      </div>
    ),
    'more': <MobileMore onNavigate={handleNavigate} />,
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div className="m-page-enter" key={tab} style={{ flex: 1 }}>
        {pages[tab] ?? pages['dashboard']}
      </div>

      <nav className="m-bottomnav">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            className={`m-nav-item ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => handleNavigate(t.id)}
          >
            <t.icon size={22} strokeWidth={activeTab === t.id ? 2.2 : 1.6} />
            {t.id === 'approvals' && pendingCount > 0 && <span className="m-nav-dot" />}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

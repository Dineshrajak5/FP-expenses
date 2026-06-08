import { useState } from 'react'
import { LayoutDashboard, FilePlus, FileText, CheckSquare, MoreHorizontal } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import ErrorBoundary from '../components/ErrorBoundary'
import MobileDashboard  from './MobileDashboard'
import MobileNewClaim   from './MobileNewClaim'
import MobileMyClaims   from './MobileMyClaims'
import MobileApprovals  from './MobileApprovals'
import MobileDrafts     from './MobileDrafts'
import MobileMore       from './MobileMore'
import AnalyticsPage    from '../pages/AnalyticsPage'
import AdminPage        from '../pages/AdminPage'
import '../styles/mobile.css'

const TABS = [
  { id: 'dashboard', label: 'Home',    icon: LayoutDashboard, roles: ['staff','manager','finance','admin'] },
  { id: 'new-claim', label: 'New',     icon: FilePlus,        roles: ['staff','manager','admin'] },
  { id: 'my-claims', label: 'Claims',  icon: FileText,        roles: ['staff','manager','admin'] },
  { id: 'approvals', label: 'Approve', icon: CheckSquare,     roles: ['manager','finance','admin'] },
  { id: 'more',      label: 'More',    icon: MoreHorizontal,  roles: ['staff','manager','finance','admin'] },
]

const MORE_PAGES = ['more', 'analytics', 'admin', 'drafts']

export default function MobileShell() {
  const { profile } = useAuth()
  const [tab, setTab]                   = useState('dashboard')
  const [resubmitClaim, setResubmitClaim] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [draftData, setDraftData]       = useState(null)

  const role        = profile?.role ?? 'staff'
  const visibleTabs = TABS.filter(t => t.roles.includes(role))
  const activeTab   = MORE_PAGES.includes(tab) ? 'more' : tab

  function handleResubmit(claim) { setResubmitClaim(claim); setTab('new-claim') }
  function handleNavigate(t)     { setResubmitClaim(null);  setTab(t) }

  function renderPage() {
    switch (tab) {
      case 'dashboard':
        return <MobileDashboard onNavigate={handleNavigate} onPendingCount={setPendingCount} />
      case 'new-claim':
        return <MobileNewClaim
          onNavigate={handleNavigate}
          editClaim={resubmitClaim}
          draftData={draftData?.draft_data ? { ...draftData.draft_data, draftId: draftData.id } : null}
        />
      case 'my-claims':
        return <MobileMyClaims onNavigate={handleNavigate} onResubmit={handleResubmit} />
      case 'approvals':
        return <MobileApprovals onNavigate={handleNavigate} />
      case 'drafts':
        return <MobileDrafts
          onNavigate={handleNavigate}
          onResumeDraft={(d) => { setDraftData(d); handleNavigate('new-claim') }}
        />
      case 'analytics':
        return (
          <div className="m-screen">
            <div className="m-topbar">
              <button className="m-back" onClick={() => handleNavigate('more')}>← More</button>
              <div className="m-topbar-title">Analytics</div>
            </div>
            <div style={{ overflowY: 'auto', padding: '16px', paddingBottom: 88, flex: 1 }}>
              <AnalyticsPage />
            </div>
          </div>
        )
      case 'admin':
        return (
          <div className="m-screen">
            <div className="m-topbar">
              <button className="m-back" onClick={() => handleNavigate('more')}>← More</button>
              <div className="m-topbar-title">Admin</div>
            </div>
            <div style={{ overflowY: 'auto', padding: '16px', paddingBottom: 88, flex: 1 }}>
              <AdminPage />
            </div>
          </div>
        )
      case 'more':
      default:
        return <MobileMore onNavigate={handleNavigate} />
    }
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <ErrorBoundary key={tab}>
        <div className="m-page-enter" style={{ flex: 1 }}>
          {renderPage()}
        </div>
      </ErrorBoundary>

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

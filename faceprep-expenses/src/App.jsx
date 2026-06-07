import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { ImpersonateProvider } from './hooks/useImpersonate'
import { ToastProvider } from './components/Toast'
import { useDevice } from './hooks/useDevice'
import Sidebar from './components/Sidebar'
import RoleToggle from './components/RoleToggle'
import MobileShell from './mobile/MobileShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NewClaimPage from './pages/NewClaimPage'
import MyClaimsPage from './pages/MyClaimsPage'
import ApprovalsPage from './pages/ApprovalsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AdminPage from './pages/AdminPage'
import { isMisconfigured } from './lib/supabase'
import './styles/global.css'

function MisconfiguredScreen() {
  return (
    <div style={{ minHeight:'100vh',background:'var(--bg-base)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
      <div style={{ maxWidth:480,width:'100%' }}>
        <div className="card" style={{ padding:32,borderRadius:18 }}>
          <div style={{ width:44,height:44,background:'#F05136',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',fontSize:14,marginBottom:20 }}>FP</div>
          <h2 style={{ marginBottom:8 }}>Setup required</h2>
          <p style={{ fontSize:13,marginBottom:20 }}>Supabase environment variables are missing.</p>
          <div style={{ background:'var(--bg-elevated)',borderRadius:8,padding:14,fontFamily:'var(--mono)',fontSize:12,marginBottom:20 }}>
            <div style={{ color:'var(--text-muted)',marginBottom:6 }}># Add to Vercel → Settings → Environment Variables</div>
            <div style={{ color:'var(--green)' }}>VITE_SUPABASE_URL=https://xxx.supabase.co</div>
            <div style={{ color:'var(--green)' }}>VITE_SUPABASE_ANON_KEY=eyJ...</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DesktopShell() {
  const { user, profile, realProfile, loading } = useAuth()
  const [page, setPageState] = useState(() => sessionStorage.getItem('fp-page') || 'dashboard')
  const setPage = (p) => { sessionStorage.setItem('fp-page', p); setPageState(p) }
  const [resubmitClaim, setResubmitClaim] = useState(null)

  if (loading) return (
    <div className="loading-screen">
      <div style={{ width:48,height:48,background:'#F05136',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',fontSize:15,marginBottom:8 }}>FP</div>
      <div className="spinner" />
      <div style={{ fontSize:13,color:'var(--text-muted)',marginTop:8 }}>Loading portal…</div>
    </div>
  )

  if (!user) return <LoginPage />

  const handleNavigate = (p) => { setResubmitClaim(null); setPage(p) }
  const handleResubmit = (claim) => { setResubmitClaim(claim); setPage('new-claim') }

  const pages = {
    dashboard:   <DashboardPage onNavigate={handleNavigate} />,
    'new-claim': <NewClaimPage  onNavigate={(p)=>{ setResubmitClaim(null); setPage(p) }} editClaim={resubmitClaim} />,
    'my-claims': <MyClaimsPage  onResubmit={handleResubmit} />,
    approvals:   <ApprovalsPage />,
    analytics:   <AnalyticsPage />,
    admin:       <AdminPage />,
  }

  const allowed = {
    staff:   ['dashboard','new-claim','my-claims'],
    manager: ['dashboard','new-claim','my-claims','approvals','analytics'],
    finance: ['dashboard','approvals','analytics'],
    admin:   ['dashboard','new-claim','my-claims','approvals','analytics','admin'],
  }
  const role = profile?.role ?? 'admin'
  const currentPage = allowed[role]?.includes(page) ? page : 'dashboard'

  return (
    <div className="app-shell">
      <Sidebar activePage={currentPage} onNavigate={handleNavigate} />
      <div style={{ display:'flex',flexDirection:'column',overflow:'hidden',maxHeight:'100vh' }}>
        {realProfile?.role === 'admin' && (
          <div style={{ display:'flex',justifyContent:'flex-end',alignItems:'center',padding:'10px 32px',borderBottom:'0.5px solid var(--border)',background:'var(--bg-surface)',minHeight:52,gap:12 }}>
            {profile?._impersonating && (
              <div style={{ fontSize:12,color:'var(--text-muted)' }}>
                Viewing as <strong style={{ color:'var(--text-primary)' }}>{role}</strong> — your actual role is unaffected
              </div>
            )}
            <RoleToggle />
          </div>
        )}
        <main className="main-content" style={{ flex:1,overflowY:'auto' }}>
          {pages[currentPage] ?? pages['dashboard']}
        </main>
      </div>
    </div>
  )
}

function MobileAuthShell() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="loading-screen">
      <div style={{ width:56,height:56,background:'#F05136',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',fontSize:18,marginBottom:12 }}>FP</div>
      <div className="spinner" />
      <div style={{ fontSize:13,color:'var(--text-muted)',marginTop:10 }}>Loading…</div>
    </div>
  )

  if (!user) return <LoginPage />
  return <MobileShell />
}

function AppContent() {
  const { isMobile } = useDevice()
  return isMobile ? <MobileAuthShell /> : <DesktopShell />
}

export default function App() {
  if (isMisconfigured) return <ThemeProvider><MisconfiguredScreen /></ThemeProvider>
  return (
    <ThemeProvider>
      <ImpersonateProvider>
        <AuthProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </ImpersonateProvider>
    </ThemeProvider>
  )
}

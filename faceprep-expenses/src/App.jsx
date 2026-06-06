import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { ToastProvider } from './components/Toast'
import Sidebar from './components/Sidebar'
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div className="card" style={{ padding: 32, borderRadius: 18 }}>
          <div style={{ width: 44, height: 44, background: '#D85A30', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 14, marginBottom: 20 }}>FP</div>
          <h2 style={{ marginBottom: 8 }}>Setup required</h2>
          <p style={{ fontSize: 13, marginBottom: 20 }}>Supabase environment variables are missing.</p>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 14, fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 20 }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}># Add to Vercel → Settings → Environment Variables</div>
            <div style={{ color: '#1D9E75' }}>VITE_SUPABASE_URL=https://xxx.supabase.co</div>
            <div style={{ color: '#1D9E75' }}>VITE_SUPABASE_ANON_KEY=eyJ...</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>After adding, redeploy from Vercel dashboard.</p>
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [resubmitClaim, setResubmitClaim] = useState(null)

  if (loading) return (
    <div className="loading-screen">
      <div style={{ width: 48, height: 48, background: '#D85A30', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 15, marginBottom: 8 }}>FP</div>
      <div className="spinner" />
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Loading portal…</div>
    </div>
  )

  if (!user) return <LoginPage />

  function handleResubmit(claim) {
    setResubmitClaim(claim)
    setPage('new-claim')
  }

  const pages = {
    dashboard:   <DashboardPage onNavigate={setPage} />,
    'new-claim': <NewClaimPage onNavigate={(p) => { setResubmitClaim(null); setPage(p) }} editClaim={resubmitClaim} />,
    'my-claims': <MyClaimsPage onResubmit={handleResubmit} />,
    approvals:   <ApprovalsPage />,
    analytics:   <AnalyticsPage />,
    admin:       <AdminPage />,
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={page} onNavigate={(p) => { setResubmitClaim(null); setPage(p) }} />
      <main className="main-content">
        {pages[page] ?? pages['dashboard']}
      </main>
    </div>
  )
}

export default function App() {
  if (isMisconfigured) return <ThemeProvider><MisconfiguredScreen /></ThemeProvider>
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

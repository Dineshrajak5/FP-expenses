import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NewClaimPage from './pages/NewClaimPage'
import MyClaimsPage from './pages/MyClaimsPage'
import ApprovalsPage from './pages/ApprovalsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import './styles/global.css'

function AppShell() {
  const { user, profile, loading } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="logo-mark" style={{ width: 44, height: 44, fontSize: 14, borderRadius: 12, background: '#D85A30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white' }}>FP</div>
        <div className="spinner" />
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading portal…</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  const pages = {
    dashboard:  <DashboardPage onNavigate={setPage} />,
    'new-claim': <NewClaimPage onNavigate={setPage} />,
    'my-claims': <MyClaimsPage />,
    approvals:   <ApprovalsPage />,
    analytics:   <AnalyticsPage />,
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={page} onNavigate={setPage} />
      <main className="main-content">
        {pages[page] ?? pages['dashboard']}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  )
}

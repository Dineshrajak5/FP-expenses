import { useState } from 'react'
import { signInWithGoogle, ALLOWED_DOMAIN } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { domainError } = useAuth()

  async function handleLogin() {
    setLoading(true); setError(null)
    try { await signInWithGoogle() }
    catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      {/* Grid bg */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.6 }} />
      {/* Glow */}
      <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(216,90,48,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
        {/* Logo block */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 14 }}>
            {/* FACE Prep Logo — orange FP mark */}
            <div style={{
              width: 64, height: 64,
              background: 'linear-gradient(135deg, #D85A30 60%, #B84820 100%)',
              borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto',
              boxShadow: '0 8px 32px rgba(216,90,48,0.35), 0 0 0 1px rgba(216,90,48,0.2)',
            }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <text x="4" y="27" fontFamily="Google Sans, sans-serif" fontSize="22" fontWeight="700" fill="white">FP</text>
              </svg>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>FACE Prep</div>
          <div style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 500, marginTop: 2 }}>Reimbursement Centre</div>
        </div>

        <div className="card" style={{ padding: 28, borderRadius: 18, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
          <h2 style={{ marginBottom: 4, fontSize: '1rem' }}>Welcome back</h2>
          <p style={{ fontSize: 12, marginBottom: 22, color: 'var(--text-muted)' }}>
            Sign in with your <span style={{ color: 'var(--brand)', fontFamily: 'var(--mono)' }}>@{ALLOWED_DOMAIN}</span> account
          </p>

          {(domainError || error) && (
            <div style={{ background: 'var(--red-bg)', border: '0.5px solid rgba(226,75,74,0.25)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 12, color: 'var(--red)', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {domainError ? `Access is restricted to @${ALLOWED_DOMAIN} accounts only.` : error}
            </div>
          )}

          <button className="btn btn-secondary" onClick={handleLogin} disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: 11, fontSize: 13, gap: 10 }}>
            {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div style={{ marginTop: 18, padding: '10px 12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            🔒 Restricted to FACE Prep employees only. Contact your admin if you need access.
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} FACE Prep · Internal use only
        </div>
      </div>
    </div>
  )
}

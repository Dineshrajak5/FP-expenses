import { useState } from 'react'
import { signInWithGoogle, ALLOWED_DOMAIN } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { AlertCircle } from 'lucide-react'
import FacerepLogo from '../components/FaceprepLogo'

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
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      {/* Grid bg */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '48px 48px', opacity: 0.7,
      }} />
      {/* Glow */}
      <div style={{
        position: 'fixed', top: '35%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(240,81,54,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
        {/* Logo + tool name */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <FacerepLogo width={220} />
          </div>
          {/* Tool name — prominent */}
          <div style={{
            fontSize: 18, fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            marginBottom: 4,
          }}>
            Reimbursement Centre
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Internal expense management portal
          </div>
        </div>

        {/* Sign-in card */}
        <div className="card" style={{ padding: 30, borderRadius: 18, boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }}>
          <h2 style={{ marginBottom: 5, fontSize: '1.1rem' }}>Sign in</h2>
          <p style={{ fontSize: 13, marginBottom: 24, color: 'var(--text-muted)' }}>
            Use your <span style={{ color: 'var(--brand)', fontFamily: 'var(--mono)' }}>@{ALLOWED_DOMAIN}</span> Google account to continue
          </p>

          {(domainError || error) && (
            <div style={{
              background: 'var(--red-bg)', border: '0.5px solid rgba(232,69,69,0.25)',
              borderRadius: 'var(--radius-sm)', padding: '11px 13px', fontSize: 13,
              color: 'var(--red)', marginBottom: 18, display: 'flex', gap: 9, alignItems: 'flex-start',
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {domainError ? `Access is restricted to @${ALLOWED_DOMAIN} accounts only.` : error}
            </div>
          )}

          <button
            className="btn btn-secondary"
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: 13, fontSize: 15, gap: 11 }}
          >
            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div style={{
            marginTop: 20, padding: '11px 13px',
            background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)',
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
          }}>
            🔒 Restricted to FACE Prep employees only. Contact your admin if you need access.
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} FACE Prep · Internal use only
        </div>
      </div>
    </div>
  )
}

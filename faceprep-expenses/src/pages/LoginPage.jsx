import { useState } from 'react'
import { signInWithGoogle, ALLOWED_DOMAIN } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { domainError } = useAuth()

  async function handleLogin() {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        opacity: 0.5,
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '52px', height: '52px',
            background: 'var(--brand)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '16px', fontWeight: '700', color: 'white', letterSpacing: '0.03em',
            boxShadow: '0 8px 32px rgba(216,90,48,0.35)',
          }}>FP</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
            FACE Prep
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Reimbursement Portal
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px', borderRadius: '18px' }}>
          <h2 style={{ marginBottom: '6px', fontSize: '1.1rem' }}>Sign in</h2>
          <p style={{ fontSize: '12px', marginBottom: '24px', color: 'var(--text-muted)' }}>
            Use your <span style={{ color: 'var(--brand)', fontFamily: 'var(--mono)' }}>@{ALLOWED_DOMAIN}</span> Google account to continue
          </p>

          {(domainError || error) && (
            <div style={{
              background: 'var(--red-bg)',
              border: '0.5px solid rgba(226,75,74,0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              fontSize: '12px',
              color: 'var(--red)',
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              {domainError
                ? `Access restricted to @${ALLOWED_DOMAIN} accounts. Please use your FACE Prep Google account.`
                : error}
            </div>
          )}

          <button
            className="btn btn-secondary"
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '13px', gap: '10px' }}
          >
            {loading ? (
              <div className="spinner" style={{ width: 16, height: 16 }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div style={{ marginTop: '20px', padding: '12px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            🔒 Access is restricted to FACE Prep employees. Your account must belong to the <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>faceprep.in</span> domain.
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} FACE Prep · Internal portal
        </div>
      </div>
    </div>
  )
}

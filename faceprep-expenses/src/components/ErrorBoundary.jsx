import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100dvh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 24, background: 'var(--bg-base)',
          flexDirection: 'column', gap: 16, textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--red-bg)', border: '0.5px solid rgba(232,69,69,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26,
          }}>⚠️</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, maxWidth: 280 }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </div>
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{
              background: 'var(--brand)', color: 'white', border: 'none',
              borderRadius: 12, padding: '12px 28px', fontSize: 15,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
            }}
          >
            Reload app
          </button>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              background: 'none', color: 'var(--text-muted)', border: 'none',
              fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
            }}
          >
            Try without reloading
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

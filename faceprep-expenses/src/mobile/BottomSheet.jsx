import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function BottomSheet({ open, onClose, title, children, footer }) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="m-sheet-overlay" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="m-sheet">
        <div className="m-sheet-handle" />
        <div className="m-sheet-header">
          <div className="m-sheet-title">{title}</div>
          <button
            onClick={onClose}
            style={{ background: 'var(--bg-elevated)', border: 'none', cursor: 'pointer', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="m-sheet-body">{children}</div>
        {footer && <div className="m-sheet-footer">{footer}</div>}
      </div>
    </div>
  )
}

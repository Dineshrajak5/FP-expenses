import { useRef, useState } from 'react'
import { Upload, FileCheck, X, Eye } from 'lucide-react'
import { getBillUrl } from '../lib/storage'

export default function UploadZone({ file, onFileSelect, existingUrl, label = 'Upload bill' }) {
  const ref = useRef()
  const [viewing, setViewing] = useState(false)

  async function handleView() {
    if (existingUrl) { window.open(existingUrl, '_blank'); return }
    setViewing(true)
    try {
      const url = await getBillUrl(file._path || file.name)
      window.open(url, '_blank')
    } catch {}
    setViewing(false)
  }

  return (
    <div>
      {file ? (
        <div className="upload-zone has-file" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 14px' }}>
          <FileCheck size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name || 'Bill uploaded'}
          </span>
          <button className="btn btn-ghost btn-xs" onClick={() => onFileSelect(null)} style={{ color: 'var(--red)' }}>
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="upload-zone" onClick={() => ref.current.click()}>
          <Upload size={16} style={{ color: 'var(--text-muted)', margin: '0 auto 6px' }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>PDF, JPG, PNG · max 5MB</div>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={e => onFileSelect(e.target.files[0] || null)}
      />
      {(file || existingUrl) && (
        <button className="btn btn-ghost btn-xs" style={{ marginTop: 4, color: 'var(--blue)' }} onClick={handleView} disabled={viewing}>
          <Eye size={12} /> {viewing ? 'Opening…' : 'View bill'}
        </button>
      )}
    </div>
  )
}

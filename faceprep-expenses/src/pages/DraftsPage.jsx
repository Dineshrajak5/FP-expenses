import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchDrafts, deleteDraftById } from '../hooks/useDraft'
import { formatCurrency } from '../lib/constants'
import { FileEdit, Trash2, Clock, Plus } from 'lucide-react'

export default function DraftsPage({ onNavigate, onResumeDraft }) {
  const { profile } = useAuth()
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    setLoading(true)
    const data = await fetchDrafts(profile.id)
    setDrafts(data)
    setLoading(false)
  }

  async function handleDelete(id) {
    await deleteDraftById(id)
    setDrafts(p => p.filter(d => d.id !== id))
  }

  function summariseDraft(d) {
    const data = d.draft_data || {}
    const fuelRows = data.fuelRows || []
    const expRows  = data.expRows  || []
    const rate     = 8.5 // rough default for preview
    const fuelAmt  = fuelRows.reduce((s, r) => s + (parseFloat(r.km) || 0) * rate, 0)
    const expAmt   = expRows.reduce((s, r)  => s + (parseFloat(r.amount) || 0), 0)
    return {
      period: data.period_from && data.period_to
        ? `${data.period_from} → ${data.period_to}`
        : 'Period not set',
      vehicle: data.vehicle_type || 'Car',
      fuelJourneys: fuelRows.filter(r => r.from || r.km).length,
      expenses: expRows.filter(r => r.desc || r.amount).length,
      estimatedTotal: fuelAmt + expAmt,
    }
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)
    if (mins < 1)   return 'Just now'
    if (mins < 60)  return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Drafts</div>
          <div className="page-sub">Saved automatically as you fill — pick up where you left off</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('new-claim')}>
          <Plus size={14} /> New claim
        </button>
      </div>

      {loading ? (
        <div style={{ display:'flex',justifyContent:'center',padding:60 }}><div className="spinner" /></div>
      ) : drafts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FileEdit size={36} />
            <div style={{ marginTop:12,fontWeight:600,color:'var(--text-primary)' }}>No drafts saved yet</div>
            <div style={{ marginTop:6,fontSize:13 }}>Start filling a claim and it autosaves here every few seconds.</div>
            <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => onNavigate('new-claim')}>
              <Plus size={14} /> Start a new claim
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          {drafts.map(d => {
            const s = summariseDraft(d)
            return (
              <div key={d.id} className="card" style={{ display:'flex',alignItems:'center',gap:16,cursor:'pointer' }}
                onClick={() => onResumeDraft(d)}>
                <div style={{ width:44,height:44,borderRadius:12,background:'rgba(240,81,54,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  <FileEdit size={20} style={{ color:'var(--brand)' }} />
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:600,fontSize:14,color:'var(--text-primary)',marginBottom:3 }}>{s.period}</div>
                  <div style={{ fontSize:12,color:'var(--text-secondary)',display:'flex',gap:14,flexWrap:'wrap' }}>
                    <span>🚗 {s.vehicle}</span>
                    {s.fuelJourneys > 0 && <span>⛽ {s.fuelJourneys} journey{s.fuelJourneys > 1 ? 's' : ''}</span>}
                    {s.expenses > 0 && <span>🧾 {s.expenses} expense{s.expenses > 1 ? 's' : ''}</span>}
                  </div>
                  <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:4,display:'flex',alignItems:'center',gap:4 }}>
                    <Clock size={11} /> Last edited {timeAgo(d.updated_at)}
                  </div>
                </div>
                <div style={{ textAlign:'right',flexShrink:0 }}>
                  {s.estimatedTotal > 0 && (
                    <div style={{ fontFamily:'var(--mono)',fontSize:15,fontWeight:700,color:'var(--text-primary)',marginBottom:6 }}>
                      ~{formatCurrency(s.estimatedTotal)}
                    </div>
                  )}
                  <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={e => { e.stopPropagation(); onResumeDraft(d) }}
                    >Resume</button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={e => { e.stopPropagation(); handleDelete(d.id) }}
                    ><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchDrafts, deleteDraftById } from '../hooks/useDraft'
import { formatCurrency } from '../lib/constants'
import { FileEdit, Trash2, Clock, Plus, ChevronRight } from 'lucide-react'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function MobileDrafts({ onNavigate, onResumeDraft }) {
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

  function summarise(d) {
    const data = d.draft_data || {}
    const fuelRows = data.fuelRows || []
    const expRows  = data.expRows  || []
    const expAmt   = expRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    return {
      period: data.period_from ? `${data.period_from} → ${data.period_to || '?'}` : 'Period not set',
      vehicle: data.vehicle_type || 'Car',
      journeys: fuelRows.filter(r => r.from || r.km).length,
      expenses: expRows.filter(r => r.desc || r.amount).length,
      expAmt,
    }
  }

  return (
    <div className="m-screen">
      <div className="m-topbar">
        <div>
          <div className="m-topbar-title">Drafts</div>
          <div className="m-topbar-sub">{drafts.length} saved</div>
        </div>
        <button
          style={{ background:'var(--brand)',border:'none',borderRadius:10,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'white' }}
          onClick={() => onNavigate('new-claim')}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="m-content">
        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',padding:48 }}><div className="spinner" /></div>
        ) : drafts.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 24px' }}>
            <FileEdit size={36} style={{ color:'var(--text-muted)',opacity:0.4,margin:'0 auto 14px',display:'block' }} />
            <div style={{ fontWeight:600,fontSize:15,color:'var(--text-primary)',marginBottom:6 }}>No drafts yet</div>
            <div style={{ fontSize:13,color:'var(--text-muted)',marginBottom:20 }}>Start filling a claim — it autosaves here as you type.</div>
            <button className="m-btn m-btn-primary" style={{ maxWidth:200,margin:'0 auto' }} onClick={() => onNavigate('new-claim')}>
              <Plus size={16} /> Start a claim
            </button>
          </div>
        ) : (
          drafts.map(d => {
            const s = summarise(d)
            return (
              <div key={d.id} className="m-claim-card" style={{ display:'flex',alignItems:'center',gap:14 }}
                onClick={() => onResumeDraft(d)}>
                <div style={{ width:42,height:42,borderRadius:12,background:'rgba(240,81,54,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  <FileEdit size={20} style={{ color:'var(--brand)' }} />
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:600,fontSize:14,color:'var(--text-primary)',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{s.period}</div>
                  <div style={{ fontSize:12,color:'var(--text-secondary)',marginBottom:3 }}>
                    {s.vehicle}
                    {s.journeys > 0 && ` · ${s.journeys} journey${s.journeys>1?'s':''}`}
                    {s.expenses > 0 && ` · ${s.expenses} expense${s.expenses>1?'s':''}`}
                  </div>
                  <div style={{ fontSize:11,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4 }}>
                    <Clock size={10} /> {timeAgo(d.updated_at)}
                  </div>
                </div>
                <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,flexShrink:0 }}>
                  <button
                    style={{ background:'var(--red-bg)',border:'0.5px solid rgba(232,69,69,0.2)',borderRadius:8,padding:'4px 8px',color:'var(--red)',cursor:'pointer',fontSize:13 }}
                    onClick={e => { e.stopPropagation(); handleDelete(d.id) }}
                  ><Trash2 size={13} /></button>
                  <ChevronRight size={16} style={{ color:'var(--text-muted)' }} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

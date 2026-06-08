import { useEffect, useState } from 'react'
import { displayClaimNumber } from '../lib/claimNumber'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { formatCurrency, formatDate, CLAIM_STATUS } from '../lib/constants'
import { processLineDecisions } from '../lib/approvalLogic'
import { getBillUrl } from '../lib/storage'
import ClaimThread from '../components/ClaimThread'
import { CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp, Eye } from 'lucide-react'

const LINE_BG = { approved: 'rgba(34,196,122,0.05)', queried: 'rgba(155,143,238,0.05)', rejected: 'rgba(232,69,69,0.05)', pending: 'transparent' }
const LINE_COLOR = { approved: 'var(--green)', queried: 'var(--purple)', rejected: 'var(--red)', pending: 'var(--text-muted)' }

export default function MobileApprovals({ onNavigate }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [claims, setClaims]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [decisions, setDecisions] = useState({})
  const [saving, setSaving]     = useState(null)
  const [noteInputs, setNoteInputs] = useState({})
  const [activeTab, setActiveTab] = useState('pending')

  useEffect(() => { if (profile) fetchClaims() }, [profile])

  async function fetchClaims() {
    setLoading(true)
    const pendingStatuses = profile.role === 'finance' ? ['pending_finance'] : ['pending_manager']
    const { data } = await supabase
      .from('claims')
      .select(`*, fuel_entries(*), expense_entries(*), profiles!claims_employee_id_fkey(full_name)`)
      .in('status', [...pendingStatuses, 'approved', 'partially_approved', 'rejected'])
      .order('submitted_at', { ascending: true })
    setClaims(data ?? [])

    // Init decisions
    const d = {}
    data?.forEach(c => {
      c.fuel_entries?.forEach(f  => { d[`fuel_${f.id}`] = { status: f.status||'pending', note: f.reviewer_note||'' } })
      c.expense_entries?.forEach(e => { d[`exp_${e.id}`]  = { status: e.status||'pending', note: e.reviewer_note||'' } })
    })
    setDecisions(d)
    setLoading(false)
  }

  const pendingStatuses = profile?.role === 'finance' ? ['pending_finance'] : ['pending_manager']
  const pending = claims.filter(c => pendingStatuses.includes(c.status))
  const history = claims.filter(c => ['approved','partially_approved','rejected'].includes(c.status))
  const shown   = activeTab === 'pending' ? pending : history

  function decide(key, status, note='') {
    setDecisions(p => ({ ...p, [key]: { status, note } }))
  }

  function allDecided(c) {
    const keys = [...(c.fuel_entries?.map(f=>`fuel_${f.id}`)??[]), ...(c.expense_entries?.map(e=>`exp_${e.id}`)??[])]
    return keys.length > 0 && keys.every(k => decisions[k]?.status !== 'pending')
  }

  function summarize(c) {
    const fkeys = c.fuel_entries?.map(f=>`fuel_${f.id}`)??[]
    const ekeys = c.expense_entries?.map(e=>`exp_${e.id}`)??[]
    const all = [...fkeys,...ekeys]
    return {
      approved: all.filter(k=>decisions[k]?.status==='approved').length,
      queried:  all.filter(k=>decisions[k]?.status==='queried').length,
      rejected: all.filter(k=>decisions[k]?.status==='rejected').length,
      total: all.length,
    }
  }

  async function handleDecisions(c) {
    setSaving(c.id)
    try {
      const result = await processLineDecisions({
        claim: c, decisions, reviewerId: profile.id, role: profile.role,
        note: noteInputs[c.id]||'',
      })
      const msgs = {
        all_approved: profile.role==='manager' ? '✅ Approved → Finance' : '✅ Fully approved!',
        all_rejected: '❌ Claim rejected',
        partial: `✅ Partial · ${result.queriedCount} queried`,
      }
      toast(msgs[result.type]||'Done', result.type==='all_rejected' ? 'error' : 'success')
      fetchClaims()
      setExpanded(null)
    } catch(err) { toast(err.message,'error') }
    finally { setSaving(null) }
  }

  async function viewBill(url) {
    const s = await getBillUrl(url)
    if (s) window.open(s,'_blank')
  }

  return (
    <div className="m-screen">
      <div className="m-topbar">
        <div>
          <div className="m-topbar-title">Approvals</div>
          <div className="m-topbar-sub">{pending.length} pending</div>
        </div>
        <div style={{ fontSize: 12, background: 'var(--amber-bg)', color: 'var(--amber)', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
          {pending.length} pending
        </div>
      </div>

      {/* How-to bar */}
      <div style={{ display: 'flex', gap: 12, padding: '10px 16px', overflowX: 'auto', scrollbarWidth: 'none', background: 'var(--bg-surface)', borderBottom: '0.5px solid var(--border)' }}>
        {[['✓','Approve','var(--green)'],['?','Query','var(--purple)'],['✗','Reject','var(--red)']].map(([icon,label,color])=>(
          <div key={label} style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, fontSize:12 }}>
            <span style={{ width:20,height:20,borderRadius:6,background:color === 'var(--green)' ? 'rgba(34,196,122,0.15)' : color === 'var(--purple)' ? 'rgba(155,143,238,0.15)' : color === 'var(--red)' ? 'rgba(232,69,69,0.15)' : 'rgba(245,166,35,0.15)',color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11 }}>{icon}</span>
            <span style={{ color:'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'0.5px solid var(--border)', background:'var(--bg-surface)' }}>
        {[['pending',`Pending (${pending.length})`],['history',`History (${history.length})`]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{
            flex:1,padding:'10px',fontSize:13,fontWeight:activeTab===id?600:400,
            fontFamily:'var(--font)',color:activeTab===id?'var(--brand)':'var(--text-muted)',
            background:'none',border:'none',borderBottom:activeTab===id?'2px solid var(--brand)':'2px solid transparent',
            cursor:'pointer',
          }}>{label}</button>
        ))}
      </div>

      <div className="m-content">
        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',padding:48 }}><div className="spinner" /></div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign:'center',padding:48,color:'var(--text-muted)' }}>
            <CheckCircle size={36} style={{ color:'var(--green)',opacity:0.4,margin:'0 auto 10px' }} />
            <div style={{ fontSize:14 }}>All caught up!</div>
          </div>
        ) : (
          shown.map(c => {
            const s = summarize(c)
            const isPending = pendingStatuses.includes(c.status)
            return (
              <div key={c.id} className="m-claim-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding:'14px 16px' }} onClick={()=>setExpanded(expanded===c.id?null:c.id)}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6 }}>
                    <div>
                      <div style={{ fontFamily:'var(--mono)',fontSize:13,fontWeight:700,color:'var(--brand)',marginBottom:3 }}>{displayClaimNumber(c, claims)}</div>
                      <div style={{ fontSize:12,color:'var(--text-secondary)',fontWeight:500 }}>{c.profiles?.full_name}</div>
                      <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:1 }}>{formatDate(c.period_from)} → {formatDate(c.period_to)}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:'var(--mono)',fontSize:17,fontWeight:800,color:'var(--text-primary)' }}>{formatCurrency(c.total_amount)}</div>
                      <span className={`badge badge-${c.status}`} style={{ fontSize:10 }}>{CLAIM_STATUS[c.status]?.label??c.status}</span>
                    </div>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                    <div style={{ fontSize:11,color:'var(--text-muted)' }}>{c.vehicle_type} · {c.fuel_price_band.replace('Below Rs.','<₹')}</div>
                    {expanded===c.id ? <ChevronUp size={15} style={{ color:'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color:'var(--text-muted)' }} />}
                  </div>
                </div>

                {/* Expanded */}
                {expanded===c.id && (
                  <div style={{ borderTop:'0.5px solid var(--border)', background:'var(--bg-elevated)' }}>
                    {/* Line items */}
                    <div style={{ padding:'14px 16px' }}>
                      {/* Fuel entries */}
                      {c.fuel_entries?.filter(f=>f.from_place).map(f=>{
                        const key=`fuel_${f.id}`; const dec=decisions[key]??{status:'pending',note:''}
                        return (
                          <div key={f.id} style={{ padding:'10px 12px',borderRadius:10,marginBottom:8,background:LINE_BG[dec.status],border:`0.5px solid ${dec.status==='pending'?'var(--border)':dec.status === 'approved' ? 'rgba(34,196,122,0.2)' : dec.status === 'queried' ? 'rgba(155,143,238,0.2)' : 'rgba(232,69,69,0.2)'}`,transition:'all 0.2s' }}>
                            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6 }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)' }}>{f.from_place} → {f.to_place}</div>
                                <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>{f.distance_km}km · ₹{f.rate_per_km}/km · {formatDate(f.entry_date)}</div>
                              </div>
                              <div style={{ fontFamily:'var(--mono)',fontSize:14,fontWeight:700,marginLeft:8,color:dec.status==='pending'?'var(--text-primary)':LINE_COLOR[dec.status] }}>{formatCurrency(f.amount)}</div>
                            </div>
                            {isPending && dec.status==='pending' && (
                              <div style={{ display:'flex',gap:6 }}>
                                {[['approved','✓','var(--green)'],['queried','?','var(--purple)'],['rejected','✗','var(--red)']].map(([s,icon,color])=>(
                                  <button key={s} onClick={()=>decide(key,s)} style={{ flex:1,padding:'7px',borderRadius:8,border:`0.5px solid color-mix(in srgb,${color} 30%,transparent)`,background:color === 'var(--green)' ? 'rgba(34,196,122,0.1)' : color === 'var(--purple)' ? 'rgba(155,143,238,0.1)' : color === 'var(--red)' ? 'rgba(232,69,69,0.1)' : 'rgba(245,166,35,0.1)',color,fontWeight:700,fontSize:15,cursor:'pointer' }}>{icon}</button>
                                ))}
                              </div>
                            )}
                            {(dec.status!=='pending'||!isPending) && (
                              <div style={{ display:'flex',alignItems:'center',gap:8,justifyContent:'space-between' }}>
                                <span style={{ fontSize:11,fontWeight:600,color:LINE_COLOR[dec.status],textTransform:'uppercase',letterSpacing:'0.05em' }}>{dec.status}</span>
                                {isPending && <button style={{ fontSize:11,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer' }} onClick={()=>decide(key,'pending')}>Change</button>}
                              </div>
                            )}
                            {dec.status==='queried' && isPending && (
                              <input className="m-input" style={{ marginTop:8,fontSize:12 }} placeholder="What needs clarification?" value={dec.note}
                                onChange={e=>decide(key,'queried',e.target.value)} />
                            )}
                          </div>
                        )
                      })}

                      {/* Expense entries */}
                      {c.expense_entries?.filter(e=>e.description).map(e=>{
                        const key=`exp_${e.id}`; const dec=decisions[key]??{status:'pending',note:''}
                        return (
                          <div key={e.id} style={{ padding:'10px 12px',borderRadius:10,marginBottom:8,background:LINE_BG[dec.status],border:`0.5px solid ${dec.status==='pending'?'var(--border)':dec.status === 'approved' ? 'rgba(34,196,122,0.2)' : dec.status === 'queried' ? 'rgba(155,143,238,0.2)' : 'rgba(232,69,69,0.2)'}`,transition:'all 0.2s' }}>
                            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6 }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)' }}>{e.expense_type}</div>
                                <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>{e.description} · {formatDate(e.entry_date)}</div>
                              </div>
                              <div style={{ display:'flex',alignItems:'center',gap:8,marginLeft:8 }}>
                                {e.receipt_url && (
                                  <button style={{ background:'none',border:'none',cursor:'pointer',color:'var(--blue)' }} onClick={()=>viewBill(e.receipt_url)}><Eye size={16}/></button>
                                )}
                                <span style={{ fontFamily:'var(--mono)',fontSize:14,fontWeight:700,color:dec.status==='pending'?'var(--text-primary)':LINE_COLOR[dec.status] }}>{formatCurrency(e.amount)}</span>
                              </div>
                            </div>
                            {isPending && dec.status==='pending' && (
                              <div style={{ display:'flex',gap:6 }}>
                                {[['approved','✓','var(--green)'],['queried','?','var(--purple)'],['rejected','✗','var(--red)']].map(([s,icon,color])=>(
                                  <button key={s} onClick={()=>decide(key,s)} style={{ flex:1,padding:'7px',borderRadius:8,border:`0.5px solid color-mix(in srgb,${color} 30%,transparent)`,background:color === 'var(--green)' ? 'rgba(34,196,122,0.1)' : color === 'var(--purple)' ? 'rgba(155,143,238,0.1)' : color === 'var(--red)' ? 'rgba(232,69,69,0.1)' : 'rgba(245,166,35,0.1)',color,fontWeight:700,fontSize:15,cursor:'pointer' }}>{icon}</button>
                                ))}
                              </div>
                            )}
                            {(dec.status!=='pending'||!isPending) && (
                              <div style={{ display:'flex',alignItems:'center',gap:8,justifyContent:'space-between' }}>
                                <span style={{ fontSize:11,fontWeight:600,color:LINE_COLOR[dec.status],textTransform:'uppercase',letterSpacing:'0.05em' }}>{dec.status}</span>
                                {isPending && <button style={{ fontSize:11,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer' }} onClick={()=>decide(key,'pending')}>Change</button>}
                              </div>
                            )}
                            {dec.status==='queried' && isPending && (
                              <input className="m-input" style={{ marginTop:8,fontSize:12 }} placeholder="What needs clarification?" value={dec.note}
                                onChange={e=>decide(key,'queried',e.target.value)} />
                            )}
                          </div>
                        )
                      })}

                      {/* Fuel bill */}
                      {c.fuel_bill_url && (
                        <button className="m-btn m-btn-secondary m-btn-sm" style={{ marginBottom:12 }} onClick={()=>viewBill(c.fuel_bill_url)}>
                          <Eye size={14} /> View fuel bill
                        </button>
                      )}
                    </div>

                    {/* Thread */}
                    <div style={{ padding:'0 16px 14px' }}>
                      <div style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
                        <MessageSquare size={13} /> Thread
                      </div>
                      <ClaimThread claimId={c.id} />
                    </div>

                    {/* Submit decisions */}
                    {isPending && (
                      <div style={{ padding:'14px 16px',borderTop:'0.5px solid var(--border)',display:'flex',flexDirection:'column',gap:10 }}>
                        {/* Summary */}
                        <div style={{ display:'flex',gap:12,fontSize:12 }}>
                          {s.approved>0 && <span style={{ color:'var(--green)' }}>✓ {s.approved} approved</span>}
                          {s.queried>0  && <span style={{ color:'var(--purple)' }}>? {s.queried} queried</span>}
                          {s.rejected>0 && <span style={{ color:'var(--red)' }}>✗ {s.rejected} rejected</span>}
                          {s.total-s.approved-s.queried-s.rejected>0 && <span style={{ color:'var(--text-muted)' }}>{s.total-s.approved-s.queried-s.rejected} pending</span>}
                        </div>
                        <input className="m-input" placeholder="Overall note (optional)…" value={noteInputs[c.id]||''} onChange={e=>setNoteInputs(p=>({...p,[c.id]:e.target.value}))} />
                        <button
                          className="m-btn m-btn-primary"
                          disabled={!allDecided(c)||saving===c.id}
                          onClick={()=>handleDecisions(c)}
                          style={{ opacity:allDecided(c)?1:0.5 }}
                        >
                          {saving===c.id ? <div className="spinner" style={{ width:16,height:16 }} /> : null}
                          {saving===c.id ? 'Processing…' : allDecided(c)
                            ? s.approved===s.total ? (profile.role==='manager'?'Approve all → Finance':'Fully approve all')
                            : `Submit decisions (${s.approved}✓ ${s.queried>0?s.queried+'? ':''}${s.rejected>0?s.rejected+'✗':''})`
                            : `Review all ${s.total} items first`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

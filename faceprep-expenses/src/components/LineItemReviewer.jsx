import { useState } from 'react'
import { CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { formatCurrency, formatDate, LINE_STATUS } from '../lib/constants'
import { getBillUrl } from '../lib/storage'

function LineStatusBadge({ status }) {
  const s = LINE_STATUS[status] ?? LINE_STATUS.pending
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px',
      borderRadius: 12, background: s.bg, color: s.color,
      whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

function LineActions({ status, onApprove, onQuery, onReject, disabled }) {
  const canQuery = !!onQuery
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  if (status !== 'pending') return <LineStatusBadge status={status} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          title="Approve this item"
          disabled={disabled}
          onClick={() => onApprove(note)}
          style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid rgba(29,158,117,0.3)', background: 'var(--green-bg)', color: 'var(--green)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        ><CheckCircle size={13} /></button>
        {canQuery && <button
          title="Query this item"
          disabled={disabled}
          onClick={() => setNoteOpen(o => !o)}
          style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid rgba(127,119,221,0.3)', background: 'var(--purple-bg)', color: 'var(--purple)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        ><MessageSquare size={13} /></button>}
        <button
          title="Reject this item"
          disabled={disabled}
          onClick={() => onReject(note)}
          style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid rgba(226,75,74,0.2)', background: 'var(--red-bg)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        ><XCircle size={13} /></button>
      </div>
      {canQuery && noteOpen && (
        <div style={{ display: 'flex', gap: 4, width: '100%' }}>
          <input
            className="inline-input"
            style={{ flex: 1, fontSize: 11 }}
            placeholder="Note (for query/reject)…"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && onQuery) { onQuery(note); setNoteOpen(false) }
            }}
          />
          <button
            style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '0.5px solid rgba(127,119,221,0.3)', background: 'var(--purple-bg)', color: 'var(--purple)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={() => { if (onQuery) { onQuery(note); setNoteOpen(false) } }}
          >Send query</button>
        </div>
      )}
    </div>
  )
}

export default function LineItemReviewer({ claim, onSaveLineDecisions, saving, role = 'manager' }) {
  const [decisions, setDecisions] = useState(() => {
    const d = {}
    claim.fuel_entries?.forEach(f => { d[`fuel_${f.id}`] = { status: f.status || 'pending', note: f.reviewer_note || '' } })
    claim.expense_entries?.forEach(e => { d[`exp_${e.id}`] = { status: e.status || 'pending', note: e.reviewer_note || '' } })
    return d
  })

  function decide(key, status, note = '') {
    setDecisions(prev => ({ ...prev, [key]: { status, note } }))
  }

  async function viewBill(url) {
    if (!url) return
    const signed = await getBillUrl(url)
    if (signed) window.open(signed, '_blank')
  }

  const allDecided = () => {
    const keys = [
      ...(claim.fuel_entries?.map(f => `fuel_${f.id}`) ?? []),
      ...(claim.expense_entries?.map(e => `exp_${e.id}`) ?? []),
    ]
    return keys.every(k => decisions[k]?.status !== 'pending')
  }

  const summary = () => {
    const vals = Object.values(decisions)
    return {
      approved: vals.filter(v => v.status === 'approved').length,
      queried:  vals.filter(v => v.status === 'queried').length,
      rejected: vals.filter(v => v.status === 'rejected').length,
      total:    vals.length,
    }
  }

  const s = summary()
  const hasQueried  = s.queried > 0
  const hasApproved = s.approved > 0
  const allApproved = s.approved === s.total
  const allRejected = s.rejected === s.total

  return (
    <div>
      {/* Fuel entries */}
      {claim.fuel_entries?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>
              Fuel journeys · {formatCurrency(claim.fuel_amount)}
            </div>
            {claim.fuel_bill_url && (
              <button className="btn btn-ghost btn-xs" style={{ color: 'var(--blue)' }} onClick={() => viewBill(claim.fuel_bill_url)}>
                <Eye size={12} /> Fuel bill
              </button>
            )}
          </div>
          <div style={{ border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {claim.fuel_entries.map((f, i) => {
              const key = `fuel_${f.id}`
              const dec = decisions[key] ?? { status: 'pending', note: '' }
              return (
                <div key={f.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  gap: 12, padding: '10px 14px', alignItems: 'center',
                  borderBottom: i < claim.fuel_entries.length - 1 ? '0.5px solid var(--border)' : 'none',
                  background: dec.status === 'approved' ? 'rgba(29,158,117,0.04)' : dec.status === 'queried' ? 'rgba(127,119,221,0.04)' : dec.status === 'rejected' ? 'rgba(226,75,74,0.04)' : 'transparent',
                  transition: 'background 0.2s',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {f.from_place} → {f.to_place}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                      <span>{formatDate(f.entry_date)}</span>
                      <span>{f.distance_km} km × ₹{f.rate_per_km}/km</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>{formatCurrency(f.amount)}</span>
                      {f.purpose && <span>· {f.purpose}</span>}
                    </div>
                    {dec.note && dec.status !== 'pending' && (
                      <div style={{ fontSize: 11, color: dec.status === 'queried' ? 'var(--purple)' : 'var(--red)', marginTop: 3 }}>
                        💬 {dec.note}
                      </div>
                    )}
                  </div>
                  <LineActions
                    status={dec.status}
                    onApprove={note => decide(key, 'approved', note)}
                    onQuery={role !== 'finance' ? (note => decide(key, 'queried', note)) : null}
                    onReject={note => decide(key, 'rejected', note)}
                    disabled={saving}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Expense entries */}
      {claim.expense_entries?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-label">Expenses · {formatCurrency(claim.expense_amount)}</div>
          <div style={{ border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {claim.expense_entries.map((e, i) => {
              const key = `exp_${e.id}`
              const dec = decisions[key] ?? { status: 'pending', note: '' }
              return (
                <div key={e.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  gap: 12, padding: '10px 14px', alignItems: 'center',
                  borderBottom: i < claim.expense_entries.length - 1 ? '0.5px solid var(--border)' : 'none',
                  background: dec.status === 'approved' ? 'rgba(29,158,117,0.04)' : dec.status === 'queried' ? 'rgba(127,119,221,0.04)' : dec.status === 'rejected' ? 'rgba(226,75,74,0.04)' : 'transparent',
                  transition: 'background 0.2s',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {e.expense_type}
                      {e.bill_number && e.bill_number !== 'NA' && (
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-muted)', marginLeft: 8 }}>#{e.bill_number}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span>{formatDate(e.entry_date)}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{e.description}</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>{formatCurrency(e.amount)}</span>
                      {e.receipt_url && (
                        <button className="btn btn-ghost btn-xs" style={{ color: 'var(--blue)', padding: '2px 6px' }} onClick={() => viewBill(e.receipt_url)}>
                          <Eye size={11} /> Bill
                        </button>
                      )}
                    </div>
                    {dec.note && dec.status !== 'pending' && (
                      <div style={{ fontSize: 11, color: dec.status === 'queried' ? 'var(--purple)' : 'var(--red)', marginTop: 3 }}>
                        💬 {dec.note}
                      </div>
                    )}
                  </div>
                  <LineActions
                    status={dec.status}
                    onApprove={note => decide(key, 'approved', note)}
                    onQuery={role !== 'finance' ? (note => decide(key, 'queried', note)) : null}
                    onReject={note => decide(key, 'rejected', note)}
                    disabled={saving}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
        padding: '12px 16px', display: 'flex', alignItems: 'center',
        gap: 16, flexWrap: 'wrap', marginBottom: 12,
      }}>
        <div style={{ flex: 1, display: 'flex', gap: 16, fontSize: 12 }}>
          <span style={{ color: 'var(--green)' }}>✓ {s.approved} approved</span>
          {s.queried > 0 && <span style={{ color: 'var(--purple)' }}>? {s.queried} queried</span>}
          {s.rejected > 0 && <span style={{ color: 'var(--red)' }}>✗ {s.rejected} rejected</span>}
          <span style={{ color: 'var(--text-muted)' }}>{s.total - s.approved - s.queried - s.rejected} pending</span>
        </div>
        {hasQueried && (
          <div style={{ fontSize: 11, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '4px 10px', borderRadius: 20, border: '0.5px solid rgba(127,119,221,0.2)' }}>
            Queried items will be sent back for clarification
          </div>
        )}
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        disabled={!allDecided() || saving}
        onClick={() => onSaveLineDecisions(decisions)}
      >
        {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : null}
        {saving ? 'Processing…' : allApproved ? 'Approve all & forward' : allRejected ? 'Reject claim' : hasQueried ? `Approve ${s.approved} items · Query ${s.queried}` : 'Submit decisions'}
      </button>
      {!allDecided() && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
          Review all {s.total} items before submitting
        </div>
      )}
    </div>
  )
}

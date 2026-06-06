import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { uploadBill } from '../lib/storage'
import UploadZone from '../components/UploadZone'
import { getFuelRate, FUEL_BANDS, EXPENSE_TYPES, formatCurrency, FUEL_RATES } from '../lib/constants'
import { Plus, Trash2, Send, Fuel, Info } from 'lucide-react'

const today = () => new Date().toISOString().split('T')[0]
let rowId = 0

function makeFuelRow(f) {
  return {
    _id: rowId++,
    date: f?.entry_date?.slice(0, 10) || today(),
    from: f?.from_place || '',
    to: f?.to_place || '',
    purpose: f?.purpose || '',
    km: f?.distance_km ? String(f.distance_km) : '',
  }
}

function makeExpRow(e) {
  return {
    _id: rowId++,
    date: e?.entry_date?.slice(0, 10) || today(),
    type: e?.expense_type || 'Food Allowance',
    desc: e?.description || '',
    bill: e?.bill_number || '',
    amount: e?.amount ? String(e.amount) : '',
    file: null,
    existingReceiptUrl: e?.receipt_url || null,
  }
}

export default function NewClaimPage({ onNavigate, editClaim }) {
  const { profile } = useAuth()
  const toast = useToast()
  const isResubmit = !!editClaim

  // Pre-fill from editClaim if resubmitting
  const [periodFrom, setPeriodFrom] = useState(editClaim?.period_from?.slice(0, 10) || '')
  const [periodTo,   setPeriodTo]   = useState(editClaim?.period_to?.slice(0, 10) || '')
  const [vehicle,    setVehicle]    = useState(editClaim?.vehicle_type || 'Car')
  const [fuelBand,   setFuelBand]   = useState(editClaim?.fuel_price_band || 'Below Rs. 100')

  const [fuelRows, setFuelRows] = useState(() =>
    editClaim?.fuel_entries?.length > 0
      ? editClaim.fuel_entries.map(f => makeFuelRow(f))
      : [makeFuelRow()]
  )

  const [expRows, setExpRows] = useState(() =>
    editClaim?.expense_entries?.length > 0
      ? editClaim.expense_entries.map(e => makeExpRow(e))
      : [makeExpRow()]
  )

  // For resubmit, the existing fuel bill is already uploaded — show it but allow replacing
  const [fuelBillFile,    setFuelBillFile]    = useState(null)
  const [keepExistingBill, setKeepExistingBill] = useState(isResubmit && !!editClaim?.fuel_bill_url)
  const [submitting, setSubmitting] = useState(false)

  const rate      = getFuelRate(vehicle, fuelBand)
  const fuelTotal = fuelRows.reduce((s, r) => s + (parseFloat(r.km) || 0) * rate, 0)
  const expTotal  = expRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const grand     = fuelTotal + expTotal

  function updateFuel(id, field, val) { setFuelRows(p => p.map(r => r._id === id ? { ...r, [field]: val } : r)) }
  function updateExp(id, field, val)  { setExpRows(p => p.map(r => r._id === id ? { ...r, [field]: val } : r)) }

  async function handleSubmit() {
    if (!periodFrom || !periodTo) { toast('Please select the claim period', 'error'); return }
    const validFuel = fuelRows.filter(r => r.from && r.to && parseFloat(r.km) > 0)
    const validExp  = expRows.filter(r => r.desc && parseFloat(r.amount) > 0)
    if (validFuel.length === 0 && validExp.length === 0) { toast('Add at least one entry', 'error'); return }
    if (validFuel.length > 0 && !fuelBillFile && !keepExistingBill) { toast('Please upload a fuel bill', 'error'); return }

    setSubmitting(true)
    try {
      // Handle fuel bill
      let fuelBillUrl = keepExistingBill ? editClaim.fuel_bill_url : null
      if (fuelBillFile) {
        const path = `${profile.id}/${Date.now()}-fuel-${fuelBillFile.name}`
        fuelBillUrl = await uploadBill(fuelBillFile, path)
      }

      const { data: claim, error: claimErr } = await supabase.from('claims').insert({
        employee_id:    profile.id,
        period_from:    periodFrom,
        period_to:      periodTo,
        vehicle_type:   vehicle,
        fuel_price_band: fuelBand,
        fuel_amount:    fuelTotal,
        expense_amount: expTotal,
        status:         'pending_manager',
        submitted_at:   new Date().toISOString(),
        fuel_bill_url:  fuelBillUrl,
        // Link to parent if resubmitting
        parent_claim_id: editClaim?.parent_claim_id || editClaim?.id || null,
      }).select().single()

      if (claimErr) throw claimErr

      if (validFuel.length > 0) {
        await supabase.from('fuel_entries').insert(
          validFuel.map(r => ({
            claim_id:    claim.id,
            entry_date:  r.date,
            from_place:  r.from,
            to_place:    r.to,
            purpose:     r.purpose,
            distance_km: parseFloat(r.km),
            rate_per_km: rate,
          }))
        )
      }

      if (validExp.length > 0) {
        const expWithUrls = await Promise.all(validExp.map(async r => {
          let receiptUrl = r.existingReceiptUrl || null
          if (r.file) {
            const path = `${profile.id}/${Date.now()}-exp-${r.file.name}`
            receiptUrl = await uploadBill(r.file, path)
          }
          return {
            claim_id:     claim.id,
            entry_date:   r.date,
            expense_type: r.type,
            description:  r.desc,
            bill_number:  r.bill || null,
            amount:       parseFloat(r.amount),
            receipt_url:  receiptUrl,
          }
        }))
        await supabase.from('expense_entries').insert(expWithUrls)
      }

      // Mark the queried claim as resubmitted
      if (editClaim) {
        await supabase.from('claims').update({ status: 'resubmitted' }).eq('id', editClaim.id)
      }

      toast(`${claim.claim_number} submitted!`, 'success')
      onNavigate('my-claims')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{isResubmit ? 'Resubmit queried items' : 'New claim'}</div>
          <div className="page-sub">{isResubmit ? `Responding to query on ${editClaim.claim_number}` : 'Submit a reimbursement claim for approval'}</div>
        </div>
      </div>

      {/* Resubmit context banner */}
      {isResubmit && (
        <div style={{
          background: 'var(--purple-bg)', border: '0.5px solid rgba(127,119,221,0.25)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <Info size={15} style={{ color: 'var(--purple)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            <div style={{ fontWeight: 600, color: 'var(--purple)', marginBottom: 2 }}>Queried items pre-filled</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              The items below were queried from <span style={{ fontFamily: 'var(--mono)' }}>{editClaim.claim_number}</span>.
              Review and correct them, then resubmit. Approved items from the original claim are unaffected.
            </div>
          </div>
        </div>
      )}

      {/* Claim period */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Claim period</div>
        <div className="grid3">
          <div className="form-group"><label className="form-label">From</label><input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">To</label><input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Employee type</label><input value={profile?.employee_type ?? 'Non Trainers'} readOnly style={{ opacity: 0.6 }} /></div>
        </div>
      </div>

      {/* Fuel section — only show if there are fuel entries */}
      {(fuelRows.length > 0 && (fuelRows.some(r => r.from || r.km) || !isResubmit)) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Fuel reimbursement</div>
            <div className="rate-pill"><Fuel size={12} /> ₹{rate.toFixed(2)}/km · {vehicle} · {fuelBand.replace('Below Rs.', '<₹')}</div>
          </div>

          <div className="grid3" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Vehicle</label>
              <select value={vehicle} onChange={e => setVehicle(e.target.value)}><option>Car</option><option>Bike</option></select>
            </div>
            <div className="form-group">
              <label className="form-label">Fuel price band</label>
              <select value={fuelBand} onChange={e => setFuelBand(e.target.value)}>
                {FUEL_BANDS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fuel bill</label>
              {keepExistingBill ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    flex: 1, background: 'var(--green-bg)', border: '0.5px solid rgba(29,158,117,0.3)',
                    borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 12, color: 'var(--green)',
                  }}>✓ Original bill retained</div>
                  <button className="btn btn-ghost btn-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                    onClick={() => setKeepExistingBill(false)}>Replace</button>
                </div>
              ) : (
                <UploadZone file={fuelBillFile} onFileSelect={setFuelBillFile} label="Upload fuel bill" />
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {FUEL_BANDS.map(band => (
              <div key={band} style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 4,
                background: fuelBand === band ? 'rgba(216,90,48,0.15)' : 'var(--bg-elevated)',
                color: fuelBand === band ? 'var(--brand)' : 'var(--text-muted)',
                border: `0.5px solid ${fuelBand === band ? 'rgba(216,90,48,0.3)' : 'var(--border)'}`,
                fontFamily: 'var(--mono)',
              }}>{band.replace('Below Rs.', '<₹')} → Car ₹{FUEL_RATES.Car[band]} · Bike ₹{FUEL_RATES.Bike[band]}</div>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Date</th><th>From</th><th>To</th><th>Purpose</th><th>KM</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {fuelRows.map((r, i) => (
                  <tr key={r._id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                    <td><input className="inline-input" type="date" value={r.date} onChange={e => updateFuel(r._id, 'date', e.target.value)} /></td>
                    <td><input className="inline-input" type="text" placeholder="From" value={r.from} onChange={e => updateFuel(r._id, 'from', e.target.value)} /></td>
                    <td><input className="inline-input" type="text" placeholder="To" value={r.to} onChange={e => updateFuel(r._id, 'to', e.target.value)} /></td>
                    <td><input className="inline-input" type="text" placeholder="Purpose" value={r.purpose} onChange={e => updateFuel(r._id, 'purpose', e.target.value)} /></td>
                    <td><input className="inline-input" type="number" placeholder="0" min="0" step="0.1" value={r.km} onChange={e => updateFuel(r._id, 'km', e.target.value)} style={{ width: 70 }} /></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{formatCurrency((parseFloat(r.km) || 0) * rate)}</td>
                    <td><button className="btn btn-ghost btn-xs" onClick={() => setFuelRows(p => p.filter(x => x._id !== r._id))} style={{ color: 'var(--red)', padding: 4 }}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setFuelRows(p => [...p, makeFuelRow()])}><Plus size={13} /> Add journey</button>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>
              Subtotal: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--mono)' }}>{formatCurrency(fuelTotal)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Expense section */}
      {(expRows.length > 0 && (expRows.some(r => r.desc || r.amount) || !isResubmit)) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Expense summary</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Description</th><th>Bill / PNR</th><th>Amount (₹)</th><th>Receipt</th><th></th></tr></thead>
              <tbody>
                {expRows.map((r, i) => (
                  <tr key={r._id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                    <td><input className="inline-input" type="date" value={r.date} onChange={e => updateExp(r._id, 'date', e.target.value)} /></td>
                    <td><select className="inline-input" value={r.type} onChange={e => updateExp(r._id, 'type', e.target.value)}>{EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}</select></td>
                    <td><input className="inline-input" type="text" placeholder="Description" value={r.desc} onChange={e => updateExp(r._id, 'desc', e.target.value)} /></td>
                    <td><input className="inline-input" type="text" placeholder="NA" value={r.bill} onChange={e => updateExp(r._id, 'bill', e.target.value)} /></td>
                    <td><input className="inline-input" type="number" placeholder="0" min="0" step="0.01" value={r.amount} onChange={e => updateExp(r._id, 'amount', e.target.value)} style={{ width: 90 }} /></td>
                    <td style={{ minWidth: 130 }}>
                      {r.existingReceiptUrl && !r.file ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Retained</span>
                          <button className="btn btn-ghost btn-xs" style={{ color: 'var(--text-muted)' }} onClick={() => updateExp(r._id, 'existingReceiptUrl', null)}>Replace</button>
                        </div>
                      ) : (
                        <UploadZone file={r.file} onFileSelect={f => updateExp(r._id, 'file', f)} label="Add receipt" />
                      )}
                    </td>
                    <td><button className="btn btn-ghost btn-xs" onClick={() => setExpRows(p => p.filter(x => x._id !== r._id))} style={{ color: 'var(--red)', padding: 4 }}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpRows(p => [...p, makeExpRow()])}><Plus size={13} /> Add expense</button>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>
              Subtotal: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--mono)' }}>{formatCurrency(expTotal)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Grand total + submit */}
      <div className="card" style={{ background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Grand total</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{formatCurrency(grand)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Fuel {formatCurrency(fuelTotal)} + Other {formatCurrency(expTotal)}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => onNavigate('my-claims')}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Send size={14} />}
              {submitting ? 'Submitting…' : isResubmit ? 'Resubmit for approval' : 'Submit claim'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

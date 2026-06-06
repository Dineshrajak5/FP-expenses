import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { uploadBill } from '../lib/storage'
import UploadZone from '../components/UploadZone'
import { getFuelRate, FUEL_BANDS, EXPENSE_TYPES, formatCurrency, FUEL_RATES } from '../lib/constants'
import { Plus, Trash2, Send, Fuel } from 'lucide-react'

const today = () => new Date().toISOString().split('T')[0]
let rowId = 0
const newFuelRow = () => ({ _id: rowId++, date: today(), from: '', to: '', purpose: '', km: '' })
const newExpRow  = () => ({ _id: rowId++, date: today(), type: 'Food Allowance', desc: '', bill: '', amount: '', file: null })

export default function NewClaimPage({ onNavigate, editClaim }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [periodFrom, setPeriodFrom] = useState(editClaim?.period_from || '')
  const [periodTo, setPeriodTo]     = useState(editClaim?.period_to || '')
  const [vehicle, setVehicle]       = useState(editClaim?.vehicle_type || 'Car')
  const [fuelBand, setFuelBand]     = useState(editClaim?.fuel_price_band || 'Below Rs. 100')
  const [fuelRows, setFuelRows]     = useState([newFuelRow()])
  const [expRows, setExpRows]       = useState([newExpRow()])
  const [fuelBillFile, setFuelBillFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const rate = getFuelRate(vehicle, fuelBand)
  const fuelTotal = fuelRows.reduce((s, r) => s + (parseFloat(r.km) || 0) * rate, 0)
  const expTotal  = expRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const grand     = fuelTotal + expTotal

  function updateFuel(id, field, val) { setFuelRows(prev => prev.map(r => r._id === id ? { ...r, [field]: val } : r)) }
  function updateExp(id, field, val)  { setExpRows(prev => prev.map(r => r._id === id ? { ...r, [field]: val } : r)) }

  async function handleSubmit() {
    if (!periodFrom || !periodTo) { toast('Please select the claim period', 'error'); return }
    const validFuel = fuelRows.filter(r => r.from && r.to && parseFloat(r.km) > 0)
    const validExp  = expRows.filter(r => r.desc && parseFloat(r.amount) > 0)
    if (validFuel.length === 0 && validExp.length === 0) { toast('Add at least one entry', 'error'); return }
    if (validFuel.length > 0 && !fuelBillFile) { toast('Please upload a fuel bill', 'error'); return }

    setSubmitting(true)
    try {
      // Upload fuel bill
      let fuelBillUrl = null
      if (fuelBillFile) {
        const path = `${profile.id}/${Date.now()}-fuel-${fuelBillFile.name}`
        fuelBillUrl = await uploadBill(fuelBillFile, path)
      }

      const isResubmit = !!editClaim
      const { data: claim, error: claimErr } = await supabase
        .from('claims')
        .insert({
          employee_id: profile.id,
          period_from: periodFrom,
          period_to: periodTo,
          vehicle_type: vehicle,
          fuel_price_band: fuelBand,
          fuel_amount: fuelTotal,
          expense_amount: expTotal,
          status: 'pending_manager',
          submitted_at: new Date().toISOString(),
          fuel_bill_url: fuelBillUrl,
        })
        .select().single()

      if (claimErr) throw claimErr

      if (validFuel.length > 0) {
        await supabase.from('fuel_entries').insert(
          validFuel.map(r => ({
            claim_id: claim.id,
            entry_date: r.date,
            from_place: r.from,
            to_place: r.to,
            purpose: r.purpose,
            distance_km: parseFloat(r.km),
            rate_per_km: rate,
          }))
        )
      }

      // Expense entries with bill uploads
      if (validExp.length > 0) {
        const expWithUrls = await Promise.all(validExp.map(async r => {
          let receiptUrl = null
          if (r.file) {
            const path = `${profile.id}/${Date.now()}-exp-${r.file.name}`
            receiptUrl = await uploadBill(r.file, path)
          }
          return {
            claim_id: claim.id,
            entry_date: r.date,
            expense_type: r.type,
            description: r.desc,
            bill_number: r.bill || null,
            amount: parseFloat(r.amount),
            receipt_url: receiptUrl,
          }
        }))
        await supabase.from('expense_entries').insert(expWithUrls)
      }

      // Mark old claim as resubmitted
      if (isResubmit) {
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
          <div className="page-title">{editClaim ? 'Resubmit claim' : 'New claim'}</div>
          <div className="page-sub">{editClaim ? `Resubmitting after clarification` : 'Submit a reimbursement claim for approval'}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Claim period</div>
        <div className="grid3">
          <div className="form-group"><label className="form-label">From</label><input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">To</label><input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Employee type</label><input value={profile?.employee_type ?? 'Non Trainers'} readOnly style={{ opacity: 0.6 }} /></div>
        </div>
      </div>

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
            <label className="form-label">Fuel bill (required)</label>
            <UploadZone file={fuelBillFile} onFileSelect={setFuelBillFile} label="Upload fuel bill" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {FUEL_BANDS.map(band => (
            <div key={band} style={{
              fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
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
                  <td><input className="inline-input" type="text" placeholder="From location" value={r.from} onChange={e => updateFuel(r._id, 'from', e.target.value)} /></td>
                  <td><input className="inline-input" type="text" placeholder="To location" value={r.to} onChange={e => updateFuel(r._id, 'to', e.target.value)} /></td>
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
          <button className="btn btn-ghost btn-sm" onClick={() => setFuelRows(p => [...p, newFuelRow()])}><Plus size={13} /> Add journey</button>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--mono)' }}>{formatCurrency(fuelTotal)}</strong></span>
        </div>
      </div>

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
                  <td style={{ minWidth: 120 }}><UploadZone file={r.file} onFileSelect={f => updateExp(r._id, 'file', f)} label="Add receipt" /></td>
                  <td><button className="btn btn-ghost btn-xs" onClick={() => setExpRows(p => p.filter(x => x._id !== r._id))} style={{ color: 'var(--red)', padding: 4 }}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setExpRows(p => [...p, newExpRow()])}><Plus size={13} /> Add expense</button>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--mono)' }}>{formatCurrency(expTotal)}</strong></span>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Grand total</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{formatCurrency(grand)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Fuel {formatCurrency(fuelTotal)} + Other {formatCurrency(expTotal)}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => onNavigate('dashboard')}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Send size={14} />}
              {submitting ? 'Submitting…' : 'Submit claim'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

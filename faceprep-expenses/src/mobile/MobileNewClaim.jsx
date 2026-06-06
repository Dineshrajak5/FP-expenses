import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { uploadBill } from '../lib/storage'
import { getFuelRate, FUEL_BANDS, EXPENSE_TYPES, formatCurrency, FUEL_RATES } from '../lib/constants'
import { ChevronLeft, Plus, Trash2, Camera, FileCheck, Info, Fuel, ChevronDown, ChevronUp } from 'lucide-react'

const today = () => new Date().toISOString().split('T')[0]
let rid = 0
const newFuelRow = (f) => ({ _id: rid++, date: f?.entry_date?.slice(0,10)||today(), from: f?.from_place||'', to: f?.to_place||'', purpose: f?.purpose||'', km: f?.distance_km?String(f.distance_km):'' })
const newExpRow  = (e) => ({ _id: rid++, date: e?.entry_date?.slice(0,10)||today(), type: e?.expense_type||'Food Allowance', desc: e?.description||'', bill: e?.bill_number||'', amount: e?.amount?String(e.amount):'', file: null, existingReceiptUrl: e?.receipt_url||null })

function MobileUpload({ file, onSelect, existingUrl, label = 'Upload bill / photo' }) {
  const ref = useRef()
  return (
    <div>
      <div className={`m-upload ${(file || existingUrl) ? 'has-file' : ''}`} onClick={() => ref.current.click()}>
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCheck size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          </div>
        ) : existingUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCheck size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--green)' }}>Original bill retained · tap to replace</span>
          </div>
        ) : (
          <div>
            <Camera size={22} style={{ color: 'var(--text-muted)', margin: '0 auto 6px', display: 'block' }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Camera or file • PDF, JPG, PNG</div>
          </div>
        )}
      </div>
      {file && (
        <button style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6 }}
          onClick={e => { e.stopPropagation(); onSelect(null) }}>Remove</button>
      )}
      <input ref={ref} type="file" accept="image/*,.pdf" capture="environment" style={{ display: 'none' }}
        onChange={e => onSelect(e.target.files[0] || null)} />
    </div>
  )
}

export default function MobileNewClaim({ onNavigate, editClaim }) {
  const { profile } = useAuth()
  const toast = useToast()
  const isResubmit = !!editClaim

  const [step, setStep] = useState(1) // 1=details, 2=fuel, 3=expenses, 4=review
  const [periodFrom, setPeriodFrom] = useState(editClaim?.period_from?.slice(0,10)||'')
  const [periodTo,   setPeriodTo]   = useState(editClaim?.period_to?.slice(0,10)||'')
  const [vehicle,    setVehicle]    = useState(editClaim?.vehicle_type||'Car')
  const [fuelBand,   setFuelBand]   = useState(editClaim?.fuel_price_band||'Below Rs. 100')
  const [fuelRows,   setFuelRows]   = useState(() => editClaim?.fuel_entries?.length > 0 ? editClaim.fuel_entries.map(f => newFuelRow(f)) : [newFuelRow()])
  const [expRows,    setExpRows]    = useState(() => editClaim?.expense_entries?.length > 0 ? editClaim.expense_entries.map(e => newExpRow(e)) : [newExpRow()])
  const [fuelBillFile, setFuelBillFile] = useState(null)
  const [keepExistingBill, setKeepExistingBill] = useState(isResubmit && !!editClaim?.fuel_bill_url)
  const [submitting, setSubmitting] = useState(false)
  const [expandedExp, setExpandedExp] = useState(null)

  const rate      = getFuelRate(vehicle, fuelBand)
  const fuelTotal = fuelRows.reduce((s,r) => s + (parseFloat(r.km)||0) * rate, 0)
  const expTotal  = expRows.reduce((s,r) => s + (parseFloat(r.amount)||0), 0)
  const grand     = fuelTotal + expTotal

  const uf = (id,f,v) => setFuelRows(p => p.map(r => r._id===id ? {...r,[f]:v} : r))
  const ue = (id,f,v) => setExpRows(p => p.map(r => r._id===id ? {...r,[f]:v} : r))

  async function handleSubmit() {
    const validFuel = fuelRows.filter(r => r.from && r.to && parseFloat(r.km) > 0)
    const validExp  = expRows.filter(r => r.desc && parseFloat(r.amount) > 0)
    if (!periodFrom || !periodTo) { toast('Select claim period', 'error'); setStep(1); return }
    if (validFuel.length === 0 && validExp.length === 0) { toast('Add at least one entry', 'error'); return }
    if (validFuel.length > 0 && !fuelBillFile && !keepExistingBill) { toast('Upload fuel bill', 'error'); setStep(2); return }

    setSubmitting(true)
    try {
      let fuelBillUrl = keepExistingBill ? editClaim.fuel_bill_url : null
      if (fuelBillFile) {
        const path = `${profile.id}/${Date.now()}-fuel-${fuelBillFile.name}`
        fuelBillUrl = await uploadBill(fuelBillFile, path)
      }
      const { data: claim, error: ce } = await supabase.from('claims').insert({
        employee_id: profile.id, period_from: periodFrom, period_to: periodTo,
        vehicle_type: vehicle, fuel_price_band: fuelBand,
        fuel_amount: fuelTotal, expense_amount: expTotal,
        status: 'pending_manager', submitted_at: new Date().toISOString(),
        fuel_bill_url: fuelBillUrl,
        parent_claim_id: editClaim?.parent_claim_id || editClaim?.id || null,
      }).select().single()
      if (ce) throw ce

      if (validFuel.length > 0) {
        await supabase.from('fuel_entries').insert(validFuel.map(r => ({
          claim_id: claim.id, entry_date: r.date, from_place: r.from,
          to_place: r.to, purpose: r.purpose, distance_km: parseFloat(r.km), rate_per_km: rate,
        })))
      }
      if (validExp.length > 0) {
        const expWithUrls = await Promise.all(validExp.map(async r => {
          let receiptUrl = r.existingReceiptUrl || null
          if (r.file) { const path = `${profile.id}/${Date.now()}-exp-${r.file.name}`; receiptUrl = await uploadBill(r.file, path) }
          return { claim_id: claim.id, entry_date: r.date, expense_type: r.type, description: r.desc, bill_number: r.bill||null, amount: parseFloat(r.amount), receipt_url: receiptUrl }
        }))
        await supabase.from('expense_entries').insert(expWithUrls)
      }
      if (editClaim) await supabase.from('claims').update({ status: 'resubmitted' }).eq('id', editClaim.id)

      toast(`${claim.claim_number} submitted!`, 'success')
      onNavigate('my-claims')
    } catch (err) { toast(err.message, 'error') }
    finally { setSubmitting(false) }
  }

  const steps = ['Details', 'Fuel', 'Expenses', 'Review']

  return (
    <div className="m-screen">
      {/* Top bar */}
      <div className="m-topbar">
        <button className="m-back" onClick={() => step > 1 ? setStep(s => s-1) : onNavigate('dashboard')}>
          <ChevronLeft size={20} /> {step > 1 ? steps[step-2] : 'Back'}
        </button>
        <div style={{ textAlign: 'right' }}>
          <div className="m-topbar-title">{isResubmit ? 'Resubmit' : 'New claim'}</div>
          <div className="m-topbar-sub">Step {step} of 4</div>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', padding: '10px 16px 0', gap: 6 }}>
        {steps.map((s, i) => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < step ? 'var(--brand)' : 'var(--border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      <div className="m-content">
        {/* Step 1: Details */}
        {step === 1 && (
          <div>
            {isResubmit && (
              <div style={{ background: 'var(--purple-bg)', border: '0.5px solid rgba(155,143,238,0.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10 }}>
                <Info size={16} style={{ color: 'var(--purple)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: 'var(--purple)' }}>Resubmitting queried items</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>from {editClaim.claim_number} — data pre-filled</div>
                </div>
              </div>
            )}
            <div className="m-field">
              <label className="m-label">Period from</label>
              <input className="m-input" type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} />
            </div>
            <div className="m-field">
              <label className="m-label">Period to</label>
              <input className="m-input" type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} min={periodFrom} />
            </div>
            <div className="m-field">
              <label className="m-label">Vehicle</label>
              <div className="m-pill-select">
                {['Car','Bike'].map(v => (
                  <button key={v} className={`m-pill ${vehicle===v?'active':''}`} onClick={() => setVehicle(v)}>{v}</button>
                ))}
              </div>
            </div>
            <div className="m-field">
              <label className="m-label">Fuel price band</label>
              <div className="m-pill-select">
                {FUEL_BANDS.map(b => (
                  <button key={b} className={`m-pill ${fuelBand===b?'active':''}`} onClick={() => setFuelBand(b)}>{b.replace('Below Rs.','<₹')}</button>
                ))}
              </div>
            </div>
            <div className="m-rate-bar">
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{vehicle} at {fuelBand.replace('Below Rs.','<₹')}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--brand)' }}>₹{rate.toFixed(2)}/km</div>
            </div>
          </div>
        )}

        {/* Step 2: Fuel */}
        {step === 2 && (
          <div>
            <div className="m-section">Fuel journeys</div>
            <div className="m-rate-bar" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><Fuel size={14} /> Rate</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>₹{rate.toFixed(2)}/km · {vehicle}</div>
            </div>

            {fuelRows.map((r, i) => (
              <div key={r._id} className="m-journey">
                <div className="m-journey-num">{i+1}</div>
                <div className="m-field"><label className="m-label">Date</label><input className="m-input" type="date" value={r.date} onChange={e => uf(r._id,'date',e.target.value)} /></div>
                <div className="m-row" style={{ marginBottom: 10 }}>
                  <div className="m-field" style={{ marginBottom: 0 }}><label className="m-label">From</label><input className="m-input" type="text" placeholder="Start" value={r.from} onChange={e => uf(r._id,'from',e.target.value)} /></div>
                  <div className="m-field" style={{ marginBottom: 0 }}><label className="m-label">To</label><input className="m-input" type="text" placeholder="End" value={r.to} onChange={e => uf(r._id,'to',e.target.value)} /></div>
                </div>
                <div className="m-row" style={{ marginBottom: 0 }}>
                  <div className="m-field" style={{ marginBottom: 0 }}><label className="m-label">Distance (km)</label><input className="m-input" type="number" inputMode="decimal" placeholder="0" min="0" step="0.1" value={r.km} onChange={e => uf(r._id,'km',e.target.value)} /></div>
                  <div className="m-field" style={{ marginBottom: 0 }}>
                    <label className="m-label">Amount</label>
                    <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--brand)' }}>
                      {formatCurrency((parseFloat(r.km)||0)*rate)}
                    </div>
                  </div>
                </div>
                {fuelRows.length > 1 && (
                  <button style={{ marginTop: 10, fontSize: 13, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setFuelRows(p => p.filter(x => x._id !== r._id))}>
                    <Trash2 size={14} /> Remove journey
                  </button>
                )}
              </div>
            ))}

            <button className="m-btn m-btn-secondary" style={{ marginBottom: 20 }} onClick={() => setFuelRows(p => [...p, newFuelRow()])}>
              <Plus size={18} /> Add another journey
            </button>

            <div className="m-section">Fuel bill (required)</div>
            <MobileUpload
              file={fuelBillFile}
              onSelect={setFuelBillFile}
              existingUrl={keepExistingBill ? editClaim?.fuel_bill_url : null}
              label="Snap / upload fuel bill"
            />

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Fuel subtotal</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(fuelTotal)}</div>
            </div>
          </div>
        )}

        {/* Step 3: Expenses */}
        {step === 3 && (
          <div>
            <div className="m-section">Other expenses</div>
            {expRows.map((r, i) => (
              <div key={r._id} className="m-expense">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Expense {i+1}</div>
                  {expRows.length > 1 && (
                    <button style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => setExpRows(p => p.filter(x => x._id !== r._id))}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="m-field"><label className="m-label">Type</label>
                  <select className="m-input" value={r.type} onChange={e => ue(r._id,'type',e.target.value)}>
                    {EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="m-row">
                  <div className="m-field"><label className="m-label">Date</label><input className="m-input" type="date" value={r.date} onChange={e => ue(r._id,'date',e.target.value)} /></div>
                  <div className="m-field"><label className="m-label">Amount (₹)</label><input className="m-input" type="number" inputMode="decimal" placeholder="0.00" value={r.amount} onChange={e => ue(r._id,'amount',e.target.value)} /></div>
                </div>
                <div className="m-field"><label className="m-label">Description</label><input className="m-input" type="text" placeholder="What was this for?" value={r.desc} onChange={e => ue(r._id,'desc',e.target.value)} /></div>
                <div className="m-field"><label className="m-label">Bill / PNR number (optional)</label><input className="m-input" type="text" placeholder="e.g. IRCTC123" value={r.bill} onChange={e => ue(r._id,'bill',e.target.value)} /></div>
                <div className="m-field">
                  <label className="m-label">Receipt</label>
                  <MobileUpload file={r.file} onSelect={f => ue(r._id,'file',f)} existingUrl={r.existingReceiptUrl && !r.file ? r.existingReceiptUrl : null} label="Snap receipt" />
                </div>
              </div>
            ))}
            <button className="m-btn m-btn-secondary" onClick={() => setExpRows(p => [...p, newExpRow()])}>
              <Plus size={18} /> Add expense
            </button>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Expenses subtotal</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(expTotal)}</div>
            </div>
          </div>
        )}

        {/* Step 4: Review & Submit */}
        {step === 4 && (
          <div>
            <div style={{ background: 'var(--brand)', borderRadius: 16, padding: '20px', marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total claim amount</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '2.2rem', fontWeight: 800, color: 'white' }}>{formatCurrency(grand)}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Fuel {formatCurrency(fuelTotal)} + Other {formatCurrency(expTotal)}</div>
            </div>

            <div className="m-card" style={{ marginBottom: 12 }}>
              <div className="m-card-row">
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Period</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{periodFrom} → {periodTo}</span>
              </div>
              <div className="m-card-row">
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Vehicle</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{vehicle} · {fuelBand.replace('Below Rs.','<₹')}</span>
              </div>
              <div className="m-card-row">
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Fuel journeys</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{fuelRows.filter(r=>r.from&&r.to).length} entries</span>
              </div>
              <div className="m-card-row">
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Other expenses</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{expRows.filter(r=>r.desc&&parseFloat(r.amount)>0).length} entries</span>
              </div>
              <div className="m-card-row" style={{ border: 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Fuel bill</span>
                <span style={{ fontSize: 13, color: fuelBillFile||keepExistingBill ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                  {fuelBillFile ? '✓ Uploaded' : keepExistingBill ? '✓ Retained' : '⚠ Missing'}
                </span>
              </div>
            </div>

            <button className="m-btn m-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ marginBottom: 10 }}>
              {submitting ? <div className="spinner" style={{ width: 18, height: 18 }} /> : null}
              {submitting ? 'Submitting…' : isResubmit ? 'Resubmit for approval' : 'Submit claim'}
            </button>
            <button className="m-btn m-btn-secondary" onClick={() => setStep(3)}>← Back to edit</button>
          </div>
        )}
      </div>

      {/* Sticky next button */}
      {step < 4 && (
        <div style={{ position: 'sticky', bottom: 68, background: 'var(--bg-surface)', borderTop: '0.5px solid var(--border)', padding: '12px 16px', zIndex: 99 }}>
          <button className="m-btn m-btn-primary" onClick={() => setStep(s => s+1)}>
            Continue to {steps[step]} →
          </button>
        </div>
      )}
    </div>
  )
}

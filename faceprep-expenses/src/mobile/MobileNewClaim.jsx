import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { uploadBill } from '../lib/storage'
import { getFuelRate, FUEL_BANDS, EXPENSE_TYPES, formatCurrency, FUEL_RATES } from '../lib/constants'
import BottomSheet from './BottomSheet'
import { ChevronLeft, Plus, Trash2, Camera, FileCheck, Info, Fuel, Edit2 } from 'lucide-react'

const today = () => new Date().toISOString().split('T')[0]
let rid = 0

const blankFuel = (f) => ({
  _id: rid++,
  date: f?.entry_date?.slice(0,10) || today(),
  from: f?.from_place || '',
  to: f?.to_place || '',
  purpose: f?.purpose || '',
  km: f?.distance_km ? String(f.distance_km) : '',
})

const blankExp = (e) => ({
  _id: rid++,
  date: e?.entry_date?.slice(0,10) || today(),
  type: e?.expense_type || 'Food Allowance',
  desc: e?.description || '',
  bill: e?.bill_number || '',
  amount: e?.amount ? String(e.amount) : '',
  file: null,
  existingReceiptUrl: e?.receipt_url || null,
})

function MobileUpload({ file, onSelect, existingUrl, label = 'Snap / upload bill' }) {
  const ref = useRef()
  return (
    <div>
      <div
        className={`m-upload ${(file || existingUrl) ? 'has-file' : ''}`}
        onClick={() => ref.current.click()}
      >
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileCheck size={20} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          </div>
        ) : existingUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileCheck size={20} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: 'var(--green)' }}>Original bill retained · tap to replace</span>
          </div>
        ) : (
          <>
            <Camera size={26} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Camera · PDF · JPG · PNG</div>
          </>
        )}
      </div>
      {file && (
        <button style={{ fontSize: 13, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}
          onClick={e => { e.stopPropagation(); onSelect(null) }}>Remove</button>
      )}
      <input ref={ref} type="file" accept="image/*,.pdf" capture="environment"
        style={{ display: 'none' }} onChange={e => onSelect(e.target.files[0] || null)} />
    </div>
  )
}

export default function MobileNewClaim({ onNavigate, editClaim }) {
  const { profile } = useAuth()
  const toast = useToast()
  const isResubmit = !!editClaim

  const [step, setStep] = useState(1)
  const [periodFrom, setPeriodFrom] = useState(editClaim?.period_from?.slice(0,10) || '')
  const [periodTo,   setPeriodTo]   = useState(editClaim?.period_to?.slice(0,10) || '')
  const [vehicle,    setVehicle]    = useState(editClaim?.vehicle_type || 'Car')
  const [fuelBand,   setFuelBand]   = useState(editClaim?.fuel_price_band || 'Below Rs. 100')
  const [fuelRows,   setFuelRows]   = useState(() =>
    editClaim?.fuel_entries?.length > 0
      ? editClaim.fuel_entries.map(f => blankFuel(f))
      : []
  )
  const [expRows, setExpRows] = useState(() =>
    editClaim?.expense_entries?.length > 0
      ? editClaim.expense_entries.map(e => blankExp(e))
      : []
  )
  const [fuelBillFile, setFuelBillFile] = useState(null)
  const [keepExistingBill, setKeepExistingBill] = useState(isResubmit && !!editClaim?.fuel_bill_url)
  const [submitting, setSubmitting] = useState(false)

  // Sheet state
  const [fuelSheet, setFuelSheet] = useState(false)
  const [expSheet, setExpSheet]   = useState(false)
  const [editingFuel, setEditingFuel] = useState(null) // row being edited
  const [editingExp,  setEditingExp]  = useState(null)
  const [draftFuel, setDraftFuel] = useState(null)
  const [draftExp,  setDraftExp]  = useState(null)

  const rate = getFuelRate(vehicle, fuelBand)
  const fuelTotal = fuelRows.reduce((s,r) => s + (parseFloat(r.km)||0) * rate, 0)
  const expTotal  = expRows.reduce((s,r) => s + (parseFloat(r.amount)||0), 0)
  const grand = fuelTotal + expTotal

  function openAddFuel() {
    setDraftFuel(blankFuel())
    setEditingFuel(null)
    setFuelSheet(true)
  }

  function openEditFuel(row) {
    setDraftFuel({ ...row })
    setEditingFuel(row._id)
    setFuelSheet(true)
  }

  function saveFuelDraft() {
    if (!draftFuel.from || !draftFuel.to || !parseFloat(draftFuel.km)) {
      toast('Fill From, To and KM', 'error'); return
    }
    if (editingFuel !== null) {
      setFuelRows(p => p.map(r => r._id === editingFuel ? { ...draftFuel, _id: editingFuel } : r))
    } else {
      setFuelRows(p => [...p, { ...draftFuel, _id: rid++ }])
    }
    setFuelSheet(false)
    setDraftFuel(null)
  }

  function openAddExp() {
    setDraftExp(blankExp())
    setEditingExp(null)
    setExpSheet(true)
  }

  function openEditExp(row) {
    setDraftExp({ ...row })
    setEditingExp(row._id)
    setExpSheet(true)
  }

  function saveExpDraft() {
    if (!draftExp.desc || !parseFloat(draftExp.amount)) {
      toast('Fill description and amount', 'error'); return
    }
    if (editingExp !== null) {
      setExpRows(p => p.map(r => r._id === editingExp ? { ...draftExp, _id: editingExp } : r))
    } else {
      setExpRows(p => [...p, { ...draftExp, _id: rid++ }])
    }
    setExpSheet(false)
    setDraftExp(null)
  }

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
          to_place: r.to, purpose: r.purpose,
          distance_km: parseFloat(r.km), rate_per_km: rate,
        })))
      }
      if (validExp.length > 0) {
        const expWithUrls = await Promise.all(validExp.map(async r => {
          let receiptUrl = r.existingReceiptUrl || null
          if (r.file) {
            const path = `${profile.id}/${Date.now()}-exp-${r.file.name}`
            receiptUrl = await uploadBill(r.file, path)
          }
          return {
            claim_id: claim.id, entry_date: r.date, expense_type: r.type,
            description: r.desc, bill_number: r.bill || null,
            amount: parseFloat(r.amount), receipt_url: receiptUrl,
          }
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

      {/* Progress bar */}
      <div style={{ display: 'flex', padding: '10px 16px 0', gap: 6 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? 'var(--brand)' : 'var(--border)', transition: 'background 0.3s' }} />
        ))}
      </div>

      <div className="m-content">

        {/* ── Step 1: Details ── */}
        {step === 1 && (
          <div>
            {isResubmit && (
              <div style={{ background: 'var(--purple-bg)', border: '0.5px solid rgba(155,143,238,0.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10 }}>
                <Info size={16} style={{ color: 'var(--purple)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--purple)', fontSize: 14 }}>Resubmitting queried items</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: 13 }}>from {editClaim.claim_number} — pre-filled</div>
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
                  <button key={v} className={`m-pill ${vehicle===v?'active':''}`} onClick={() => setVehicle(v)} style={{ flex: 1, textAlign: 'center' }}>{v}</button>
                ))}
              </div>
            </div>
            <div className="m-field">
              <label className="m-label">Fuel price band</label>
              <div className="m-pill-select" style={{ flexWrap: 'wrap' }}>
                {FUEL_BANDS.map(b => (
                  <button key={b} className={`m-pill ${fuelBand===b?'active':''}`} onClick={() => setFuelBand(b)}>{b.replace('Below Rs.','<₹')}</button>
                ))}
              </div>
            </div>
            <div className="m-rate-bar">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Fuel size={15} /> Applicable rate</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 800, color: 'var(--brand)' }}>₹{rate.toFixed(2)}<span style={{ fontSize: 13, fontWeight: 400 }}>/km</span></div>
            </div>
          </div>
        )}

        {/* ── Step 2: Fuel ── */}
        {step === 2 && (
          <div>
            <div className="m-rate-bar" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Fuel size={15} /> {vehicle} at {fuelBand.replace('Below Rs.','<₹')}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 800, color: 'var(--brand)' }}>₹{rate.toFixed(2)}/km</div>
            </div>

            {/* Journey cards */}
            {fuelRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                No journeys added yet.<br />Tap below to add your first.
              </div>
            ) : (
              fuelRows.map((r, i) => (
                <div key={r._id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                        {r.from} → {r.to}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {r.date} · {r.km} km · {r.purpose || 'No purpose'}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 800, color: 'var(--brand)', marginLeft: 12, flexShrink: 0 }}>
                      {formatCurrency((parseFloat(r.km)||0)*rate)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="m-btn m-btn-secondary m-btn-sm" onClick={() => openEditFuel(r)} style={{ flex: 1 }}>
                      <Edit2 size={13} /> Edit
                    </button>
                    <button className="m-btn m-btn-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '0.5px solid rgba(232,69,69,0.2)', flex: 1 }}
                      onClick={() => setFuelRows(p => p.filter(x => x._id !== r._id))}>
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              ))
            )}

            <button className="m-btn m-btn-secondary" onClick={openAddFuel}>
              <Plus size={18} /> Add journey
            </button>

            <div style={{ marginTop: 20 }}>
              <div className="m-label" style={{ marginBottom: 10 }}>Fuel bill {fuelRows.length > 0 ? '(required)' : '(if any fuel journeys)'}</div>
              <MobileUpload
                file={fuelBillFile}
                onSelect={setFuelBillFile}
                existingUrl={keepExistingBill ? editClaim?.fuel_bill_url : null}
                label="Snap / upload fuel bill"
              />
            </div>

            {fuelRows.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Fuel subtotal</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 800, color: 'var(--brand)' }}>{formatCurrency(fuelTotal)}</div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Expenses ── */}
        {step === 3 && (
          <div>
            {expRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                No expenses added yet.<br />Tap below to add.
              </div>
            ) : (
              expRows.map((r, i) => (
                <div key={r._id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{r.type}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{r.desc}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {r.date}{r.bill ? ` · #${r.bill}` : ''}
                        {(r.file || r.existingReceiptUrl) && <span style={{ color: 'var(--green)', marginLeft: 6 }}>📎 Bill</span>}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginLeft: 12, flexShrink: 0 }}>
                      {formatCurrency(parseFloat(r.amount)||0)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="m-btn m-btn-secondary m-btn-sm" onClick={() => openEditExp(r)} style={{ flex: 1 }}>
                      <Edit2 size={13} /> Edit
                    </button>
                    <button className="m-btn m-btn-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '0.5px solid rgba(232,69,69,0.2)', flex: 1 }}
                      onClick={() => setExpRows(p => p.filter(x => x._id !== r._id))}>
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              ))
            )}

            <button className="m-btn m-btn-secondary" onClick={openAddExp}>
              <Plus size={18} /> Add expense
            </button>

            {expRows.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Expenses subtotal</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(expTotal)}</div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && (
          <div>
            <div style={{ background: 'var(--brand)', borderRadius: 18, padding: '24px', marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total claim amount</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '2.4rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>{formatCurrency(grand)}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>Fuel {formatCurrency(fuelTotal)} + Expenses {formatCurrency(expTotal)}</div>
            </div>

            <div className="m-card" style={{ marginBottom: 14 }}>
              {[
                ['Period', `${periodFrom} → ${periodTo}`],
                ['Vehicle', `${vehicle} · ${fuelBand.replace('Below Rs.','<₹')}`],
                ['Rate', `₹${rate.toFixed(2)}/km`],
                ['Fuel journeys', `${fuelRows.length} added`],
                ['Other expenses', `${expRows.length} added`],
                ['Fuel bill', fuelBillFile ? '✓ Uploaded' : keepExistingBill ? '✓ Retained' : fuelRows.length > 0 ? '⚠ Missing' : 'N/A'],
              ].map(([label, value]) => (
                <div key={label} className="m-card-row">
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: value.startsWith('⚠') ? 'var(--red)' : value.startsWith('✓') ? 'var(--green)' : 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>

            <button className="m-btn m-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ marginBottom: 10 }}>
              {submitting ? <div className="spinner" style={{ width: 18, height: 18 }} /> : null}
              {submitting ? 'Submitting…' : isResubmit ? '↑ Resubmit for approval' : '↑ Submit claim'}
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

      {/* ── Fuel journey bottom sheet ── */}
      <BottomSheet
        open={fuelSheet}
        onClose={() => setFuelSheet(false)}
        title={editingFuel !== null ? 'Edit journey' : 'Add journey'}
        footer={
          <>
            <button className="m-btn m-btn-secondary" style={{ flex: 1 }} onClick={() => setFuelSheet(false)}>Cancel</button>
            <button className="m-btn m-btn-primary" style={{ flex: 2 }} onClick={saveFuelDraft}>
              {editingFuel !== null ? 'Save changes' : 'Add journey'}
            </button>
          </>
        }
      >
        {draftFuel && (
          <div>
            <div className="m-field">
              <label className="m-label">Date</label>
              <input className="m-input" type="date" value={draftFuel.date} onChange={e => setDraftFuel(p => ({...p, date: e.target.value}))} />
            </div>
            <div className="m-field">
              <label className="m-label">From location</label>
              <input className="m-input" type="text" placeholder="e.g. Chennai office" value={draftFuel.from} onChange={e => setDraftFuel(p => ({...p, from: e.target.value}))} autoFocus />
            </div>
            <div className="m-field">
              <label className="m-label">To location</label>
              <input className="m-input" type="text" placeholder="e.g. Sathyabama University" value={draftFuel.to} onChange={e => setDraftFuel(p => ({...p, to: e.target.value}))} />
            </div>
            <div className="m-field">
              <label className="m-label">Purpose</label>
              <input className="m-input" type="text" placeholder="e.g. College visit, meeting" value={draftFuel.purpose} onChange={e => setDraftFuel(p => ({...p, purpose: e.target.value}))} />
            </div>
            <div className="m-field">
              <label className="m-label">Distance (km)</label>
              <input className="m-input" type="number" inputMode="decimal" placeholder="0.0" min="0" step="0.1" value={draftFuel.km} onChange={e => setDraftFuel(p => ({...p, km: e.target.value}))} />
            </div>
            {draftFuel.km && parseFloat(draftFuel.km) > 0 && (
              <div className="m-rate-bar" style={{ marginTop: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Calculated amount</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 800, color: 'var(--brand)' }}>
                  {formatCurrency(parseFloat(draftFuel.km) * rate)}
                </span>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* ── Expense bottom sheet ── */}
      <BottomSheet
        open={expSheet}
        onClose={() => setExpSheet(false)}
        title={editingExp !== null ? 'Edit expense' : 'Add expense'}
        footer={
          <>
            <button className="m-btn m-btn-secondary" style={{ flex: 1 }} onClick={() => setExpSheet(false)}>Cancel</button>
            <button className="m-btn m-btn-primary" style={{ flex: 2 }} onClick={saveExpDraft}>
              {editingExp !== null ? 'Save changes' : 'Add expense'}
            </button>
          </>
        }
      >
        {draftExp && (
          <div>
            <div className="m-field">
              <label className="m-label">Expense type</label>
              <select className="m-input" value={draftExp.type} onChange={e => setDraftExp(p => ({...p, type: e.target.value}))}>
                {EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="m-field">
              <label className="m-label">Date</label>
              <input className="m-input" type="date" value={draftExp.date} onChange={e => setDraftExp(p => ({...p, date: e.target.value}))} />
            </div>
            <div className="m-field">
              <label className="m-label">Description</label>
              <input className="m-input" type="text" placeholder="What was this expense for?" value={draftExp.desc} onChange={e => setDraftExp(p => ({...p, desc: e.target.value}))} autoFocus />
            </div>
            <div className="m-field">
              <label className="m-label">Amount (₹)</label>
              <input className="m-input" type="number" inputMode="decimal" placeholder="0.00" min="0" step="0.01" value={draftExp.amount} onChange={e => setDraftExp(p => ({...p, amount: e.target.value}))} />
            </div>
            <div className="m-field">
              <label className="m-label">Bill / PNR number <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', fontSize: 12 }}>(optional)</span></label>
              <input className="m-input" type="text" placeholder="e.g. IRCTC1234, INV-001" value={draftExp.bill} onChange={e => setDraftExp(p => ({...p, bill: e.target.value}))} />
            </div>
            <div className="m-field">
              <label className="m-label">Receipt <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', fontSize: 12 }}>(optional)</span></label>
              {draftExp.existingReceiptUrl && !draftExp.file ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: 'var(--green-bg)', borderRadius: 12, border: '0.5px solid rgba(34,196,122,0.25)' }}>
                  <FileCheck size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>Original receipt retained</div>
                    <button style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => setDraftExp(p => ({...p, existingReceiptUrl: null}))}>Tap to replace</button>
                  </div>
                </div>
              ) : (
                <MobileUpload
                  file={draftExp.file}
                  onSelect={f => setDraftExp(p => ({...p, file: f}))}
                  label="Snap or upload receipt"
                />
              )}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}

import { Check, Clock, AlertCircle, CreditCard } from 'lucide-react'

const STAGES = [
  { key: 'submitted',  label: 'Submitted' },
  { key: 'manager',    label: 'Manager' },
  { key: 'finance',    label: 'Finance' },
  { key: 'payment',    label: 'Payment' },
]

function getStageState(claim) {
  const { status } = claim
  // Returns: for each stage — 'done' | 'active' | 'queried' | 'rejected' | 'pending'
  const submitted = 'done' // always done if claim exists

  let manager = 'pending'
  let finance  = 'pending'
  let payment  = 'pending'

  if (['pending_manager', 'queried', 'resubmitted'].includes(status)) {
    manager = 'active'
  } else if (status === 'rejected' && !claim.finance_at) {
    manager = 'rejected'
  } else if (claim.manager_at || ['pending_finance','approved','partially_approved','payment_processed'].includes(status)) {
    manager = claim.is_partial ? 'queried' : 'done'
    // If fully approved by manager with no partial, it's clean done
    if (!claim.is_partial) manager = 'done'
  }

  if (status === 'pending_finance') {
    finance = 'active'
  } else if (status === 'approved' || status === 'partially_approved' || status === 'payment_processed') {
    finance = 'done'
  } else if (status === 'rejected' && claim.finance_at) {
    finance = 'rejected'
  }

  if (status === 'payment_processed') {
    payment = 'done'
  } else if (status === 'approved') {
    payment = 'active'
  }

  return { submitted, manager, finance, payment }
}

function StageNode({ label, state, isLast }) {
  const configs = {
    done:     { bg: 'var(--green)',   icon: Check,        color: 'white' },
    active:   { bg: 'var(--brand)',   icon: Clock,        color: 'white', pulse: true },
    queried:  { bg: 'var(--amber)',   icon: AlertCircle,  color: 'white' },
    rejected: { bg: 'var(--red)',     icon: AlertCircle,  color: 'white' },
    pending:  { bg: 'var(--border)',  icon: null,         color: 'var(--text-muted)' },
  }
  const c = configs[state] || configs.pending
  const Icon = c.icon

  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: state === 'pending' ? 'var(--bg-elevated)' : c.bg,
          border: `2px solid ${state === 'pending' ? 'var(--border-strong)' : c.bg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: c.pulse ? `0 0 0 4px rgba(240,81,54,0.2)` : 'none',
          transition: 'all 0.2s',
        }}>
          {Icon
            ? <Icon size={14} style={{ color: c.color }} />
            : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-strong)' }} />
          }
        </div>
        <div style={{ fontSize: 10, fontWeight: state === 'active' ? 700 : 500, color: state === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
          {label}
        </div>
      </div>
      {!isLast && (
        <div style={{ flex: 1, height: 2, background: ['done','queried'].includes(state) ? 'var(--green)' : 'var(--border)', margin: '0 4px', marginBottom: 18, transition: 'background 0.3s' }} />
      )}
    </div>
  )
}

export default function ClaimStageBar({ claim, compact = false }) {
  const states = getStageState(claim)
  const stageStates = [states.submitted, states.manager, states.finance, states.payment]

  if (compact) {
    // Slim horizontal bar for list views
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
        {STAGES.map((s, i) => {
          const state = stageStates[i]
          const isLast = i === STAGES.length - 1
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: state === 'done' ? 'var(--green)' : state === 'active' ? 'var(--brand)' : state === 'queried' ? 'var(--amber)' : state === 'rejected' ? 'var(--red)' : 'var(--border)', flexShrink: 0 }} />
              {!isLast && <div style={{ flex: 1, height: 2, background: state === 'done' ? 'var(--green)' : 'var(--border)', minWidth: 12 }} />}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Claim progress</div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {STAGES.map((s, i) => (
          <StageNode key={s.key} label={s.label} state={stageStates[i]} isLast={i === STAGES.length - 1} />
        ))}
      </div>
      {/* Contextual note */}
      {claim.manager_note && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--amber)', background: 'var(--amber-bg)', borderRadius: 6, padding: '5px 10px' }}>
          Manager note: {claim.manager_note}
        </div>
      )}
      {claim.finance_note && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--blue)', background: 'var(--blue-bg)', borderRadius: 6, padding: '5px 10px' }}>
          Finance note: {claim.finance_note}
        </div>
      )}
      {claim.payment_note && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--green)', background: 'var(--green-bg)', borderRadius: 6, padding: '5px 10px' }}>
          Payment note: {claim.payment_note}
        </div>
      )}
    </div>
  )
}

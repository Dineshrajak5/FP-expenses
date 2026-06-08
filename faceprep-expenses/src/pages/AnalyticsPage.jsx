import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, EXPENSE_TYPE_COLORS, countsTowardAmount } from '../lib/constants'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { TrendingUp, Users, Fuel, DollarSign, Filter } from 'lucide-react'

const COLORS = ['#F05136','#378ADD','#1D9E75','#EF9F27','#7F77DD','#E24B4A','#22C47A','#9B8FEE']

function Card({ children, style }) {
  return <div className="card" style={{ marginBottom: 16, ...style }}>{children}</div>
}

function StatMini({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: `2px solid ${accent}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

const PERIODS = [
  { id: 'week',  label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year',  label: 'This year' },
  { id: 'all',   label: 'All time' },
]

function getPeriodRange(period) {
  const now = new Date()
  const from = new Date()
  if (period === 'week')    from.setDate(now.getDate() - 7)
  if (period === 'month')   from.setMonth(now.getMonth(), 1)
  if (period === 'quarter') from.setMonth(Math.floor(now.getMonth() / 3) * 3, 1)
  if (period === 'year')    from.setMonth(0, 1)
  if (period === 'all')     return null
  from.setHours(0, 0, 0, 0)
  return from.toISOString()
}

export default function AnalyticsPage() {
  const { profile } = useAuth()
  const [claims, setClaims]   = useState([])
  const [expenses, setExpenses] = useState([])
  const [fuel, setFuel]       = useState([])
  const [reps, setReps]       = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [period, setPeriod]   = useState('month')
  const [repFilter, setRepFilter] = useState('all')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: c }, { data: e }, { data: f }, { data: r }] = await Promise.all([
      supabase.from('claims').select('*, profiles!claims_employee_id_fkey(full_name)').order('submitted_at'),
      supabase.from('expense_entries').select('*'),
      supabase.from('fuel_entries').select('*'),
      supabase.from('profiles').select('id, full_name').eq('role', 'staff'),
    ])
    setClaims(c ?? [])
    setExpenses(e ?? [])
    setFuel(f ?? [])
    setReps(r ?? [])
    setLoading(false)
  }

  // Apply filters
  const filtered = useMemo(() => {
    const fromDate = getPeriodRange(period)
    return claims
      .filter(countsTowardAmount)
      .filter(c => !fromDate || new Date(c.submitted_at) >= new Date(fromDate))
      .filter(c => repFilter === 'all' || c.employee_id === repFilter)
  }, [claims, period, repFilter])

  const filteredIds = useMemo(() => new Set(filtered.map(c => c.id)), [filtered])

  const filteredExpenses = useMemo(() =>
    expenses.filter(e => filteredIds.has(e.claim_id) && e.status !== 'rejected' && e.status !== 'queried'),
    [expenses, filteredIds]
  )
  const filteredFuel = useMemo(() =>
    fuel.filter(f => filteredIds.has(f.claim_id) && f.status !== 'rejected' && f.status !== 'queried'),
    [fuel, filteredIds]
  )

  // ── Key metrics ──
  const totalSpend    = filtered.reduce((s, c) => s + Number(c.total_amount || 0), 0)
  const totalFuelAmt  = filtered.reduce((s, c) => s + Number(c.fuel_amount || 0), 0)
  const totalExpAmt   = filtered.reduce((s, c) => s + Number(c.expense_amount || 0), 0)
  const totalKm       = filteredFuel.reduce((s, f) => s + Number(f.distance_km || 0), 0)
  const approvedCount = filtered.filter(c => c.status === 'approved').length
  const avgClaim      = filtered.length ? totalSpend / filtered.length : 0

  // ── Trend chart (group by week or month depending on period) ──
  const trendData = useMemo(() => {
    const groups = {}
    filtered.forEach(c => {
      const d = new Date(c.submitted_at)
      const key = period === 'week'
        ? d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
        : period === 'year' || period === 'all'
          ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
          : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      groups[key] = (groups[key] || 0) + Number(c.total_amount || 0)
    })
    return Object.entries(groups).map(([date, amount]) => ({ date, amount: Math.round(amount) }))
  }, [filtered, period])

  // ── Category breakdown ──
  const categoryData = useMemo(() => {
    const map = {}
    filteredExpenses.forEach(e => {
      map[e.expense_type] = (map[e.expense_type] || 0) + Number(e.amount)
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value), color: EXPENSE_TYPE_COLORS[name] || '#888' }))
      .sort((a, b) => b.value - a.value)
  }, [filteredExpenses])

  // ── Rep leaderboard ──
  const repData = useMemo(() => {
    const map = {}
    filtered.forEach(c => {
      const name = c.profiles?.full_name || c.employee_id?.slice(0, 8) || 'Unknown'
      if (!map[name]) map[name] = { name, total: 0, claims: 0, fuel: 0, expenses: 0 }
      map[name].total    += Number(c.total_amount || 0)
      map[name].fuel     += Number(c.fuel_amount || 0)
      map[name].expenses += Number(c.expense_amount || 0)
      map[name].claims   += 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filtered])

  // ── Status pipeline ──
  const pipelineData = useMemo(() => {
    const all = claims.filter(countsTowardAmount)
      .filter(c => repFilter === 'all' || c.employee_id === repFilter)
    return [
      { name: 'Pending Manager', value: all.filter(c => c.status === 'pending_manager').length, color: '#EF9F27' },
      { name: 'Pending Finance', value: all.filter(c => c.status === 'pending_finance').length, color: '#378ADD' },
      { name: 'Approved',        value: all.filter(c => c.status === 'approved').length,        color: '#22C47A' },
      { name: 'Partial',         value: all.filter(c => c.status === 'partially_approved').length, color: '#F05136' },
      { name: 'Rejected',        value: all.filter(c => c.status === 'rejected').length,        color: '#E24B4A' },
    ].filter(d => d.value > 0)
  }, [claims, repFilter])

  // ── Top routes ──
  const routeData = useMemo(() => {
    const map = {}
    filteredFuel.forEach(f => {
      const key = `${f.from_place} → ${f.to_place}`
      if (!map[key]) map[key] = { route: key, trips: 0, km: 0, amount: 0 }
      map[key].trips  += 1
      map[key].km     += Number(f.distance_km || 0)
      map[key].amount += Number(f.amount || 0)
    })
    return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 5)
  }, [filteredFuel])

  const fmt = (n) => formatCurrency(n)

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-sub">{filtered.length} claims · {fmt(totalSpend)} total</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
            <Filter size={14} /> Filters
          </div>

          {/* Period */}
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p.id}
                className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriod(p.id)}
              >{p.label}</button>
            ))}
          </div>

          {/* Rep filter */}
          {reps.length > 0 && (
            <select
              style={{ padding: '7px 12px', borderRadius: 6, border: '0.5px solid var(--border-strong)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font)', maxWidth: 200 }}
              value={repFilter}
              onChange={e => setRepFilter(e.target.value)}
            >
              <option value="all">All reps</option>
              {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
          )}
        </div>
      </Card>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 20 }}>
        <StatMini label="Total spend"    value={fmt(totalSpend)}   accent="var(--brand)" />
        <StatMini label="Claims"         value={filtered.length}   accent="var(--blue)" />
        <StatMini label="Approved"       value={approvedCount}     accent="var(--green)" />
        <StatMini label="Avg per claim"  value={fmt(avgClaim)}     accent="var(--purple)" />
        <StatMini label="Fuel total"     value={fmt(totalFuelAmt)} accent="var(--amber)" />
        <StatMini label="Total km"       value={`${Math.round(totalKm)} km`} accent="var(--red)" />
      </div>

      {/* ── Trend + Pipeline ── */}
      <div className="grid2" style={{ marginBottom: 16 }}>
        <Card>
          <div className="card-header"><h3>Spend trend</h3></div>
          {trendData.length === 0
            ? <div className="empty-state">No data for this period</div>
            : <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F05136" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F05136" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Area type="monotone" dataKey="amount" stroke="#F05136" fill="url(#grad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
          }
        </Card>

        <Card>
          <div className="card-header"><h3>Pipeline status</h3></div>
          {pipelineData.length === 0
            ? <div className="empty-state">No data</div>
            : <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pipelineData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={10}>
                    {pipelineData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
          }
        </Card>
      </div>

      {/* ── Category breakdown ── */}
      <Card style={{ marginBottom: 16 }}>
        <div className="card-header"><h3>Expense by category</h3><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(totalExpAmt)} total</span></div>
        {categoryData.length === 0
          ? <div className="empty-state">No expense data</div>
          : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40}>
                    {categoryData.map((e, i) => <Cell key={i} fill={e.color || COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', maxHeight: 220, overflowY: 'auto' }}>
                {categoryData.map((c, i) => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color || COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
        }
      </Card>

      {/* ── Rep leaderboard ── */}
      <Card style={{ marginBottom: 16 }}>
        <div className="card-header"><h3>Rep-wise breakdown</h3><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{repData.length} reps</span></div>
        {repData.length === 0
          ? <div className="empty-state">No data</div>
          : <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={repData} margin={{ bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="fuel"     name="Fuel"     fill="#F05136" stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#378ADD" stackId="a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead><tr><th>Rep</th><th>Claims</th><th>Fuel</th><th>Expenses</th><th>Total</th></tr></thead>
                  <tbody>
                    {repData.map(r => (
                      <tr key={r.name}>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td>{r.claims}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{fmt(r.fuel)}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{fmt(r.expenses)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--brand)' }}>{fmt(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
        }
      </Card>

      {/* ── Top routes ── */}
      {routeData.length > 0 && (
        <Card>
          <div className="card-header"><h3>Top fuel routes</h3></div>
          <table>
            <thead><tr><th>#</th><th>Route</th><th>Trips</th><th>Total km</th><th>Amount</th></tr></thead>
            <tbody>
              {routeData.map((r, i) => (
                <tr key={r.route}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>#{i+1}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.route}</td>
                  <td>{r.trips}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{Math.round(r.km)} km</td>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--brand)' }}>{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

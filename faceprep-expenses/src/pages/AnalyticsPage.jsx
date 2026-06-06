import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area
} from 'recharts'
import { formatCurrency, EXPENSE_TYPE_COLORS } from '../lib/constants'
import { format, parseISO, startOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'

const MONTH_COUNT = 6

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [claims, setClaims] = useState([])
  const [expenses, setExpenses] = useState([])
  const [fuel, setFuel] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: c }, { data: e }, { data: f }] = await Promise.all([
      supabase.from('claims').select('*').order('submitted_at'),
      supabase.from('expense_entries').select('*').order('entry_date'),
      supabase.from('fuel_entries').select('*').order('entry_date'),
    ])
    setClaims(c ?? [])
    setExpenses(e ?? [])
    setFuel(f ?? [])
    setLoading(false)
  }

  // ── Monthly spend trend (last 6 months) ──
  const months = eachMonthOfInterval({
    start: subMonths(new Date(), MONTH_COUNT - 1),
    end: new Date(),
  })

  const monthlyTrend = months.map(m => {
    const label = format(m, 'MMM yy')
    const key = format(m, 'yyyy-MM')
    const monthClaims = claims.filter(c => c.submitted_at?.startsWith(key))
    return {
      month: label,
      fuel: monthClaims.reduce((s, c) => s + Number(c.fuel_amount || 0), 0),
      other: monthClaims.reduce((s, c) => s + Number(c.expense_amount || 0), 0),
      total: monthClaims.reduce((s, c) => s + Number(c.total_amount || 0), 0),
    }
  })

  // ── Expense by category ──
  const categoryMap = {}
  expenses.forEach(e => {
    categoryMap[e.expense_type] = (categoryMap[e.expense_type] || 0) + Number(e.amount)
  })
  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // ── Claim status distribution ──
  const statusMap = { pending_manager: 0, pending_finance: 0, approved: 0, rejected: 0, draft: 0 }
  claims.forEach(c => { if (statusMap[c.status] !== undefined) statusMap[c.status]++ })
  const statusData = [
    { name: 'Approved', value: statusMap.approved, color: '#1D9E75' },
    { name: 'Pending manager', value: statusMap.pending_manager, color: '#EF9F27' },
    { name: 'Pending finance', value: statusMap.pending_finance, color: '#378ADD' },
    { name: 'Rejected', value: statusMap.rejected, color: '#E24B4A' },
  ].filter(d => d.value > 0)

  // ── Vehicle split in fuel ──
  const carFuel  = fuel.filter(f => true).reduce((s, f) => {
    const c = claims.find(c => c.id === f.claim_id)
    return c?.vehicle_type === 'Car' ? s + Number(f.amount) : s
  }, 0)
  const bikeFuel = fuel.reduce((s, f) => {
    const c = claims.find(cl => cl.id === f.claim_id)
    return c?.vehicle_type === 'Bike' ? s + Number(f.amount) : s
  }, 0)

  // ── Top routes ──
  const routeMap = {}
  fuel.forEach(f => {
    const key = `${f.from_place} → ${f.to_place}`
    if (!routeMap[key]) routeMap[key] = { count: 0, km: 0, amount: 0 }
    routeMap[key].count++
    routeMap[key].km += Number(f.distance_km)
    routeMap[key].amount += Number(f.amount)
  })
  const topRoutes = Object.entries(routeMap)
    .map(([route, stats]) => ({ route, ...stats }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // Summary KPIs
  const totalSpend    = claims.reduce((s, c) => s + Number(c.total_amount || 0), 0)
  const approvedSpend = claims.filter(c => c.status === 'approved').reduce((s, c) => s + Number(c.total_amount || 0), 0)
  const avgClaim      = claims.length ? totalSpend / claims.length : 0
  const totalKm       = fuel.reduce((s, f) => s + Number(f.distance_km || 0), 0)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: 'var(--bg-elevated)', border: '0.5px solid var(--border-strong)',
        borderRadius: 8, padding: '10px 14px', fontSize: 12,
      }}>
        <div style={{ fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <span>{p.name}</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner" style={{ width: 24, height: 24 }} />
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Analytics</div>
          <div className="page-sub">Expense trends, category breakdown and claim pipeline</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}>
          Last {MONTH_COUNT} months
        </div>
      </div>

      {/* KPI row */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total spend', value: formatCurrency(totalSpend), accent: 'var(--brand)' },
          { label: 'Approved spend', value: formatCurrency(approvedSpend), accent: 'var(--green)' },
          { label: 'Avg. claim size', value: formatCurrency(avgClaim), accent: 'var(--blue)' },
          { label: 'Total KM driven', value: `${totalKm.toFixed(0)} km`, accent: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.accent }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize: '1.3rem' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly trend chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>Monthly spend trend</h3>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: 'var(--brand)', display: 'inline-block', borderRadius: 2 }} /> Fuel</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: 'var(--blue)', display: 'inline-block', borderRadius: 2 }} /> Other expenses</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradFuel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D85A30" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#D85A30" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#378ADD" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#378ADD" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="fuel" name="Fuel" stroke="#D85A30" fill="url(#gradFuel)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="other" name="Other" stroke="#378ADD" fill="url(#gradOther)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row 2: Category pie + Status donut */}
      <div className="grid2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><h3>Spend by category</h3></div>
          {categoryData.length === 0 ? (
            <div className="empty-state">No expense data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {categoryData.map((entry, i) => (
                      <Cell key={entry.name} fill={EXPENSE_TYPE_COLORS[entry.name] ?? '#888'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {categoryData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: EXPENSE_TYPE_COLORS[d.name] ?? '#888', flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{d.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h3>Claim pipeline</h3></div>
          {statusData.length === 0 ? (
            <div className="empty-state">No claims yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {statusData.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {statusData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{d.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 500, color: 'var(--text-primary)' }}>{d.value}</span>
                  </div>
                ))}
              </div>

              {/* Fuel vehicle split */}
              <div className="divider" />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>FUEL: VEHICLE SPLIT</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[['Car', carFuel, 'var(--brand)'], ['Bike', bikeFuel, 'var(--blue)']].map(([label, val, color]) => (
                  <div key={label} style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color }}>{formatCurrency(val)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top routes */}
      <div className="card">
        <div className="card-header"><h3>Top routes by spend</h3></div>
        {topRoutes.length === 0 ? (
          <div className="empty-state">No fuel data yet</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Trips</th>
                  <th>Total KM</th>
                  <th>Total spend</th>
                  <th>Avg per trip</th>
                </tr>
              </thead>
              <tbody>
                {topRoutes.map((r, i) => (
                  <tr key={r.route}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0
                        }}>{i + 1}</div>
                        <span style={{ fontSize: 12 }}>{r.route}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.count}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.km.toFixed(1)} km</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{formatCurrency(r.amount)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{formatCurrency(r.amount / r.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

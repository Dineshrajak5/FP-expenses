import jsPDF from 'jspdf'

export function exportClaimPDF(claim, fuelEntries, expenseEntries, profile) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, margin = 18, lineH = 7
  let y = margin

  const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  // Header
  doc.setFillColor(216, 90, 48)
  doc.rect(0, 0, W, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('FACE Prep — Reimbursement Claim', margin, 14)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(claim.claim_number, W - margin, 14, { align: 'right' })
  y = 32

  doc.setTextColor(30, 30, 30)

  // Employee details
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Employee Details', margin, y); y += lineH
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const empDetails = [
    ['Name', profile?.full_name || '—'],
    ['Email', profile?.email || '—'],
    ['Period', `${fmtDate(claim.period_from)} to ${fmtDate(claim.period_to)}`],
    ['Vehicle', `${claim.vehicle_type} · ${claim.fuel_price_band}`],
    ['Submitted', fmtDate(claim.submitted_at)],
    ['Status', claim.status?.replace('_', ' ').toUpperCase()],
  ]
  empDetails.forEach(([label, value]) => {
    doc.setTextColor(100, 100, 100); doc.text(label, margin, y)
    doc.setTextColor(30, 30, 30); doc.text(String(value), margin + 35, y)
    y += lineH
  })
  y += 4

  // Fuel entries
  if (fuelEntries?.length > 0) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30)
    doc.text('Fuel Reimbursement', margin, y); y += lineH
    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 100, 100)
    doc.text('Date', margin, y)
    doc.text('From → To', margin + 22, y)
    doc.text('KM', margin + 100, y)
    doc.text('Rate', margin + 115, y)
    doc.text('Amount', margin + 130, y)
    y += 5
    doc.setDrawColor(220, 220, 220); doc.line(margin, y, W - margin, y); y += 3
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30)
    fuelEntries.forEach(f => {
      doc.text(fmtDate(f.entry_date), margin, y)
      const route = `${f.from_place} → ${f.to_place}`
      doc.text(route.length > 45 ? route.slice(0, 45) + '…' : route, margin + 22, y)
      doc.text(String(f.distance_km), margin + 100, y)
      doc.text(`${f.rate_per_km}/km`, margin + 115, y)
      doc.text(fmt(f.amount), margin + 130, y)
      y += lineH
    })
    doc.setFont('helvetica', 'bold')
    doc.text(`Fuel subtotal: ${fmt(claim.fuel_amount)}`, W - margin, y, { align: 'right' })
    y += lineH + 4
  }

  // Expense entries
  if (expenseEntries?.length > 0) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30)
    doc.text('Expense Summary', margin, y); y += lineH
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100)
    doc.text('Date', margin, y)
    doc.text('Type', margin + 22, y)
    doc.text('Description', margin + 65, y)
    doc.text('Bill no.', margin + 120, y)
    doc.text('Amount', margin + 148, y)
    y += 5
    doc.setDrawColor(220, 220, 220); doc.line(margin, y, W - margin, y); y += 3
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30)
    expenseEntries.forEach(e => {
      doc.text(fmtDate(e.entry_date), margin, y)
      doc.text((e.expense_type || '').slice(0, 22), margin + 22, y)
      doc.text((e.description || '').slice(0, 28), margin + 65, y)
      doc.text((e.bill_number || 'NA').slice(0, 14), margin + 120, y)
      doc.text(fmt(e.amount), margin + 148, y)
      y += lineH
    })
    doc.setFont('helvetica', 'bold')
    doc.text(`Expense subtotal: ${fmt(claim.expense_amount)}`, W - margin, y, { align: 'right' })
    y += lineH + 4
  }

  // Grand total
  doc.setDrawColor(216, 90, 48); doc.setLineWidth(0.5)
  doc.line(margin, y, W - margin, y); y += 6
  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.setTextColor(216, 90, 48)
  doc.text(`Grand Total: ${fmt(claim.total_amount)}`, W - margin, y, { align: 'right' })
  y += 12

  // Approval info
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
  doc.text('Claimed by: ' + (profile?.full_name || '—'), margin, y)
  doc.text('Approved by Manager: ' + (claim.manager_at ? fmtDate(claim.manager_at) : 'Pending'), margin + 80, y)
  y += lineH
  doc.text('Approved by Finance: ' + (claim.finance_at ? fmtDate(claim.finance_at) : 'Pending'), margin + 80, y)

  doc.save(`${claim.claim_number}.pdf`)
}

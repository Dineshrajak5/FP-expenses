export const FUEL_RATES = {
  Car: {
    'Below Rs. 100': 8.5,
    'Below Rs. 107.5': 9.0,
    'Below Rs. 115': 9.5,
    'Below Rs. 122.5': 10.0,
  },
  Bike: {
    'Below Rs. 100': 3.5,
    'Below Rs. 107.5': 3.75,
    'Below Rs. 115': 4.0,
    'Below Rs. 122.5': 4.25,
  },
}

export const FUEL_BANDS = [
  'Below Rs. 100',
  'Below Rs. 107.5',
  'Below Rs. 115',
  'Below Rs. 122.5',
]

export const EXPENSE_TYPES = [
  'Base Local Travel',
  'Outstation Travel',
  'Outstation Local Travel',
  'Internal Commute',
  'Outstation Stay',
  'Laundry',
  'Transit Local Travel',
  'Transit Stay',
  'Toll/Parking',
  'Courier Charges',
  'Food Allowance',
  'Miscellaneous',
  'Mobile Allowance',
  'Printing & Stationery',
]

export const EXPENSE_TYPE_COLORS = {
  'Base Local Travel': '#D85A30',
  'Outstation Travel': '#378ADD',
  'Outstation Local Travel': '#1D9E75',
  'Internal Commute': '#EF9F27',
  'Outstation Stay': '#7F77DD',
  'Laundry': '#9FE1CB',
  'Transit Local Travel': '#D4537E',
  'Transit Stay': '#639922',
  'Toll/Parking': '#BA7517',
  'Courier Charges': '#534AB7',
  'Food Allowance': '#0F6E56',
  'Miscellaneous': '#888780',
  'Mobile Allowance': '#185FA5',
  'Printing & Stationery': '#993C1D',
}

export const CLAIM_STATUS = {
  draft: { label: 'Draft', color: '#888780', bg: '#F1EFE8' },
  pending_manager: { label: 'Pending Manager', color: '#BA7517', bg: '#FAEEDA' },
  pending_finance: { label: 'Pending Finance', color: '#185FA5', bg: '#E6F1FB' },
  approved: { label: 'Approved', color: '#0F6E56', bg: '#E1F5EE' },
  rejected: { label: 'Rejected', color: '#993C1D', bg: '#FAECE7' },
}

export const ROLES = {
  staff: 'Sales Rep',
  manager: 'Manager',
  finance: 'Finance',
  admin: 'Admin',
}

export function getFuelRate(vehicle, band) {
  return FUEL_RATES[vehicle]?.[band] ?? 0
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount ?? 0)
}

export function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

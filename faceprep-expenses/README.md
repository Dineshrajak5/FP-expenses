# FACE Prep — Reimbursement Portal

A full-stack reimbursement management web app for FACE Prep's sales team.
Built with **Vite + React 18**, **Supabase** (PostgreSQL + Auth + Storage), and **Recharts**.

---

## Features

| Feature | Details |
|---|---|
| Google OAuth | Restricted to `@faceprep.in` domain |
| Fuel reimbursement | Auto-calculated: vehicle × fuel band × km |
| Expense tracking | 14 categories matching your existing Excel form |
| Two-level approval | Manager → Finance with notes |
| Analytics dashboard | Monthly trends, category pie, claim pipeline, top routes |
| Role-based access | Staff / Manager / Finance / Admin |
| Real-time DB | Supabase PostgreSQL with Row-Level Security |

---

## Stack

```
Frontend:  Vite + React 18
Auth:      Supabase Auth (Google OAuth)
Database:  Supabase PostgreSQL
Storage:   Supabase Storage (receipts)
Charts:    Recharts
Icons:     Lucide React
Hosting:   Vercel (recommended)
```

---

## Setup

### 1. Supabase project
1. Create project at supabase.com
2. Go to SQL Editor → paste and run `supabase_schema.sql`
3. Note your Project URL and anon key (Settings → API)

### 2. Google OAuth
1. Google Cloud Console → Create OAuth 2.0 credentials
2. Redirect URI: `https://<project-id>.supabase.co/auth/v1/callback`
3. Supabase → Auth → Providers → Google → paste Client ID + Secret
4. Set Hosted Domain to `faceprep.in` for server-side enforcement
5. Supabase → Auth → URL Config → add your Vercel domain

### 3. Local dev
```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 4. Deploy to Vercel
```bash
vercel
# Set env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

### 5. Set user roles (in Supabase SQL Editor)
```sql
UPDATE profiles SET role = 'manager' WHERE email = 'manager@faceprep.in';
UPDATE profiles SET role = 'finance' WHERE email = 'finance@faceprep.in';
UPDATE profiles SET role = 'admin'   WHERE email = 'dinesh@faceprep.in';
```

---

## Role capabilities

| Role | Submit | Approve L1 | Approve L2 | Analytics |
|------|:---:|:---:|:---:|:---:|
| Staff | Yes | — | — | — |
| Manager | Yes | Yes | — | Yes |
| Finance | — | — | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes |

---

## Fuel rate matrix

| Vehicle | <Rs.100 | <Rs.107.5 | <Rs.115 | <Rs.122.5 |
|---------|---------|-----------|---------|-----------|
| Car | 8.50/km | 9.00/km | 9.50/km | 10.00/km |
| Bike | 3.50/km | 3.75/km | 4.00/km | 4.25/km |

To update: edit `src/lib/constants.js`

---

## Project structure

```
src/
  components/  Sidebar, Toast
  hooks/       useAuth (auth context)
  lib/         supabase.js, constants.js
  pages/       Login, Dashboard, NewClaim, MyClaims, Approvals, Analytics
  styles/      global.css (design system)
supabase_schema.sql   Run this first in Supabase SQL Editor
```

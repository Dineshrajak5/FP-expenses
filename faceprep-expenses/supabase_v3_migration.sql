-- ============================================================
-- V3 Migration: Line-item level approval
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Line-item status on fuel entries
ALTER TABLE public.fuel_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','queried','rejected')),
  ADD COLUMN IF NOT EXISTS reviewer_note text;

-- 2. Line-item status on expense entries
ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','queried','rejected')),
  ADD COLUMN IF NOT EXISTS reviewer_note text;

-- 3. Track if claim was partially approved / is a resubmission of queried items
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS is_partial boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_claim_id uuid REFERENCES public.claims(id),
  ADD COLUMN IF NOT EXISTS partial_fuel_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS partial_expense_amount numeric(10,2);

-- 4. Update status constraint to include line_item_queried
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_status_check;
ALTER TABLE public.claims ADD CONSTRAINT claims_status_check
  CHECK (status IN ('draft','pending_manager','pending_finance','approved','rejected','resubmitted','queried','partially_approved'));

-- 5. Allow update on fuel_entries and expense_entries by managers
DROP POLICY IF EXISTS "Manager update fuel entries" ON public.fuel_entries;
CREATE POLICY "Manager update fuel entries"
  ON public.fuel_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager','finance','admin')
    )
  );

DROP POLICY IF EXISTS "Manager update expense entries" ON public.expense_entries;
CREATE POLICY "Manager update expense entries"
  ON public.expense_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager','finance','admin')
    )
  );

SELECT 'V3 migration complete' AS status;

-- ============================================================
-- FACE Prep Reimbursement Portal — V2 Migration
-- Run this in Supabase SQL Editor AFTER the original schema
-- ============================================================

-- 1. User approval fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- 2. Fuel bill URL on claims
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS fuel_bill_url text;

-- 3. Drop and recreate status constraint to add new statuses
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_status_check;
ALTER TABLE public.claims ADD CONSTRAINT claims_status_check
  CHECK (status IN ('draft','pending_manager','pending_finance','approved','rejected','resubmitted','queried'));

-- 4. Clarification message thread
CREATE TABLE IF NOT EXISTS public.claim_messages (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id   uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES public.profiles(id),
  message    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.claim_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Claim message access" ON public.claim_messages;
CREATE POLICY "Claim message access"
  ON public.claim_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM claims c WHERE c.id = claim_id AND (
        c.employee_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager','finance','admin'))
      )
    )
  );

-- 5. Bills storage bucket
INSERT INTO storage.buckets (id, name, public)
  VALUES ('bills', 'bills', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth users upload bills" ON storage.objects;
CREATE POLICY "Auth users upload bills"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bills' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth users view bills" ON storage.objects;
CREATE POLICY "Auth users view bills"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bills' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth users delete bills" ON storage.objects;
CREATE POLICY "Auth users delete bills"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bills' AND auth.role() = 'authenticated');

-- 6. Index for messages
CREATE INDEX IF NOT EXISTS idx_messages_claim ON public.claim_messages(claim_id);

-- Done!
SELECT 'V2 migration complete' AS status;

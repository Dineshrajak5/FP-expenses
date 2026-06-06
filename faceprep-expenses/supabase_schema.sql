-- ============================================================
-- FACE Prep Reimbursement Portal — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES (synced from auth.users on login)
-- ─────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  employee_id text,
  role        text not null default 'staff'
                   check (role in ('staff','manager','finance','admin')),
  employee_type text default 'Non Trainers'
                     check (employee_type in ('Trainers','Non Trainers','Freelancer')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- CLAIMS
-- ─────────────────────────────────────────────
create table public.claims (
  id              uuid primary key default uuid_generate_v4(),
  claim_number    text unique not null,
  employee_id     uuid not null references public.profiles(id),
  period_from     date not null,
  period_to       date not null,
  vehicle_type    text not null check (vehicle_type in ('Car','Bike')),
  fuel_price_band text not null,
  fuel_amount     numeric(10,2) default 0,
  expense_amount  numeric(10,2) default 0,
  total_amount    numeric(10,2) generated always as (fuel_amount + expense_amount) stored,
  status          text not null default 'draft'
                       check (status in ('draft','pending_manager','pending_finance','approved','rejected')),
  manager_id      uuid references public.profiles(id),
  manager_note    text,
  manager_at      timestamptz,
  finance_id      uuid references public.profiles(id),
  finance_note    text,
  finance_at      timestamptz,
  submitted_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.claims enable row level security;

create policy "Staff see own claims"
  on public.claims for select
  using (employee_id = auth.uid() or
         exists (select 1 from profiles where id = auth.uid() and role in ('manager','finance','admin')));

create policy "Staff insert own claims"
  on public.claims for insert with check (employee_id = auth.uid());

create policy "Staff update own draft claims"
  on public.claims for update
  using (employee_id = auth.uid() and status = 'draft' or
         exists (select 1 from profiles where id = auth.uid() and role in ('manager','finance','admin')));

-- ─────────────────────────────────────────────
-- FUEL ENTRIES
-- ─────────────────────────────────────────────
create table public.fuel_entries (
  id            uuid primary key default uuid_generate_v4(),
  claim_id      uuid not null references public.claims(id) on delete cascade,
  entry_date    date not null,
  from_place    text not null,
  to_place      text not null,
  purpose       text,
  distance_km   numeric(8,1) not null,
  rate_per_km   numeric(6,2) not null,
  amount        numeric(10,2) generated always as (distance_km * rate_per_km) stored,
  created_at    timestamptz default now()
);

alter table public.fuel_entries enable row level security;

create policy "Fuel entries visible with claim access"
  on public.fuel_entries for select
  using (exists (
    select 1 from claims c
    where c.id = claim_id and (
      c.employee_id = auth.uid() or
      exists (select 1 from profiles where id = auth.uid() and role in ('manager','finance','admin'))
    )
  ));

create policy "Insert fuel entries for own claims"
  on public.fuel_entries for insert
  with check (exists (
    select 1 from claims where id = claim_id and employee_id = auth.uid()
  ));

create policy "Delete fuel entries for own draft claims"
  on public.fuel_entries for delete
  using (exists (
    select 1 from claims where id = claim_id and employee_id = auth.uid() and status = 'draft'
  ));

-- ─────────────────────────────────────────────
-- EXPENSE ENTRIES
-- ─────────────────────────────────────────────
create table public.expense_entries (
  id            uuid primary key default uuid_generate_v4(),
  claim_id      uuid not null references public.claims(id) on delete cascade,
  entry_date    date not null,
  expense_type  text not null,
  description   text,
  bill_number   text,
  amount        numeric(10,2) not null,
  receipt_url   text,
  created_at    timestamptz default now()
);

alter table public.expense_entries enable row level security;

create policy "Expense entries visible with claim access"
  on public.expense_entries for select
  using (exists (
    select 1 from claims c
    where c.id = claim_id and (
      c.employee_id = auth.uid() or
      exists (select 1 from profiles where id = auth.uid() and role in ('manager','finance','admin'))
    )
  ));

create policy "Insert expense entries for own claims"
  on public.expense_entries for insert
  with check (exists (
    select 1 from claims where id = claim_id and employee_id = auth.uid()
  ));

create policy "Delete expense entries for own draft claims"
  on public.expense_entries for delete
  using (exists (
    select 1 from claims where id = claim_id and employee_id = auth.uid() and status = 'draft'
  ));

-- ─────────────────────────────────────────────
-- AUTO-GENERATE CLAIM NUMBER
-- ─────────────────────────────────────────────
create sequence if not exists claim_number_seq start 1000;

create or replace function generate_claim_number()
returns trigger language plpgsql as $$
begin
  new.claim_number := 'RCLAIM-' || lpad(nextval('claim_number_seq')::text, 5, '0');
  return new;
end;
$$;

create trigger set_claim_number
  before insert on public.claims
  for each row execute procedure generate_claim_number();

-- ─────────────────────────────────────────────
-- STORAGE BUCKET for receipts
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
on conflict do nothing;

create policy "Authenticated users upload receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "Users view own receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
create index idx_claims_employee on public.claims(employee_id);
create index idx_claims_status on public.claims(status);
create index idx_claims_submitted on public.claims(submitted_at);
create index idx_fuel_claim on public.fuel_entries(claim_id);
create index idx_expense_claim on public.expense_entries(claim_id);
create index idx_expense_type on public.expense_entries(expense_type);

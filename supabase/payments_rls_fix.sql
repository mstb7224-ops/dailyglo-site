-- DailyGlo Payments RLS and Schema Fix
-- Run this script in your Supabase SQL Editor to resolve the RLS insert violation on the payments table.

-- 1. Ensure columns exist on the public.payments table
alter table if exists public.payments add column if not exists method text;
alter table if exists public.payments add column if not exists final_amount numeric(10,2);
alter table if exists public.payments add column if not exists discount_code text;
alter table if exists public.payments add column if not exists discount_percent numeric(5,2);
alter table if exists public.payments add column if not exists transaction_reference text;
alter table if exists public.payments add column if not exists screenshot_url text;

-- 2. Enable Row Level Security
alter table public.payments enable row level security;

-- 3. Clean up conflicting insert policies on payments
drop policy if exists "Enable insert for authenticated users" on public.payments;
drop policy if exists "Members can insert their own payments" on public.payments;
drop policy if exists "Allow authenticated users to insert payments" on public.payments;
drop policy if exists "Admins can view and update all payments" on public.payments;

-- 4. Create secure RLS policies for payments
create policy "Allow authenticated users to insert payments"
  on public.payments
  for insert
  to authenticated
  with check (true);

create policy "Allow users to view their own payments"
  on public.payments
  for select
  to authenticated
  using (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Allow admins to update payments"
  on public.payments
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

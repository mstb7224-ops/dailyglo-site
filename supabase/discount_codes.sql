-- DailyGlo discount-code setup
-- Run this script in Supabase SQL Editor before relying on database-backed validation.
-- The current frontend also contains the same two promo codes for immediate display/calculation.

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent_off numeric(5,2) not null check (percent_off > 0 and percent_off <= 100),
  active boolean not null default true,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.discount_codes enable row level security;

drop policy if exists "Anyone can read active discount codes" on public.discount_codes;
drop policy if exists "Admins can view all discount codes" on public.discount_codes;
drop policy if exists "Admins can insert discount codes" on public.discount_codes;
drop policy if exists "Admins can update discount codes" on public.discount_codes;
create policy "Anyone can read active discount codes"
  on public.discount_codes
  for select
  to anon, authenticated
  using (
    active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  );

create policy "Admins can view all discount codes"
  on public.discount_codes
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can insert discount codes"
  on public.discount_codes
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can update discount codes"
  on public.discount_codes
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.discount_codes (code, percent_off, active)
values
  ('DAILYGLO75', 75, true),
  ('DAILYGLO60', 60, true)
on conflict (code) do update set
  percent_off = excluded.percent_off,
  active = excluded.active;

-- Important: do not let the browser increment used_count or set payment amounts.
-- Final amount and one-time-use enforcement should be performed by a trusted
-- server-side endpoint or a SECURITY DEFINER RPC after backend payment integration.

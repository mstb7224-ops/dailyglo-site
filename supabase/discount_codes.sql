-- DailyGlo discount-code setup
-- FIRST90 is the only current promotion. Payment validity is 3 hours from browser redemption;
-- production payment verification should also enforce this window server-side.

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
  on public.discount_codes for select to anon, authenticated
  using (active = true and (expires_at is null or expires_at > now()) and (max_uses is null or used_count < max_uses));
create policy "Admins can view all discount codes"
  on public.discount_codes for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can insert discount codes"
  on public.discount_codes for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can update discount codes"
  on public.discount_codes for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.discount_codes (code, percent_off, active, max_uses, used_count, expires_at)
values
  ('SPECIAL5', 90, false, 5, 5, null),
  ('PRIME75', 75, false, null, 0, null),
  ('FIRST90', 90, true, 10, 0, null)
on conflict (code) do update set
  percent_off = excluded.percent_off,
  active = excluded.active,
  max_uses = excluded.max_uses,
  used_count = excluded.used_count,
  expires_at = excluded.expires_at;

-- The browser starts a three-hour redemption window when FIRST90 is applied.
-- Final payment verification and atomic used_count increments should be performed by a trusted
-- server-side endpoint or SECURITY DEFINER RPC before production payment settlement.

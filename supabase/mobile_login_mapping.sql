-- Allow email-free registration while preserving mobile login for existing accounts.
-- Existing auth emails are backfilled from auth.users metadata where available.
alter table public.members add column if not exists mobile text;

update public.members as m
set mobile = u.raw_user_meta_data ->> 'mobile'
from auth.users as u
where u.id = m.id
  and (m.mobile is null or m.mobile = '');

create or replace function public.resolve_login_email(p_mobile text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.members
  where regexp_replace(coalesce(mobile, ''), '\\D', '', 'g') = regexp_replace(coalesce(p_mobile, ''), '\\D', '', 'g')
  order by created_at desc nulls last
  limit 1
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;

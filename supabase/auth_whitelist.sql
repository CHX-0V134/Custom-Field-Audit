-- Email whitelist + secure login lockdown.
-- Applied at cutover (after the email list is loaded and Site URL is configured).

-- 1. The whitelist. Kept private (RLS on, no read policies) — only the
--    SECURITY DEFINER helper functions below can see it.
create table if not exists public.allowed_emails (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

-- 2. Public check used by the login screen to validate ONE email without
--    exposing the whole list (and to avoid wasting the email quota on
--    unauthorized addresses).
create or replace function public.is_email_allowed(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(check_email)
  );
$$;
grant execute on function public.is_email_allowed(text) to anon, authenticated;

-- 3. Authorization check used by RLS: is the *currently signed-in* user
--    whitelisted? (Also revokes access immediately if an email is removed.)
create or replace function public.is_authorized()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_authorized() to anon, authenticated;

-- 4. Hard block at the door: a non-whitelisted email can never become a user.
create or replace function public.enforce_email_whitelist()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.allowed_emails where lower(email) = lower(NEW.email)
  ) then
    raise exception 'Email not authorized: %', NEW.email using errcode = '42501';
  end if;
  return NEW;
end;
$$;

drop trigger if exists enforce_email_whitelist_trg on auth.users;
create trigger enforce_email_whitelist_trg
  before insert on auth.users
  for each row execute function public.enforce_email_whitelist();

-- 5. Replace the open (anon) policies with whitelisted-authenticated-only access.
drop policy if exists "read accounts" on public.accounts;
drop policy if exists "read injection_points" on public.injection_points;
drop policy if exists "read audits" on public.audits;
drop policy if exists "insert audits" on public.audits;
drop policy if exists "update audits" on public.audits;
drop policy if exists "delete audits" on public.audits;

create policy "auth read accounts" on public.accounts
  for select to authenticated using (public.is_authorized());

create policy "auth read injection_points" on public.injection_points
  for select to authenticated using (public.is_authorized());

create policy "auth read audits" on public.audits
  for select to authenticated using (public.is_authorized());
create policy "auth insert audits" on public.audits
  for insert to authenticated with check (public.is_authorized());
create policy "auth update audits" on public.audits
  for update to authenticated using (public.is_authorized()) with check (public.is_authorized());
create policy "auth delete audits" on public.audits
  for delete to authenticated using (public.is_authorized());

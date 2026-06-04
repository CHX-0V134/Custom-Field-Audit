-- Seed accounts and injection points.
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run: existing rows are kept.
--
-- 1. Add your accounts.
-- 2. Add each injection point under its account (tank + the well it serves).

-- ---- Accounts ----
insert into public.accounts (name) values
  ('Account A'),
  ('Account B')
on conflict (name) do nothing;

-- ---- Injection points ----
-- Each row: the account name, the tank, and the well the tank serves.
insert into public.injection_points (account_id, tank, well)
select a.id, v.tank, v.well
from (values
  ('Account A', 'Tank 1', 'Well 12-34'),
  ('Account A', 'Tank 2', 'Well 56-78'),
  ('Account B', 'Tank 1', 'Well 90-12')
) as v(account_name, tank, well)
join public.accounts a on a.name = v.account_name
where not exists (
  select 1 from public.injection_points ip
  where ip.account_id = a.id and ip.tank = v.tank and ip.well = v.well
);

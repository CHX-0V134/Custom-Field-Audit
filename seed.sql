-- Seed accounts, tanks, and the wells each tank serves.
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- Model: account → tanks → wells. A tank shared by several wells is entered once
-- here, with one well row per well it serves.

-- ---- Accounts ----
insert into public.accounts (name) values
  ('Account A'),
  ('Account B')
on conflict (name) do nothing;

-- ---- Tanks ----
-- (account name, tank label)
insert into public.tanks (account_id, label)
select a.id, v.label
from (values
  ('Account A', 'Tank 1 (Pad 7)'),
  ('Account A', 'Tank 2 (Pad 3)'),
  ('Account B', 'Tank 1')
) as v(account_name, label)
join public.accounts a on a.name = v.account_name
where not exists (
  select 1 from public.tanks t where t.account_id = a.id and t.label = v.label
);

-- ---- Wells ----
-- (account name, tank label, well name) — list every well under its tank.
insert into public.wells (tank_id, name)
select t.id, v.well
from (values
  ('Account A', 'Tank 1 (Pad 7)', 'Well 12-34'),
  ('Account A', 'Tank 1 (Pad 7)', 'Well 56-78'),
  ('Account A', 'Tank 2 (Pad 3)', 'Well 90-12'),
  ('Account B', 'Tank 1',         'Well 01-02')
) as v(account_name, tank_label, well)
join public.accounts a on a.name = v.account_name
join public.tanks t on t.account_id = a.id and t.label = v.tank_label
where not exists (
  select 1 from public.wells w where w.tank_id = t.id and w.name = v.well
);

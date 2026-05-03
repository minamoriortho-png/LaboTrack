create table if not exists lab_cards (
  id uuid primary key default gen_random_uuid(),
  patient text not null,
  device_category text not null,
  device_name text not null,
  stage text not null,
  fitting_date date not null,
  visit_date date not null,
  memo text default '',
  created_at timestamp with time zone default now()
);

alter table lab_cards enable row level security;

drop policy if exists "authenticated users can read lab cards" on lab_cards;
drop policy if exists "authenticated users can insert lab cards" on lab_cards;
drop policy if exists "authenticated users can update lab cards" on lab_cards;
drop policy if exists "authenticated users can delete lab cards" on lab_cards;

create policy "authenticated users can read lab cards"
on lab_cards for select
to authenticated
using (true);

create policy "authenticated users can insert lab cards"
on lab_cards for insert
to authenticated
with check (true);

create policy "authenticated users can update lab cards"
on lab_cards for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete lab cards"
on lab_cards for delete
to authenticated
using (true);

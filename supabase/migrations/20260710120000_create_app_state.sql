create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Public app state read" on public.app_state;
create policy "Public app state read"
on public.app_state for select
to anon, authenticated
using (true);

drop policy if exists "Public app state insert" on public.app_state;
create policy "Public app state insert"
on public.app_state for insert
to anon, authenticated
with check (id = 'house-os');

drop policy if exists "Public app state update" on public.app_state;
create policy "Public app state update"
on public.app_state for update
to anon, authenticated
using (id = 'house-os')
with check (id = 'house-os');

grant select, insert, update on public.app_state to anon, authenticated;

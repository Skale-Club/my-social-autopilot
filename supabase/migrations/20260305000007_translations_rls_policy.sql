alter table public.translations enable row level security;

drop policy if exists translations_no_client_access on public.translations;

create policy translations_no_client_access
  on public.translations
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.translations is
  'Cached UI translations managed by backend service role. Direct client access is blocked by RLS.';

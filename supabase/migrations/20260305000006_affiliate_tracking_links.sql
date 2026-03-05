-- Affiliate referral links and click tracking

create table if not exists public.affiliate_links (
  id uuid default gen_random_uuid() primary key,
  affiliate_user_id uuid references auth.users on delete cascade not null,
  code text not null unique,
  destination_url text not null default '/login?tab=signup',
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.affiliate_clicks (
  id uuid default gen_random_uuid() primary key,
  link_id uuid references public.affiliate_links on delete set null,
  affiliate_user_id uuid references auth.users on delete set null,
  code text not null,
  destination_url text not null,
  ip_hash text,
  user_agent text,
  referrer text,
  clicked_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_affiliate_links_user_id
  on public.affiliate_links(affiliate_user_id);

create index if not exists idx_affiliate_links_code
  on public.affiliate_links(code);

create index if not exists idx_affiliate_clicks_affiliate_user
  on public.affiliate_clicks(affiliate_user_id, clicked_at desc);

create index if not exists idx_affiliate_clicks_code
  on public.affiliate_clicks(code);

alter table public.affiliate_links enable row level security;
alter table public.affiliate_clicks enable row level security;

drop policy if exists "Users can view own affiliate links" on public.affiliate_links;
create policy "Users can view own affiliate links" on public.affiliate_links
  for select using (auth.uid() = affiliate_user_id);

drop policy if exists "Users can insert own affiliate links" on public.affiliate_links;
create policy "Users can insert own affiliate links" on public.affiliate_links
  for insert with check (auth.uid() = affiliate_user_id);

drop policy if exists "Users can update own affiliate links" on public.affiliate_links;
create policy "Users can update own affiliate links" on public.affiliate_links
  for update using (auth.uid() = affiliate_user_id);

drop policy if exists "Users can view own affiliate clicks" on public.affiliate_clicks;
create policy "Users can view own affiliate clicks" on public.affiliate_clicks
  for select using (auth.uid() = affiliate_user_id);

-- Backfill one default referral link per existing affiliate profile
insert into public.affiliate_links (affiliate_user_id, code, destination_url)
select
  p.id,
  lower('aff_' || substring(replace(p.id::text, '-', '') from 1 for 12)),
  '/login?tab=signup'
from public.profiles p
where p.is_affiliate = true
  and not exists (
    select 1
    from public.affiliate_links l
    where l.affiliate_user_id = p.id
  )
on conflict (code) do nothing;

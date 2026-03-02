-- Stripe Billing: subscription plans, user subscriptions, and usage events
-- Run this SQL in your Supabase SQL Editor after the initial setup

-- Plans available on the platform
create table if not exists public.subscription_plans (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,           -- 'free_trial', 'pro'
  display_name text not null,
  stripe_price_id text,                -- NULL for free_trial
  monthly_limit integer,               -- NULL = unlimited; 3 for free_trial
  price_cents integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User subscription state (one row per user)
create table if not exists public.user_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  plan_id uuid references public.subscription_plans,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'trialing', -- trialing | active | canceled | past_due
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id)
);

-- Usage events: one row per generation or edit
create table if not exists public.usage_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  post_id uuid references public.posts on delete set null,
  event_type text not null check (event_type in ('generate', 'edit')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.usage_events enable row level security;

create policy "Plans are public read" on public.subscription_plans
  for select using (true);

create policy "Users can view own subscription" on public.user_subscriptions
  for select using (auth.uid() = user_id);

create policy "Users can view own usage" on public.usage_events
  for select using (auth.uid() = user_id);

-- Seed: initial plans
insert into public.subscription_plans (name, display_name, monthly_limit, price_cents)
values
  ('free_trial', 'Free Trial', 3, 0),
  ('pro', 'Pro', null, 9900)  -- R$99/month placeholder; update price_cents and stripe_price_id after creating Stripe products
on conflict (name) do nothing;

-- Update handle_new_user trigger to also create user_subscription on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  free_trial_id uuid;
begin
  insert into public.profiles (id)
  values (new.id);

  select id into free_trial_id
  from public.subscription_plans
  where name = 'free_trial'
  limit 1;

  if free_trial_id is not null then
    insert into public.user_subscriptions (user_id, plan_id, status)
    values (new.id, free_trial_id, 'trialing');
  end if;

  return new;
end;
$$ language plpgsql security definer;

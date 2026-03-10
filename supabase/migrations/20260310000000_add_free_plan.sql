-- Add free plan for new users
insert into public.billing_plans (
  plan_key,
  display_name,
  billing_interval,
  included_credits_micros,
  base_price_micros,
  overage_enabled,
  active
)
values
  ('free', 'Free', 'month', 0, 0, false, true)
on conflict (plan_key) do update set
  display_name = EXCLUDED.display_name,
  billing_interval = EXCLUDED.billing_interval,
  included_credits_micros = EXCLUDED.included_credits_micros,
  base_price_micros = EXCLUDED.base_price_micros,
  overage_enabled = EXCLUDED.overage_enabled,
  active = EXCLUDED.active;

-- Update default_plan_key setting to use free plan
insert into public.billing_settings (setting_key, setting_value)
values ('default_plan_key', '{"value": "free"}'::jsonb)
on conflict (setting_key) do update set
  setting_value = EXCLUDED.setting_value,
  updated_at = timezone('utc'::text, now());

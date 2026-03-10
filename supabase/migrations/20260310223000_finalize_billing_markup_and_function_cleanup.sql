-- Finalize billing rollout:
-- 1) Ensure markup settings exist with safe defaults (idempotent)
-- 2) Remove legacy overloaded RPC signature to avoid ambiguity

INSERT INTO public.platform_settings (setting_key, setting_value)
VALUES
  ('markup_regular', '{"multiplier": 3, "description": "Regular user pay-per-use markup"}'::jsonb),
  ('markup_affiliate', '{"multiplier": 4, "description": "Referred customer markup"}'::jsonb),
  ('default_affiliate_commission_percent', '{"amount": 50, "description": "Default affiliate commission share percent over gross profit"}'::jsonb),
  ('min_recharge_micros', '{"amount": 10000000, "description": "Minimum manual top-up"}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Legacy signature introduced in 20260309232557_billing_token_pricing_profit_share_statement.sql.
-- Current code uses the newer signature:
-- process_usage_deduction_tx(uuid, uuid, bigint, numeric, text, boolean, uuid)
DROP FUNCTION IF EXISTS public.process_usage_deduction_tx(
  uuid,
  uuid,
  bigint,
  bigint,
  text,
  boolean,
  uuid
);

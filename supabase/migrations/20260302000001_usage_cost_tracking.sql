-- Add token and cost tracking columns to usage_events
-- cost_usd_micros: cost in micro-dollars (1 USD = 1_000_000). Example: $0.001 → 1000

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS text_input_tokens  INTEGER,   -- input tokens: gemini-2.5-flash (text phase)
  ADD COLUMN IF NOT EXISTS text_output_tokens INTEGER,   -- output tokens: gemini-2.5-flash (text phase)
  ADD COLUMN IF NOT EXISTS image_input_tokens INTEGER,   -- input tokens: gemini-2.5-flash-image (image phase)
  ADD COLUMN IF NOT EXISTS image_output_tokens INTEGER,  -- output tokens: gemini-2.5-flash-image (image phase)
  ADD COLUMN IF NOT EXISTS cost_usd_micros    BIGINT;    -- total estimated cost in micro-dollars

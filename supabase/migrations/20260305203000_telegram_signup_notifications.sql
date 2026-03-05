-- One-time delivery log for Telegram integration events.
-- Prevents duplicate notifications when auth state updates run multiple times.

CREATE TABLE IF NOT EXISTS public.integration_event_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type text NOT NULL,
  event_type text NOT NULL,
  subject_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  delivered_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.integration_event_deliveries
  ADD COLUMN IF NOT EXISTS integration_type text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.integration_event_deliveries
  DROP CONSTRAINT IF EXISTS integration_event_deliveries_unique_subject_event;

ALTER TABLE public.integration_event_deliveries
  ADD CONSTRAINT integration_event_deliveries_unique_subject_event
  UNIQUE (integration_type, event_type, subject_id);

ALTER TABLE public.integration_event_deliveries ENABLE ROW LEVEL SECURITY;

-- Migrate legacy Telegram metadata key.
UPDATE public.integration_settings
SET custom_field_mappings = (
  (custom_field_mappings - 'notify_on_new_chat')
  || jsonb_build_object(
    'notify_on_new_signup',
    COALESCE(
      (custom_field_mappings ->> 'notify_on_new_signup')::boolean,
      (custom_field_mappings ->> 'notify_on_new_chat')::boolean,
      false
    )
  )
)
WHERE integration_type = 'telegram';

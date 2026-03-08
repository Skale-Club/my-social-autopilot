ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS enabled_at timestamp with time zone;

UPDATE public.integration_settings
SET enabled_at = COALESCE(enabled_at, updated_at, created_at, timezone('utc'::text, now()))
WHERE enabled = true
  AND enabled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.integration_delivery_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_type text NOT NULL,
  event_name text NOT NULL,
  event_key text,
  status text NOT NULL DEFAULT 'queued',
  reason text,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'integration_delivery_logs_status_check'
  ) THEN
    ALTER TABLE public.integration_delivery_logs
      ADD CONSTRAINT integration_delivery_logs_status_check
      CHECK (status IN ('queued', 'sent', 'failed', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_integration_delivery_logs_created_at
  ON public.integration_delivery_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_delivery_logs_integration_event
  ON public.integration_delivery_logs (integration_type, event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_delivery_logs_status
  ON public.integration_delivery_logs (status);

ALTER TABLE public.integration_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view integration delivery logs" ON public.integration_delivery_logs;
CREATE POLICY "Admins can view integration delivery logs"
ON public.integration_delivery_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);

DROP POLICY IF EXISTS "Admins can insert integration delivery logs" ON public.integration_delivery_logs;
CREATE POLICY "Admins can insert integration delivery logs"
ON public.integration_delivery_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);

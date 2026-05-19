-- Phase 17 (v1.4) — opt-in flag for GHL signup sync.
-- Reuses existing integration_settings table; no new table.

ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS sync_on_signup boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.integration_settings.sync_on_signup IS
  'Per-integration opt-in: when true, this integration receives a push when a Xareable user signs up. Phase 17 wires the GHL branch; future integrations can opt in by reading this flag from their handler.';

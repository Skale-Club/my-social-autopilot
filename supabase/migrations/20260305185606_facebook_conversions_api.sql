-- Migration: Facebook Conversions API Integration
-- Adds Facebook Pixel/Conversions API settings and tracking columns

-- 1. Insert default Facebook integration settings row
INSERT INTO integration_settings (integration_type, enabled, custom_field_mappings)
VALUES ('facebook', false, '{"auto_pageview": true, "auto_lead": true}')
ON CONFLICT (integration_type) DO NOTHING;

-- 2. Add Facebook tracking columns to form_leads table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'form_leads') THEN
        -- Facebook Click ID (fbclid)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'form_leads' AND column_name = 'fbclid'
        ) THEN
            ALTER TABLE form_leads ADD COLUMN fbclid TEXT;
            COMMENT ON COLUMN form_leads.fbclid IS 'Facebook Click ID from URL parameter';
        END IF;

        -- Facebook Browser ID (_fbc from cookie)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'form_leads' AND column_name = 'fbc'
        ) THEN
            ALTER TABLE form_leads ADD COLUMN fbc TEXT;
            COMMENT ON COLUMN form_leads.fbc IS 'Facebook Browser ID from _fbc cookie';
        END IF;

        -- Facebook event ID for deduplication
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'form_leads' AND column_name = 'fb_event_id'
        ) THEN
            ALTER TABLE form_leads ADD COLUMN fb_event_id TEXT;
            COMMENT ON COLUMN form_leads.fb_event_id IS 'Unique event ID for Facebook event deduplication';
        END IF;

        -- Facebook sync status
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'form_leads' AND column_name = 'fb_sync_status'
        ) THEN
            ALTER TABLE form_leads ADD COLUMN fb_sync_status TEXT DEFAULT 'pending';
            COMMENT ON COLUMN form_leads.fb_sync_status IS 'Facebook CAPI sync status: pending, synced, failed';
        END IF;

        -- Facebook synced at timestamp
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'form_leads' AND column_name = 'fb_synced_at'
        ) THEN
            ALTER TABLE form_leads ADD COLUMN fb_synced_at TIMESTAMPTZ;
            COMMENT ON COLUMN form_leads.fb_synced_at IS 'Timestamp of last successful Facebook CAPI sync';
        END IF;

        -- Facebook sync error
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'form_leads' AND column_name = 'fb_sync_error'
        ) THEN
            ALTER TABLE form_leads ADD COLUMN fb_sync_error TEXT;
            COMMENT ON COLUMN form_leads.fb_sync_error IS 'Error message if Facebook sync failed';
        END IF;

        -- Create index for Facebook sync queries
        CREATE INDEX IF NOT EXISTS idx_form_leads_fb_status ON form_leads(fb_sync_status) WHERE fb_sync_status IS NOT NULL;
    END IF;
END $$;

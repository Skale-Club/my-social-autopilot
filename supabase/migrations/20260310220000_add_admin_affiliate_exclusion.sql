-- Migration: Add mutual exclusion constraint for admin and affiliate roles
-- Prevents conflict of interest where an admin could set themselves as affiliate and earn commissions

-- First, check if there are any existing users with both roles and fix them
-- (Admins should not be affiliates, so we remove affiliate status from admins)
UPDATE public.profiles 
SET is_affiliate = false 
WHERE is_admin = true AND is_affiliate = true;

-- Add the constraint to prevent both roles simultaneously
-- This allows:
-- is_admin = false, is_affiliate = false (regular user)
-- is_admin = true, is_affiliate = false (admin)
-- is_admin = false, is_affiliate = true (affiliate)
-- But NOT:
-- is_admin = true, is_affiliate = true (admin + affiliate - conflict of interest)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'admin_affiliate_mutual_exclusion'
  ) THEN
    ALTER TABLE public.profiles 
      ADD CONSTRAINT admin_affiliate_mutual_exclusion 
      CHECK (NOT (is_admin = true AND is_affiliate = true));
  END IF;
END $$;

-- Add a trigger to prevent setting is_affiliate = true when is_admin = true via admin API
CREATE OR REPLACE FUNCTION enforce_admin_affiliate_exclusion()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to set both to true, keep is_affiliate = false
  IF NEW.is_admin = true AND NEW.is_affiliate = true THEN
    NEW.is_affiliate := false;
    RAISE NOTICE 'Cannot set is_affiliate = true for admin users. is_affiliate has been set to false.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS enforce_admin_affiliate_exclusion_trigger ON public.profiles;
CREATE TRIGGER enforce_admin_affiliate_exclusion_trigger
  BEFORE INSERT OR UPDATE OF is_admin, is_affiliate ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_admin_affiliate_exclusion();

-- Add comment
COMMENT ON CONSTRAINT admin_affiliate_mutual_exclusion ON public.profiles IS 
'Prevents users from being both admin and affiliate simultaneously to avoid conflict of interest. Admins have full platform access and should not earn affiliate commissions.';

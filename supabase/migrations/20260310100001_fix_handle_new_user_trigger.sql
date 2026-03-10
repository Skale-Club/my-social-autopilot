-- Fix handle_new_user trigger that references removed subscription_plans table
-- Also remove stale initialize_user_subscription trigger/function from legacy billing

DROP FUNCTION IF EXISTS public.initialize_user_subscription() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (
    new.id,
    COALESCE(LOWER(TRIM(new.email)), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

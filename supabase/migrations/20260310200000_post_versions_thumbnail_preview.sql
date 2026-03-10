-- Persist lightweight preview URLs for edited post versions
ALTER TABLE public.post_versions
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Phase 18 (v1.5) — Brand Style References: data layer
-- Creates brand_reference_photos table and adds style_description to brands.

-- ============================================================
-- PART 1: Add brands.style_description column
-- ============================================================

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS style_description TEXT;

-- ============================================================
-- PART 2: Create brand_reference_photos table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_reference_photos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id   UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url  TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_brand_reference_photos_brand_id
  ON public.brand_reference_photos (brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_reference_photos_user_id
  ON public.brand_reference_photos (user_id);

-- ============================================================
-- PART 3: Enable RLS + policies
-- ============================================================

ALTER TABLE public.brand_reference_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reference photos" ON public.brand_reference_photos;
CREATE POLICY "Users can view own reference photos"
  ON public.brand_reference_photos FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own reference photos" ON public.brand_reference_photos;
CREATE POLICY "Users can insert own reference photos"
  ON public.brand_reference_photos FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own reference photos" ON public.brand_reference_photos;
CREATE POLICY "Users can update own reference photos"
  ON public.brand_reference_photos FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own reference photos" ON public.brand_reference_photos;
CREATE POLICY "Users can delete own reference photos"
  ON public.brand_reference_photos FOR DELETE
  USING (user_id = auth.uid());

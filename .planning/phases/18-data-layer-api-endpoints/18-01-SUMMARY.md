---
phase: 18
plan: 01
subsystem: data-layer
tags: [migration, zod, supabase, brand, rls]
dependency_graph:
  requires: []
  provides:
    - supabase/migrations/20260516000000_brand_style_references.sql
    - shared/schema.ts#brandReferencePhotoSchema
    - shared/schema.ts#brandReferencePhotosResponseSchema
    - shared/schema.ts#createBrandReferencePhotoSchema
    - shared/schema.ts#updateStyleDescriptionSchema
  affects:
    - server/routes/brand-references.routes.ts (Plan 18-02 consumes these schemas)
    - shared/schema.ts#brandSchema (style_description field added)
tech_stack:
  added: []
  patterns:
    - Supabase migration with additive ALTER TABLE + CREATE TABLE IF NOT EXISTS
    - Zod schema with nullable().optional() for soft fields
    - RLS policies using auth.uid() directly on denormalized user_id column
key_files:
  created:
    - supabase/migrations/20260516000000_brand_style_references.sql
  modified:
    - shared/schema.ts
decisions:
  - "user_id stored denormalized on brand_reference_photos for O(1) RLS check without subquery JOIN to brands"
  - "UPDATE policy included for completeness even though no UPDATE route exists in v1.5"
  - "brandReferencePhotoSchema.photo_url is z.string() (not .url()) — DB row stores whatever URL client provided; input validation only on createBrandReferencePhotoSchema"
  - "updateStyleDescriptionSchema.style_description is z.string().max(1000).nullable() — null clears the column"
metrics:
  duration: ~5 minutes
  completed: 2026-05-16
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
requirements:
  - REF-01
---

# Phase 18 Plan 01: Data Layer + Zod Schemas Summary

**One-liner:** SQL migration creating `brand_reference_photos` table with RLS + four Zod schema exports in `shared/schema.ts` for the REF-01 data contract.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Supabase migration 20260516000000_brand_style_references.sql | b9ac5be | supabase/migrations/20260516000000_brand_style_references.sql |
| 2 | Extend shared/schema.ts with brand reference Zod schemas | b07e8e9 | shared/schema.ts |

## What Was Built

### Task 1 — Migration

`supabase/migrations/20260516000000_brand_style_references.sql` adds:

- `ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS style_description TEXT` — soft nullable field, no new RLS needed (existing brands UPDATE policy covers it)
- `CREATE TABLE IF NOT EXISTS public.brand_reference_photos` with columns: `id UUID PK`, `brand_id UUID FK→brands(id) ON DELETE CASCADE`, `user_id UUID FK→auth.users(id) ON DELETE CASCADE`, `photo_url TEXT NOT NULL`, `position INTEGER NOT NULL DEFAULT 0`, `created_at TIMESTAMPTZ NOT NULL`
- Indexes: `idx_brand_reference_photos_brand_id` (for list queries ordered by position), `idx_brand_reference_photos_user_id` (for the 10-cap count query)
- RLS enabled with 4 policies (SELECT, INSERT, UPDATE, DELETE) all scoped to `user_id = auth.uid()`

### Task 2 — Zod Schemas

`shared/schema.ts` additions:

- `brandSchema` extended with `style_description: z.string().nullable().optional()` before `created_at`
- `brandReferencePhotoSchema` + `BrandReferencePhoto` type — read model for DB rows
- `brandReferencePhotosResponseSchema` + `BrandReferencePhotosResponse` type — GET endpoint response
- `createBrandReferencePhotoSchema` + `CreateBrandReferencePhoto` type — POST body validation (photo_url uses `.url()`, position is optional)
- `updateStyleDescriptionSchema` + `UpdateStyleDescription` type — PATCH body with `.max(1000).nullable()`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- Migration file verified: all 8 required strings confirmed present via Node.js check script
- TypeScript check: `npm run check` exits 0 with no errors
- All 8 named exports confirmed present in shared/schema.ts (4 schemas + 4 types)
- `style_description` field confirmed added to `brandSchema`

## Self-Check: PASSED

- `supabase/migrations/20260516000000_brand_style_references.sql` — FOUND
- Commit `b9ac5be` — verified via git log
- Commit `b07e8e9` — verified via git log
- All 9 schema assertions — PASSED (migration OK + all exports present)
- `npm run check` — EXIT:0

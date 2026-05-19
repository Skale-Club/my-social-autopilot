---
phase: 18-data-layer-api-endpoints
plan: 02
subsystem: brand-references-api
tags: [api, brand, reference-photos, style-description, express, supabase, zod]
dependency_graph:
  requires:
    - "18-01: shared/schema.ts Zod schemas (brandReferencePhotoSchema, createBrandReferencePhotoSchema, updateStyleDescriptionSchema, brandReferencePhotosResponseSchema)"
    - "server/middleware/auth.middleware.ts: authenticateUser + AuthenticatedRequest"
    - "server/routes/posts.routes.ts: getStorageObjectPathFromPublicUrl pattern"
  provides:
    - "API-01: GET /api/brand/reference-photos"
    - "API-02: POST /api/brand/reference-photos"
    - "API-03: DELETE /api/brand/reference-photos/:id"
    - "API-04: PATCH /api/brand/style-description"
    - "server/routes/brand-references.routes.ts (new file, default export)"
  affects:
    - "server/routes/index.ts (import + router.use + named export)"
tech_stack:
  added: []
  patterns:
    - "authenticateUser(req as AuthenticatedRequest) inline at handler top"
    - "authResult.supabase throughout — no second createServerSupabase call"
    - "brand_id resolved via brands WHERE user_id = user.id before child table queries"
    - "10-photo cap via count query: select('id', { count: 'exact', head: true })"
    - "position auto-assign via .maybeSingle() (empty table safe)"
    - "DELETE order: DB row first, then storage best-effort with console.warn"
    - "getStorageObjectPathFromPublicUrl copied verbatim from posts.routes.ts"
    - "Zod safeParse for all request bodies; errors joined with ', '"
key_files:
  created:
    - server/routes/brand-references.routes.ts
  modified:
    - server/routes/index.ts
decisions:
  - "No multer or multipart parsing — POST body is JSON { photo_url: string, position?: number }"
  - "All .js extensions on imports per Node ESM + tsx requirement"
  - "No createAdminSupabase anywhere in brand-references.routes.ts — user-scoped client only"
  - "Storage delete is best-effort: logged via console.warn, not surfaced to caller"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 18 Plan 02: Brand References API Endpoints Summary

**One-liner:** Four Express endpoints for brand reference photos CRUD and style description PATCH, using inline authenticateUser pattern + Supabase user-scoped client throughout, with 10-photo cap enforcement and best-effort storage cleanup on delete.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create server/routes/brand-references.routes.ts | 7f3660a | server/routes/brand-references.routes.ts (new, 206 lines) |
| 2 | Register brandReferencesRoutes in server/routes/index.ts | fcb5755 | server/routes/index.ts (+5 lines) |

## What Was Built

### server/routes/brand-references.routes.ts

New route file with four handlers:

- **GET /api/brand/reference-photos** — resolves brand_id from user.id, returns `{ photos: [...] }` ordered by position ascending, empty array when none exist.
- **POST /api/brand/reference-photos** — validates body with `createBrandReferencePhotoSchema`, enforces 10-photo cap via count query, auto-assigns position as max+1 (or 0 for first photo), returns 201 with `BrandReferencePhoto` shape.
- **DELETE /api/brand/reference-photos/:id** — fetches photo for ownership check (clean 404 via RLS), deletes DB row, then attempts storage object removal best-effort.
- **PATCH /api/brand/style-description** — validates `{ style_description: string | null }` with max 1000 chars, updates brands table for user's brand (null clears the column).

All handlers: inline `authenticateUser(req as AuthenticatedRequest)` at top, `authResult.supabase` used throughout, no `createAdminSupabase`.

### server/routes/index.ts

Three targeted edits:
1. Import `brandReferencesRoutes` from `"./brand-references.routes.js"` (after integrationsRoutes import)
2. `router.use(brandReferencesRoutes)` inside `createApiRouter()` (after integrationsRoutes registration)
3. `brandReferencesRoutes` added to named export list

## Deviations from Plan

None — plan executed exactly as written. The Zod schemas were already present in `shared/schema.ts` (added by Plan 18-01). The route file and index registration match the blueprint verbatim.

## Verification

- `npm run check` passes with zero TypeScript errors (confirmed twice: after each task)
- Four route declarations confirmed: GET, POST, DELETE, PATCH at correct paths
- No `createAdminSupabase` in brand-references.routes.ts
- All imports end with `.js` extension
- `brandReferencesRoutes` appears at all 3 required locations in index.ts (import line 23, router.use line 83, named export line 119)

## Known Stubs

None — all four endpoints are fully wired. The `brand_reference_photos` table operations depend on the migration from Plan 18-01 being applied to Supabase; the code is complete and correct.

## Self-Check: PASSED

- server/routes/brand-references.routes.ts: FOUND
- server/routes/index.ts: modified with brandReferencesRoutes in 3 locations
- Commit 7f3660a: FOUND (feat(18-02): create brand-references.routes.ts)
- Commit fcb5755: FOUND (feat(18-02): register brandReferencesRoutes in server/routes/index.ts)

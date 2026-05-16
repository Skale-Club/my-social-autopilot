---
phase: 20-generation-integration
plan: 01
subsystem: api, ui
tags: [gemini, supabase, react, zod, typescript]

# Dependency graph
requires:
  - phase: 19-brand-reference-photos-ui
    provides: "brand_reference_photos table + /api/brand/reference-photos endpoint (GET)"
  - phase: 18-brand-reference-photos
    provides: "brand_reference_photos table schema + upload API"
provides:
  - "use_brand_references field in generateRequestSchema (Zod + TypeScript)"
  - "fetchBrandReferenceImagesAsBase64 helper at module scope in generate.routes.ts"
  - "Merge block replacing referenceImageBase64 — user images first, brand fills remaining slots up to 4"
  - "!isVideo guard preventing brand reference injection on video generation"
  - "useBrandReferences toggle in post-creator-dialog with hasBrandReferences-gated visibility"
  - "scripts/verify-phase-20.ts — 12 static assertions for GEN-01 + GEN-02"
affects:
  - 20-generation-integration
  - future carousel-injection (v1.6)
  - future enhancement-injection (v1.6)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scope async helper before Express route handler (matches logGenerationError pattern)"
    - "Best-effort fetch with silent skip per URL in fetchBrandReferenceImagesAsBase64"
    - "User-scoped Supabase client (RLS) for brand_reference_photos query — no admin client"
    - "Type split: generateText receives string[] (base64 only), generateVideo/generateImageAsset receive Array<{mimeType,data}>"
    - "TanStack Query v5 conditional query enabled: !!brand && contentType === 'image'"

key-files:
  created:
    - scripts/verify-phase-20.ts
  modified:
    - shared/schema.ts
    - server/routes/generate.routes.ts
    - client/src/components/post-creator-dialog.tsx

key-decisions:
  - "!isVideo guard in merge block — prevents brand reference injection on video generation (video_duration !== undefined defines isVideo)"
  - "use_brand_references: undefined treated as true on server (opt-out pattern, not opt-in)"
  - "User-provided inline images fill Gemini slots first; brand reference photos fill remaining slots up to 4 total"
  - "BrandReferencePhotosResponse already exported from shared/schema.ts at line 91 — no new type needed"
  - "hasBrandReferences ? useBrandReferences : undefined — sends undefined when no brand photos so server query returns 0 rows"

patterns-established:
  - "Best-effort async fetcher at module scope: try/catch per URL, continue on failure"
  - "Merge pattern: userRefImages first, brand fills slotsRemaining = 4 - userRefImages.length"
  - "Client: conditional query enabled by content type + brand availability"
  - "Reset ephemeral toggle state in close path useEffect alongside other state resets"

requirements-completed: [GEN-01, GEN-02]

# Metrics
duration: 25min
completed: 2026-05-16
---

# Phase 20 Plan 01: Generation Integration Summary

**Brand reference photos from Phase 18/19 now auto-inject into Gemini image generation via a merge block in generate.routes.ts, with a per-generation opt-out checkbox in the creator dialog gated by contentType=image and brand photo availability**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-16T00:00:00Z
- **Completed:** 2026-05-16
- **Tasks:** 4/4
- **Files modified:** 4 (shared/schema.ts, generate.routes.ts, post-creator-dialog.tsx, scripts/verify-phase-20.ts)

## Accomplishments
- Added `use_brand_references: z.boolean().optional()` to `generateRequestSchema` closing the schema loop between brand storage and generation
- Replaced single `referenceImageBase64` constant with a full merge block: user images fill Gemini slots first, brand reference photos fill remainder up to 4 total, with `!isVideo` guard preventing injection on video paths
- Added conditional "Use my style references" checkbox to the creator dialog — visible only when `contentType === "image"` AND the brand has at least one saved reference photo; checked by default; resets on dialog close
- Created `scripts/verify-phase-20.ts` with 12 static assertions covering both GEN-01 and GEN-02 requirements — all pass with `npm run check` exiting 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema — add use_brand_references to generateRequestSchema** - `37e6710` (feat)
2. **Task 2: Server — inject brand references into generate pipeline** - `ea6b4c0` (feat)
3. **Task 3: Client — add toggle + query to post-creator-dialog** - `893aae8` (feat)
4. **Task 4: Verification script + final type check** - `6a0014e` (test)

## Files Created/Modified
- `shared/schema.ts` - Added `use_brand_references: z.boolean().optional()` after `reference_images` field in `generateRequestSchema`
- `server/routes/generate.routes.ts` - Added `fetchBrandReferenceImagesAsBase64` helper, destructured `use_brand_references`, replaced `referenceImageBase64` with merge block + updated 5 downstream consumers
- `client/src/components/post-creator-dialog.tsx` - Added `BrandReferencePhotosResponse` import, `useBrandReferences` state, brand ref photos query, `hasBrandReferences` derived value, checkbox toggle JSX, payload field, and close-path reset
- `scripts/verify-phase-20.ts` - 12 static assertions for GEN-01 + GEN-02

## Decisions Made
- Used `!isVideo` guard (not `content_type === "image"`) to exclude brand refs from video generation — matches the plan requirement precisely and is computed from `video_duration !== undefined` which is already available at the merge block location
- Kept `use_brand_references: undefined` as the "opt-in" default (undefined !== false on server = inject brand refs), sending `false` only when user explicitly unchecks the toggle
- Type split maintained: `mergedReferenceImages.map(img => img.data)` for `generateText` (string[]), raw objects for `generateVideo`/`generateImageAsset`

## Deviations from Plan

None — plan executed exactly as written. All 5 edits to generate.routes.ts matched exact line numbers from RESEARCH.md. The `setUseBrandReferences` reset required additional context to uniquely identify the close path block but was otherwise as specified.

## Issues Encountered
- `setUseLogo(false)` + `setLogoPosition("bottom-right")` pattern appeared 3 times in the file, requiring extra context to uniquely target the close path reset insertion point. Resolved by including the "Close path — existing reset behavior." comment line as additional context.

## User Setup Required
None — no external service configuration required. All changes use existing Supabase tables, existing Gemini pipeline, and existing TanStack Query infrastructure.

## Next Phase Readiness
- GEN-01 and GEN-02 requirements fully satisfied — brand reference photos now flow through the entire generation pipeline
- Carousel and enhancement injection deferred to v1.6 (out of scope for Phase 20)
- Per-photo selection UI in creator dialog deferred to v1.6

---
*Phase: 20-generation-integration*
*Completed: 2026-05-16*

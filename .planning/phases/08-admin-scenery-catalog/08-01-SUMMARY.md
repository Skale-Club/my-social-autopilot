---
phase: 08-admin-scenery-catalog
plan: 01
subsystem: ui
tags: [react, admin, catalog, accordion, dialog, switch, textarea, scenery]

# Dependency graph
requires:
  - phase: 07-server-routes
    provides: PATCH /api/admin/style-catalog endpoint already accepts sceneries array
  - phase: 05-schema-database-foundation
    provides: scenerySchema + styleCatalogSchema.sceneries field in shared/schema.ts; 12 presets seeded in DB migration

provides:
  - SceneriesCard component — Accordion + Dialog CRUD for Scenery[] inside StyleCatalog admin UI
  - Barrel export of SceneriesCard from post-creation/index.ts
  - SceneriesCard rendered as full-width row at bottom of PostCreationTab grid

affects:
  - 09-frontend-creator-dialogs (reads sceneries from getStyleCatalogPayload cache)
  - 10-gallery-surface-updates

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SceneriesCard mirrors TextStylesCard accordion+dialog pattern with Scenery-specific fields
    - Empty preview URL input saves as null (not empty string) per D-05
    - No minimum-count delete guard per D-07 (unlike TextStylesCard)
    - useMemo derives working array from catalog.sceneries ?? [] — no DEFAULT_STYLE_CATALOG fallback

key-files:
  created:
    - client/src/components/admin/post-creation/sceneries-card.tsx
  modified:
    - client/src/components/admin/post-creation/index.ts
    - client/src/components/admin/post-creation-tab.tsx

key-decisions:
  - "Image icon (lucide-react Image aliased as ImageIcon) chosen for SceneriesCard header — scenery concerns backdrop imagery"
  - "catalog.sceneries ?? [] fallback (not DEFAULT_STYLE_CATALOG.sceneries) — 12 presets seeded in DB not in DEFAULT constant"
  - "No minimum-count delete guard (D-07) — enhancement service handles empty sceneries array gracefully"

patterns-established:
  - "SceneriesCard: accordion per item, dialog for add, inline edit in accordion content, setCatalog state updater — same pattern as all other catalog cards"

requirements-completed:
  - ADMN-01
  - ADMN-02
  - ADMN-03

# Metrics
duration: 2min
completed: 2026-04-28
---

# Phase 8 Plan 01: Admin Scenery Catalog Summary

**SceneriesCard admin UI component delivering full CRUD over scenery presets (accordion+dialog pattern mirroring TextStylesCard) wired into the existing PostCreationTab and PATCH /api/admin/style-catalog save path**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-28T23:14:10Z
- **Completed:** 2026-04-28T23:16:07Z
- **Tasks:** 2 of 3 automated (Task 3 is checkpoint:human-verify)
- **Files modified:** 3

## Accomplishments
- Created `SceneriesCard` (317 lines) mirroring `TextStylesCard` accordion+dialog pattern with Scenery fields: label, prompt_snippet (Textarea), preview_image_url (URL Input, empty→null), is_active (Switch)
- Barrel-exported `SceneriesCard` from `post-creation/index.ts` and rendered it as the last full-width row in `PostCreationTab` grid (below PostFormatsCard rows per D-06)
- TypeScript compiles clean (`npm run check` exits 0) with all Scenery types from `shared/schema.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SceneriesCard component** - `bb2073a` (feat)
2. **Task 2: Export SceneriesCard from barrel and wire into PostCreationTab** - `6f3db21` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `client/src/components/admin/post-creation/sceneries-card.tsx` — SceneriesCard component (317 lines): Accordion per scenery + Dialog for add, inline editing in accordion content, slugifyCatalogId ID generation, no minimum-count guard
- `client/src/components/admin/post-creation/index.ts` — Added `export * from "./sceneries-card"` as 6th barrel export
- `client/src/components/admin/post-creation-tab.tsx` — Extended import destructure to include SceneriesCard; added full-width grid row at bottom rendering `<SceneriesCard catalog={currentCatalog} setCatalog={setCatalog} />`

## Decisions Made
- **Icon choice:** `Image` from lucide-react (aliased as `ImageIcon` to avoid DOM collision) — scenery concerns backdrop imagery; `Sparkles` is taken by PostMoodsCard, `Languages` by TextStylesCard
- **DB fallback:** `catalog.sceneries ?? []` (not `DEFAULT_STYLE_CATALOG.sceneries`) — the 12 presets (white-studio, marble-light, marble-dark, wooden-table, concrete-urban, outdoor-natural, kitchen-counter, dark-premium, softbox-studio, pastel-flat, seasonal-festive, cafe-ambience) are seeded in DB via Phase 5 migration, not in the DEFAULT constant. An empty array is valid.
- **Field order in Add Dialog:** label → prompt_snippet → preview_image_url → is_active (per CONTEXT.md Claude's Discretion suggestion)
- **No minimum-count guard:** Per D-07, admins can delete all sceneries; enhancement service handles empty catalog gracefully

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — SceneriesCard reads from `catalog.sceneries` which is populated from the DB via the existing `getStyleCatalogPayload()` cache path. No hardcoded data or placeholders.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SceneriesCard fully wired: admin can CRUD scenery presets through Post Creation tab
- Edits persist via existing `AdminFloatingSaveButton` → `PATCH /api/admin/style-catalog` path
- `getStyleCatalogPayload()` returns updated sceneries unchanged (ADMN-03)
- Phase 9 (creator dialogs) can now read admin-curated sceneries from the style catalog cache

---
*Phase: 08-admin-scenery-catalog*
*Completed: 2026-04-28*

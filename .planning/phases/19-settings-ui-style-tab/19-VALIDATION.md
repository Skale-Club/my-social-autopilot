---
phase: 19
slug: settings-ui-style-tab
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-16
---

# Phase 19 — Validation Strategy

> Verification contract for the Settings UI Style Tab phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript static harness (tsx) + npm run check |
| **Config file** | scripts/verify-phase-19.ts (Wave 0 creates this) |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npx tsx scripts/verify-phase-19.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Requirement → Test Map

| Requirement | Automated Check | Wave |
|-------------|-----------------|------|
| SET-01: 4th Style tab added | `grep "value=\"style\""` in settings.tsx | Wave 0 |
| SET-01: grid-cols-4 TabsList | `grep "grid-cols-4"` in settings.tsx | Wave 0 |
| SET-02: photo grid rendered | `grep "brand-reference-photos"` in settings.tsx | Wave 0 |
| SET-02: upload handler | `grep "handleUploadPhoto"` in settings.tsx | Wave 0 |
| SET-02: delete handler | `grep "handleDeletePhoto"` in settings.tsx | Wave 0 |
| SET-02: drag-drop | `grep "onDrop\|onDragOver"` in settings.tsx | Wave 0 |
| SET-03: style description textarea | `grep "styleDescription"` in settings.tsx | Wave 0 |
| SET-03: character counter | `grep "1000"` in settings.tsx | Wave 0 |
| SET-03: save handler | `grep "handleSaveStyleDescription"` in settings.tsx | Wave 0 |

## Wave 0 Gaps

- `scripts/verify-phase-19.ts` does not exist yet — created in Task 4

## Notes

- Human verification needed after Phase 19: open Settings in browser, verify Style tab appears, test upload, delete, and description save flows.

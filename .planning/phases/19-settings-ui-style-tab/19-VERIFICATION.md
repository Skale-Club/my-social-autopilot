---
phase: 19-settings-ui-style-tab
verified: 2026-05-16T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Upload a reference photo — drag a JPEG onto an empty slot"
    expected: "Photo appears as thumbnail in the grid immediately (no page reload)"
    why_human: "Requires browser interaction with Supabase Storage and live API; static analysis cannot confirm binary upload succeeds"
  - test: "Delete a reference photo — hover thumbnail, click X button"
    expected: "X button appears on hover; thumbnail disappears immediately from grid without reload"
    why_human: "Hover CSS and DOM removal require browser rendering; cannot be confirmed statically"
  - test: "Drag an image file onto an empty grid slot"
    expected: "Slot highlights on drag-over; dropping the file triggers upload and shows the thumbnail"
    why_human: "drag-and-drop browser event dispatch requires a real browser; cannot be automated without a test runner"
  - test: "Enter text in Style Description textarea, click Save Style, then reload the page"
    expected: "Saved text reappears in the textarea after reload, confirming DB persistence"
    why_human: "Database round-trip and session reload require a live environment"
---

# Phase 19: Settings UI — Style Tab Verification Report

**Phase Goal:** Users can open Settings, navigate to the new "Style" tab, see their existing reference photos in a grid, upload new ones with drag & drop or a file picker, delete photos with an X button on hover, and save or clear their style description — with all changes immediately reflected in the UI via cache invalidation.

**Verified:** 2026-05-16T00:00:00Z
**Status:** human_needed (all automated checks passed; 4 browser-only behaviors queued for human UAT)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Settings page shows four tabs (Info, Colors, Logo, Style); Style tab is brand-guarded | VERIFIED | `grid-cols-4` TabsList at line 340; four TabsTrigger entries lines 341-356; Style TabsContent `{brand ? ... : "No brand configured"}` at lines 696-796 |
| 2 | Style tab displays photos as thumbnails in grid; X on hover deletes without reload | VERIFIED | `photos.map(...)` renders `<img>` with `group` + `opacity-0 group-hover:opacity-100` X button (lines 709-726); `handleDeletePhoto` calls DELETE then `queryClient.invalidateQueries` (lines 311-314) |
| 3 | Empty slot opens `image/*` file picker; drag-drop works; 5MB / 10-photo limits show error | VERIFIED | `<input accept="image/*">` in empty slot labels (line 742); `onDrop` wired at line 731; 5MB guard at lines 285-288; 10-photo guard at lines 289-292 — both show toasts |
| 4 | Textarea shows saved value, 1000-char limit + counter, Save persists with toast, null on clear | VERIFIED | `useState(brand?.style_description ?? "")` at line 64; `useEffect` sync at line 98; `<Textarea maxLength={1000}>` line 763; counter `{styleDescription.length}/1000` line 772; PATCH + `refreshBrand()` + toast in `handleSaveStyleDescription` lines 316-323; `styleDescription.trim() || null` sends null on clear |

**Score:** 4/4 truths verified (automated static evidence)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/pages/settings.tsx` | Modified with Style tab | VERIFIED | File exists, 826 lines, all handlers and JSX present; 4 task commits (63c97ad, 50afe4e, 618b32c, 229d074) confirmed in git log |
| `server/routes/brand-references.routes.ts` | Phase 18 API contract (GET, POST, DELETE, PATCH) | VERIFIED | All four endpoints implemented with real DB queries; registered in `server/routes/index.ts` lines 23+83 |
| `shared/schema.ts` | `BrandReferencePhotosResponse` type + `style_description` in `Brand` | VERIFIED | `BrandReferencePhotosResponse` at line 91; `style_description: z.string().nullable().optional()` in `brandSchema` at line 73 |
| `scripts/verify-phase-19.ts` | Static verification harness | VERIFIED | File exists; 28 assertions covering SET-01 (4), SET-02 (12), SET-03 (8), imports (4) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `settings.tsx` useQuery | `GET /api/brand/reference-photos` | `queryKey: ["/api/brand/reference-photos"]`, `getQueryFn` default | WIRED | Line 71-74; enabled only when `!!brand` |
| `handleUploadPhoto` | `POST /api/brand/reference-photos` | `apiRequest("POST", ...)` | WIRED | Line 306; also directly uploads to Supabase Storage at `user_assets/${user.id}/references/${uuid}.${ext}` |
| `handleDeletePhoto` | `DELETE /api/brand/reference-photos/:id` | `apiRequest("DELETE", ...)` | WIRED | Line 312 |
| `handleSaveStyleDescription` | `PATCH /api/brand/style-description` | `apiRequest("PATCH", ...)` | WIRED | Line 318 |
| `handleSaveStyleDescription` | `brand.style_description` in auth context | `refreshBrand()` | WIRED | Line 320; `refreshBrand` in auth.tsx line 201-205 does `brands.select("*")` pulling `style_description` |
| Upload / Delete handlers | UI grid | `queryClient.invalidateQueries({ queryKey: ["/api/brand/reference-photos"] })` | WIRED | Lines 307, 313 — cache bust triggers useQuery refetch, grid updates without reload |
| Brand Zod type | `style_description` from Supabase | `brands.select("*")` in auth.tsx line 109 | WIRED | Wildcard select returns all columns including `style_description`; `brandSchema` at line 73 types it correctly |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| Photo grid (`photos.map(...)`) | `photos` ← `refPhotos?.photos ?? []` | `useQuery` → `GET /api/brand/reference-photos` → `supabase.from("brand_reference_photos").select(...).order("position")` (route line 52-58) | Yes — real DB query with ordering | FLOWING |
| Style description textarea | `styleDescription` ← `brand?.style_description ?? ""` | `useAuth()` → `refreshBrand()` → `brands.select("*")` (auth.tsx line 204) | Yes — wildcard DB select | FLOWING |
| Upload handler | Supabase Storage public URL | `sb.storage.from("user_assets").upload(...)` then `getPublicUrl(...)` then `POST /api/brand/reference-photos` | Yes — real storage write + DB insert | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for browser-side rendering behaviors (tab switching, drag-drop, hover CSS). The server-side API endpoints (Phase 18) were verified in Phase 18's verification. No standalone runnable CLI entry point for this frontend-only phase.

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SET-01 | New "Style" 4th tab in settings.tsx — grid-cols-4, ImagePlus icon | SATISFIED | `grid-cols-4` at line 340; `ImagePlus` imported (line 14) and used in TabsTrigger (line 354) |
| SET-02 | Reference photo grid — 10 slots, drag & drop, file picker, X-to-delete on hover | SATISFIED | 10-slot grid (filled + up to `10 - photos.length` empty slots, lines 709-749); drag handlers; file input; X button with group-hover pattern |
| SET-03 | Style description textarea — 1000 char limit with counter, save button, toast | SATISFIED | `maxLength={1000}` (line 763); `{styleDescription.length}/1000` counter (line 772); Save button (line 773); toast in handler (line 322); null-on-clear (line 319) |

No orphaned requirements — all three requirements declared in CONTEXT.md are covered by the single plan 19-01.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

All `placeholder` occurrences in settings.tsx are legitimate HTML input hint text (lines 376, 387, 457, 468, 546, 767). No TODO/FIXME/stub patterns detected. No `return null` / `return []` / hardcoded-empty-prop patterns in the Style tab section. The `photos` array is initialized as `refPhotos?.photos ?? []` which is a proper empty-until-loaded default, not a stub — the useQuery populates it from a real DB query.

---

### Human Verification Required

#### 1. Reference Photo Upload (File Picker)

**Test:** Open Settings > Style tab. Click an empty slot (the "+" area). Select a JPEG or PNG from disk.
**Expected:** File uploads to Supabase Storage; photo appears as thumbnail in the grid immediately; no page reload occurs.
**Why human:** Binary file upload to Supabase Storage and live API call cannot be confirmed by static analysis.

#### 2. Reference Photo Delete (X on Hover)

**Test:** Hover over an existing thumbnail in the photo grid. Click the X button that appears.
**Expected:** X button becomes visible on hover; clicking it removes the photo from the grid immediately; DB row and Storage file are deleted.
**Why human:** Hover CSS (opacity-0 → opacity-100) and DOM mutation require browser rendering.

#### 3. Drag-and-Drop Upload

**Test:** Drag an image file from the OS file manager and drop it onto an empty slot in the photo grid.
**Expected:** The slot highlights (border-primary + bg-primary/5) during drag-over; dropping triggers upload and thumbnail appears.
**Why human:** Browser drag-and-drop event dispatch requires a live browser; cannot be automated without a test runner (Playwright/Cypress).

#### 4. Style Description Persistence Across Sessions

**Test:** Enter text in the "Visual Style" textarea. Click "Save Style". Reload the page (F5).
**Expected:** The saved text reappears in the textarea after reload, confirming the PATCH wrote to the DB and `refreshBrand()` + `brand.style_description` flows back correctly.
**Why human:** Full round-trip (PATCH → DB write → session reload → brand re-fetch) requires a live environment with a connected Supabase instance.

---

### Gaps Summary

No gaps found. All four success criteria are verified at the code level:

1. The four-tab structure is in place with correct brand guard on the Style tab.
2. The photo grid renders real DB data, X-delete is wired to the DELETE endpoint with immediate cache invalidation.
3. File picker is `image/*`-restricted, drag-drop handlers are present, and both limit guards (5MB, 10 photos) are wired to error toasts.
4. Style description is initialized from `brand.style_description`, the 1000-char limit and live counter are rendered, Save calls PATCH and refreshes the auth context, and empty-field save sends `null`.

Four browser-only behaviors are routed to human UAT (actual file upload, hover CSS, drag-drop, reload persistence). These are inherently unverifiable by static analysis but the code paths that support them are fully wired.

---

_Verified: 2026-05-16T00:00:00Z_
_Verifier: Claude (gsd-verifier)_

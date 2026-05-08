# Milestones

## v1.1 Media Creation Expansion (Shipped: 2026-05-08)

**Phases completed:** 9 phases, 26 plans, 46 tasks

**Key accomplishments:**

- SceneriesCard admin UI delivers full CRUD over scenery presets via responsive card grid with thumbnail upload to Supabase Storage, AlertDialog delete confirmation, and inline is_active toggle — wired into PostCreationTab through the existing PATCH /api/admin/style-catalog save path
- en dictionary stays empty:
- Enhancement branch fully wired: JPEG/PNG/WEBP upload with 5MB guard, base64 FileReader encoding, responsive scenery picker grid from activeSceneries, UUID idempotency_key POST to /api/enhance via fetchSSE, and openViewer handoff on SSE complete (D-20)
- Auto-save creator dialog state to localStorage with 500ms debounce, 7-day TTL, and Continue/Start fresh banner restore UI for all content types (image, video, carousel, enhancement)
- postGalleryItemSchema extended with slide_count (number | null) and status (string, default "generated") so downstream gallery tiles can render carousel count badges and draft status indicators
- Gallery tiles now distinguish carousel (deck-stack + Carousel·N badge), enhancement (violet Enhanced badge), and draft carousels (orange Draft badge) with a TypeScript exhaustiveness guard ensuring future content_type values force a compile error
- Carousel slide viewer with post_slides fetch + prev/next + ArrowLeft/ArrowRight keyboard nav added to PostViewerDialog; markCreated() now fires on carousel SSE error path so partial-draft carousels appear in gallery without page reload
- Third cron job added to startCronJobs() invoking runOverageBillingBatch() on a cadence-derived expression (1d/7d/30d → daily/weekly/monthly cron) with in-process boolean lock preventing overlapping invocations

---

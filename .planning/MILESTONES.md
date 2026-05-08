# Milestones

## v1.2 Production Hardening (Shipped: 2026-05-08)

**Phases completed:** 3 phases, 5 plans, 15 tasks
**Git range:** v1.1..HEAD (~30 commits)

**Key accomplishments:**

- Per-user HTTP 429 rate limiting on 5 paid AI endpoints via `express-rate-limit` + per-user keying + admin bypass, plus SSE `safetyTimer` cleanup migrated into `finally` blocks across all 4 SSE routes (Phase 13: HARD-01, HARD-02)
- App-root React Error Boundary class component with Retry / Go home recovery UI and PT/ES translations, plus removal of 5 dead session/auth deps (`passport`, `passport-local`, `express-session`, `connect-pg-simple`, `memorystore`) + 4 `@types/*` and relocation of `@octokit/rest` to `devDependencies` (Phase 13: HARD-03, HARD-04)
- HTTP-triggered cron architecture wired for Vercel: new `requireCronSecret` middleware (`crypto.timingSafeEqual` + 401/503 split) protecting 3 internal POST endpoints (`/api/internal/cleanup/{trash,purge}` + `/api/internal/billing/run-overage-batch`); legacy `runAdminGuard` handler moved from `billing.routes.ts:649` with auth swap (Phase 14: CRON-01, CRON-02)
- `.github/workflows/cron.yml` GitHub Actions schedule firing cleanup-sweep every 6h + overage-batch weekly Sunday 00:00 UTC; `node-cron` infrastructure preserved untouched so future Hetzner migration is a config flip (Phase 14: CRON-03, CRON-04)
- Runtime verification harness `scripts/verify-cron-jobs.ts` (762 LOC) exercising trash sweep, purge sweep, and overage batch (Mode A always; Mode B Stripe `sk_test_*` gated) against an isolated test user — live run exits 0 with 3 passed / 0 failed / 1 skipped; closes VRFY-01 (Phase 15)
- Cron triggers ACTIVATED in production — `CRON_SECRET` set in Vercel + GitHub Actions secrets (`PROD_BASE_URL` + `CRON_SECRET`) configured via `vercel env add` + `gh secret set`; smoke-tested via `curl` (401/401/200/200 expected pattern; trash + purge endpoints respond in <1.3s)
- Architecture documentation: new `docs/production-cron.md` runbook, `Deployment & Cron` section in CLAUDE.md, "Scheduled Operations" section in `.planning/codebase/ARCHITECTURE.md`, cron concern marked RESOLVED in CONCERNS.md, `cleanup-cron.service.ts` header explaining dual-trigger model

---

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

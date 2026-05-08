# Roadmap: My Social Autopilot

## Milestones

- ✅ **v1.0 Bug Fixes & System Hardening** — Phases 1-4 (shipped 2026-04-20)
- ✅ **v1.1 Media Creation Expansion** — Phases 5-12 (shipped 2026-05-08) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 Production Hardening** — Phases 13-14 (in progress) — see [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

## Shipped

<details>
<summary>✅ v1.1 Media Creation Expansion (Phases 5-12) — SHIPPED 2026-05-08</summary>

- [x] Phase 5: Schema & Database Foundation (3/3 plans) — completed 2026-04-21
- [x] Phase 6: Server Services (3/3 plans) — completed 2026-04-21
- [x] Phase 7: Server Routes (3/3 plans) — completed 2026-04-22
- [x] Phase 8: Admin — Scenery Catalog (1/1 plan) — completed 2026-04-28
- [x] Phase 9: Frontend Creator — Carousel & Enhancement Branches (4/4 plans) — completed 2026-04-29
- [x] Phase 09.1: Creator dialog UX gap closure (3/3 plans) — completed 2026-04-29
- [x] Phase 10: Gallery Surface Updates (4/4 plans) — completed 2026-04-30
- [x] Phase 11: Post Trash & Automated Cleanup (4/4 plans) — completed 2026-05-07
- [x] Phase 12: Schedule billing overage batch via cleanup-cron (1/1 plan) — completed 2026-05-08

**Totals:** 9 phases, 26 plans, 46 tasks — full details in [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

## 🚧 v1.2 Production Hardening (In Progress)

**Milestone Goal:** Close the highest-risk gaps in production accumulated through v1.0 + v1.1 — security (rate limiting), reliability (SSE timer leak, React Error Boundary), verification of destructive cron operations, and dependency hygiene.

**Phases:**

- [ ] **Phase 13: Production Hardening Fixes** — Rate limit AI endpoints, fix SSE timer leak, add React Error Boundary, prune dead deps
- [ ] **Phase 14: Cron Verification Harness** — Automated harness asserting trash sweep, purge sweep, and overage batch behave correctly against seeded data

### Phase 13: Production Hardening Fixes
**Goal**: Close four independent production-code gaps — abuse protection on paid AI endpoints, deterministic SSE timer cleanup, app-wide render-error recovery, and removal of unused security-surface packages.
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04
**Success Criteria** (what must be TRUE):
  1. An authenticated user exceeding the configured per-user rate limit on any of `/api/generate`, `/api/edit-post`, `/api/transcribe`, `/api/carousel/generate`, `/api/enhance` receives HTTP 429 with `Retry-After`, and Gemini is not billed for rejected requests.
  2. Forcing `sse.sendError` to throw during a generation no longer leaks the SSE safety timer — `safetyTimer` is cleared on every termination path.
  3. A render error in any descendant of `<App>` shows a user-facing recovery UI ("Something went wrong" + Retry) and logs the error with stack and component info; the SPA does not go blank.
  4. `package.json` no longer lists `passport`, `passport-local`, `@types/passport`, `@types/passport-local`, `express-session`, `connect-pg-simple`, or `memorystore`; `@octokit/rest` lives under `devDependencies`; `npm install && npm run check && npm run build` all succeed.
**Plans**: TBD
**UI hint**: yes

### Phase 14: Cron Verification Harness
**Goal**: Provide an automated, repeatable harness that exercises the three destructive scheduled jobs shipped in Phase 11 and Phase 12 against seeded test data and asserts their observable side effects.
**Depends on**: Phase 13
**Requirements**: VRFY-01
**Success Criteria** (what must be TRUE):
  1. Running `scripts/verify-cron-jobs.ts` (or equivalent) seeds three controlled scenarios — past-due posts awaiting trash, posts past `TRASH_RETENTION_DAYS` awaiting purge with their image/thumbnail/slides/enhancement-source storage objects, and `user_billing_profiles` with `pending_overage_micros > 0` — without contaminating real user data.
  2. After invoking `runTrashSweep()`, seeded past-due posts have `trashed_at` set and remain in the database.
  3. After invoking `runPurgeSweep()`, seeded over-retention posts have DB rows removed AND every associated storage object is gone — no orphans left in the bucket.
  4. After invoking `runOverageBillingBatch()`, the expected ledger entries are created for seeded profiles with pending overage and `pending_overage_micros` is reset on success.
  5. The script exits 0 only when all three sweeps produce the expected observable side effects; any deviation produces a non-zero exit and an itemized failure report.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 13 → 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 5–12. (v1.1 phases) | v1.1 | 26/26 | Complete | 2026-05-08 |
| 13. Production Hardening Fixes | v1.2 | 0/TBD | Not started | - |
| 14. Cron Verification Harness | v1.2 | 0/TBD | Not started | - |

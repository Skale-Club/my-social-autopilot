---
phase: 3
slug: data-integrity-business-logic
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
---

# Phase 3 - Validation Strategy

> Per-phase validation contract for the surgical data-integrity and business-logic fixes in Phase 3.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None - no automated route/unit test runner exists in the repo |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` plus the route-specific manual checks below
- **Before `/gsd:verify-work`:** TypeScript must compile clean and all manual verifications below must be completed
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Verification | Status |
|---------|------|------|-------------|-----------|-------------------|---------------------|--------|
| 3-01-01 | 01 | 1 | DATA-01 | ts-compile + route smoke | `npm run check` | Edit one portrait-origin video post and one landscape-origin video post through `POST /api/posts/edit`; confirm the regenerated video keeps the original `9:16` or `16:9` ratio instead of always falling back to portrait | [ ] pending |
| 3-01-02 | 01 | 1 | DATA-05 | ts-compile + route smoke | `npm run check` | Call `POST /api/posts/edit` as an admin or affiliate without `profiles.api_key` and confirm one consistent 400 message is returned, then retry with a configured key and confirm the edit route proceeds past Gemini key selection | [ ] pending |
| 3-02-01 | 02 | 1 | DATA-02 | ts-compile + cleanup smoke | `npm run check` | Seed an expired post with at least one version thumbnail, call `POST /api/admin/posts/cleanup-expired`, and confirm the response deletes the expired post plus both version `image_url` and `thumbnail_url` storage objects from `user_assets` | [ ] pending |
| 3-02-02 | 02 | 1 | DATA-02 | ts-compile + cleanup smoke | `npm run check` | Inspect the same expired-cleanup run in Supabase Storage and verify no `thumbnails/versions/*` object for the deleted post remains after the route finishes | [ ] pending |
| 3-03-01 | 03 | 1 | DATA-03 | ts-compile + admin route smoke | `npm run check` | In a dataset above 1000 rows, call `GET /api/admin/stats` and confirm totals still reflect the larger dataset while the JSON shape consumed by the admin dashboard remains unchanged | [ ] pending |
| 3-03-02 | 03 | 1 | DATA-03 | ts-compile + admin route smoke | `npm run check` | In the same dataset, call `GET /api/admin/users` and confirm the endpoint still returns the existing `{ users: [...] }` payload shape while joined data is no longer silently capped by Supabase's default 1000-row behavior | [ ] pending |

*Status: [ ] pending | [x] green | [!] red | [~] flaky*

---

## Wave 0 Requirements

None - Phase 3 uses the existing TypeScript gate plus concrete manual verification against the real edit, cleanup, and admin endpoints.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Video edit preserves the original aspect ratio | DATA-01 | No route test harness and ratio behavior depends on persisted post data | Use two existing video posts whose `ai_prompt_used` blobs encode different ratios, call `POST /api/posts/edit`, and confirm portrait stays `9:16` while landscape stays `16:9` |
| Edit route uses one Gemini key decision path and one missing-key message | DATA-05 | No unit test harness and behavior is route-level | Remove `profiles.api_key` for an admin or affiliate account, call `POST /api/posts/edit`, confirm one consistent 400 message, then restore the key and verify the route continues |
| Expired cleanup removes version thumbnails as well as primary media | DATA-02 | Requires live storage and seeded expired records | Seed an expired post with `post_versions.image_url` and `post_versions.thumbnail_url`, call `POST /api/admin/posts/cleanup-expired`, then verify both files disappear from `user_assets` |
| Admin stats and users survive past 1000 rows without shape changes | DATA-03 | Requires realistic row counts and live admin auth | Seed or use a project with more than 1000 rows, call `GET /api/admin/stats` and `GET /api/admin/users`, then compare totals and payload structure with what `dashboard-tab.tsx` and `users-tab.tsx` already expect |

---

## Validation Sign-Off

- [x] All planned tasks include `<automated>` verification via `npm run check`
- [x] Manual verification is specific to real routes in this codebase
- [ ] TypeScript compiles clean after each task
- [ ] Manual route checks completed during execution
- [x] No schema migration or extra test framework required for this phase

**Approval:** pending

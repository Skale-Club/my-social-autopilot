---
phase: 2
slug: supabase-client-correctness
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
---

# Phase 2 - Validation Strategy

> Per-phase validation contract for Supabase client correctness and honest failure reporting.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None - no automated test runner exists in the repo |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` plus route-specific smoke verification
- **Before `/gsd:verify-work`:** TypeScript must compile clean and all four manual verifications below must be completed
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Verification | Status |
|---------|------|------|-------------|-----------|-------------------|---------------------|--------|
| 2-01-01 | 01 | 1 | SBC-01, SBC-02 | ts-compile + route smoke | `npm run check` | Delete a non-original version through `DELETE /api/posts/:id/versions/:versionNumber` and confirm both the `post_versions` row and the `user_assets` objects are removed without an RLS/storage permission failure | [ ] pending |
| 2-01-02 | 01 | 1 | QUOT-01 | ts-compile + function smoke | `npm run check` | Run a one-off `node --import tsx` script that calls `incrementQuickRemakeCount(userId)` for a non-special user and confirm `user_credits.quick_remake_count` increments by 1 with no `sb.raw` runtime error; do not rewrite the function unless the smoke fails | [ ] pending |
| 2-02-01 | 02 | 1 | SBC-03 | ts-compile + route smoke | `npm run check` | Edit an image post through `POST /api/posts/edit` (same flow used by the app) and confirm the edited image and version thumbnail upload successfully to `user_assets` using the admin-storage path while the new `post_versions` insert still succeeds | [ ] pending |
| 2-02-02 | 02 | 1 | DATA-04 | ts-compile + route smoke | `npm run check` | Trigger `POST /api/admin/migrate-colors` in an environment where `rpc("exec")` fails or is absent and confirm the response is non-success and the server logs the RPC error instead of returning `success: true` | [ ] pending |

*Status: [ ] pending | [x] green | [!] red | [~] flaky*

---

## Wave 0 Requirements

None - Phase 2 uses the existing TypeScript gate plus manual route/function verification only.

`QUOT-01` is already satisfied in the current tree and remains in this phase as a validation/documentation requirement, not a planned re-implementation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Version delete uses admin DB delete and admin storage cleanup | SBC-01, SBC-02 | No route test harness exists | Seed a post with version 1+, call `DELETE /api/posts/:id/versions/:versionNumber`, then verify the version row is gone and the referenced files are removed from `user_assets` without an RLS/storage error |
| Quick remake counter still uses valid Supabase update syntax | QUOT-01 | No unit test framework and requirement is already code-complete | Run `incrementQuickRemakeCount(userId)` from `node --import tsx`, then inspect `user_credits.quick_remake_count` before/after and confirm no runtime error is thrown |
| Edit image upload uses admin storage while version insert stays user-scoped | SBC-03 | No route test harness exists | Run an image edit against an owned post, then verify the new image URL and thumbnail URL resolve and a new `post_versions` row exists for the same post |
| Admin color migration reports RPC failure honestly | DATA-04 | Requires a live Supabase environment or intentionally missing `exec` RPC | Call `POST /api/admin/migrate-colors` as an admin in a project where `exec` is unavailable or returns an error; expect non-200/non-success response plus a logged RPC error |

---

## Validation Sign-Off

- [x] All planned tasks include `<automated>` verification via `npm run check`
- [x] Manual verification is specific to real routes/functions in this codebase
- [ ] TypeScript compiles clean after each task
- [ ] Manual route/function checks completed during execution
- [ ] No extra test framework required for this phase

**Approval:** pending

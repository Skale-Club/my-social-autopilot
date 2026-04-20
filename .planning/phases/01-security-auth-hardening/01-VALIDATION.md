---
phase: 1
slug: security-auth-hardening
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework exists in project |
| **Config file** | none |
| **Quick run command** | `npm run check` (TypeScript compilation) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` + manual curl smoke tests
- **Before `/gsd:verify-work`:** TypeScript must compile clean + all manual verifications complete
- **Max feedback latency:** ~5 seconds (TS check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Verification | Status |
|---------|------|------|-------------|-----------|-------------------|---------------------|--------|
| 1-01-01 | 01 | 1 | SEC-01 | ts-compile | `npm run check` | malformed Bearer headers return 401 on both `/api/generate` and `/api/admin/stats` | ⬜ pending |
| 1-01-02 | 01 | 1 | SEC-02 | ts-compile | `npm run check` | one-off `requireAdmin()` invocation populates `req.profile` for a valid admin token and returns 403 for non-admin | ⬜ pending |
| 1-02-01 | 02 | 1 | SEC-03 | ts-compile | `npm run check` | `POST /api/stripe/webhook` with JSON body + test Stripe signature returns the raw-body 400 before Stripe SDK verification | ⬜ pending |
| 1-02-02 | 02 | 1 | QUOT-02 | ts-compile | `npm run check` | seeded inactive-subscription `checkCredits()` call returns `denial_reason: "inactive_subscription"` | ⬜ pending |
| 1-02-03 | 02 | 1 | QUOT-03 | ts-compile | `npm run check` | `GET /api/settings` returns canonical payload with `favicon_url` merged from `landing_content.icon_url`; `/api/config` still works | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no test framework to install. All verification is TypeScript compilation + manual curl.

*Existing infrastructure (npm run check) covers compilation gating for all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Malformed Bearer token → 401 on both auth paths | SEC-01 | No test framework | `curl -i -H "Authorization: BearerTOKEN" http://localhost:8888/api/generate` and `curl -i -H "Authorization: BearerTOKEN" http://localhost:8888/api/admin/stats` → both expect 401 |
| `req.profile` attached by `requireAdmin()` | SEC-02 | No test framework | Run a one-off `node --import tsx` script that invokes `requireAdmin()` with mocked `req/res/next` and a valid admin Bearer token → expect `req.profile.is_admin === true`; repeat with non-admin token → expect 403 |
| Non-Buffer rawBody rejected | SEC-03 | No test framework | `curl -i -X POST http://localhost:8888/api/stripe/webhook -H "Content-Type: application/json" -H "Stripe-Signature: test" -d '{"id":"evt_test"}'` → expect 400 with raw-body error, not Stripe signature error |
| Inactive subscription denial reason | QUOT-02 | No test framework | With a seeded inactive `subscription_overage` user, run `checkCredits(userId, "generate")` from a one-off `node --import tsx` script → expect `denial_reason: "inactive_subscription"` |
| GET /api/settings includes landing icon merge | QUOT-03 | No test framework | `curl http://localhost:8888/api/settings` → response has `favicon_url`; `curl http://localhost:8888/api/config` still returns Supabase config |

---

## Validation Sign-Off

- [x] All planned tasks have `<automated>` verify (`npm run check`) plus manual verification steps
- [ ] TypeScript compiles clean after each task
- [ ] Manual verifications documented per task in plan
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter when above complete

**Approval:** pending

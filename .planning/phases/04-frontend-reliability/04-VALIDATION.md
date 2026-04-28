---
phase: 4
slug: frontend-reliability
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
---

# Phase 4 - Validation Strategy

> Per-phase validation contract for the surgical frontend routing, auth, and cache fixes in Phase 4.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None - no frontend integration or unit test harness detected in the repo |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After the wave completes:** Run `npm run check` plus the browser and network checks below
- **Before `/gsd:verify-work`:** TypeScript must compile clean and all manual verifications below must be completed
- **Max feedback latency:** ~5 seconds for the automated gate, then one focused browser pass for the affected routes

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Verification | Status |
|---------|------|------|-------------|-----------|-------------------|---------------------|--------|
| 4-01-01 | 01 | 1 | FE-01 | ts-compile + admin-route smoke | `npm run check` | Sign in as an admin, hard-load `/admin/dashboard` and `/admin/users`, then exit admin mode and revisit those URLs directly; confirm the admin shell renders without redirecting to `/dashboard` and the sidebar/header stay in admin mode | [ ] pending |
| 4-01-02 | 01 | 1 | FE-07 | ts-compile + auth-shell smoke | `npm run check` | Simulate or observe a session where `brand` exists but `profile` is still null or delayed, then confirm `client/src/App.tsx` shows a blocking fallback instead of reading `profile.is_admin`, redirecting incorrectly, or crashing | [ ] pending |
| 4-02-01 | 02 | 1 | FE-02 | ts-compile + signup network smoke | `npm run check` | Create a brand-new account and watch the browser network tab for `/api/telegram/notify-signup`; confirm one request on initial profile creation, then refresh and sign in again to confirm no repeat call | [ ] pending |
| 4-02-02 | 02 | 1 | FE-05 | ts-compile + auth-error smoke | `npm run check` | Force `fetchUserData()` down an error path (for example by temporarily breaking a profile or brand read in dev tools/network conditions) and confirm the loading screen resolves instead of spinning forever | [ ] pending |
| 4-02-03 | 02 | 1 | FE-06 | ts-compile + tolerant-refresh smoke | `npm run check` | Exercise `refreshProfile()` from a flow that can race profile creation, and confirm a missing profile row no longer throws a 406-driven crash path | [ ] pending |
| 4-03-01 | 03 | 1 | FE-03 | ts-compile + auth-init failure smoke | `npm run check` | Force `supabase()` or `auth.getSession()` initialization to fail before a protected fetch, then confirm the caller receives a surfaced error instead of proceeding with empty headers and a misleading silent fallback | [ ] pending |
| 4-03-02 | 03 | 1 | FE-04 | ts-compile + network URL smoke | `npm run check` | Visit pages that rely on the shared query fetcher and confirm no request URL contains `/[object Object]`, `/undefined`, or joined query-key fragments; parameterized admin queries with explicit `queryFn`s should keep working unchanged | [ ] pending |
| 4-03-03 | 03 | 1 | FE-08 | ts-compile + billing freshness smoke | `npm run check` | Visit `/billing`, change spending controls, and confirm the overview/account data refreshes immediately; then return to `/billing` after a Stripe redirect or equivalent revisit and confirm `/api/billing/me`, `/api/billing/overview`, `/api/billing/resource-usage`, and `/api/billing/ledger` refetch on mount instead of showing indefinitely cached balances | [ ] pending |

*Status: [ ] pending | [x] green | [!] red | [~] flaky*

---

## Wave 0 Requirements

None - Phase 4 uses the existing TypeScript gate plus focused manual browser and network verification tied to real routes and shared helpers in this repo.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin direct navigation stays in the admin shell | FE-01 | No route-level frontend test harness and the bug depends on client routing plus persisted admin mode | Sign in as an admin, directly load `/admin/dashboard` and `/admin/users`, verify the admin shell renders, then exit admin mode and revisit the same URLs to confirm the route resynchronizes admin mode instead of redirecting to `/dashboard` |
| New-account Telegram notification fires exactly once | FE-02 | Requires a real signup event and browser network inspection | Create one new account, confirm one `/api/telegram/notify-signup` request, then refresh and log in again to confirm no second request appears |
| Auth initialization and loading failures surface correctly | FE-03, FE-05, FE-06, FE-07 | These bugs are tied to bootstrap timing, missing rows, and error branches that are not covered by existing tests | Force auth bootstrap/profile-read failure states in dev and verify the app shows a finite fallback, `refreshProfile()` tolerates a missing row, and protected fetches surface initialization errors rather than silently continuing |
| Shared queries never generate malformed URLs | FE-04 | Requires inspecting actual browser requests from the shared TanStack fetcher | Navigate through pages that use default `getQueryFn`, inspect network requests, and verify URLs stay anchored to the first query-key segment while explicit page-level `queryFn`s keep handling dynamic params |
| Billing data does not stay indefinitely stale | FE-08 | Requires browser navigation and post-mutation cache behavior across revisits | On `/billing`, save spending controls and confirm same-tab data refreshes; then revisit `/billing` after a checkout or portal redirect and verify the billing queries refetch on mount instead of reusing forever-fresh cached values |

---

## Validation Sign-Off

- [x] All planned tasks include `<automated>` verification via `npm run check`
- [x] Manual verification is specific to real files, routes, and browser behaviors in this codebase
- [ ] TypeScript compiles clean after each task
- [ ] Manual browser and network checks completed during execution
- [x] No new test framework or global cache refactor is required for this phase

**Approval:** pending

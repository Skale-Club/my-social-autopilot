# Phase 4: Frontend Reliability - Research

**Researched:** 2026-04-20
**Domain:** Client routing, auth lifecycle, TanStack Query request behavior, and billing-data freshness
**Confidence:** HIGH

## User Constraints

- Research only; do not implement code changes.
- Favor surgical fixes over refactors.
- Verification strategy should fit this repo's current reality: `npm run check` plus realistic manual verification.

## Project Constraints (from AGENTS.md)

- Keep the existing stack: React 18, `wouter`, TanStack Query v5, Supabase, TypeScript.
- Keep auth tokens in `Authorization: Bearer <token>` headers.
- Use existing client-side auth state in `client/src/lib/auth.tsx`; do not redesign auth architecture for this phase.
- Use the current routing shell in `client/src/App.tsx`; Phase 4 is a bug-fix phase, not a navigation rewrite.
- Use Zod-backed shared schemas already present in `@shared/schema` where API types are involved.
- Do not commit secrets or `.env` files.
- Validate with `npm run check` before committing.

## Summary

Phase 4 is concentrated in three client hotspots already identified by the audit: `client/src/App.tsx`, `client/src/lib/auth.tsx`, and `client/src/lib/queryClient.ts`. The billing freshness requirement also lands in one page-specific consumer, `client/src/pages/credits.tsx`. The repo already shows the intended patterns nearby: page-local `queryFn` overrides for parameterized admin queries, `maybeSingle()` for tolerant profile reads, and per-query freshness overrides where truly live data is needed.

The safest plan is to keep the current app shell and repair the exact branches that mis-handle state. Admin access should be route-synchronized instead of depending only on a sticky client toggle. Signup notification should stay inside the profile-creation path only. Auth header initialization errors should bubble so callers can surface them. The default TanStack query fetcher should stop converting entire query keys into URLs. Loading teardown belongs in `finally`, and financial queries should opt out of the global `staleTime: Infinity` behavior instead of changing caching rules app-wide.

The strongest code-implied choice is to avoid broad cache or router refactors. Every Phase 4 bug already has a narrow owner file and a small corrective pattern that exists elsewhere in the codebase.

**Primary recommendation:** Make surgical fixes in `client/src/App.tsx`, `client/src/lib/auth.tsx`, `client/src/lib/queryClient.ts`, and `client/src/pages/credits.tsx`; leave the broader app structure intact.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FE-01 | Direct URL navigation to `/admin/*` by a verified admin does not redirect to `/dashboard` | `client/src/App.tsx:192` only renders admin when `isAdminMode && profile?.is_admin`; `client/src/App.tsx:308` otherwise redirects `/admin` to `/dashboard` |
| FE-02 | Telegram signup notification fires only on first signup | `client/src/lib/auth.tsx:135-163` calls `notifyTelegramOnSignup()` after every `fetchUserData()` run, even when profile already exists |
| FE-03 | `getAuthHeaders()` surfaces initialization errors | `client/src/lib/queryClient.ts:36-47` swallows all exceptions and returns empty headers |
| FE-04 | Query key construction never produces malformed URLs | `client/src/lib/queryClient.ts:75-78` builds URLs with `queryKey.join("/")`; current parameterized queries already use explicit `queryFn` overrides in `client/src/components/admin/generations-tab.tsx:91-109` and `client/src/components/admin/users/user-details-dialog.tsx:407-410` |
| FE-05 | `fetchUserData` sets `loading` to `false` in a `finally` block | `client/src/lib/auth.tsx:103-163` sets loading only after `try/catch`, so an exception path can leave the auth shell inconsistent |
| FE-06 | `refreshProfile` uses `.maybeSingle()` | `client/src/lib/auth.tsx:197-201` still uses `.single()` while other profile reads use `.maybeSingle()` |
| FE-07 | `AppContent` guards against `profile === null` before reading admin state | `client/src/App.tsx:160-193` assumes the app can proceed once `brand` exists, even when `profile` is still null |
| FE-08 | Financial query data is refetched after mutations so balances stay current | `client/src/lib/queryClient.ts:90-97` applies global `staleTime: Infinity`; `client/src/pages/credits.tsx:112-129` does not override it on billing queries |
</phase_requirements>

## Locked Implementation Decisions

- **LD-01:** Keep the admin-mode feature flag, but route-sync it for admins. The repo already uses `isAdminMode` for sidebar rendering and exit behavior, so the fix should auto-enable admin mode when an authenticated admin is on `/admin/*`, not bypass the flag entirely.
- **LD-02:** Fix FE-01 in `client/src/App.tsx`, not by redesigning `client/src/lib/admin-mode.tsx`. `AppContent` already owns `location`, `profile`, and the admin/user shell split.
- **LD-03:** Move the Telegram signup call into the just-created profile branch in `client/src/lib/auth.tsx`. Do not solve FE-02 with client-side localStorage dedupe or a broader notification service rewrite.
- **LD-04:** Make `getAuthHeaders()` throw on initialization failure. Returning `{}` is the specific bug; logging-only keeps the broken request path alive.
- **LD-05:** Replace URL construction from `queryKey.join("/")` with the first key segment as the canonical URL. Existing queries that need dynamic params already provide explicit `queryFn`s, so no query-key refactor is required.
- **LD-06:** Put `setLoading(false)` in a `finally` block inside `fetchUserData()` and keep the rest of the auth state flow intact.
- **LD-07:** Change only `refreshProfile()` to `.maybeSingle()` for FE-06; the broken behavior is isolated to that helper.
- **LD-08:** Add an explicit `!profile` guard in `AppContent` before the admin/user shell split. Do not assume `brand` implies a valid profile row.
- **LD-09:** Keep global cache defaults unchanged for this phase. FE-08 is narrower: override freshness for billing queries in `client/src/pages/credits.tsx` and invalidate the exact billing keys affected by local mutations.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | project `^18.3.1` | App shell and auth-driven rendering | All reliability fixes land in existing React components/hooks |
| `wouter` | project `^3.3.5`; npm latest `3.9.0` published 2025-12-18 | Client-side routing | Existing admin/user route gating already lives here |
| `@tanstack/react-query` | project `^5.60.5`; npm latest `5.99.2` published 2026-04-19 | Data fetching and cache control | FE-03, FE-04, and FE-08 all hinge on current Query usage |
| `@supabase/supabase-js` | project `^2.98.0`; npm latest `2.104.0` published 2026-04-20 | Session access and profile/brand reads | Auth state and Bearer header generation depend on it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| repo-local `client/src/lib/auth.tsx` | repo-local | Canonical auth/profile/brand lifecycle | Use for profile refresh, signup-side effects, and auth loading state |
| repo-local `client/src/lib/queryClient.ts` | repo-local | Shared request/error/cache defaults | Use for default query behavior and authenticated fetches |
| repo-local `client/src/lib/admin-mode.tsx` | repo-local | Admin-shell mode persistence | Keep for UI mode state; synchronize it with route intent rather than replacing it |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Route-syncing admin mode in `AppContent` | Remove admin mode entirely | Larger behavior change; sidebar and exit flows already depend on the mode concept |
| Throwing from `getAuthHeaders()` | Log and return empty headers | Preserves silent unauthenticated requests and hides the real initialization failure |
| Overriding billing query freshness locally | Changing global `staleTime` for every query | Higher blast radius and unnecessary for this phase's stated requirement |

**Installation:** None required.

**Version verification:** Verified from npm registry on 2026-04-20 with `npm view`.

## Architecture Patterns

### Recommended Project Structure

```text
client/src/
├── App.tsx                # route-aware auth shell and admin/user split
├── lib/
│   ├── auth.tsx           # session, profile, brand, loading lifecycle
│   ├── admin-mode.tsx     # persisted admin mode flag
│   └── queryClient.ts     # authenticated fetch + cache defaults
├── pages/
│   └── credits.tsx        # billing queries and post-mutation invalidation
└── components/admin/
    ├── generations-tab.tsx        # example of explicit queryFn for parameterized requests
    └── users/user-details-dialog.tsx  # same pattern for dynamic admin URLs
```

### Pattern 1: Route State Decides Which Shell Renders

**What:** Shell selection should follow authenticated role plus current pathname, not a stale toggle alone.

**When to use:** Admin-only routes that still preserve a user/admin mode toggle for UI affordances.

**Example:**
```typescript
// Source: direct codebase inspection (`client/src/App.tsx:192-209`)
if (isAdminMode && profile?.is_admin && location.startsWith("/admin")) {
  const adminTabSegment = location.split("/")[2] || "dashboard";
}
```

### Pattern 2: Parameterized Queries Keep Identity In The Key, URL In queryFn

**What:** Use query keys for cache identity only; build request URLs explicitly in `queryFn` when params vary.

**When to use:** Any query whose key contains page numbers, filters, IDs, or other non-URL segments.

**Example:**
```typescript
// Source: direct codebase inspection (`client/src/components/admin/generations-tab.tsx:91-98`)
useQuery<GenerationsResponse>({
  queryKey: ["/api/admin/generations", page, statusFilter, contentTypeFilter, debouncedSearch],
  queryFn: () => adminFetch(`/api/admin/generations?${queryParams.toString()}`),
  staleTime: 0,
});
```

### Pattern 3: Tolerant Single-Row Reads Use maybeSingle

**What:** Profile/brand reads that may legitimately not exist yet should use `.maybeSingle()`.

**When to use:** Auth bootstrap and profile refresh helpers.

**Example:**
```typescript
// Source: direct codebase inspection (`client/src/lib/auth.tsx:107-110`)
const [profileRes, brandRes] = await Promise.all([
  sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
  sb.from("brands").select("*").eq("user_id", userId).maybeSingle(),
]);
```

### Pattern 4: Live Financial Pages Opt Out Of Global Infinite Freshness

**What:** Leave app-wide cache defaults stable, but override staleness for pages where balances must refresh quickly.

**When to use:** Billing, credits, and other balance-sensitive reads.

**Example:**
```typescript
// Source: direct codebase inspection (`client/src/components/post-creator-dialog.tsx:150-155`)
useQuery<CreditStatus>({
  queryKey: ["/api/credits/check?operation=generate"],
  enabled: isOpen && !usesOwnApiKey,
  staleTime: 0,
  refetchOnMount: "always",
});
```

### Anti-Patterns to Avoid

- **Silent auth fallback:** returning empty headers from `getAuthHeaders()` turns initialization failures into misleading 401s.
- **URL-from-key joining:** `queryKey.join("/")` couples cache identity to request URL shape and breaks as soon as complex segments appear.
- **Mode-only admin gating:** a stale `isAdminMode` value can override a correct `/admin/*` route.
- **Infinite loading assumptions:** once `loading` is false, `AppContent` must still safely handle `profile === null`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin route recovery | A new router layer or protected-route system | A small route-sync fix in `AppContent` | The current shell split is already centralized there |
| Query URL serialization | Custom generic query-key-to-URL encoding | `queryKey[0]` as canonical URL plus explicit `queryFn` for dynamic cases | The repo already uses this pattern in admin tabs |
| Cache freshness for billing | Global cache invalidation policy rewrite | Local `staleTime`/refetch overrides in `client/src/pages/credits.tsx` | Only financial reads need stricter freshness now |
| Signup dedupe | LocalStorage/sessionStorage notification markers | Existing profile-creation branch in `fetchUserData()` | The user-creation event already exists in one place |

**Key insight:** Phase 4 is not missing infrastructure; it is missing alignment between shared helpers and the page-level patterns the repo already uses successfully.

## Common Pitfalls

### Pitfall 1: Fixing admin access by bypassing mode without syncing it
**What goes wrong:** `/admin/*` loads the admin page but still shows user sidebar/navigation.
**Why it happens:** `AppSidebar` reads `isAdminMode`, not just the pathname.
**How to avoid:** Ensure the route-based fix also drives the existing admin-mode state.
**Warning signs:** Admin content renders with user nav items like Dashboard/Billing/Settings.

### Pitfall 2: Moving signup notification too late in the flow
**What goes wrong:** New signups stop notifying, or existing sessions still notify repeatedly.
**Why it happens:** The notification is currently outside the create-vs-existing branch.
**How to avoid:** Tie the side effect to the successful profile insert path only.
**Warning signs:** Login refreshes still hit `/api/telegram/notify-signup`, or first signups stop hitting it entirely.

### Pitfall 3: Fixing FE-04 only in one callsite
**What goes wrong:** One admin page is safe, but the shared default query function still serializes bad URLs elsewhere.
**Why it happens:** The real bug sits in `client/src/lib/queryClient.ts`, not in any single page.
**How to avoid:** Fix the shared `getQueryFn` behavior once, then leave explicit per-page `queryFn`s intact.
**Warning signs:** Network requests include unexpected path fragments like `/[object Object]` or `/null` from default queries.

### Pitfall 4: Treating null profile as impossible after loading completes
**What goes wrong:** The app leaves the spinner path and then renders an invalid shell state.
**Why it happens:** `brand` and `profile` are fetched separately, and profile creation can fail independently.
**How to avoid:** Add a dedicated `!profile` guard before branching into admin/user UI.
**Warning signs:** Authenticated users with a brand see redirects or broken buttons without a loaded profile.

### Pitfall 5: Fixing billing freshness only with invalidation
**What goes wrong:** In-app mutations look fresh, but returning from Stripe checkout/portal still shows stale cached data.
**Why it happens:** Global `staleTime: Infinity` keeps previous results fresh forever unless a mutation in the same tab invalidates them.
**How to avoid:** Combine targeted invalidation with per-query staleness overrides on billing reads.
**Warning signs:** Revisiting `/billing` after a completed checkout still shows the old balance until a hard reload.

## Code Examples

Verified repo patterns to copy directly:

### Tolerant auth bootstrap reads

```typescript
// Source: `client/src/lib/auth.tsx:107-110`
const [profileRes, brandRes] = await Promise.all([
  sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
  sb.from("brands").select("*").eq("user_id", userId).maybeSingle(),
]);
```

### Parameterized query with explicit URL builder

```typescript
// Source: `client/src/components/admin/users/user-details-dialog.tsx:407-410`
useQuery<{ posts: UserPost[] }>({
  queryKey: ["/api/admin/users", user?.id, "posts"],
  queryFn: () => adminFetch(`/api/admin/users/${user?.id}/posts`),
  enabled: !!user?.id && open,
});
```

### Freshness override on a balance-sensitive query

```typescript
// Source: `client/src/components/post-creator-dialog.tsx:150-155`
useQuery<CreditStatus>({
  queryKey: ["/api/credits/check?operation=generate"],
  enabled: isOpen && !usesOwnApiKey,
  staleTime: 0,
  refetchOnMount: "always",
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Building request URLs by joining every query-key segment | Keep cache identity in the full key, but fetch from an explicit canonical URL | Current TanStack Query v5 usage in this repo | Safer dynamic keys and cleaner parameterized queries |
| Infinite freshness for everything | Opt specific live pages into immediate or short-stale refetching | Current bug-fix milestone | Keeps most of the app stable while fixing balance-sensitive reads |

**Deprecated/outdated:**
- Treating `getAuthHeaders()` failure as a non-event is incorrect for this app; it hides startup/session issues.
- Treating `brand` as proof that `profile` is safe to use is incorrect in the current auth flow.

## Open Questions

1. **What should the `!profile` guard render in `AppContent`?**
   - What we know: a silent fall-through is unsafe, and an infinite spinner could hide a real persistent data issue.
   - What's unclear: whether product wants a retry/error surface or a conservative loading fallback for this milestone.
   - Recommendation: use a minimal blocking fallback state in `AppContent` that does not redirect; planner can choose between `PageLoader` and a short error card.

2. **Should billing queries use `staleTime: 0` or a short non-zero window like 30-60s?**
   - What we know: any finite staleness removes the current forever-fresh balance bug.
   - What's unclear: how aggressively product wants background refetching on the billing page.
   - Recommendation: prefer `staleTime: 0` with default refetch-on-mount behavior for this bug-fix phase; it is the most explicit and matches the existing credit check pattern.

## Environment Availability

Step 2.6: SKIPPED - this phase is code-only and depends only on the existing Node/npm toolchain already present in the workspace.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | none |
| Quick run command | `npm run check` |
| Full suite command | `npm run check` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FE-01 | Admin direct navigation stays in the admin shell | manual routing smoke + typecheck | `npm run check` | ❌ Wave 0 |
| FE-02 | Telegram signup notify fires once on new-account creation only | manual auth/network smoke + typecheck | `npm run check` | ❌ Wave 0 |
| FE-03 | Auth header initialization failures bubble to callers | manual failure-path smoke + typecheck | `npm run check` | ❌ Wave 0 |
| FE-04 | Shared query fetcher never builds malformed URLs from key segments | manual network smoke + typecheck | `npm run check` | ❌ Wave 0 |
| FE-05 | Auth loading always resolves after `fetchUserData` completes or fails | manual auth error smoke + typecheck | `npm run check` | ❌ Wave 0 |
| FE-06 | Profile refresh tolerates missing profile rows | manual onboarding/affiliate smoke + typecheck | `npm run check` | ❌ Wave 0 |
| FE-07 | App shell handles `profile === null` safely | manual auth shell smoke + typecheck | `npm run check` | ❌ Wave 0 |
| FE-08 | Billing/credit balances refresh after local or external billing changes | manual billing smoke + typecheck | `npm run check` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` plus targeted manual verification of admin routing, auth lifecycle, and billing freshness

### Wave 0 Gaps

- [ ] No automated frontend integration tests exist for route/auth/cache behavior; manual browser verification is required.
- [ ] Manual smoke for FE-01/FE-07: sign in as admin, hit `/admin/dashboard` and `/admin/users` from a fresh load and from in-app navigation after exiting admin mode; confirm admin shell renders and no redirect/crash occurs.
- [ ] Manual smoke for FE-02: create a brand-new account, confirm one `/api/telegram/notify-signup` call, then refresh and sign in again to confirm no repeat call.
- [ ] Manual smoke for FE-03/FE-04/FE-05: force a temporary `/api/config` or session-init failure and confirm requests surface a real error instead of silent empty headers or endless spinners.
- [ ] Manual smoke for FE-06: exercise `refreshProfile()` via onboarding completion and affiliate API-key save when the profile row is absent or delayed; confirm no 406-driven crash path.
- [ ] Manual smoke for FE-08: load `/billing`, mutate spending controls, and confirm overview/me refresh immediately; then return from a Stripe flow or equivalent cached revisit and confirm balances refetch on mount.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `client/src/App.tsx` - admin route gating and null-profile shell behavior confirmed
- Direct codebase inspection: `client/src/lib/auth.tsx` - signup notify location, loading teardown, and `refreshProfile()` inconsistency confirmed
- Direct codebase inspection: `client/src/lib/queryClient.ts` - swallowed auth errors, shared query URL building, and global `staleTime: Infinity` confirmed
- Direct codebase inspection: `client/src/pages/credits.tsx` - billing queries rely on global cache freshness and only partially invalidate after mutation
- Direct codebase inspection: `client/src/components/admin/generations-tab.tsx` - explicit queryFn pattern for parameterized URLs confirmed
- Direct codebase inspection: `client/src/components/admin/users/user-details-dialog.tsx` - explicit queryFn pattern for dynamic user-post URL confirmed
- npm registry: `@tanstack/react-query` - latest version `5.99.2`, checked 2026-04-20
- npm registry: `wouter` - latest version `3.9.0`, checked 2026-04-20
- npm registry: `@supabase/supabase-js` - latest version `2.104.0`, checked 2026-04-20

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` - phase scope and FE-01..FE-08 intent confirmed
- `.planning/debug/full-system-bug-audit.md` - original failure modes and affected files confirmed against current code

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all affected libraries are already in the repo and versions were verified from npm
- Architecture: HIGH - each recommendation follows an adjacent pattern already used successfully in the codebase
- Pitfalls: HIGH - each pitfall maps directly to a currently broken branch confirmed in source

**Research date:** 2026-04-20
**Valid until:** 2026-05-20

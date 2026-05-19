---
phase: 17-ghl-signup-sync-wire-up
plan: 01
subsystem: integrations
tags: [ghl, signup-sync, best-effort, observability, admin-ui]
dependency_graph:
  requires:
    - integration_settings table (20260305000013_integration_settings.sql)
    - integration_delivery_logs table (20260307000000_integration_observability.sql)
    - getOrCreateGHLContact (server/integrations/ghl.ts — sealed)
    - recordIntegrationDeliveryLog (server/routes/integrations.routes.ts)
    - POST /api/telegram/notify-signup handler (existing signup hook)
  provides:
    - sync_on_signup boolean column on integration_settings
    - fanGHLSignup helper (fire-and-forget GHL contact push)
    - GET /api/admin/ghl includes sync_on_signup in response
    - PATCH /api/admin/ghl accepts and persists sync_on_signup
    - Admin UI checkbox for "Sync new signups to GHL (tagged xareable)"
    - scripts/verify-phase-17.ts (20-check static harness)
  affects:
    - integration_delivery_logs (new ghl rows per signup)
    - POST /api/telegram/notify-signup (pipeline extended with GHL branch)
tech_stack:
  added: []
  patterns:
    - fire-and-forget fan-out via void + .catch (best-effort integration branch)
    - helper-at-module-scope pattern (fanGHLSignup extracted before route handler)
key_files:
  created:
    - supabase/migrations/20260508203515_integration_settings_sync_on_signup.sql
    - scripts/verify-phase-17.ts
  modified:
    - shared/schema.ts (+2 fields: sync_on_signup in adminGHLStatusSchema + saveGHLSettingsRequestSchema)
    - server/routes/integrations.routes.ts (+134 lines: helper, route extensions, smell-comment)
    - client/src/components/admin/integrations-tab.tsx (+21 lines: state, hydration, payload, UI)
decisions:
  - "fanGHLSignup extracted as module-scope helper (Option B2) — ensures GHL runs regardless of which telegram exit path fires, keeping telegram block 100% unchanged"
  - "GHL branch runs fire-and-forget (void + .catch) so handler's existing telegram pipeline is not blocked by GHL latency"
  - "sync_on_signup stored as a boolean column on integration_settings (Decision 3, Option 1) — clean schema, query-friendly, additive migration"
  - "Reused integration_delivery_logs table for GHL delivery records (Decision 2) — identical observability surface to telegram, zero new schema"
  - "ghl.ts sealed — getOrCreateGHLContact already supports tags: string[], no wrapper change needed"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-16T13:11:38Z"
  tasks: 4
  files_modified: 4
  files_created: 2
  commits: 4
---

# Phase 17 Plan 01: GHL Signup Sync (Wire-Up) Summary

**One-liner:** GHL contact push on Xareable signup via fire-and-forget `fanGHLSignup` helper, gated by admin `sync_on_signup` opt-in toggle, recording all outcomes to `integration_delivery_logs` with `integrationType="ghl"` and `tags: ["xareable"]`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration + Zod schema extension | `476f54b` | `supabase/migrations/20260508203515_*.sql`, `shared/schema.ts` |
| 2 | Server wiring — GHL branch + admin GET/PATCH | `a22c7a3` | `server/routes/integrations.routes.ts` |
| 3 | Admin UI checkbox in GHL card | `d3c3785` | `client/src/components/admin/integrations-tab.tsx` |
| 4 | Verification harness | `189f7b0` | `scripts/verify-phase-17.ts` |

## Requirement Coverage

| Requirement | Satisfied by | Evidence |
|-------------|-------------|---------|
| GHL-01: server-side push on signup, opt-in gated, tag `xareable` | Task 2 | `fanGHLSignup` reads `sync_on_signup`, calls `getOrCreateGHLContact` with `tags: ["xareable"]` |
| GHL-02: admin checkbox persisting `sync_on_signup` | Tasks 1+3 | Boolean column on `integration_settings`, Switch in GHL card with round-trip via TanStack Query |
| GHL-03: best-effort — signup never blocked, delivery logged | Task 2 | `void fanGHLSignup(...).catch(...)`, 4 observability outcomes in `integration_delivery_logs` |

## Observability Legs

All four outcome paths record to `integration_delivery_logs` with `integration_type='ghl'`, `event_name='CompleteRegistration'`:

| Outcome | Status | Reason |
|---------|--------|--------|
| Settings read failed | `failed` | `settings_read_failed` |
| Not configured / not opted-in | `skipped` | `integration_not_configured` |
| GHL contact created/updated | `sent` | `contact_created` or `contact_updated` |
| API error or exception | `failed` | `ghl_api_error` or error message |

## Verification Harness Output

```
Section 1: Migration — supabase/migrations/*_integration_settings_sync_on_signup.sql
Section 2: Zod schema — shared/schema.ts
Section 3: Server wiring — server/routes/integrations.routes.ts
Section 4: Admin UI — client/src/components/admin/integrations-tab.tsx
Section 5: Sealed file — server/integrations/ghl.ts must be byte-identical to HEAD
Dynamic: round-trip sync_on_signup column via integration_settings (skipped if no env)

=== Phase 17 Verification ===
  ok  migration file exists matching *_integration_settings_sync_on_signup.sql
  ok  migration contains ADD COLUMN IF NOT EXISTS sync_on_signup boolean NOT NULL DEFAULT false
  ok  migration contains COMMENT ON COLUMN public.integration_settings.sync_on_signup
  ok  migration filename timestamp is greater than 20260307000000 (orders last)
  ok  adminGHLStatusSchema contains sync_on_signup: z.boolean().default(false)
  ok  saveGHLSettingsRequestSchema contains sync_on_signup: z.boolean().optional()
  ok  shared/schema.ts mentions sync_on_signup at least 2 times
  ok  declares async function fanGHLSignup
  ok  void fanGHLSignup( invoked exactly once
  ok  integrationType: "ghl" appears at least 4 times (settings_read_failed, skipped, sent, failed paths)
  ok  GHL contact payload passes tags: ["xareable"] or tags: ['xareable']
  ok  smell-comment: fans the signup event to ALL configured integrations
  ok  GET /api/admin/ghl response includes sync_on_signup field
  ok  PATCH /api/admin/ghl persists sync_on_signup: if (typeof sync_on_signup === "boolean") updateData.sync_on_signup
  ok  fanGHLSignup uses eventName: "CompleteRegistration"
  ok  integrations-tab.tsx contains id="ghl-sync-on-signup"
  ok  integrations-tab.tsx contains label text "Sync new signups to GHL"
  ok  integrations-tab.tsx contains payload.sync_on_signup = ghlSyncOnSignup
  ok  integrations-tab.tsx hydration: setGhlSyncOnSignup(Boolean(ghlData.sync_on_signup))
  ok  server/integrations/ghl.ts is byte-identical to HEAD (sealed file gate)
  skip dynamic check — SUPABASE env vars not set (CI-friendly)

All Phase 17 checks passed.
```

**Exit code: 0 — all 20 static checks passed.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] PATCH handler missing sync_on_signup in updateData and response**

- **Found during:** Task 2 execution
- **Issue:** The `updateData` builder in `PATCH /api/admin/ghl` was missing `if (typeof sync_on_signup === "boolean") updateData.sync_on_signup = sync_on_signup`, and the response was missing `sync_on_signup: Boolean(settings.sync_on_signup)`. These were required for the admin round-trip contract.
- **Fix:** Added both lines to complete the PATCH handler.
- **Files modified:** `server/routes/integrations.routes.ts`
- **Commit:** `a22c7a3`

No other deviations — plan executed as written.

## Deferred Items

- **Rename `POST /api/telegram/notify-signup` route** — path name is now misleading since it fans to all integrations. Tracked in CONTEXT.md `<deferred>`. Out of scope for v1.4. Smell-comment added to route declaration as mitigation.
- **Telegram `notify_on_new_signup` flag consolidation** — telegram uses a JSONB-nested boolean in `custom_field_mappings`; the new `sync_on_signup` column is cleaner. Unifying these is V2 cleanup.
- **Other event types (first_generation, subscription_started)** — push-only signup-only in v1.4. Future phases extend `fanGHLSignup` pattern to other handlers.

## Known Stubs

None — the implementation is fully wired. `fanGHLSignup` returns early with `status='skipped'` when unconfigured (not a stub — that is correct behavior). No hardcoded empty values flow to UI rendering.

## Self-Check: PASSED

Files created/modified:
- `supabase/migrations/20260508203515_integration_settings_sync_on_signup.sql` — FOUND
- `shared/schema.ts` — FOUND (sync_on_signup in both schemas)
- `server/routes/integrations.routes.ts` — FOUND (fanGHLSignup + admin extensions)
- `client/src/components/admin/integrations-tab.tsx` — FOUND (ghlSyncOnSignup state + UI)
- `scripts/verify-phase-17.ts` — FOUND

Commits:
- `476f54b` — Task 1 (migration + Zod)
- `a22c7a3` — Task 2 (server wiring)
- `d3c3785` — Task 3 (admin UI)
- `189f7b0` — Task 4 (verify harness)

`npm run check` — PASSED  
`npm run build` — PASSED  
`npx tsx scripts/verify-phase-17.ts` — PASSED (exit 0, 20/20 checks)  
`git diff HEAD server/integrations/ghl.ts` — empty (sealed file invariant held across all 4 commits)

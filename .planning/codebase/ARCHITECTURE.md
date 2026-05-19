# Architecture

**Analysis Date:** 2026-04-06 (last updated 2026-05-08 — added Scheduled Operations section after Phase 14 reorg)

## Pattern Overview

**Overall:** Full-stack TypeScript monorepo with client/server split, BFF (Backend for Frontend) pattern, and external service delegation (Supabase, Gemini, Stripe).

**Key Characteristics:**
- React SPA served by an Express 5 API server (dev: Vite middleware; prod: static files)
- All auth delegated to Supabase Auth; server re-validates every request via JWT
- AI generation streamed over SSE rather than a single HTTP response
- Shared Zod schemas in `shared/schema.ts` are the single source of truth for types

## Layers

**Frontend (React SPA):**
- Purpose: User interface, routing, state management
- Location: `client/src/`
- Contains: Pages, components, context providers, hooks, lib utilities
- Depends on: `shared/schema.ts` types, `/api/*` endpoints, Supabase Auth client
- Used by: End users via browser

**Express API Server:**
- Purpose: Business logic, AI orchestration, auth validation, billing
- Location: `server/`
- Contains: Route modules, middleware, services, integrations
- Depends on: Supabase (DB + Storage), Gemini REST API, Stripe API
- Used by: Frontend SPA

**Shared Layer:**
- Purpose: Type contracts between client and server
- Location: `shared/schema.ts`, `shared/config/`
- Contains: Zod schemas, TypeScript types, constants
- Depends on: Nothing (pure Zod)
- Used by: Both `client/src/` and `server/`

**Services Layer (server-side):**
- Purpose: Isolate AI, image processing, and storage operations
- Location: `server/services/`
- Contains: Gemini service, image generation, text rendering, caption quality, storage cleanup
- Depends on: Gemini REST API, Sharp (image processing)
- Used by: Route handlers

## Data Flow

**AI Generation (POST /api/generate):**
1. Client sends `Authorization: Bearer <token>` + generation params via `apiRequest()`
2. `authenticateUser()` middleware validates JWT via `supabase.auth.getUser(token)`
3. Profile fetched via admin Supabase client (bypasses RLS)
4. `checkCredits()` (`server/quota.ts`) validates billing allowance
5. Server initializes SSE stream (`server/lib/sse.ts`) and streams progress events
6. Phase 1: `gemini.service.ts` calls Gemini text model → JSON content plan
7. Phase 2: `image-generation.service.ts` calls Gemini image model → PNG buffer
8. Optional: `text-rendering.service.ts` verifies/repairs exact text in image
9. Optional: logo overlay applied via `image-optimization.service.ts`
10. Image optimized + thumbnail generated; both uploaded to Supabase Storage (`user_assets/`)
11. `caption-quality.service.ts` polishes the social caption
12. Post record inserted into `posts` table; usage event recorded; credits deducted
13. `sse.sendComplete()` sends final payload to client

**Auth Flow:**
1. `main.tsx` calls `initializeSupabase()` → fetches `SUPABASE_URL` + anon key from `GET /api/config`
2. `AuthProvider` (`client/src/lib/auth.tsx`) subscribes to `supabase.auth.onAuthStateChange`
3. On session, profile and brand fetched directly from Supabase DB (client-side, RLS-gated)
4. Missing profile → auto-created; missing brand → redirect to `/onboarding`
5. All subsequent API calls attach `Authorization: Bearer <token>` header via `getAuthHeaders()` in `client/src/lib/queryClient.ts`

**State Management:**
- Server state: TanStack Query v5 with auth headers injected globally via `getQueryFn`
- UI/Auth state: React Context (`AuthContext`, `PostCreatorContext`, `PostViewerContext`, `AdminModeContext`, `AppSettingsContext`, `LanguageContext`)

## Key Abstractions

**AuthenticatedRequest:**
- Purpose: Extended Express Request carrying `user`, `supabase`, and `profile`
- Location: `server/middleware/auth.middleware.ts`
- Pattern: `authenticateUser()` returns `AuthResult | AuthError`; route handlers check `result.success`

**SSE Stream:**
- Purpose: Incremental progress reporting for long-running AI generation
- Location: `server/lib/sse.ts`
- Pattern: `initSSE(res)` returns helper with `sendProgress()`, `sendComplete()`, `sendError()`

**Quota / Credits:**
- Purpose: Per-user credit gating with billing model support
- Location: `server/quota.ts`
- Pattern: `checkCredits()` → `deductCredits()` → `recordUsageEvent()` after successful generation

**Style Catalog:**
- Purpose: Admin-configurable AI model config, text styles, post formats, moods
- Location: `server/routes/style-catalog.routes.ts`
- Pattern: `getStyleCatalogPayload()` exported and reused across route modules

## Entry Points

The codebase has TWO server entry points to support different deployment targets:

**`server/index.ts` — Long-running entry (local dev + Hetzner / VPS / Railway / Render):**
- Triggers: `npm run dev` (`tsx server/index.ts`) or `npm run start` (`node dist/index.cjs`)
- Responsibilities: Express app setup, route registration via `createApiRouter()`, Vite middleware (dev) or static serving (prod), **starts internal `node-cron` scheduler via `startCronJobs()` in the `httpServer.listen` callback**

**`api/handler.ts` — Vercel serverless entry (current production):**
- Triggers: Per-request invocation by Vercel platform
- Responsibilities: Express app setup, route registration, NO cron scheduler (functions are short-lived)
- vercel.json maps `/api/*`, `/`, `/privacy`, `/terms`, `/sitemap.xml`, `/robots.txt`, `/site.webmanifest`, `/favicon.ico` → this handler

**Client:**
- Location: `client/src/main.tsx`
- Triggers: Browser load
- Responsibilities: `initializeSupabase()` → render `<App />` (wrapped in `<ErrorBoundary>` since Phase 13) with all providers

## Scheduled Operations (Phase 11 + 12 + 14)

Three destructive scheduled jobs run in production:

1. **Trash sweep** — every 6h. Soft-deletes posts past `expires_at` by setting `trashed_at = now()`. Defined in `server/services/cleanup-cron.service.ts:runTrashSweep()`.
2. **Purge sweep** — every 6h (offset). Permanently deletes posts in trash > `TRASH_RETENTION_DAYS`. Removes storage files BEFORE DB rows (orphan-prevention contract). Defined in `server/services/cleanup-cron.service.ts:runPurgeSweep()`.
3. **Overage billing batch** — weekly. Stripe-invoices accrued overage from `user_billing_profiles.pending_overage_micros`. Defined in `server/stripe.ts:runOverageBillingBatch()`.

### Dual trigger architecture

Both trigger paths exist in code AND can coexist. The active path depends on which entry point runs:

| Trigger path | Active when | Mechanism |
|---|---|---|
| **HTTP triggers** | `api/handler.ts` is the entry (Vercel today) | GitHub Actions schedule fires `curl -X POST` to `/api/internal/cleanup/{trash,purge}` and `/api/internal/billing/run-overage-batch` (each protected by `requireCronSecret` middleware) |
| **Internal `node-cron`** | `server/index.ts` is the entry (Hetzner future, local dev, any long-running Node host) | `startCronJobs()` registers `cron.schedule(...)` for all three jobs at `httpServer.listen` time |

Both paths invoke the SAME core functions. There is no logic divergence — the trigger merely decides WHEN the function fires.

### Why two paths

- Vercel serverless functions don't host long-running processes → `node-cron`'s `setTimeout` never fires → internal scheduler is dead in production.
- Vercel Cron Jobs (Hobby tier) is limited to once-daily, which degrades the 6h cadence spec from Phase 11.
- GitHub Actions free tier supports any schedule (we use 6h cleanup + weekly overage) at $0.
- Future Hetzner migration restores the internal `node-cron` path for free — the infrastructure was preserved deliberately.

### Cross-host concurrency

The in-process `overageBatchRunning` boolean lock (Phase 12) prevents same-process double-invocation. It does NOT prevent cross-process races (e.g., Hetzner internal cron + GitHub Actions both firing). When migrating to Hetzner: disable one trigger or accept the risk until DB-backed locks are added.

See [docs/production-cron.md](../../docs/production-cron.md) for the full setup runbook.

## Error Handling

**Strategy:** Fail fast for pre-flight errors (auth, validation, credits) with JSON responses; SSE `sendError()` for errors during streaming generation.

**Patterns:**
- Route handlers call `authenticateUser()` and check `result.success` before proceeding
- Zod `safeParse()` used on all request bodies before processing
- Generation errors logged to `generation_logs` table via `logGenerationError()`
- Global Express error handler in `server/index.ts` catches unhandled throws

## Cross-Cutting Concerns

**Logging:** `log()` function in `server/index.ts`; all `/api/*` requests logged with method, path, status, duration, response body.

**Validation:** Zod `safeParse()` server-side on all mutation endpoints; types shared from `shared/schema.ts`.

**Authentication:** `requireAuth` middleware (Express middleware style) or `authenticateUser()` (inline functional style) used per-route; `requireAdmin` / `requireAdminGuard` for admin routes.

**Billing:** `server/quota.ts` centralizes credit checking, deduction, and usage recording. `server/stripe.ts` handles Stripe webhooks and auto-recharge.

---

*Architecture analysis: 2026-04-06*

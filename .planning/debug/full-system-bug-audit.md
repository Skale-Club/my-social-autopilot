---
status: diagnosed
trigger: "full-system-bug-audit"
created: 2026-04-20T00:00:00Z
updated: 2026-04-20T00:00:00Z
---

## Current Focus

hypothesis: Systematic audit of all layers — backend, frontend, auth, schema
test: Reading all source files and cross-referencing for bugs, security issues, inconsistencies
expecting: A comprehensive list of findings across all severity levels
next_action: Read all source files

## Symptoms

expected: System should function correctly across all layers
actual: Unknown — proactive audit
errors: None reported yet
reproduction: N/A
started: N/A — audit requested proactively

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-20
  checked: All server routes, middleware, services, shared schema, client auth, query client, App.tsx
  found: Multiple bugs across auth, token extraction, database usage, storage, and security layers
  implication: See Resolution section for complete categorized findings

## Resolution

root_cause: N/A — audit mode
fix: See findings below
verification: N/A
files_changed: []

---

# FULL AUDIT FINDINGS

## CRITICAL

### BUG-001 — Bearer Token Extraction Is Fragile (Auth Bypass Risk)
**File:** `server/middleware/auth.middleware.ts` line 35, 178; `server/routes/edit.routes.ts` line 61
**Severity:** Critical
**Description:** Token extraction uses `.replace("Bearer ", "")` which is a plain string replace, not a proper prefix strip. If the `Authorization` header is `Bearer  token` (extra space) or `bearer token` (lowercase), the "replace" still passes through a malformed or full string as the token. More critically, if the header is `NotBearer token`, it would still proceed with `NotBearer token` as the token value. The correct approach is to check that the header starts with `"Bearer "` and slice after it.
**Code:**
```ts
return authHeader.replace("Bearer ", "");
```
**Suggested Fix:**
```ts
if (!authHeader.startsWith("Bearer ")) return null;
return authHeader.slice(7);
```

---

### BUG-002 — `sb.raw()` Does Not Exist on Supabase JS Client
**File:** `server/quota.ts` line 635
**Severity:** Critical
**Description:** `incrementQuickRemakeCount` uses `sb.raw("quick_remake_count + 1")` — but the Supabase JavaScript client does not have a `.raw()` method. This is a Knex/Drizzle idiom. This call will throw a runtime error every time a free-tier user completes a quick remake, crashing the response. The column will never be incremented.
**Code:**
```ts
.update({ quick_remake_count: sb.raw("quick_remake_count + 1") })
```
**Suggested Fix:** Use an RPC or a read-then-write pattern:
```ts
const current = await getQuickRemakeCount(userId);
await sb.from("user_credits").update({ quick_remake_count: current + 1 }).eq("user_id", userId);
```
Or define a Supabase SQL function and call it via `.rpc()`.

---

### BUG-003 — Duplicate `/api/settings` Route Registration
**File:** `server/routes/config.routes.ts` line 43 AND `server/routes/settings.routes.ts` line 24
**Severity:** Critical
**Description:** Both `config.routes.ts` (line 43) and `settings.routes.ts` (line 24) register `GET /api/settings`. In Express, the first registered route wins. Since `configRoutes` is registered before `settingsRoutes` in `routes/index.ts`, `config.routes.ts` always handles the request. `settings.routes.ts` has additional logic (merging `icon_url` from `landing_content`); that logic is silently dead. Any consumer expecting the icon URL merge behavior will never receive it.
**Suggested Fix:** Consolidate both handlers into one file, or rename one route.

---

## HIGH

### BUG-004 — `post.aspect_ratio` Column Does Not Exist
**File:** `server/routes/edit.routes.ts` line 326
**Severity:** High
**Description:** When editing a video post, the code reads `post.aspect_ratio || "9:16"` to pass as aspect ratio to the video generator. However, `post` is fetched with `select("*")` on the `posts` table, and `aspect_ratio` is not a column in the `postSchema` (see `shared/schema.ts` — the schema has no `aspect_ratio` field). This will always evaluate to `undefined`, silently falling through to the default `"9:16"`, meaning the original aspect ratio of the post is permanently lost during video edits.
**Suggested Fix:** Store `aspect_ratio` in the `posts` table and schema, or look it up from the generation log/prompt.

---

### BUG-005 — Admin Panel Access Not Gated on Frontend Admin Mode
**File:** `client/src/App.tsx` lines 192–257
**Severity:** High
**Description:** The admin UI is only rendered when `isAdminMode && profile?.is_admin && location.startsWith("/admin")`. If an admin user navigates directly to `/admin/dashboard` without having activated `isAdminMode` (which is a client-side toggle), they are silently redirected to `/dashboard` (the default catch in the user Switch). The admin panel is inaccessible until the admin manually clicks the "Admin Panel" button. This is a UX bug — a direct URL visit to `/admin/*` by a verified admin should work.
**Suggested Fix:** When `profile?.is_admin` is true and the route starts with `/admin`, set `isAdminMode` to `true` automatically (or bypass the mode check for route-based access).

---

### BUG-006 — Telegram Signup Notification Called on Every Login, Not Just First Signup
**File:** `client/src/lib/auth.tsx` lines 159–162
**Severity:** High
**Description:** `notifyTelegramOnSignup` is called inside `fetchUserData`, which runs on every auth state change — including every login, token refresh, and page load (when there's an active session). Telegram will receive a signup notification on every login. There is no check for whether this is the user's first ever session.
**Suggested Fix:** Only call `notifyTelegramOnSignup` when a new profile was just created (line 141–153 path), not unconditionally.

---

### BUG-007 — Version Delete Uses User-Scoped Supabase Client Without RLS UPDATE Policy
**File:** `server/routes/posts.routes.ts` lines 566–574
**Severity:** High
**Description:** When deleting a specific post version (versionNumber >= 1), the delete call uses the user-scoped `supabase` client, not `adminSb`. The comment on line 506–507 explicitly notes: "Use admin client for mutations — no UPDATE RLS policy on posts or post_versions." This means the `.delete()` on `post_versions` at line 567 will fail silently or throw an RLS error for regular users who have no DELETE RLS policy on `post_versions`.
**Code:**
```ts
const { error: deleteError } = await supabase  // should be adminSb
    .from("post_versions")
    .delete()
    .eq("id", targetVersion.id);
```
**Suggested Fix:** Replace `supabase` with `adminSb` (already declared at line 507).

---

### BUG-008 — Storage Cleanup After Version Delete Uses User-Scoped Client
**File:** `server/routes/posts.routes.ts` lines 584–590
**Severity:** High
**Description:** The storage removal after version deletion also uses the user-scoped `supabase` client. If RLS on storage does not allow user-initiated deletions, this will silently fail, accumulating orphaned files in storage.
**Suggested Fix:** Use `adminSb` for storage cleanup, consistent with how deletion is handled in other places.

---

### BUG-009 — Edit Route: Image Upload Uses User-Scoped Supabase Client for Storage
**File:** `server/routes/edit.routes.ts` lines 475–488
**Severity:** High
**Description:** Image upload in the edit flow uses the user-scoped `supabase` client (derived from token). The generate flow uses `createAdminSupabase()` for uploads. If RLS storage policies do not allow user tokens to write to `user_assets`, image uploads during edits will fail. This is inconsistent with `generate.routes.ts` which correctly uses `createAdminSupabase()`.
**Suggested Fix:** Use `createAdminSupabase()` for all storage uploads, consistent with the generate flow.

---

### BUG-010 — `requireAdmin` Middleware Does Not Attach `profile` to Request
**File:** `server/middleware/auth.middleware.ts` lines 132–168
**Severity:** High
**Description:** The `requireAdmin` middleware (used as Express middleware) attaches `req.user` and `req.supabase` but does NOT attach `req.profile`. Any route handler that calls `next()` after `requireAdmin` and then reads `req.profile` will get `undefined`. The `requireAuth` middleware correctly attaches all three. This inconsistency will silently break any route that stacks `requireAdmin` and then reads `req.profile`.
**Suggested Fix:** Fetch and attach the full profile in `requireAdmin`, or consolidate to `requireAuth` + admin check.

---

### BUG-011 — Double API Key Check for `usesOwnApiKey` in `edit.routes.ts`
**File:** `server/routes/edit.routes.ts` lines 135–162
**Severity:** High (Logic Duplication + Subtle Bug)
**Description:** The `edit.routes.ts` route re-implements `usesOwnApiKey` logic inline (lines 135–136) instead of using the imported `usesOwnApiKey` helper from `auth.middleware.ts`. Additionally, line 138–143 checks `usesOwnApiKey && !editProfile?.api_key` and returns 400, then immediately after (line 146–162) checks the same condition again and returns a different 400 message for affiliates specifically. This is dead code duplication — the second block can never be reached with a different `api_key` value than the first check already covered. The different error messages for the same condition are confusing.
**Suggested Fix:** Use `getGeminiApiKey(editProfile)` from `auth.middleware.ts` just like `generate.routes.ts` does.

---

## MEDIUM

### BUG-012 — Admin Stats Fetches ALL Posts/Users/Usage With No Limit
**File:** `server/routes/admin.routes.ts` lines 265–280
**Severity:** Medium
**Description:** `GET /api/admin/stats` runs unbounded queries on `profiles`, `posts`, `brands`, `usage_events`, and `user_credits` with no `.limit()` or pagination. As the platform grows, this will exhaust memory and cause timeouts. Supabase has a default row limit of 1000 unless overridden, meaning stats will silently be wrong once a table exceeds 1000 rows.
**Suggested Fix:** Use `count: "exact"` with `.head()` for totals, and paginate or aggregate date-windowed data in the database using SQL/RPC.

---

### BUG-013 — Admin `/api/admin/users` Also Fetches Unbounded Data
**File:** `server/routes/admin.routes.ts` lines 570–597
**Severity:** Medium
**Description:** Same pattern — all profiles, brands, posts, credits, usage events, affiliate settings, and billing profiles are fetched without limits. At scale this will silently return only partial data (Supabase 1000-row default) while appearing complete to the admin.
**Suggested Fix:** Add server-side pagination for the users list.

---

### BUG-014 — `incrementQuickRemakeCount` Has No Error Handling
**File:** `server/quota.ts` lines 628–637
**Severity:** Medium (compounded by BUG-002)
**Description:** Beyond the `sb.raw()` crash (BUG-002), the function does not await the Supabase update and does not handle the returned error. Even if fixed, if the update fails silently, users would get unlimited quick remakes past the free limit.
**Suggested Fix:** Await and check the error:
```ts
const { error } = await sb.from("user_credits").update({...}).eq("user_id", userId);
if (error) throw new Error(`Failed to increment quick remake count: ${error.message}`);
```

---

### BUG-015 — `checkCredits` with `subscription_overage` Mode Has Wrong `denial_reason` Label
**File:** `server/quota.ts` lines 414–415
**Severity:** Medium
**Description:** When the subscription model is `subscription_overage` and the user has no active subscription, `denial_reason` is set to `"upgrade_required"` (line 414). But the routes (generate, edit, transcribe) map `"upgrade_required"` to the message "Your free generations have been used. Upgrade to a paid plan to continue." — which is semantically correct for credits_topup but misleading for subscription_overage users who may not need to "upgrade" but rather "subscribe". The `checkCredits` interface already has `"inactive_subscription"` as a valid denial_reason but it's never returned for the subscription_overage model.
**Suggested Fix:** Return `"inactive_subscription"` when `!hasActiveSubscription` in the `subscription_overage` branch.

---

### BUG-016 — `getAuthHeaders()` Silently Swallows All Errors
**File:** `client/src/lib/queryClient.ts` lines 36–48
**Severity:** Medium
**Description:** The `catch {}` in `getAuthHeaders()` swallows all errors silently. If the Supabase client fails to initialize (e.g. `/api/config` hasn't loaded yet), the function returns empty headers with no indication of failure. This means API requests will proceed without auth headers, get 401s, and the user sees cryptic "401" errors rather than a proper "loading" or "retry" state.
**Suggested Fix:** At minimum log the error: `catch (e) { console.warn("getAuthHeaders failed:", e); }`.

---

### BUG-017 — `queryClient.ts` `getQueryFn` Constructs URL by Joining Array With "/"
**File:** `client/src/lib/queryClient.ts` line 77
**Severity:** Medium
**Description:** `queryKey.join("/")` as the URL is fragile. TanStack Query keys are often arrays like `["/api/posts", { page: 1 }]`. Joining these with "/" would produce `/api/posts/[object Object]`. Any query that uses an object in the key will silently make a request to a wrong URL.
**Suggested Fix:** Use only `queryKey[0]` as the URL, or require callers to pass the URL as a separate option.

---

### BUG-018 — Expired Posts Cleanup Does Not Delete Version Thumbnails
**File:** `server/routes/posts.routes.ts` lines 781–799
**Severity:** Medium
**Description:** The cleanup endpoint fetches `post_versions.image_url` but not `post_versions.thumbnail_url`. Thumbnails for expired post versions are never cleaned up from storage, causing permanent orphaned files.
**Suggested Fix:** Also select and process `thumbnail_url` from `post_versions`.

---

### BUG-019 — `notifyTelegramOnSignup` Has No Rate Limiting or Deduplication
**File:** `client/src/lib/auth.tsx` lines 90–101
**Severity:** Medium (DDoS risk on Telegram integration)
**Description:** Beyond BUG-006 (called on every login), there is no server-side deduplication. If 1000 users log in simultaneously, 1000 concurrent Telegram requests will be fired. The server endpoint for `/api/telegram/notify-signup` should be idempotent and rate-limited, but nothing enforces this.

---

### BUG-020 — `fetchUserData` Race Condition: `setLoading(false)` Called Before All State Updates
**File:** `client/src/lib/auth.tsx` line 163
**Severity:** Medium
**Description:** `setLoading(false)` is called at the end of the `try` block in `fetchUserData`, but `setProfile` and `setBrand` are called inside the try/catch (lines 133, 153, 154). If an exception occurs after `setProfile` but before `setLoading(false)` in the `catch` path, `loading` remains `true` forever and the app shows a spinner indefinitely. The `finally` block should be used.
**Suggested Fix:**
```ts
} finally {
  setLoading(false);
}
```

---

### BUG-021 — `refreshProfile` Uses `.single()` Which Throws if No Row
**File:** `client/src/lib/auth.tsx` line 200
**Severity:** Medium
**Description:** `refreshProfile` uses `.single()` which throws a "406" Supabase error if no profile row exists, unlike the rest of the code which uses `.maybeSingle()`. This can crash the profile refresh silently in the catch that wraps it.
**Suggested Fix:** Use `.maybeSingle()`.

---

### BUG-022 — Stripe Webhook Uses `(req as any).rawBody` — Type Unsafe, May Be Undefined
**File:** `server/routes/stripe.routes.ts` line 28
**Severity:** Medium
**Description:** The raw body is cast via `(req as any).rawBody`. In `server/index.ts`, the `rawBody` is attached in the `verify` callback of `express.json()`. However, if the request body is not parsed by this middleware (e.g. a content-type mismatch), `rawBody` will be `undefined`, causing `stripe.webhooks.constructEvent()` to throw with an unhelpful error. The `IncomingMessage` type extension at line 15 types it as `unknown`, not `Buffer`.
**Suggested Fix:** Validate that `rawBody` is a `Buffer` before passing it to Stripe; respond with 400 if not.

---

## LOW

### BUG-023 — `extractToken` Accepts Any Request, But Is Typed as `AuthenticatedRequest`
**File:** `server/middleware/auth.middleware.ts` line 32
**Severity:** Low
**Description:** `extractToken` accepts `AuthenticatedRequest` but is called in contexts before the user is authenticated. This is a type mismatch that TypeScript lets through only because of the cast at the call sites. Should accept `Request`.

---

### BUG-024 — `sanitizeRequestForLogging` in `generate.routes.ts` Is Called Both Before and After `safeParse`
**File:** `server/routes/generate.routes.ts` lines 175, 228
**Severity:** Low
**Description:** `sanitizeRequestForLogging` is called on the raw `req.body` before Zod validation on line 175 (for auth errors), then on the validated `parseResult.data` indirectly on line 228. The pre-validation call uses the raw body function; the post-validation one is a manual object. This is inconsistent and the pre-validation object (lines 259–274) is built manually again. Consolidate to one sanitization path.

---

### BUG-025 — `DEFAULT_STYLE_CATALOG` Missing `video_generation` in `ai_models`
**File:** `shared/schema.ts` lines 342–346
**Severity:** Low
**Description:** The `aiModelsSchema` has a `video_generation` field with default `"veo-3.1-generate-preview"`, but the `DEFAULT_STYLE_CATALOG` constant does not set `video_generation` in the `ai_models` block. The Zod schema `.parse()` will apply the default, so at runtime it's populated, but any code that directly reads `DEFAULT_STYLE_CATALOG.ai_models.video_generation` without going through the schema will get `undefined`.

---

### BUG-026 — `isAcceptableCaption` Rejects Captions Under 80 Characters — May Cause Caption Loops
**File:** `server/routes/posts.routes.ts` line 42
**Severity:** Low
**Description:** The caption quality check function `isAcceptableCaption` rejects captions shorter than 80 characters. If the AI consistently returns short captions (e.g., for a minimal brand), this could trigger repeated re-generation in `ensureCaptionQuality` that never terminates within the function's logic. Verify `ensureCaptionQuality` has a maximum retry count.

---

### BUG-027 — `claimAffiliateReferralRequestSchema` Validates `ref` as UUID But Stored Refs May Be Non-UUID Codes
**File:** `shared/schema.ts` line 1046
**Severity:** Low
**Description:** `claimAffiliateReferralRequestSchema` validates `ref` as `z.string().uuid().optional()`. However, the affiliate referral code system supports alphanumeric codes (5-64 chars, per `affiliateReferralCodeRegex`). If the claim endpoint is called with a human-readable referral code (not a UUID), Zod will reject it with a validation error. The client must ensure it always sends a UUID, but the schema mismatch is a latent bug.

---

### BUG-028 — Admin `migrate-colors` Endpoint Uses `sb.rpc("exec", { sql: ... })`
**File:** `server/routes/admin.routes.ts` lines 1806–1808
**Severity:** Low
**Description:** Calling `sb.rpc("exec", { sql: "ALTER TABLE..." })` assumes a custom `exec` SQL function exists in the database. This function is not standard in Supabase. If it doesn't exist, the call will silently fail with a PostgREST error. The error is not surfaced to the admin — the response says "success: true" regardless (line 1820–1828).
**Suggested Fix:** The endpoint should use the Supabase management API or just return an instruction to run SQL manually — which the comment already does.

---

### BUG-029 — Client `AppContent` Does Not Handle Missing Profile (Only Missing Brand)
**File:** `client/src/App.tsx` lines 160–185
**Severity:** Low
**Description:** The auth flow guards for `!user` (redirect to login) and `!brand` (redirect to onboarding) but never checks `!profile`. If a user is authenticated and has a brand but `profile` is `null` (e.g. DB trigger failed and auto-create also failed), the app renders the full dashboard with `profile === null`, and any code that reads `profile.is_admin` will throw a runtime error.
**Suggested Fix:** Add a guard: if `user && !profile`, show a loading/error state.

---

### BUG-030 — `staleTime: Infinity` on All TanStack Queries
**File:** `client/src/lib/queryClient.ts` line 96
**Severity:** Low
**Description:** `staleTime: Infinity` means once data is fetched, it is never considered stale and never refetched automatically. This means if credits are purchased in one browser tab, another tab (or even the same tab after navigation) will show stale credit balances. Manual cache invalidation must be done on every mutation — if any is missed, users see incorrect data.
**Suggested Fix:** Use a reasonable stale time (e.g. 30–60 seconds) for user-facing financial data, or ensure all mutations explicitly call `queryClient.invalidateQueries`.


# Phase 2: Supabase Client Correctness - Research

**Researched:** 2026-04-20
**Domain:** Supabase client selection, storage mutation paths, RPC error handling
**Confidence:** HIGH

## User Constraints

- Research only; do not implement code changes.
- Favor surgical fixes over refactors.
- Verification should match repo reality: `npm run check` plus realistic manual verification.

## Project Constraints (from AGENTS.md)

- Use existing stack: Express 5, `@supabase/supabase-js`, TypeScript, Zod validation.
- Use `createServerSupabase(token)` for user-scoped operations and `createAdminSupabase()` for admin-only / RLS-bypassing operations.
- Keep all auth tokens in `Authorization: Bearer <token>`.
- Use Zod `safeParse` on request bodies.
- Do not change RLS policies for this phase; fix client usage in code.
- Do not commit secrets or `.env` files.
- Validate with `npm run check` before committing.

## Summary

Phase 2 is mostly three small wrong-client fixes plus one already-fixed quota item and one missing RPC error branch. The codebase already shows the intended pattern: user-scoped clients read user-owned rows under RLS, while storage uploads/deletes and admin-side mutations use `createAdminSupabase()` after authorization is established. The generate route and storage cleanup service are the clearest canonical examples.

The strongest surgical fixes are localized. In `server/routes/posts.routes.ts`, the version delete path already creates `adminSb` and uses it for adjacent mutations, but two calls still use the user-scoped `supabase` client. In `server/routes/edit.routes.ts`, the video upload path already uses `createAdminSupabase()`, but the image upload branch still uses the user-scoped storage client. In `server/routes/admin.routes.ts`, the `migrate-colors` endpoint captures `error1` from `.rpc("exec", ...)` and then ignores it, so failures can still return `success: true`.

One requirement is already satisfied in the current tree: `incrementQuickRemakeCount()` in `server/quota.ts` now uses a read-then-update flow with explicit error handling. Planning should treat `QUOT-01` as a validation/documentation item, not new implementation work, unless the planner also updates phase bookkeeping.

**Primary recommendation:** Make four code changes only: swap two mutation/storage calls in `posts.routes.ts` to `adminSb`, swap the image-edit storage client in `edit.routes.ts` to an admin client matching generate/video behavior, and add explicit `if (error1)` handling in `admin.routes.ts`; verify `QUOT-01` as already fixed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SBC-01 | Post version delete uses admin Supabase client | `server/routes/posts.routes.ts:567` should use existing `adminSb` from `server/routes/posts.routes.ts:507`; keep ownership/select reads on user client |
| SBC-02 | Storage cleanup after version delete uses admin Supabase client | `server/routes/posts.routes.ts:585` should use `adminSb.storage`, matching admin storage cleanup service |
| SBC-03 | Edit route image upload uses admin Supabase client consistent with generate route | `server/routes/edit.routes.ts:475`, `server/routes/edit.routes.ts:487`, `server/routes/edit.routes.ts:493`, and `server/routes/edit.routes.ts:500` should follow the admin upload pattern already used in `server/routes/edit.routes.ts:338` and `server/routes/generate.routes.ts:454` |
| QUOT-01 | `incrementQuickRemakeCount` uses valid Supabase JS update syntax with error handling | Already fixed in `server/quota.ts:628`; current function does read-then-update and throws on Supabase error |
| DATA-04 | Admin color-migration RPC call has error handling and does not silently succeed on failure | `server/routes/admin.routes.ts:1806` captures `error1` but never branches on it before returning success |
</phase_requirements>

## Locked Implementation Decisions

- **LD-01:** In `server/routes/posts.routes.ts`, change only the wrong mutation/storage call sites to `adminSb`; do not refactor the route or change the ownership verification reads that already use the user-scoped client.
- **LD-02:** In `server/routes/edit.routes.ts`, fix only the image-edit storage path. The database insert into `post_versions` stays user-scoped; the video upload path already proves the intended split: admin client for storage, user client for owned-row inserts.
- **LD-03:** In `server/routes/edit.routes.ts`, prefer the smallest alignment change: introduce/reuse an admin storage client in the image branch and swap the four `supabase.storage` usages. Do not convert the whole route to `authenticateUser()` or broader auth refactors in this phase.
- **LD-04:** In `server/routes/admin.routes.ts`, keep the endpoint and manual-SQL fallback note, but branch on `error1` immediately, log it, and return a failure response instead of `success: true`.
- **LD-05:** Treat `QUOT-01` as already implemented. Do not replace the current read-then-update with a new RPC just for this phase.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | project `^2.98.0`; npm latest `2.104.0` published 2026-04-20 | DB, auth, storage clients | Already central to all affected code paths |
| `express` | project `^5.0.1`; npm latest `5.2.1` published 2025-12-01 | Route handlers | Existing server framework |
| `typescript` | project `5.6.3`; npm latest `6.0.3` | Compile-time verification | `npm run check` is the real automated gate in this repo |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| local `server/supabase.ts` helpers | repo-local | Encodes user-scoped vs admin client selection | Use instead of ad hoc `createClient()` calls |
| local `server/storage.ts` helper | repo-local | Canonical upload helper that accepts a chosen Supabase client | Use as a pattern reference; no refactor required for this phase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Swapping the wrong client at call sites | Refactor whole routes around shared auth/storage helpers | Too large for a bug-fix phase; increases blast radius |
| Keeping read-then-update for quick remake count | New SQL RPC for atomic increment | Valid in principle, but unnecessary because current code already satisfies the requirement |
| Returning success after ignored RPC error | Replacing endpoint with management API/manual-only workflow | Overkill for this milestone; requirement only needs honest failure handling |

**Installation:** None required.

**Version verification:** Verified from npm registry on 2026-04-20 with `npm view`.

## Architecture Patterns

### Recommended Project Structure

```text
server/
├── supabase.ts          # user/admin client factories
├── routes/
│   ├── posts.routes.ts  # delete version flow
│   ├── edit.routes.ts   # edit upload flow
│   ├── generate.routes.ts
│   └── admin.routes.ts  # migrate-colors endpoint
├── services/
│   └── storage-cleanup.service.ts
└── quota.ts             # quick remake counter
```

### Pattern 1: Split Reads and Mutations by Trust Boundary

**What:** Use the user-scoped client for authenticated ownership reads; use the admin client only for mutations/storage operations that must bypass RLS after ownership/admin status is already proven.

**When to use:** Any route that first proves ownership/admin access and then performs writes or storage cleanup.

**Example:**
```typescript
// Source: direct codebase inspection (`server/routes/posts.routes.ts` + `server/routes/generate.routes.ts`)
const { data: post } = await supabase
  .from("posts")
  .select("id, user_id")
  .eq("id", postId)
  .single();

if (post?.user_id !== user.id) {
  return res.status(403).json({ message: "Access denied" });
}

const adminSb = createAdminSupabase();
await adminSb.from("post_versions").delete().eq("id", targetVersion.id);
await adminSb.storage.from("user_assets").remove(filesToDelete);
```

### Pattern 2: Keep Storage Client Choice Consistent Within a Media Flow

**What:** Once a route uses admin storage for one media branch, all equivalent storage writes in sibling branches should use the same trust pattern.

**When to use:** Multi-branch flows like generate/edit where image and video uploads should behave identically with respect to RLS.

**Example:**
```typescript
// Source: direct codebase inspection (`server/routes/edit.routes.ts:338`, `server/routes/generate.routes.ts:454`)
const adminSb = createAdminSupabase();
await adminSb.storage.from("user_assets").upload(fileName, optimizedImage.buffer, {
  contentType: "image/webp",
  upsert: false,
});

const { data: urlData } = adminSb.storage.from("user_assets").getPublicUrl(fileName);
```

### Pattern 3: Supabase RPC Calls Must Branch on Returned `error`

**What:** Supabase calls in this codebase consistently inspect `{ error }` and throw/return failure when present.

**When to use:** Every `.rpc(...)` that changes state or reports admin success.

**Example:**
```typescript
// Source: `server/quota.ts:524`, `server/stripe.ts:309`
const { error } = await sb.rpc("process_usage_deduction_tx", params);

if (error) {
  console.error("RPC Error:", error);
  throw new Error(error.message);
}
```

### Anti-Patterns to Avoid

- **Mixing client trust levels inside one mutation path:** makes only some branches fail under RLS.
- **Refactoring auth structure during this phase:** not needed to fix the five requirements.
- **Ignoring Supabase `error` values:** especially on `.rpc(...)`, which can fail without hitting the outer `catch`.
- **Changing policies instead of code:** explicitly out of scope in `REQUIREMENTS.md`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Storage permission bypass | Custom signed URL/delete workaround | `createAdminSupabase()` storage client | The repo already standardizes admin storage writes/deletes |
| Counter increment repair | Custom SQL string builder in JS | Existing read-then-update with error handling | Already implemented and type-safe in this codebase |
| RPC failure reporting | Generic success-with-note response | Explicit `if (error)` branch + log + failure response | Prevents silent admin false positives |

**Key insight:** The codebase already contains the correct patterns; the safest Phase 2 work is to reuse those patterns at the broken call sites instead of inventing new abstractions.

## Common Pitfalls

### Pitfall 1: Fixing only the DB delete but not the storage cleanup
**What goes wrong:** The version row deletes, but files remain orphaned in `user_assets`.
**Why it happens:** `server/routes/posts.routes.ts` has two separate wrong-client calls in the same flow.
**How to avoid:** Treat `server/routes/posts.routes.ts:567` and `server/routes/posts.routes.ts:585` as a pair.
**Warning signs:** API returns success but storage cleanup logs `Failed to delete version files`.

### Pitfall 2: Converting the whole edit route to admin writes
**What goes wrong:** The fix becomes a refactor and can widen privilege scope unnecessarily.
**Why it happens:** The image branch has several `supabase` calls close together.
**How to avoid:** Change only storage upload/public URL calls in `server/routes/edit.routes.ts`; keep owned-row reads/inserts on the existing user client.
**Warning signs:** Planner starts touching unrelated auth/profile logic in `edit.routes.ts`.

### Pitfall 3: Trusting the outer `try/catch` to catch RPC failure
**What goes wrong:** `migrate-colors` still returns `success: true` even though `error1` is populated.
**Why it happens:** Supabase returns `{ error }`; it does not need to throw for failure to occur.
**How to avoid:** Add an immediate branch on `error1` before the success response.
**Warning signs:** Logs show PostgREST error text while the HTTP response says success.

### Pitfall 4: Re-implementing QUOT-01
**What goes wrong:** Work is duplicated on a function that already satisfies the requirement.
**Why it happens:** Planning docs still mark `QUOT-01` pending.
**How to avoid:** Start by validating `server/quota.ts:628` and update documentation/phase bookkeeping as needed.
**Warning signs:** Proposed plan includes a new RPC or another rewrite of `incrementQuickRemakeCount()`.

## Code Examples

Verified repo patterns to copy directly:

### Admin storage upload pattern

```typescript
// Source: `server/routes/generate.routes.ts:454`
const sb = createAdminSupabase();

imageUrl = await uploadFile(
  sb,
  "user_assets",
  `${user.id}/${postId}.webp`,
  optimizedImage.buffer,
  "image/webp"
);
```

### Admin storage cleanup pattern

```typescript
// Source: `server/services/storage-cleanup.service.ts:34`
const supabase = createAdminSupabase();

const { error: deleteError } = await supabase.storage
  .from("user_assets")
  .remove(filesToDelete);
```

### RPC error handling pattern

```typescript
// Source: `server/stripe.ts:309`
const { error } = await sb.rpc("apply_credit_purchase_tx", params);

if (error) {
  console.error("RPC Error in applyCreditPurchase:", error);
  throw new Error(`Failed to apply credit purchase: ${error.message}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mixed user/admin clients inside one mutation flow | Consistent split: user client for ownership reads, admin client for storage/admin-side writes | Already established in current repo | Minimizes RLS surprises without broad refactors |
| Invalid `sb.raw()` increment idea | Plain Supabase `.update()` with explicit error handling | Already fixed in current tree | `QUOT-01` is no longer an implementation blocker |

**Deprecated/outdated:**
- Using user-scoped storage writes in the edit image path is inconsistent with the repo's current canonical upload pattern.

## Open Questions

1. **Why does the audit say `post_versions` delete lacks RLS while `supabase-setup.sql` includes a delete policy?**
   - What we know: `supabase-setup.sql:231` defines `Users can delete versions of own posts`, but the roadmap, audit, and inline route comment all say admin client is required.
   - What's unclear: whether live Supabase policies drifted from the checked-in setup SQL, or whether storage RLS was the real production failure.
   - Recommendation: Keep the code-side admin client fix anyway; it matches the route's own mutation pattern and avoids depending on policy drift.

2. **Should `migrate-colors` return 500 or 400 on `error1`?**
   - What we know: this is an admin maintenance route, and failure is server-side.
   - What's unclear: whether the UI expects a specific non-200 code.
   - Recommendation: Return 500 with the existing manual-SQL note; keep response shape close to current behavior.

## Environment Availability

Step 2.6: SKIPPED — this phase is code-only and depends only on the existing Node/npm toolchain already present in the workspace.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | none |
| Quick run command | `npm run check` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SBC-01 | Version delete uses admin client for DB delete | manual smoke | `npm run check` | ❌ Wave 0 |
| SBC-02 | Version delete uses admin client for storage cleanup | manual smoke | `npm run check` | ❌ Wave 0 |
| SBC-03 | Edit image upload uses admin storage client | manual smoke | `npm run check` | ❌ Wave 0 |
| QUOT-01 | Quick remake counter update compiles and throws on error | type/manual verification | `npm run check` | ❌ Wave 0 |
| DATA-04 | Color migration reports RPC failure honestly | manual smoke | `npm run check` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` plus manual verification of the three affected routes

### Wave 0 Gaps

- [ ] No test runner exists for route-level assertions; use manual API verification.
- [ ] Manual smoke for version delete: delete a non-original version and confirm both DB row and storage objects are removed.
- [ ] Manual smoke for edit upload: edit an image post and confirm new image + thumbnail upload succeeds.
- [ ] Manual smoke for admin migration: force/observe an RPC failure and confirm non-success response plus logged error.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `server/routes/posts.routes.ts` - wrong-client delete and storage cleanup confirmed
- Direct codebase inspection: `server/routes/edit.routes.ts` - image branch storage uses wrong client while video branch already uses admin client
- Direct codebase inspection: `server/routes/generate.routes.ts` - canonical admin storage upload pattern
- Direct codebase inspection: `server/routes/admin.routes.ts` - ignored `error1` confirmed
- Direct codebase inspection: `server/quota.ts` - `QUOT-01` already fixed in current tree
- Direct codebase inspection: `server/services/storage-cleanup.service.ts` - canonical admin storage delete pattern
- Supabase official docs: `https://supabase.com/docs/guides/api/api-keys` - service-role keys bypass RLS and are backend-only

### Secondary (MEDIUM confidence)

- Direct repo policy file: `supabase-setup.sql` - shows `post_versions` delete policy, which conflicts with audit/roadmap assumptions and suggests live-policy drift or stale setup SQL

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies and versions verified from `package.json`/npm
- Architecture: HIGH - correct patterns already exist in adjacent code paths in the same repo
- Pitfalls: MEDIUM - one important policy-vs-audit contradiction remains unresolved, but it does not change the recommended surgical fixes

**Research date:** 2026-04-20
**Valid until:** 2026-05-20

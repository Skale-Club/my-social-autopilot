# Phase 3: Data Integrity & Business Logic - Research

**Researched:** 2026-04-20
**Domain:** Post edit data sources, storage cleanup completeness, admin query scale limits, Gemini API key selection
**Confidence:** HIGH

## User Constraints

- Research only; do not implement code changes.
- Favor surgical fixes over refactors.
- Verification strategy should fit repo reality: `npm run check` plus realistic manual verification.

## Project Constraints (from AGENTS.md)

- Keep the existing stack: Express 5, Supabase, TypeScript, Zod.
- Use `createServerSupabase(token)` for user-scoped operations and `createAdminSupabase()` for admin-only / RLS-bypassing operations.
- Keep auth tokens in `Authorization: Bearer <token>`.
- Use Zod `safeParse` for request-body validation.
- Do not solve this phase with schema migrations; `REQUIREMENTS.md` marks DB schema changes out of scope for this milestone.
- Do not change Supabase RLS policies for this phase.
- Do not commit secrets or `.env` files.
- Validate with `npm run check` before committing.

## Summary

Phase 3 is still a surgical server-side phase. Three of the four requirements land in already-known hot spots: `server/routes/edit.routes.ts`, `server/routes/posts.routes.ts`, and `server/routes/admin.routes.ts`. The codebase already shows the intended patterns nearby, so the safest plan is to align the broken branches with those patterns instead of introducing new abstractions.

The strongest code-implied decisions are: derive video edit aspect ratio from already-persisted prompt data instead of adding a new DB column; finish thumbnail cleanup in the remaining admin cleanup path instead of reworking delete flows that already remove version thumbnails; add explicit high `.limit(...)` guards to the current in-memory admin queries because the frontend expects full arrays and v2 already reserves true aggregation/pagination work as `PERF-01`; and collapse edit-route API key selection onto the shared middleware helper pattern used by generate.

`DATA-02` deserves one nuance: the direct version-delete path already removes `targetVersion.thumbnail_url`, so the remaining orphan-thumbnail bug is the expired-post cleanup branch, not the user delete branch. Planning should treat that as the last incomplete cleanup edge, not rewrite the whole delete route.

**Primary recommendation:** Make four narrow fixes only: parse preserved aspect ratio for video edits from existing stored prompt data, extend expired cleanup to include `post_versions.thumbnail_url`, add explicit high limits to the two admin aggregation endpoints, and deduplicate edit-route Gemini API key selection around the existing auth helper path.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Post edit correctly reads `aspect_ratio` from the appropriate source | `server/routes/edit.routes.ts:326` currently reads a nonexistent `post.aspect_ratio`; the durable source already available in-repo is `posts.ai_prompt_used` written by `server/routes/generate.routes.ts:638` and containing the original generated prompt text with the ratio embedded |
| DATA-02 | Post version delete removes thumbnail files as well as primary image files | Direct delete already removes `targetVersion.thumbnail_url` in `server/routes/posts.routes.ts:577-587`; the remaining orphan-thumbnail path is expired cleanup at `server/routes/posts.routes.ts:771-786`, which selects only `image_url` from `post_versions` |
| DATA-03 | Admin stats and users queries include `.limit()` calls to handle tables exceeding 1000 rows correctly | `server/routes/admin.routes.ts:264-280` and `server/routes/admin.routes.ts:569-597` fetch large tables with no limit while the frontend still expects non-paginated response shapes |
| DATA-05 | Edit route `usesOwnApiKey` logic is deduplicated with one consistent check path | `server/routes/edit.routes.ts:135-162` duplicates ownership/API-key checks and diverges from the canonical generate pattern in `server/routes/generate.routes.ts:190-202` using `usesOwnApiKey()` + `getGeminiApiKey()` |
</phase_requirements>

## Locked Implementation Decisions

- **LD-01:** Do not add an `aspect_ratio` column in this milestone. `REQUIREMENTS.md` says schema migrations are out of scope, and the current repo already persists enough prompt text to recover the ratio for edits.
- **LD-02:** For `DATA-01`, fix only the video edit read path in `server/routes/edit.routes.ts`; keep the rest of the edit flow unchanged. The smallest correct source is `post.ai_prompt_used`, not a new table or a large prompt-history refactor.
- **LD-03:** For `DATA-01`, normalize any recovered video ratio to the same two-value Veo contract already enforced in `server/services/video-generation.service.ts:39-40` (`9:16` or `16:9`), with `9:16` as the fallback if parsing fails.
- **LD-04:** For `DATA-02`, do not rewrite the user version-delete route. The specific-version branch already queues both image and thumbnail paths; the missing cleanup is the expired-post cleanup query and storage path list.
- **LD-05:** For `DATA-03`, keep the current response shapes and in-memory calculations. Add explicit high `.limit(...)` calls to the existing table reads instead of introducing pagination or SQL aggregation in this phase.
- **LD-06:** For `DATA-03`, use one shared ceiling across the affected admin selects so behavior stays predictable. `5000` is the safest surgical cap: it clears Supabase's default 1000-row truncation without forcing immediate frontend pagination work.
- **LD-07:** For `DATA-05`, the canonical path is the generate route: compute `ownApiKey` once with `usesOwnApiKey(profile)` and derive the selected key from the shared helper path, not from route-local duplicate `if` blocks.
- **LD-08:** Keep `DATA-05` scoped to edit. `transcribe.routes.ts` still has similar duplication, but Phase 3 requirements only require deduping the edit route.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | project `^2.98.0`; npm latest `2.104.0` published 2026-04-20 | DB and storage access | All affected paths already use Supabase clients directly |
| `express` | project `^5.0.1`; npm latest `5.2.1` published 2025-12-01 | Route handling | Existing server framework for every Phase 3 change |
| `typescript` | project `5.6.3`; npm latest `6.0.3` | Compile-time verification | `npm run check` is the real automated gate in this repo |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| local `server/middleware/auth.middleware.ts` helpers | repo-local | Shared API-key and auth decisions | Use when a route needs user-scoped Gemini key selection |
| local `server/services/video-generation.service.ts` | repo-local | Canonical video aspect-ratio normalization | Use as the contract for recovered video ratios |
| local `server/routes/posts.routes.ts` helpers | repo-local | Existing prompt-field extraction and storage path extraction | Reuse the same small helper style rather than introducing new parsing subsystems |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recovering aspect ratio from existing stored prompt text | Add a new `posts.aspect_ratio` column | Cleaner long-term, but blocked by milestone scope and requires migration/backfill |
| Adding explicit high limits to admin selects | Introduce server pagination or SQL aggregates now | More scalable, but would require response-shape and frontend changes; already deferred as `PERF-01` |
| Using the shared auth helper path in edit | Keep local duplicated `if` branches | Smaller diff count, but preserves inconsistent logic and messages |

**Installation:** None required.

**Version verification:** Verified from npm registry on 2026-04-20 with `npm view`.

## Architecture Patterns

### Recommended Project Structure

```text
server/
├── middleware/
│   └── auth.middleware.ts   # shared own-key and Gemini key selection helpers
├── routes/
│   ├── edit.routes.ts       # edit flow and video aspect-ratio recovery
│   ├── posts.routes.ts      # version cleanup and expired cleanup
│   ├── admin.routes.ts      # stats and users endpoints
│   └── generate.routes.ts   # canonical Gemini key + prompt persistence pattern
└── services/
    └── video-generation.service.ts  # accepted video aspect-ratio contract
```

### Pattern 1: Recover Missing Derived Data From Existing Persisted Context

**What:** When a derived field is not stored as a dedicated column, recover it from already-persisted context that is stable and local to the same record.

**When to use:** Bug-fix phases where schema work is out of scope but the required value was already serialized elsewhere.

**Example:**
```typescript
// Source: direct codebase inspection (`server/routes/generate.routes.ts:638-655`)
ai_prompt_used: [
  `Image prompt: ${textResult.content.image_prompt}`,
  textResult.content.creative_plan?.scenario_type
    ? `Scenario: ${textResult.content.creative_plan.scenario_type}`
    : "",
].filter(Boolean).join("\n")
```

### Pattern 2: Finish Cleanup by Following Every Stored Media URL Variant

**What:** Any route that deletes media-backed rows must collect both `image_url` and `thumbnail_url` for every relevant record type.

**When to use:** Version deletes, expired cleanup, and any storage garbage-collection path.

**Example:**
```typescript
// Source: direct codebase inspection (`server/routes/posts.routes.ts:577-587`)
const imgPath = extractPathFromUrl(targetVersion.image_url);
if (imgPath) filesToDelete.push(imgPath);
const thumbPath = extractPathFromUrl(targetVersion.thumbnail_url);
if (thumbPath) filesToDelete.push(thumbPath);
```

### Pattern 3: Preserve Existing Admin Response Shapes During Bug-Fix Scaling Work

**What:** If the frontend expects full arrays and does its own filtering/sorting, add explicit query bounds first instead of changing transport contracts mid-milestone.

**When to use:** Admin reads that currently materialize full datasets in memory.

**Example:**
```typescript
// Source: direct codebase inspection (`client/src/components/admin/users-tab.tsx:46-49`)
const { data: usersData } = useQuery<{ users: AdminUser[] }>({
  queryKey: ["/api/admin/users"],
  queryFn: () => adminFetch("/api/admin/users"),
});
```

### Pattern 4: Centralize Gemini API-Key Selection

**What:** Decide once whether a user must supply their own Gemini key, then derive the actual key from the shared helper path.

**When to use:** Generate/edit/transcribe routes that gate billing and Gemini access on admin/affiliate status.

**Example:**
```typescript
// Source: direct codebase inspection (`server/routes/generate.routes.ts:190-202`)
const ownApiKey = usesOwnApiKey(profile);
const { key: geminiApiKey, error: keyError } = await getGeminiApiKey(profile);
if (keyError) {
  return res.status(400).json({ message: keyError });
}
```

### Anti-Patterns to Avoid

- **Adding schema work for one bug:** the roadmap explicitly excludes schema migrations in this milestone.
- **Fixing only one cleanup path:** direct delete and expired cleanup must both be considered before claiming thumbnails are fully cleaned up.
- **Switching admin endpoints to pagination without frontend changes:** `users-tab.tsx` and `dashboard-tab.tsx` currently expect existing response shapes.
- **Keeping route-local API key branches:** they already drifted into duplicate checks and conflicting copy in `edit.routes.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video aspect-ratio persistence | New ad hoc prompt-history store | Existing `ai_prompt_used` payload + current Veo ratio normalization | The source data already exists and the accepted output domain is tiny |
| Admin query scale fix | New admin repository layer | Explicit `.limit(...)` on existing Supabase selects | Lowest-risk fix that matches current frontend contracts |
| Gemini key selection in edit | Another custom route-local decision tree | `usesOwnApiKey()` and shared Gemini key helper path | Generate already establishes the intended behavior |

**Key insight:** Phase 3 does not need new infrastructure. The repo already contains the right patterns; the work is to point the broken branches at them.

## Common Pitfalls

### Pitfall 1: Parsing aspect ratio from the wrong place
**What goes wrong:** Video edits still fall back to `9:16` even after the fix.
**Why it happens:** `posts` has no `aspect_ratio` column, and not every string field reliably contains the original ratio.
**How to avoid:** Parse only from the persisted prompt text already written at post creation, then normalize to the Veo-supported two-value contract.
**Warning signs:** A previously landscape video edit regenerates as portrait.

### Pitfall 2: Declaring thumbnail cleanup fixed too early
**What goes wrong:** Manual version delete works, but scheduled/admin cleanup still leaves `thumbnails/versions/*` objects behind.
**Why it happens:** There are multiple cleanup paths in `posts.routes.ts`, and only one of them currently fetches version thumbnails.
**How to avoid:** Audit both the direct delete branch and the expired cleanup branch together.
**Warning signs:** Storage object counts keep growing after expired-post cleanup succeeds.

### Pitfall 3: Replacing truncation with a bigger silent truncation
**What goes wrong:** `.limit(2000)` works for a while, then stats silently go wrong again.
**Why it happens:** The current endpoints compute totals in memory from fetched rows, so the chosen cap directly affects correctness.
**How to avoid:** Pick one clearly documented higher cap for this milestone and call out `PERF-01` as the true long-term solution.
**Warning signs:** Admin totals disagree with Supabase table counts after growth.

### Pitfall 4: Using the helper path but shipping the wrong user-facing copy
**What goes wrong:** Edit failures say "before generating" or still produce two different missing-key messages.
**Why it happens:** The current helper wording is generate-oriented while `edit.routes.ts` currently hard-codes two separate messages.
**How to avoid:** Ensure the final edit path emits one message only, even if that requires a tiny helper-copy adjustment.
**Warning signs:** Admin and affiliate edit failures return different 400 messages for the same missing `api_key` condition.

## Code Examples

Verified repo patterns to copy directly:

### Prompt field extraction pattern

```typescript
// Source: `server/routes/posts.routes.ts:18-21`
function extractPromptField(prompt: string | null | undefined, fieldLabel: string): string | null {
  if (!prompt) return null;
  const match = prompt.match(new RegExp(`^${fieldLabel}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() || null;
}
```

### Direct version thumbnail cleanup pattern

```typescript
// Source: `server/routes/posts.routes.ts:577-587`
const imgPath = extractPathFromUrl(targetVersion.image_url);
if (imgPath) filesToDelete.push(imgPath);
const thumbPath = extractPathFromUrl(targetVersion.thumbnail_url);
if (thumbPath) filesToDelete.push(thumbPath);

await adminSb.storage.from("user_assets").remove(filesToDelete);
```

### Shared Gemini key selection pattern

```typescript
// Source: `server/routes/generate.routes.ts:190-202`
const ownApiKey = usesOwnApiKey(profile);
const { key: geminiApiKey, error: keyError } = await getGeminiApiKey(profile);
if (keyError) {
  return res.status(400).json({ message: keyError });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Assume missing derived data needs a new column | Recover from persisted request/prompt context when schema work is intentionally deferred | Current bug-fix milestone | Keeps fixes surgical and migration-free |
| Unbounded admin scans that depend on implicit platform defaults | Explicit bounded selects, then later true aggregation/pagination | `PERF-01` deferred to v2 | Removes the 1000-row silent failure mode now |

**Deprecated/outdated:**
- Treating `post.aspect_ratio` as a stored column is incorrect in the current schema.
- Treating direct delete as the only cleanup path misses the remaining expired-thumbnail leak.

## Open Questions

1. **Should the recovered video ratio come from `Image prompt:` parsing or a dedicated helper that scans the whole `ai_prompt_used` blob?**
   - What we know: `generate.routes.ts` writes the ratio into the first persisted prompt line for generated posts.
   - What's unclear: whether all historic rows follow the same wording exactly.
   - Recommendation: implement a tolerant parser that looks for `9:16` or `16:9` anywhere in `ai_prompt_used`, not a brittle full-sentence match.

2. **What exact high limit should Phase 3 use for admin reads?**
   - What we know: any explicit cap above 1000 fixes the immediate silent truncation bug, and the frontend currently expects full non-paginated payloads.
   - What's unclear: expected near-term data volume in production.
   - Recommendation: standardize on `5000` for this milestone and document that `PERF-01` replaces it with real aggregation/pagination later.

3. **Should the shared Gemini helper message become operation-neutral?**
   - What we know: `getGeminiApiKey()` currently says "before generating," while Phase 3 wants one consistent edit-route message.
   - What's unclear: whether changing shared helper copy now is acceptable for generate consumers.
   - Recommendation: prefer operation-neutral helper copy if the planner wants strict single-path reuse; otherwise keep helper logic and map only the missing-own-key error text in edit.

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
| DATA-01 | Video edit reuses the original aspect ratio instead of assuming a missing DB column | manual smoke + typecheck | `npm run check` | ❌ Wave 0 |
| DATA-02 | Cleanup removes version thumbnails as well as primary media | manual smoke + typecheck | `npm run check` | ❌ Wave 0 |
| DATA-03 | Admin stats/users are not silently capped at 1000 rows by default behavior | manual smoke + typecheck | `npm run check` | ❌ Wave 0 |
| DATA-05 | Edit route performs one own-key decision path and emits one missing-key message | manual smoke + typecheck | `npm run check` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` plus targeted manual verification of edit, cleanup, and admin endpoints

### Wave 0 Gaps

- [ ] No automated route tests exist for edit, cleanup, or admin query behavior; rely on manual API verification.
- [ ] Manual smoke for `DATA-01`: edit one portrait video and one landscape video; confirm returned media keeps the original ratio.
- [ ] Manual smoke for `DATA-02`: run expired-post cleanup against a fixture post with version thumbnails and confirm both main and thumbnail storage objects are removed.
- [ ] Manual smoke for `DATA-03`: verify admin stats/users on a dataset exceeding 1000 rows, or seed enough rows locally to prove no silent truncation.
- [ ] Manual smoke for `DATA-05`: edit as admin/affiliate without `api_key` and confirm one consistent 400 message; edit again with a key and confirm the route proceeds.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `server/routes/edit.routes.ts` - broken aspect-ratio read and duplicated Gemini key logic confirmed
- Direct codebase inspection: `server/routes/generate.routes.ts` - canonical prompt persistence and shared Gemini key helper usage confirmed
- Direct codebase inspection: `server/routes/posts.routes.ts` - direct delete already handles thumbnails; expired cleanup still misses version thumbnails
- Direct codebase inspection: `server/routes/admin.routes.ts` - stats/users endpoints fetch large datasets without explicit limits
- Direct codebase inspection: `client/src/components/admin/users-tab.tsx` - users endpoint is consumed as a full array with client-side filtering/sorting
- Direct codebase inspection: `client/src/components/admin/dashboard-tab.tsx` - stats endpoint is consumed with current non-paginated shape
- Direct codebase inspection: `server/services/video-generation.service.ts` - accepted video aspect-ratio contract is only `9:16` or `16:9`
- Supabase official docs: `https://supabase.com/docs/guides/api/api-keys` - service-role keys bypass RLS and are backend-only

### Secondary (MEDIUM confidence)

- Direct roadmap/requirements linkage: `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` - confirms no schema migrations in this milestone and reserves true admin scaling work for later via `PERF-01`

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies and versions verified from `package.json`/npm
- Architecture: HIGH - all recommended fixes align with patterns already present in adjacent repo code
- Pitfalls: MEDIUM - `DATA-02` wording lags the actual remaining bug location, but the code path needing work is clear

**Research date:** 2026-04-20
**Valid until:** 2026-05-20

# Production cron architecture

> Authored 2026-05-08 alongside Phase 14 of v1.2 milestone. Lives forever in the repo as the source of truth for how scheduled jobs run in production across Vercel (today) and Hetzner (future).

## What runs on a schedule

Three destructive scheduled jobs:

| Job | Cadence | What it does | Function |
|---|---|---|---|
| **Trash sweep** | every 6h | Soft-delete posts past `expires_at` (sets `trashed_at = now()`) | `runTrashSweep()` in `server/services/cleanup-cron.service.ts` |
| **Purge sweep** | every 6h (offset 30m) | Permanently delete posts trashed > 30 days. Storage objects deleted BEFORE DB rows (orphan-prevention contract) | `runPurgeSweep()` in `server/services/cleanup-cron.service.ts` |
| **Overage billing batch** | weekly, Sundays 00:00 UTC | Stripe-invoice accrued overage from `user_billing_profiles.pending_overage_micros` | `runOverageBillingBatch()` in `server/stripe.ts` |

These jobs were defined in Phase 11 + Phase 12. Phase 14 added the HTTP-trigger path because Vercel's serverless model can't host long-running `node-cron`.

## Two trigger paths in one codebase

The same three functions are invoked by either path:

```
                                                         ┌──────────────────┐
                                                         │  runTrashSweep   │
                                                         │  runPurgeSweep   │
                                                         │  runOverageBatch │
                                                         └────────▲─────────┘
                                                                  │
        ┌─────────────────────────┐                                │
        │  Path A — HTTP triggers │  ───── invokes via API ───────┤
        │  (Vercel, today)        │                                │
        │                         │                                │
        │  GitHub Actions cron    │                                │
        │      ↓ curl POST        │                                │
        │  /api/internal/...      │                                │
        │  (requireCronSecret)    │                                │
        └─────────────────────────┘                                │
                                                                   │
        ┌─────────────────────────┐                                │
        │  Path B — node-cron     │  ───── invokes directly ──────┘
        │  (Hetzner, future)      │
        │                         │
        │  startCronJobs() in     │
        │  server/index.ts:       │
        │  httpServer.listen      │
        └─────────────────────────┘
```

## Path A: HTTP triggers via GitHub Actions (current Vercel deploy)

### Why

- Vercel serverless functions don't host long-running processes → `node-cron`'s internal `setTimeout` never fires.
- Vercel Cron Jobs (Hobby tier) is limited to once-daily firing → would degrade the 6h cadence.
- GitHub Actions schedule is free (within 2000 min/month for private repos), supports any cadence.

### Endpoints (all `POST`, all `requireCronSecret`)

| Endpoint | Invokes | Body | Response on success |
|---|---|---|---|
| `/api/internal/cleanup/trash` | `runTrashSweep()` | `{}` | `{ok:true, trigger:"http", duration_ms, result:{swept:N}}` |
| `/api/internal/cleanup/purge` | `runPurgeSweep()` | `{}` | `{ok:true, trigger:"http", duration_ms, result:{purged:N}}` |
| `/api/internal/billing/run-overage-batch` | `runOverageBillingBatch()` | `{}` | `{ok:true, trigger:"http", duration_ms, result:{processed,charged,skipped}}` |

Auth header: `Authorization: Bearer ${CRON_SECRET}` (verified via `crypto.timingSafeEqual` in `server/middleware/cron-auth.middleware.ts`).

Failure modes:
- Missing/wrong header → `401 {"error":"unauthorized"}`
- `CRON_SECRET` env unset → `503 {"error":"cron_not_configured"}` (signals config gap, not auth fail)
- Internal exception → `500 {"error":"internal_error", "message": "..."}`

### Setup (one-time, on Vercel)

1. Generate a strong secret:
   ```bash
   openssl rand -hex 32
   ```

2. Add to Vercel project env (Settings → Environment Variables → Production scope):
   ```
   CRON_SECRET=<the-64-char-hex-string>
   ```
   Trigger a redeploy (Vercel needs the env var available at function execution time).

   **CLI shortcut (gotcha included):**
   ```bash
   # CORRECT — printf prevents trailing newline that breaks timingSafeEqual:
   printf "%s" "$CRON_SECRET" | vercel env add CRON_SECRET production
   vercel --prod   # redeploy so the env var propagates

   # WRONG — adds \n to the env value, causes silent 401s:
   # echo "$CRON_SECRET" | vercel env add CRON_SECRET production
   ```
   The `echo` form was tried first when shipping Phase 14 and produced 401s with the correct secret because the stored env had a trailing newline that the `Authorization: Bearer ...` header didn't include — `timingSafeEqual` compared 65 bytes vs 64 and rejected.

3. Add to GitHub repo secrets (Settings → Secrets and variables → Actions → New repository secret):
   ```
   PROD_BASE_URL = https://your-vercel-domain.com
   CRON_SECRET   = <same-value-as-Vercel>
   ```

4. **Smoke test** before relying on the schedule:
   - Go to Actions tab → "Production cleanup crons" workflow → "Run workflow" (workflow_dispatch trigger)
   - Watch the run logs; expect HTTP 200 from each step
   - Verify in Supabase: spot-check `posts.trashed_at` populated for past-due rows, etc.

5. **Confirm scheduled fires** the next day:
   - Actions tab shows scheduled runs at the configured cadence
   - GitHub Actions schedule is best-effort (can run 5–15 min late under load); acceptable for cleanup ops

### Workflow file: `.github/workflows/cron.yml`

```yaml
name: Production cleanup crons
on:
  schedule:
    - cron: '0 */6 * * *'   # cleanup sweep every 6h
    - cron: '0 0 * * 0'     # overage batch weekly Sunday 00:00 UTC
  workflow_dispatch: {}      # manual trigger for testing

jobs:
  cleanup-sweep:
    if: github.event.schedule == '0 */6 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger trash sweep
        run: |
          set -euo pipefail
          curl -fsS -X POST "${{ secrets.PROD_BASE_URL }}/api/internal/cleanup/trash" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            --max-time 295 \
            -w "\n[HTTP %{http_code}] %{time_total}s\n"
      - name: Trigger purge sweep
        run: |
          set -euo pipefail
          curl -fsS -X POST "${{ secrets.PROD_BASE_URL }}/api/internal/cleanup/purge" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            --max-time 295 \
            -w "\n[HTTP %{http_code}] %{time_total}s\n"

  overage-batch:
    if: github.event.schedule == '0 0 * * 0' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger overage batch
        run: |
          set -euo pipefail
          curl -fsS -X POST "${{ secrets.PROD_BASE_URL }}/api/internal/billing/run-overage-batch" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            --max-time 295 \
            -w "\n[HTTP %{http_code}] %{time_total}s\n"
```

`--max-time 295` matches Vercel's 300s `maxDuration` cap with 5s slack.

## Path B: Internal `node-cron` (Hetzner / future, or any long-running Node host)

### Why

- Long-running Node processes (Hetzner VPS, Railway, Render, Fly.io) host `node-cron` natively
- No external dependency, no extra workflow file, no GitHub Actions quota concerns
- Already implemented and tested in Phase 11 + 12 — preserved intact during Phase 14

### How it works

`server/index.ts` (the entry point invoked by `npm run start`) calls `startCronJobs()` inside the `httpServer.listen` callback:

```typescript
httpServer.listen(port, "0.0.0.0", () => {
  log(`serving on port ${port}`);
  startCronJobs();
});
```

`startCronJobs()` (in `server/services/cleanup-cron.service.ts`) registers three `cron.schedule(...)` blocks for trash sweep, purge sweep, and overage batch.

### Migration: Vercel → Hetzner

When you eventually move off Vercel:

1. Deploy app on Hetzner via existing `deploy/hetzner/deploy.sh` toolchain (see [docs/deployment-hetzner.md](deployment-hetzner.md))

2. Set `CRON_SECRET` in the Hetzner `.env` (same value or new — used by HTTP triggers as escape hatch)

3. **Decide trigger model:**

   **Option A — Exclusive internal scheduler (recommended):**
   - Disable GitHub Actions workflow: rename `.github/workflows/cron.yml` to `.github/workflows/cron.yml.disabled`, OR comment out the `schedule:` keys (keep `workflow_dispatch:` so you can still test manually).
   - `node-cron` in `startCronJobs()` handles all three jobs at server boot.
   - Single source of truth, no cross-process race risk.

   **Option B — Redundancy (both paths active):**
   - Keep GitHub Actions schedule + internal `node-cron` running.
   - Update `PROD_BASE_URL` GH secret to the new Hetzner domain.
   - **Risk**: cross-process double-trigger possible. The in-process `overageBatchRunning` lock prevents same-process double-charge but NOT cross-host. Without DB-backed locks (out of scope for v1.2), running both is risky for billing operations.
   - **Not recommended** unless you add a DB-backed lock first.

4. **Smoke test on Hetzner:**
   ```bash
   pm2 logs xareable | grep "[Cron]"
   ```
   Expect on boot:
   ```
   [Cron] Jobs registered: trash-sweep (every 6h), purge-sweep (every 6h +30m), overage-batch (...)
   ```

   Then wait for first scheduled fire (or trigger manually via the HTTP endpoint).

## Coexistence rules (when both paths could fire)

If both paths are accidentally active (e.g. you deployed to Hetzner but forgot to disable GitHub Actions):

- **Same-process double-trigger**: prevented by `overageBatchRunning` boolean lock in `cleanup-cron.service.ts`. The trash and purge sweeps are idempotent in semantics (UPDATE `WHERE trashed_at IS NULL`, DELETE `WHERE trashed_at < cutoff` etc.) so double-firing is wasteful but not harmful.

- **Cross-process double-trigger** (e.g. GitHub Actions + Hetzner internal cron firing simultaneously): the in-process lock does NOT protect across hosts. For billing specifically, this could cause double-invoicing. **Either:**
  - Disable one path before deploying the other
  - Add a DB-backed lock (Postgres advisory lock or `cron_locks` table) — out of scope for v1.2; revisit when scaling beyond single deployment

## Local development

`npm run dev` runs `tsx server/index.ts`, which calls `startCronJobs()`. Practical impact: zero, because dev sessions rarely run long enough for the 6h timer to fire. If you want to test triggers manually:

```bash
# Set CRON_SECRET=dev-secret in .env first
curl -X POST http://localhost:8888/api/internal/cleanup/trash \
  -H "Authorization: Bearer dev-secret"
```

## Verification

The `scripts/verify-cron-jobs.ts` harness (Phase 15) seeds an isolated test user, invokes each cron function directly, and asserts observable side effects. Run on demand:

```bash
npx tsx scripts/verify-cron-jobs.ts
```

It tests the **functions themselves** — both trigger paths (HTTP via GH Actions / internal via `node-cron`) merely invoke the same function, so verifying the function suffices.

## Related code

- `server/middleware/cron-auth.middleware.ts` — `requireCronSecret`
- `server/routes/internal-cron.routes.ts` — three HTTP endpoints
- `server/services/cleanup-cron.service.ts` — `runTrashSweep`, `runPurgeSweep`, `startCronJobs`, `cron.schedule(...)` blocks
- `server/stripe.ts:527` — `runOverageBillingBatch`
- `server/index.ts:httpServer.listen` — Hetzner entry, calls `startCronJobs`
- `api/handler.ts` — Vercel entry, does NOT call `startCronJobs`
- `.github/workflows/cron.yml` — schedule + curl invocations
- `vercel.json` — confirms `api/handler.ts:maxDuration: 300` ceiling
- `scripts/verify-cron-jobs.ts` — runtime harness

/**
 * Phase 15 Verification Script — Cron Job Runtime Harness (VRFY-01)
 *
 * RUNTIME verification of the three destructive scheduled jobs:
 *   1. runTrashSweep()           → asserts soft-delete on past-due posts
 *   2. runPurgeSweep()           → asserts storage-then-DB delete on over-retention posts
 *   3. runOverageBillingBatch()  → empty case (always) + Stripe full case (sk_test_* gated)
 *
 * Test isolation: a dedicated user (cron-verify-{timestamp}@xareable.test) is created at
 * start, owns ALL seeded data, and is deleted in a finally block. Cascade FKs remove
 * posts/post_slides/post_versions/user_billing_profiles/billing_ledger automatically.
 *
 * Run with: npx tsx scripts/verify-cron-jobs.ts
 * Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (loaded via dotenv).
 * Optional env: STRIPE_SECRET_KEY=sk_test_* enables the full overage Stripe path test.
 *
 * Exits 0 only when all enabled tests pass. Non-zero with itemized failure report otherwise.
 */

import * as dotenv from "dotenv";
import { createAdminSupabase } from "../server/supabase.js";
import {
  runTrashSweep,
  runPurgeSweep,
} from "../server/services/cleanup-cron.service.js";
import { runOverageBillingBatch } from "../server/stripe.js";
import { TRASH_RETENTION_DAYS } from "../shared/schema.js";

dotenv.config();

if (
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_ANON_KEY ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "FAIL: SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be set (env or .env).",
  );
  process.exit(1);
}

// ── Tiny assert helper (no Jest, no Vitest — keep deps zero) ────────────────
class AssertionError extends Error {}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new AssertionError(msg);
}

// ── Test user lifecycle ─────────────────────────────────────────────────────
async function createTestUser(): Promise<string> {
  const sb = createAdminSupabase();
  const email = `cron-verify-${Date.now()}@xareable.test`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error(`Failed to create test user: ${error?.message}`);
  console.log(`  → seeded test user: ${email} (${data.user.id})`);
  return data.user.id;
}

async function cleanupTestUser(userId: string): Promise<void> {
  const sb = createAdminSupabase();
  // Storage objects under user_assets/{userId}/* — list and remove root + thumbnails subfolder.
  // (Recursive listing isn't supported by the Supabase JS SDK in one call; do two passes.)
  const { data: rootObjects } = await sb.storage
    .from("user_assets")
    .list(userId);
  if (rootObjects?.length) {
    const paths = rootObjects.map((o) => `${userId}/${o.name}`);
    await sb.storage.from("user_assets").remove(paths);
  }
  const { data: thumbObjects } = await sb.storage
    .from("user_assets")
    .list(`${userId}/thumbnails`);
  if (thumbObjects?.length) {
    const paths = thumbObjects.map((o) => `${userId}/thumbnails/${o.name}`);
    await sb.storage.from("user_assets").remove(paths);
  }
  // Auth user delete cascades through posts/post_slides/post_versions/user_billing_profiles/billing_ledger.
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) console.error(`  ⚠ test user delete failed: ${error.message}`);
  else console.log(`  → cleaned up test user ${userId}`);
}

// ── 1×1 transparent PNG upload helper ───────────────────────────────────────
async function uploadTestImage(path: string): Promise<string> {
  const sb = createAdminSupabase();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
  const { error } = await sb.storage.from("user_assets").upload(path, png, {
    contentType: "image/png",
    upsert: true,
  });
  if (error)
    throw new Error(`Storage upload failed for ${path}: ${error.message}`);
  const { data } = sb.storage.from("user_assets").getPublicUrl(path);
  return data.publicUrl;
}

async function storageObjectExists(path: string): Promise<boolean> {
  const sb = createAdminSupabase();
  const lastSlash = path.lastIndexOf("/");
  const folder = path.slice(0, lastSlash);
  const name = path.slice(lastSlash + 1);
  const { data } = await sb.storage
    .from("user_assets")
    .list(folder, { search: name });
  return !!data?.find((o) => o.name === name);
}

// ── Output format helpers (mirror verify-phase-11.ts conventions) ───────────
type TestResult = {
  name: string;
  passed: number;
  failed: number;
  skipped: boolean;
};
function fmtResult(r: TestResult): string {
  if (r.skipped) return `⊘ ${r.name} — SKIPPED`;
  return r.failed === 0
    ? `✓ ${r.name} — PASS (${r.passed} assertion${r.passed === 1 ? "" : "s"})`
    : `✗ ${r.name} — FAIL (${r.failed} of ${r.passed + r.failed} assertions failed)`;
}

// ── Test stubs (real bodies in subsequent tasks) ────────────────────────────
async function testTrashSweep(userId: string): Promise<TestResult> {
  console.log("\n▶ Test: trash sweep");
  const sb = createAdminSupabase();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const future = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const result: TestResult = {
    name: "trash sweep",
    passed: 0,
    failed: 0,
    skipped: false,
  };
  const tally = (label: string, ok: boolean, detail?: string) => {
    if (ok) {
      console.log(`  ✓ ${label}`);
      result.passed += 1;
    } else {
      console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
      result.failed += 1;
    }
  };

  // Seed: 2 eligible (expires_at in the past, trashed_at null) + 1 control (expires_at in the future).
  // image_url uses test:// scheme so trash sweep ignores it for storage purposes (sweep only updates trashed_at).
  const { data: seeded, error: seedErr } = await sb
    .from("posts")
    .insert([
      {
        user_id: userId,
        content_type: "image",
        image_url: "test://trash-1.webp",
        expires_at: yesterday,
        trashed_at: null,
        status: "draft",
      },
      {
        user_id: userId,
        content_type: "image",
        image_url: "test://trash-2.webp",
        expires_at: yesterday,
        trashed_at: null,
        status: "draft",
      },
      {
        user_id: userId,
        content_type: "image",
        image_url: "test://trash-control.webp",
        expires_at: future,
        trashed_at: null,
        status: "draft",
      },
    ])
    .select("id, expires_at");

  if (seedErr || !seeded || seeded.length !== 3) {
    tally(
      "seed 3 posts",
      false,
      `insert error: ${seedErr?.message ?? "no rows returned"}`,
    );
    return result;
  }
  tally("seed 3 posts (2 eligible + 1 control)", true);

  // IMPORTANT: runTrashSweep is global — it might trash other expired posts too.
  // We only assert about the rows WE inserted, identified by id.
  const eligibleIds = seeded
    .filter((s) => s.expires_at === yesterday)
    .map((s) => s.id);
  const controlId = seeded.find((s) => s.expires_at === future)!.id;

  let swept = 0;
  try {
    swept = await runTrashSweep();
    tally("runTrashSweep() did not throw", true);
  } catch (err) {
    tally("runTrashSweep() did not throw", false, (err as Error).message);
    return result;
  }

  // Re-read our 3 rows.
  const { data: after, error: afterErr } = await sb
    .from("posts")
    .select("id, trashed_at")
    .in(
      "id",
      seeded.map((s) => s.id),
    );
  if (afterErr || !after) {
    tally("re-read seeded posts", false, afterErr?.message);
    return result;
  }

  const byId = new Map(after.map((p) => [p.id, p.trashed_at]));
  for (const id of eligibleIds) {
    const t = byId.get(id);
    tally(
      `eligible post ${id.slice(0, 8)} trashed_at set`,
      t !== null && t !== undefined,
    );
  }
  const controlTrashed = byId.get(controlId);
  tally(
    `control post ${controlId.slice(0, 8)} preserved (trashed_at null)`,
    controlTrashed === null,
  );

  // The sweep is global; we can't assert exact return count, but it MUST be ≥ 2 (our two eligible).
  tally(`runTrashSweep() returned ≥ 2 (got ${swept})`, swept >= 2);

  console.log(
    `  Result: ${result.failed === 0 ? "PASS" : "FAIL"} (${result.passed}/${result.passed + result.failed})`,
  );
  return result;
}
async function testPurgeSweep(_userId: string): Promise<TestResult> {
  return { name: "purge sweep", passed: 0, failed: 0, skipped: true };
}
async function testOverageBatchEmpty(_userId: string): Promise<TestResult> {
  return {
    name: "overage batch (empty case)",
    passed: 0,
    failed: 0,
    skipped: true,
  };
}
async function testOverageBatchFull(_userId: string): Promise<TestResult> {
  return {
    name: "overage batch (full Stripe path)",
    passed: 0,
    failed: 0,
    skipped: true,
  };
}

// Reference helpers/imports not yet wired in by later tasks (keeps type-check green between tasks).
void runPurgeSweep;
void runOverageBillingBatch;
void TRASH_RETENTION_DAYS;
void uploadTestImage;
void storageObjectExists;
void assert;
void fmtResult;

// ── Orchestrator stub (real body in Task 5) ─────────────────────────────────
async function main(): Promise<void> {
  const testUserId = await createTestUser();
  try {
    console.log("(test bodies wired in subsequent tasks)");
    void testTrashSweep;
    void testPurgeSweep;
    void testOverageBatchEmpty;
    void testOverageBatchFull;
  } finally {
    await cleanupTestUser(testUserId);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("verify-cron-jobs.ts: unhandled error:", err);
  process.exit(1);
});

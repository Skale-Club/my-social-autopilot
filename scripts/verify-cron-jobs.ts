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
async function testTrashSweep(_userId: string): Promise<TestResult> {
  return { name: "trash sweep", passed: 0, failed: 0, skipped: true };
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

// Reference unused imports/helpers so type-check stays green even before tasks 2-5 wire them in.
// These are no-ops; do NOT remove — they keep TS lint happy until the orchestrator+tests use them.
void runTrashSweep;
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

/**
 * Phase 06 Verification Script
 *
 * Validates Phase 6 (Server Services) success criteria against a live
 * Supabase + (for Wave 2) Gemini environment.
 *
 * Wave 1 (this plan, 06-01) implements:
 *   - BILL-01: checkCredits slideCount multiplier (assertions 1×, 5×, 8× + 0/-3 clamps)
 *
 * Wave 2 (plans 06-02 and 06-03) will fill in the SKIP blocks for:
 *   - CRSL-02, CRSL-03, CRSL-06, CRSL-09, CRSL-10 (carousel generation service)
 *   - ENHC-03, ENHC-04, ENHC-05, ENHC-06 (enhancement service)
 *
 * Usage:
 *   npx tsx scripts/verify-phase-06.ts
 *
 * Required env (loaded from .env via dotenv, or from the shell):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env (when absent, the script mints a throwaway test user via the
 * admin API and tears it down at the end — lets this run end-to-end from CI
 * without a manually captured JWT):
 *   TEST_USER_ACCESS_TOKEN  (JWT for an existing non-admin Supabase auth user)
 *   TEST_USER_ID            (the user_id matching the JWT above)
 *
 * Exits 0 on full pass, 1 on any failure. SKIP lines (Wave 2 placeholders)
 * do NOT count as failures.
 *
 * Self-cleaning: minted user is deleted in `finally`. No posts/usage_events
 * rows are written by the Wave 1 BILL-01 block — checkCredits reads only.
 */

import { randomUUID } from "node:crypto";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase, createAdminSupabase } from "../server/supabase.js";
import { checkCredits } from "../server/quota.js";

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "FAIL: SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be set (either in .env or the shell).",
  );
  process.exit(1);
}

let TEST_USER_ACCESS_TOKEN = process.env.TEST_USER_ACCESS_TOKEN;
let TEST_USER_ID = process.env.TEST_USER_ID;
let mintedTestUserId: string | null = null;

async function mintTestUserIfNeeded() {
  if (TEST_USER_ACCESS_TOKEN && TEST_USER_ID) return;

  const admin = createAdminSupabase();
  const email = `phase06-verify-${randomUUID()}@verify.local`;
  const password = `Phase06-${randomUUID()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`admin.createUser failed: ${createErr?.message ?? "no user"}`);
  }
  mintedTestUserId = created.user.id;

  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session) {
    throw new Error(`signInWithPassword failed: ${signInErr?.message ?? "no session"}`);
  }

  TEST_USER_ACCESS_TOKEN = signIn.session.access_token;
  TEST_USER_ID = created.user.id;
  console.log(`[setup] minted throwaway test user ${TEST_USER_ID} for Phase 6 checks`);
}

async function teardownTestUserIfMinted() {
  if (!mintedTestUserId) return;
  try {
    const admin = createAdminSupabase();
    await admin.auth.admin.deleteUser(mintedTestUserId);
    console.log(`[cleanup] deleted throwaway test user ${mintedTestUserId}`);
  } catch (e) {
    console.error(`[cleanup] failed to delete throwaway user ${mintedTestUserId}:`, (e as Error).message);
  }
}

type CheckResult = { name: string; pass: boolean; detail: string };
const results: CheckResult[] = [];

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name} — ${detail}`);
}

async function main() {
  await mintTestUserIfNeeded();
  // Touch the user-scoped client import so future Wave 2 blocks (which will
  // use RLS-probing reads) remain linked. Not used in Wave 1.
  void createServerSupabase(TEST_USER_ACCESS_TOKEN!);
  const admin = createAdminSupabase();

  try {
    // --- Criterion BILL-01: slideCount multiplier ---
    // Minted throwaway user has is_admin=false, is_affiliate=false, is_business=false
    // → usesOwnApiKey returns false → full cost estimation path runs.
    //
    // BUT: the pay-per-use migration (20260303010000_pay_per_use_billing.sql)
    // sets user_credits.free_generations_limit default = 1, and the profile
    // trigger auto-creates that row on signup. That means a freshly minted user
    // has freeGenerationsRemaining = 1 → the free-generations early return
    // fires and estimated_cost_micros is 0, which makes the multiplier
    // untestable against a zero baseline.
    //
    // Exhaust the free generation by bumping free_generations_used to the limit
    // (via admin client, bypassing RLS) BEFORE calling checkCredits. This
    // forces the full cost-estimation path which is the only one the multiplier
    // applies to (own-api-key and free-generations returns are always 0 by
    // design — see D-19).
    //
    // After exhausting free generations, estimateBaseCostMicros falls back to
    // image_fallback_pricing.sell_micros (default 117_000 µ$) because the
    // minted user has no usage_events history, giving a stable non-zero
    // baseline for the 5 sub-assertions.
    const { data: creditsRow, error: creditsReadErr } = await admin
      .from("user_credits")
      .select("free_generations_limit, free_generations_used")
      .eq("user_id", TEST_USER_ID!)
      .maybeSingle();
    if (creditsReadErr) {
      throw new Error(`failed to read user_credits for minted user: ${creditsReadErr.message}`);
    }
    if (!creditsRow) {
      // Some older signups may not have triggered the auto-insert; ensure a
      // row exists with free generations already exhausted.
      const { error: insErr } = await admin
        .from("user_credits")
        .insert({ user_id: TEST_USER_ID!, free_generations_limit: 1, free_generations_used: 1 });
      if (insErr) {
        throw new Error(`failed to seed user_credits for minted user: ${insErr.message}`);
      }
    } else {
      const limit = creditsRow.free_generations_limit ?? 0;
      const { error: updErr } = await admin
        .from("user_credits")
        .update({ free_generations_used: limit })
        .eq("user_id", TEST_USER_ID!);
      if (updErr) {
        throw new Error(`failed to exhaust free generations for minted user: ${updErr.message}`);
      }
    }
    const singleCost = await checkCredits(TEST_USER_ID!, "generate", false, undefined);
    const fiveCost = await checkCredits(TEST_USER_ID!, "generate", false, 5);
    const oneCost = await checkCredits(TEST_USER_ID!, "generate", false, 1);
    const zeroCost = await checkCredits(TEST_USER_ID!, "generate", false, 0);
    const negCost = await checkCredits(TEST_USER_ID!, "generate", false, -3);
    const eightCost = await checkCredits(TEST_USER_ID!, "generate", false, 8);

    const base = singleCost.estimated_cost_micros;

    if (base === 0) {
      // Defensive diagnostic: if the baseline is 0, the minted user hit an
      // early-return path (own-api-key, free-generations) which makes the
      // multiplier untestable. Surface as FAIL with explicit reason.
      record(
        "BILL-01 (slideCount multiplier)",
        false,
        `baseline cost is 0 µ$ (minted user hit an early-return path — own-api-key or free-generations). Multiplier cannot be asserted against zero.`,
      );
    } else {
      const passes = [
        { label: "undefined === 1×", ok: base === oneCost.estimated_cost_micros },
        { label: "0 clamps to 1×", ok: base === zeroCost.estimated_cost_micros },
        { label: "-3 clamps to 1×", ok: base === negCost.estimated_cost_micros },
        { label: "5 === 5×", ok: fiveCost.estimated_cost_micros === 5 * base },
        { label: "8 === 8×", ok: eightCost.estimated_cost_micros === 8 * base },
      ];
      const failed = passes.filter((p) => !p.ok).map((p) => p.label);
      record(
        "BILL-01 (slideCount multiplier)",
        failed.length === 0,
        failed.length === 0
          ? `single=${base} µ$, 5×=${fiveCost.estimated_cost_micros} µ$ — all five assertions passed`
          : `failed: ${failed.join(", ")} (single=${base}, 1×=${oneCost.estimated_cost_micros}, 0→${zeroCost.estimated_cost_micros}, -3→${negCost.estimated_cost_micros}, 5×=${fiveCost.estimated_cost_micros}, 8×=${eightCost.estimated_cost_micros})`,
      );
    }

    // --- CRSL-02 (single master text call) — implemented in Plan 06-02 ---
    console.log("SKIP — CRSL-02 not yet implemented (Plan 06-02)");

    // --- CRSL-03 (slide 2..N thought_signature propagation) — implemented in Plan 06-02 ---
    console.log("SKIP — CRSL-03 not yet implemented (Plan 06-02)");

    // --- CRSL-06 (AbortSignal propagation, 260s safety timer) — implemented in Plan 06-02 ---
    console.log("SKIP — CRSL-06 not yet implemented (Plan 06-02)");

    // --- CRSL-09 (ensureCaptionQuality called exactly once) — implemented in Plan 06-02 ---
    console.log("SKIP — CRSL-09 not yet implemented (Plan 06-02)");

    // --- CRSL-10 (enforceExactImageText never called in carousel path) — implemented in Plan 06-02 ---
    console.log("SKIP — CRSL-10 not yet implemented (Plan 06-02)");

    // --- ENHC-03 (EXIF strip via sharp().autoOrient()) — implemented in Plan 06-03 ---
    console.log("SKIP — ENHC-03 not yet implemented (Plan 06-03)");

    // --- ENHC-04 (enhancement prompt preservation language) — implemented in Plan 06-03 ---
    console.log("SKIP — ENHC-04 not yet implemented (Plan 06-03)");

    // --- ENHC-05 (input normalized to 1:1 before Gemini call) — implemented in Plan 06-03 ---
    console.log("SKIP — ENHC-05 not yet implemented (Plan 06-03)");

    // --- ENHC-06 (pre-screen rejection for face photo) — implemented in Plan 06-03 ---
    console.log("SKIP — ENHC-06 not yet implemented (Plan 06-03)");
  } finally {
    await teardownTestUserIfMinted();
  }

  const passes = results.filter((r) => r.pass).length;
  const total = results.length;
  const failedCount = results.filter((r) => !r.pass).length;
  console.log("");
  if (failedCount === 0) {
    console.log(`VERIFY PHASE 06: PASS (${passes}/${total} implemented criteria)`);
  } else {
    console.log(`VERIFY PHASE 06: FAIL (${passes}/${total} implemented criteria)`);
  }
  process.exit(failedCount === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("VERIFY PHASE 06: FAIL — unhandled error:", err);
  try {
    await teardownTestUserIfMinted();
  } catch (cleanupErr) {
    console.error("[cleanup] teardown after crash failed:", (cleanupErr as Error).message);
  }
  process.exit(1);
});

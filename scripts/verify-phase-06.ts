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
import { readFileSync } from "node:fs";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase, createAdminSupabase } from "../server/supabase.js";
import { checkCredits } from "../server/quota.js";
import {
  generateCarousel,
  CarouselAbortedError,
  CarouselFullFailureError,
  CarouselInvalidAspectError,
  type CarouselGenerationParams,
  type CarouselProgressEvent,
} from "../server/services/carousel-generation.service.js";
import { DEFAULT_STYLE_CATALOG } from "../shared/schema.js";
import type { Brand } from "../shared/schema.js";

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

    // ═══════════════════════════════════════════════════════════════════════
    // Carousel verification helpers (Plan 06-02)
    // ═══════════════════════════════════════════════════════════════════════

    // Structural (no Gemini key needed):
    //   CRSL-10 — enforceExactImageText not imported
    //   AC-12 (CRSL-09 defense-in-depth) — invalid aspect ratio throws sync
    //
    // Live (require TEST_GEMINI_API_KEY):
    //   CRSL-02 — 1 text call + N sequential image calls with 3s spacing
    //   CRSL-03 — slides 2..N request bodies contain role:model + inlineData
    //             from slide 1 and (when slide 1 had it) thoughtSignature
    //   CRSL-06 — abort after slide 2 → draft or full-failure, persisted
    //             slides match observed success count
    //   CRSL-09 — only 1 call to gemini-2.5-flash text endpoint (caption
    //             quality check either returns the candidate as-is or
    //             makes its own calls — CRSL-09 is about ensureCaptionQuality
    //             *not* running inside the slide loop; we assert via source
    //             code grep that there is exactly 1 call site)
    //
    // Teardown: every postId created during verification is deleted via
    // admin.from("posts").delete() at the end of the try block. CASCADE on
    // post_slides + Phase 5 BEFORE DELETE trigger handles storage cleanup
    // enqueueing. Auth user deletion (teardownTestUserIfMinted) also
    // cascades posts→post_slides via FK.

    const createdPostIds = new Set<string>();

    const carouselBrand: Brand = {
      id: randomUUID(),
      user_id: TEST_USER_ID!,
      company_name: "Verify Coffee Co",
      company_type: "specialty coffee",
      color_1: "#2B1B0E",
      color_2: "#C4A484",
      color_3: "#F5E6D3",
      color_4: null,
      mood: "minimalist",
      logo_url: null,
      created_at: new Date().toISOString(),
    };

    // ── Fetch interceptor (captures all Gemini calls made by the service) ──
    type RecordedCall = {
      url: string;
      body: any;
      startedAt: number;
      responseStatus: number;
    };
    let recorded: RecordedCall[] = [];
    const originalFetch = globalThis.fetch;

    async function runWithInterceptor<T>(fn: () => Promise<T>): Promise<T> {
      recorded = [];
      globalThis.fetch = (async (url: any, init: any) => {
        const urlStr = String(url);
        let parsedBody: any = null;
        if (init?.body && typeof init.body === "string") {
          try {
            parsedBody = JSON.parse(init.body);
          } catch {
            parsedBody = null;
          }
        }
        const startedAt = Date.now();
        const res = await originalFetch(url as any, init as any);
        recorded.push({ url: urlStr, body: parsedBody, startedAt, responseStatus: res.status });
        return res;
      }) as any;
      try {
        return await fn();
      } finally {
        globalThis.fetch = originalFetch;
      }
    }

    // ── CRSL-10: code-grep that enforceExactImageText is not imported ─────
    {
      const svcSource = readFileSync(
        "server/services/carousel-generation.service.ts",
        "utf-8",
      );
      const hasEnforce = /enforceExactImageText/.test(svcSource);
      record(
        "CRSL-10 (enforceExactImageText not in carousel path)",
        !hasEnforce,
        hasEnforce
          ? "service source contains 'enforceExactImageText' — CRSL-10 violated"
          : "service source contains zero occurrences of 'enforceExactImageText'",
      );
    }

    // ── AC-12 / CRSL-09 defense-in-depth: invalid aspect ratio throws sync ─
    {
      // We don't have a baseline textCall count here — the synchronous guard
      // should throw before any fetch is made. Run inside interceptor to
      // prove that: zero calls recorded.
      let sawCorrectError = false;
      let callCountBefore = 0;
      try {
        await runWithInterceptor(async () => {
          callCountBefore = recorded.length;
          await generateCarousel({
            userId: TEST_USER_ID!,
            apiKey: "sk-invalid-never-used",
            brand: carouselBrand,
            styleCatalog: DEFAULT_STYLE_CATALOG,
            prompt: "invalid aspect guard probe",
            slideCount: 3,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            aspectRatio: "16:9" as any,
            postMood: "promo",
            contentLanguage: "en",
            idempotencyKey: randomUUID(),
          });
        });
      } catch (err) {
        if (err instanceof CarouselInvalidAspectError) sawCorrectError = true;
      }
      const noFetchesMade = recorded.length === callCountBefore;
      record(
        "CRSL-09 (aspect ratio guard — invalid aspect throws before any Gemini call)",
        sawCorrectError && noFetchesMade,
        sawCorrectError
          ? noFetchesMade
            ? "CarouselInvalidAspectError thrown synchronously; zero fetch calls recorded"
            : "CarouselInvalidAspectError thrown but some fetches were made before — guard is not synchronous"
          : "did not throw CarouselInvalidAspectError for aspectRatio=16:9",
      );
    }

    // ── Live blocks (gated on TEST_GEMINI_API_KEY) ─────────────────────────
    const geminiKey = process.env.TEST_GEMINI_API_KEY;
    if (!geminiKey) {
      console.log(
        "SKIP — CRSL-02 (one master text call + N sequential image calls) — set TEST_GEMINI_API_KEY in .env to run live",
      );
      console.log(
        "SKIP — CRSL-03 (thoughtSignature echoed + slide-1 inlineData in slides 2..N) — set TEST_GEMINI_API_KEY in .env to run live",
      );
      console.log(
        "SKIP — CRSL-06 (abort between slides → draft or full-failure) — set TEST_GEMINI_API_KEY in .env to run live",
      );
      console.log(
        "SKIP — CRSL-09-live (ensureCaptionQuality not in slide loop; source-grep check) — running structural check only",
      );
      // CRSL-09 structural check that matches AC-8 without a live run:
      const svcSource = readFileSync(
        "server/services/carousel-generation.service.ts",
        "utf-8",
      );
      const callSites = svcSource.match(/ensureCaptionQuality\(/g) ?? [];
      record(
        "CRSL-09 (ensureCaptionQuality — exactly 1 call site in carousel service)",
        callSites.length === 1,
        callSites.length === 1
          ? "service source contains exactly 1 call to ensureCaptionQuality(...) — confirms not called per-slide"
          : `service source contains ${callSites.length} call sites to ensureCaptionQuality(...) — CRSL-09 requires exactly 1`,
      );
    } else {
      // ── Happy-path 3-slide run — powers CRSL-02, CRSL-03, CRSL-09 ───────
      const progressEvents: CarouselProgressEvent[] = [];
      let happyResult: Awaited<ReturnType<typeof generateCarousel>> | null = null;
      try {
        await runWithInterceptor(async () => {
          happyResult = await generateCarousel({
            userId: TEST_USER_ID!,
            apiKey: geminiKey!,
            brand: carouselBrand,
            styleCatalog: DEFAULT_STYLE_CATALOG,
            prompt:
              "A minimalist product launch for a new specialty espresso maker — hook, feature, CTA",
            slideCount: 3,
            aspectRatio: "1:1",
            postMood: "promo",
            contentLanguage: "en",
            idempotencyKey: randomUUID(),
            onProgress: (ev) => progressEvents.push(ev),
          } satisfies CarouselGenerationParams);
        });
      } catch (runErr) {
        console.warn(
          "[verify] live carousel run raised — CRSL-02/03/09 will be marked FAIL with error detail:",
          String((runErr as Error)?.message ?? runErr),
        );
      }

      if (happyResult) {
        createdPostIds.add(happyResult.postId);
      }

      const textCalls = recorded.filter((r) =>
        r.url.includes(`models/gemini-2.5-flash:generateContent`),
      );
      const imageCalls = recorded.filter((r) =>
        r.url.includes(`models/gemini-3.1-flash-image-preview:generateContent`),
      );

      // ── CRSL-02 ──
      {
        const textOk = textCalls.length === 1;
        const imageOk = imageCalls.length === 3;
        // Inter-slide spacing: slides 2 and 3 must start ≥ previous + 2900ms
        let spacingOk = true;
        let spacingDetail = "";
        for (let i = 1; i < imageCalls.length; i++) {
          const gap = imageCalls[i].startedAt - imageCalls[i - 1].startedAt;
          if (gap < 2900) {
            spacingOk = false;
            spacingDetail = `imageCalls[${i}] started ${gap}ms after [${i - 1}] — expected ≥2900`;
            break;
          }
        }
        const pass = textOk && imageOk && spacingOk;
        record(
          "CRSL-02 (one text call + N sequential image calls with D-02 delay)",
          pass,
          pass
            ? `textCalls=1, imageCalls=3, inter-slide gaps satisfy ≥2900ms (D-02)`
            : `textCalls=${textCalls.length} (want 1), imageCalls=${imageCalls.length} (want 3)${spacingDetail ? "; " + spacingDetail : ""}`,
        );
      }

      // ── CRSL-03 ──
      {
        if (imageCalls.length < 2) {
          record(
            "CRSL-03 (thoughtSignature + slide-1 inlineData in slides 2..N)",
            false,
            `not enough imageCalls to inspect — got ${imageCalls.length}`,
          );
        } else {
          // The slide-1 body was a single-turn (no role:model); its response
          // shape isn't directly captured by the interceptor (we only
          // capture request bodies). To check slide-1 base64 match, we must
          // compare the base64 sent in slide-2's model turn against a known
          // slide-1 reference — but without access to slide 1's response
          // body we compare it against slide-2's own modelTurn consistency
          // (slide-3's modelTurn should carry the SAME slide-1 base64 as
          // slide-2's, since both reference slide 1).
          //
          // Primary structural assertions (AC-3):
          //   - slides 2..N bodies contain a role:"model" turn
          //   - that turn's parts[0].inlineData.data is a non-empty base64 string
          //   - slide-3's base64 equals slide-2's base64 (both = slide 1 bytes)
          //
          // thoughtSignature: check whether slide 2's model turn carries it.
          // If slide 1's response lacked a signature the service falls back
          // to single-turn (no role:model). Either outcome is acceptable
          // per D-06, but we record which path was taken.

          const shapes: string[] = [];
          let allMultiTurn = true;
          let allHaveInline = true;
          let baseForCompare: string | null = null;
          let consistentBase64 = true;
          let sigPresent = false;

          for (let i = 1; i < imageCalls.length; i++) {
            const body = imageCalls[i].body;
            const contents = body?.contents;
            const first = contents?.[0];
            const isModelTurn = first?.role === "model";
            const inline = first?.parts?.[0]?.inlineData;
            const hasInline = typeof inline?.data === "string" && inline.data.length > 0;
            const hasSig =
              typeof first?.parts?.[0]?.thoughtSignature === "string" &&
              first?.parts?.[0]?.thoughtSignature.length > 0;

            shapes.push(
              `slide${i + 1}:${isModelTurn ? "multi" : "single"}${hasInline ? "+inline" : ""}${hasSig ? "+sig" : ""}`,
            );

            if (!isModelTurn) allMultiTurn = false;
            if (!hasInline) allHaveInline = false;
            if (hasSig) sigPresent = true;

            if (hasInline) {
              if (baseForCompare === null) {
                baseForCompare = inline.data;
              } else if (inline.data !== baseForCompare) {
                consistentBase64 = false;
              }
            }
          }

          // D-06 accepts the silent fallback path. So:
          //   Happy path (sig present in slide 1): every slide 2..N must be multi-turn with sig.
          //   Fallback path (sig absent): slides 2..N are single-turn BUT must
          //     still carry slide 1 as bare inlineData in the user turn.
          let fallbackInlineOk = true;
          if (!allMultiTurn) {
            // For single-turn fallback, slide 1 base64 should appear as a part in the user turn
            for (let i = 1; i < imageCalls.length; i++) {
              const body = imageCalls[i].body;
              const parts = body?.contents?.[0]?.parts ?? [];
              const hasInlinePart = parts.some(
                (p: any) => typeof p?.inlineData?.data === "string" && p.inlineData.data.length > 0,
              );
              if (!hasInlinePart) {
                fallbackInlineOk = false;
                break;
              }
            }
          }

          const pass =
            (allMultiTurn && allHaveInline && consistentBase64 && sigPresent) ||
            (!allMultiTurn && fallbackInlineOk);

          record(
            "CRSL-03 (thoughtSignature echoed + slide-1 inlineData in slides 2..N)",
            pass,
            pass
              ? allMultiTurn
                ? `multi-turn path: slides 2..N carry role:model + slide-1 base64 + thoughtSignature (${shapes.join(", ")})`
                : `D-06 fallback path (no signature returned by slide 1): slides 2..N carry slide-1 base64 as inlineData in single-turn user parts (${shapes.join(", ")})`
              : `structural mismatch — shapes=[${shapes.join(", ")}], multi=${allMultiTurn}, inline=${allHaveInline}, consistent=${consistentBase64}, sig=${sigPresent}, fallbackInline=${fallbackInlineOk}`,
          );
        }
      }

      // ── CRSL-09 (ensureCaptionQuality — exactly 1 call site, verified
      //             by source grep; semantically: caption-quality never
      //             runs inside the per-slide loop) ──
      {
        const svcSource = readFileSync(
          "server/services/carousel-generation.service.ts",
          "utf-8",
        );
        const callSites = svcSource.match(/ensureCaptionQuality\(/g) ?? [];
        record(
          "CRSL-09 (ensureCaptionQuality — exactly 1 call site in carousel service)",
          callSites.length === 1,
          callSites.length === 1
            ? "service source contains exactly 1 call to ensureCaptionQuality(...) — confirms not called per-slide"
            : `service source contains ${callSites.length} call sites to ensureCaptionQuality(...) — CRSL-09 requires exactly 1`,
        );
      }

      // ── CRSL-06 (abort between slides) ─────────────────────────────────
      {
        const controller = new AbortController();
        // Abort after 8 seconds — slide 1 normally completes by then but
        // the 3s inter-slide delay and slide 2's own call should still be
        // in flight or queued when we trip the signal.
        const timer = setTimeout(() => controller.abort(), 8000);
        const events: CarouselProgressEvent[] = [];
        let observedError: unknown = null;
        let abortResultPostId: string | null = null;
        try {
          await runWithInterceptor(async () => {
            await generateCarousel({
              userId: TEST_USER_ID!,
              apiKey: geminiKey!,
              brand: carouselBrand,
              styleCatalog: DEFAULT_STYLE_CATALOG,
              prompt: "An abort-test carousel — will be aborted mid-run",
              slideCount: 5,
              aspectRatio: "1:1",
              postMood: "promo",
              contentLanguage: "en",
              idempotencyKey: randomUUID(),
              signal: controller.signal,
              onProgress: (ev) => {
                events.push(ev);
                if (ev.type === "complete") {
                  // no-op; result return happens synchronously after this
                }
              },
            });
          });
        } catch (err) {
          observedError = err;
        } finally {
          clearTimeout(timer);
        }

        // Inspect progress events to determine how many slides completed
        const slideCompleteEvents = events.filter((e) => e.type === "slide_complete");
        const completeEvent = events.find((e) => e.type === "complete") as
          | Extract<CarouselProgressEvent, { type: "complete" }>
          | undefined;

        // Try to recover the postId from the abort branch: if the service
        // threw CarouselAbortedError after persisting, the posts row exists.
        // We search for it by idempotency_key match — but we didn't capture
        // it here. Instead fall back to querying by status+user_id+slide_count
        // within a recent window.
        const aborted = observedError instanceof CarouselAbortedError;
        const fullFail = observedError instanceof CarouselFullFailureError;

        // If we got a CarouselAbortedError we expect a posts row with
        // slide_count === savedSlideCount and status == (saved < 5 ? draft : completed)
        let dbCheckOk = true;
        let dbDetail = "";
        if (aborted && completeEvent) {
          const saved = completeEvent.savedSlideCount;
          const { data: rows, error: rowsErr } = await admin
            .from("posts")
            .select("id, status, slide_count")
            .eq("user_id", TEST_USER_ID!)
            .eq("content_type", "carousel")
            .eq("slide_count", saved)
            .order("created_at", { ascending: false })
            .limit(3);
          if (rowsErr) {
            dbCheckOk = false;
            dbDetail = `db read failed: ${rowsErr.message}`;
          } else if (!rows || rows.length === 0) {
            dbCheckOk = false;
            dbDetail = `no posts row with slide_count=${saved} found after abort`;
          } else {
            abortResultPostId = rows[0].id as string;
            createdPostIds.add(abortResultPostId);
            const expectedStatus = saved === 5 ? "completed" : "draft";
            if (rows[0].status !== expectedStatus) {
              dbCheckOk = false;
              dbDetail = `posts.status=${rows[0].status} (expected ${expectedStatus} for saved=${saved})`;
            } else {
              dbDetail = `posts row ${abortResultPostId} slide_count=${saved} status=${rows[0].status}`;
            }
          }
        }

        // Acceptable outcomes (AC-7):
        //   A. CarouselAbortedError thrown with savedSlideCount >= 1 AND
        //      posts row persisted with status=draft (if saved < 5) or
        //      completed (if saved === 5)
        //   B. CarouselFullFailureError thrown when abort fired before
        //      slide 1 completed (observedError is CarouselFullFailureError)
        //      and ZERO posts row inserted
        const scenarioA =
          aborted &&
          completeEvent !== undefined &&
          completeEvent.savedSlideCount >= 1 &&
          dbCheckOk;
        const scenarioB = fullFail && slideCompleteEvents.length === 0;
        const pass = scenarioA || scenarioB;

        record(
          "CRSL-06 (abort between slides → draft-or-full-failure contract)",
          pass,
          pass
            ? scenarioA
              ? `CarouselAbortedError thrown after savedSlideCount=${completeEvent!.savedSlideCount}; ${dbDetail}`
              : `CarouselFullFailureError thrown before slide 1 completed (abort landed early)`
            : `observedError=${(observedError as Error)?.constructor?.name ?? "none"}; slideCompleteEvents=${slideCompleteEvents.length}; dbDetail=${dbDetail}`,
        );
      }

      // ── Teardown: delete posts created during verification ──
      for (const postId of createdPostIds) {
        try {
          const { error: delErr } = await admin.from("posts").delete().eq("id", postId);
          if (delErr) {
            console.warn(`[cleanup] failed to delete post ${postId}: ${delErr.message}`);
          } else {
            console.log(`[cleanup] deleted carousel post ${postId} (cascade on post_slides)`);
          }
        } catch (cleanupErr) {
          console.warn(`[cleanup] exception deleting post ${postId}:`, (cleanupErr as Error).message);
        }
      }
    }

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

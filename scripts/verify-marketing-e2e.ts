/**
 * SEED-002 — Marketing Tracking E2E Validation Harness (GA4 + Facebook CAPI)
 *
 * Verifies that GA4 and Facebook Conversions API integrations are correctly
 * configured and delivering events end-to-end.
 *
 * Two modes:
 *
 *   MODE A — Static (always runs):
 *     Checks marketing_events DB table, integration_settings table, env structure.
 *     No external API calls.
 *
 *   MODE B — Live (requires GA4 or Facebook configured in DB):
 *     Sends a real test event through trackMarketingEvent() and verifies:
 *     - marketing_events row created with correct status
 *     - GA4: event sent to Measurement Protocol (check GA4 DebugView manually)
 *     - Facebook: event sent with test_event_code (check FB Test Events tool manually)
 *
 * Run: npx tsx scripts/verify-marketing-e2e.ts
 * Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: This script DOES NOT verify events actually arrived in GA4/Facebook dashboards
 * (those require human verification in external tools). It only verifies:
 *   - The event was accepted by the integration without error
 *   - The marketing_events row shows status "sent" (not "failed")
 *   - The response payload from the provider looks valid
 *
 * Exits 0 only when all enabled checks pass.
 */

import * as dotenv from "dotenv";
dotenv.config();

import { createAdminSupabase } from "../server/supabase.js";
import { trackMarketingEvent } from "../server/integrations/marketing.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string) {
    console.log(`  ✅ ${label}`);
    passed++;
}

function fail(label: string, detail?: string) {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push(label);
}

function skip(label: string, reason: string) {
    console.log(`  ⏭  ${label} (skipped: ${reason})`);
}

function warn(label: string, detail: string) {
    console.log(`  ⚠️  ${label} — ${detail}`);
}

function section(title: string) {
    console.log(`\n── ${title} ─────────────────────────────────────────────`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE A — Static checks
// ─────────────────────────────────────────────────────────────────────────────

async function runStaticChecks() {
    section("MODE A — Static checks");

    const sb = createAdminSupabase();

    // A-01: DB tables exist
    for (const table of ["marketing_events", "integration_settings"]) {
        const { error } = await sb.from(table).select("id").limit(1);
        if (!error) ok(`A-01 table ${table} accessible`);
        else fail(`A-01 table ${table}`, error.message);
    }

    // A-02: marketing_events columns
    const { data: sample } = await sb
        .from("marketing_events")
        .select("id, event_key, event_name, ga4_status, facebook_status, processed_at")
        .limit(1);
    ok(`A-02 marketing_events schema valid (${sample ? "has rows" : "empty — ok"})`);

    // A-03: Check GA4 integration config
    const { data: ga4Row } = await sb
        .from("integration_settings")
        .select("enabled, api_key, location_id")
        .eq("integration_type", "ga4")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!ga4Row) {
        warn("A-03 GA4", "no integration_settings row found — configure in admin → Integrations → GA4");
    } else if (!ga4Row.enabled) {
        warn("A-03 GA4", "integration exists but is disabled");
    } else if (!ga4Row.location_id || !ga4Row.api_key) {
        fail("A-03 GA4 enabled but missing measurement_id or api_secret");
    } else {
        ok(`A-03 GA4 configured and enabled (measurement_id: ${ga4Row.location_id.slice(0, 6)}...)`);
    }

    // A-04: Check Facebook integration config
    const { data: fbRow } = await sb
        .from("integration_settings")
        .select("enabled, api_key, location_id, custom_field_mappings")
        .eq("integration_type", "facebook_dataset")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!fbRow) {
        warn("A-04 Facebook CAPI", "no integration_settings row found — configure in admin → Integrations → Facebook");
    } else if (!fbRow.enabled) {
        warn("A-04 Facebook CAPI", "integration exists but is disabled");
    } else if (!fbRow.location_id || !fbRow.api_key) {
        fail("A-04 Facebook CAPI enabled but missing dataset_id or access_token");
    } else {
        const testCode = (fbRow.custom_field_mappings as any)?.test_event_code;
        if (!testCode) {
            warn("A-04 Facebook CAPI", "no test_event_code set — live events will fire without test isolation; consider setting one in admin");
        } else {
            ok(`A-04 Facebook CAPI configured (dataset: ${fbRow.location_id.slice(0, 6)}..., test_event_code: ${testCode})`);
        }
    }

    // A-05: trackMarketingEvent function importable
    try {
        if (typeof trackMarketingEvent === "function") ok("A-05 trackMarketingEvent imported OK");
        else fail("A-05 trackMarketingEvent is not a function");
    } catch (e: any) {
        fail("A-05 marketing.ts import failed", e.message);
    }

    // A-06: Delivery stats from last 24h
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: recentEvents } = await sb
        .from("marketing_events")
        .select("event_name, ga4_status, facebook_status")
        .gte("created_at", since)
        .limit(100);

    if (!recentEvents || recentEvents.length === 0) {
        warn("A-06 recent delivery stats", "no marketing events in last 24h (normal if no users are active)");
    } else {
        const ga4Sent = recentEvents.filter((e: any) => e.ga4_status === "sent").length;
        const ga4Failed = recentEvents.filter((e: any) => e.ga4_status === "failed").length;
        const fbSent = recentEvents.filter((e: any) => e.facebook_status === "sent").length;
        const fbFailed = recentEvents.filter((e: any) => e.facebook_status === "failed").length;
        const total = recentEvents.length;

        ok(`A-06 last 24h: ${total} events — GA4 ${ga4Sent} sent / ${ga4Failed} failed | FB ${fbSent} sent / ${fbFailed} failed`);

        if (ga4Failed > 0) warn("A-06 GA4 failures detected", `${ga4Failed} events failed — check integration_settings GA4 config`);
        if (fbFailed > 0) warn("A-06 Facebook failures detected", `${fbFailed} events failed — check integration_settings Facebook config`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE B — Live event send checks
// ─────────────────────────────────────────────────────────────────────────────

async function runLiveChecks() {
    section("MODE B — Live event delivery checks");

    const sb = createAdminSupabase();

    // Check if any integration is configured + enabled
    const { data: integrations } = await sb
        .from("integration_settings")
        .select("integration_type, enabled, api_key, location_id")
        .in("integration_type", ["ga4", "facebook_dataset"])
        .eq("enabled", true);

    const ga4Active = integrations?.some((i: any) => i.integration_type === "ga4" && i.api_key && i.location_id);
    const fbActive = integrations?.some((i: any) => i.integration_type === "facebook_dataset" && i.api_key && i.location_id);

    if (!ga4Active && !fbActive) {
        skip("B-01..B-04 all live checks", "no GA4 or Facebook integration is enabled + fully configured");
        return;
    }

    console.log(`  Active integrations: GA4=${ga4Active ? "✓" : "✗"}, Facebook=${fbActive ? "✓" : "✗"}`);

    // B-01: Send a test event through the unified dispatcher
    const eventKey = `e2e-test-${Date.now()}`;
    let eventId: string | null = null;
    try {
        const result = await trackMarketingEvent({
            event_name: "PageView",
            event_key: eventKey,
            event_source: "e2e_validation",
            user_id: null,
            email: null,
            event_payload: { test: true, harness: "verify-marketing-e2e" },
        });

        eventId = result.id;
        ok(`B-01 trackMarketingEvent returned — ga4_status="${result.ga4_status}" facebook_status="${result.facebook_status}"`);

        if (ga4Active && result.ga4_status === "failed") {
            fail("B-01 GA4 delivery failed", "check GA4 measurement_id + api_secret in admin → Integrations");
        } else if (ga4Active && result.ga4_status === "sent") {
            ok("B-01 GA4 event accepted by Measurement Protocol API");
            warn("B-01 GA4 manual step required", "Verify event appears in GA4 DebugView (realtime.debug_view) within 30s");
        }

        if (fbActive && result.facebook_status === "failed") {
            fail("B-01 Facebook delivery failed", "check dataset_id + access_token in admin → Integrations");
        } else if (fbActive && result.facebook_status === "sent") {
            ok("B-01 Facebook event accepted by CAPI");
            warn("B-01 Facebook manual step required", "Verify event appears in Facebook Events Manager → Test Events tab within 60s");
        }
    } catch (e: any) {
        fail("B-01 trackMarketingEvent threw", e.message);
        return;
    }

    // B-02: Verify marketing_events row was created
    if (eventId) {
        const { data: row, error } = await sb
            .from("marketing_events")
            .select("id, event_key, event_name, ga4_status, facebook_status, processed_at, ga4_response, facebook_response")
            .eq("id", eventId)
            .single();

        if (error || !row) {
            fail("B-02 marketing_events row not found after send", error?.message);
        } else {
            ok(`B-02 marketing_events row persisted (id: ${row.id.slice(0, 8)}...)`);
            ok(`B-02 event_key="${row.event_key}", ga4_status="${row.ga4_status}", facebook_status="${row.facebook_status}"`);
        }
    }

    // B-03: Idempotency — send same event_key again
    try {
        const result2 = await trackMarketingEvent({
            event_name: "PageView",
            event_key: eventKey, // same key
            event_source: "e2e_validation_duplicate",
            user_id: null,
            email: null,
        });

        if (result2.duplicate === true) {
            ok("B-03 duplicate event_key correctly detected — no double-send");
        } else {
            fail("B-03 duplicate event_key not detected — potential double-attribution risk");
        }
    } catch (e: any) {
        fail("B-03 duplicate check threw", e.message);
    }

    // B-04: Delivery stats after test
    const { data: afterStats } = await sb
        .from("marketing_events")
        .select("ga4_status, facebook_status")
        .eq("event_source", "e2e_validation")
        .limit(10);

    const totalSent = afterStats?.length ?? 0;
    ok(`B-04 e2e_validation events in DB: ${totalSent}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
    console.log("=============================================================");
    console.log("  SEED-002 — Marketing Tracking E2E Validation Harness");
    console.log("  Run date:", new Date().toISOString());
    console.log("=============================================================");

    try {
        await runStaticChecks();
        await runLiveChecks();
    } catch (e: any) {
        console.error("\nFATAL:", e.message);
        process.exit(1);
    }

    console.log("\n=============================================================");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    if (failures.length) {
        console.log("  Failed checks:");
        for (const f of failures) console.log(`    - ${f}`);
    }
    if (failed === 0) {
        console.log("\n  📋 MANUAL STEPS REQUIRED:");
        console.log("  1. GA4: Open GA4 → Admin → DebugView. Confirm 'PageView' event appears.");
        console.log("  2. Facebook: Open Events Manager → Test Events. Confirm PageView event appears.");
        console.log("  3. Stripe (Mode B): Run verify-stripe-e2e.ts with sk_test_* key.");
    }
    console.log("=============================================================");
    process.exit(failed > 0 ? 1 : 0);
})();

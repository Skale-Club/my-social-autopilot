/**
 * Phase 20 Verification Script (v1.5 — Generation Integration)
 *
 * Statically verifies that the Phase 20 contract is in place:
 *   GEN-01: Creator dialog toggle — "Use my style references" checkbox,
 *           shown only when contentType === "image" AND brand has >= 1 saved photo
 *   GEN-02: Server-side injection — fetch brand photos, download as base64,
 *           merge with user inline reference_images (user first, total <= 4 slots)
 *
 * 12 static assertions across 3 files. No live Supabase connection required.
 *
 * Run with: npx tsx scripts/verify-phase-20.ts
 * Exits non-zero if any check fails.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
let failed = 0;
const results: string[] = [];

function check(label: string, condition: boolean, hint?: string): void {
  if (condition) {
    results.push(`  ok  ${label}`);
  } else {
    failed++;
    results.push(`  FAIL ${label}${hint ? `\n       hint: ${hint}` : ""}`);
  }
}

function read(path: string): string {
  const p = resolve(ROOT, path);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const schemaPath = "shared/schema.ts";
const routePath = "server/routes/generate.routes.ts";
const dialogPath = "client/src/components/post-creator-dialog.tsx";

const schema = read(schemaPath);
const route = read(routePath);
const dialog = read(dialogPath);

// ── Section 1: GEN-02 Schema ──────────────────────────────────────────────────

console.log("\nSection 1: GEN-02 — Schema field (shared/schema.ts)");

check(
  "shared/schema.ts contains use_brand_references: z.boolean().optional()",
  schema.includes("use_brand_references: z.boolean().optional()"),
  'expected: use_brand_references: z.boolean().optional() in generateRequestSchema',
);

// ── Section 2: GEN-02 Server route ───────────────────────────────────────────

console.log("\nSection 2: GEN-02 — Server injection (server/routes/generate.routes.ts)");

check(
  "generate.routes.ts contains fetchBrandReferenceImagesAsBase64",
  route.includes("fetchBrandReferenceImagesAsBase64"),
  'expected: async function fetchBrandReferenceImagesAsBase64(...) at module scope',
);

check(
  "generate.routes.ts destructures use_brand_references from parseResult.data",
  route.includes("use_brand_references"),
  'expected: use_brand_references, in the const { ... } = parseResult.data destructure',
);

check(
  "generate.routes.ts contains mergedReferenceImages",
  route.includes("mergedReferenceImages"),
  'expected: let mergedReferenceImages = userRefImages; in merge block',
);

check(
  "generate.routes.ts queries brand_reference_photos table",
  route.includes("brand_reference_photos"),
  'expected: supabase.from("brand_reference_photos") in merge block',
);

check(
  "generate.routes.ts uses mergedReferenceImages.map(img => img.data) for generateText (string[] type split)",
  route.includes("mergedReferenceImages.map(img => img.data)"),
  'expected: referenceImages: mergedReferenceImages.map(img => img.data) in gemini.generateText call',
);

check(
  "generate.routes.ts does NOT contain referenceImageBase64 (old var removed)",
  !route.includes("referenceImageBase64"),
  'old variable referenceImageBase64 must be fully replaced by mergedReferenceImages',
);

check(
  "generate.routes.ts contains !isVideo guard in merge block (video path excluded)",
  route.includes("!isVideo && use_brand_references !== false"),
  'expected: if (!isVideo && use_brand_references !== false && userRefImages.length < 4)',
);

// ── Section 3: GEN-01 Creator dialog ─────────────────────────────────────────

console.log("\nSection 3: GEN-01 — Creator dialog toggle (client/src/components/post-creator-dialog.tsx)");

check(
  "post-creator-dialog.tsx contains useBrandReferences state",
  dialog.includes("useBrandReferences"),
  'expected: const [useBrandReferences, setUseBrandReferences] = useState(true)',
);

check(
  "post-creator-dialog.tsx contains hasBrandReferences derived value",
  dialog.includes("hasBrandReferences"),
  'expected: const hasBrandReferences = (brandRefPhotos?.photos?.length ?? 0) > 0',
);

check(
  'post-creator-dialog.tsx contains checkbox-use-brand-references data-testid',
  dialog.includes("checkbox-use-brand-references"),
  'expected: data-testid="checkbox-use-brand-references" on the toggle input',
);

check(
  "post-creator-dialog.tsx sends use_brand_references in fetchSSE payload",
  dialog.includes("use_brand_references"),
  'expected: use_brand_references: hasBrandReferences ? useBrandReferences : undefined in payload',
);

// ── Summary ───────────────────────────────────────────────────────────────────

const total = results.length;
const passed = total - failed;

console.log("\n=== Phase 20 Verification ===");
for (const line of results) console.log(line);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed. Phase 20 verification: ${passed}/${total} checks passed.`);
  process.exit(1);
}

console.log(`\nPhase 20 verification: ${passed}/${total} checks passed.`);

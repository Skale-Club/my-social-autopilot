/**
 * Phase 18 Verification Script (v1.5 — Brand Style References: Data Layer + API Endpoints)
 *
 * Statically verifies that the Phase 18 contract is in place:
 *   REF-01: brand_reference_photos table + brands.style_description column + 4 Zod schemas
 *   API-01: GET /api/brand/reference-photos declared in brand-references.routes.ts
 *   API-02: POST /api/brand/reference-photos declared in brand-references.routes.ts
 *   API-03: DELETE /api/brand/reference-photos/:id declared in brand-references.routes.ts
 *   API-04: PATCH /api/brand/style-description declared in brand-references.routes.ts
 *
 * All checks are static (file existence + string search). No live Supabase connection required.
 *
 * Run with: npx tsx scripts/verify-phase-18.ts
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

// ── Section 1: Migration (REF-01) ────────────────────────────────────────────

console.log("\nSection 1: Migration — supabase/migrations/20260516000000_brand_style_references.sql");
const migPath = "supabase/migrations/20260516000000_brand_style_references.sql";
const migExists = existsSync(resolve(ROOT, migPath));
const migration = read(migPath);

check(
  "migration file 20260516000000_brand_style_references.sql exists",
  migExists,
  `expected at ${migPath}`,
);

check(
  "migration contains CREATE TABLE IF NOT EXISTS public.brand_reference_photos",
  migration.includes("CREATE TABLE IF NOT EXISTS public.brand_reference_photos"),
);

check(
  "migration contains ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS style_description",
  migration.includes("ADD COLUMN IF NOT EXISTS style_description"),
);

check(
  "migration enables RLS on brand_reference_photos",
  migration.includes("ALTER TABLE public.brand_reference_photos ENABLE ROW LEVEL SECURITY"),
);

// ── Section 2: Zod schemas (REF-01) ─────────────────────────────────────────

console.log("\nSection 2: Zod schemas — shared/schema.ts");
const schema = read("shared/schema.ts");

check(
  "shared/schema.ts exports brandReferencePhotoSchema",
  schema.includes("export const brandReferencePhotoSchema"),
);

check(
  "shared/schema.ts exports brandReferencePhotosResponseSchema",
  schema.includes("export const brandReferencePhotosResponseSchema"),
);

check(
  "shared/schema.ts exports createBrandReferencePhotoSchema",
  schema.includes("export const createBrandReferencePhotoSchema"),
);

check(
  "shared/schema.ts exports updateStyleDescriptionSchema",
  schema.includes("export const updateStyleDescriptionSchema"),
);

// ── Section 3: Route file existence and endpoint declarations (API-01 to API-04) ──

console.log("\nSection 3: Route file — server/routes/brand-references.routes.ts");
const routePath = "server/routes/brand-references.routes.ts";
const routeExists = existsSync(resolve(ROOT, routePath));
const route = read(routePath);

check(
  "server/routes/brand-references.routes.ts exists",
  routeExists,
  `expected at ${routePath}`,
);

check(
  "route file declares GET /api/brand/reference-photos (API-01)",
  route.includes('"/api/brand/reference-photos"') && route.includes("router.get"),
  'expected: router.get("/api/brand/reference-photos", ...)',
);

check(
  "route file declares POST /api/brand/reference-photos (API-02)",
  route.includes('"/api/brand/reference-photos"') && route.includes("router.post"),
  'expected: router.post("/api/brand/reference-photos", ...)',
);

check(
  "route file declares DELETE /api/brand/reference-photos/:id (API-03)",
  route.includes('"/api/brand/reference-photos/:id"') && route.includes("router.delete"),
  'expected: router.delete("/api/brand/reference-photos/:id", ...)',
);

check(
  "route file declares PATCH /api/brand/style-description (API-04)",
  route.includes('"/api/brand/style-description"') && route.includes("router.patch"),
  'expected: router.patch("/api/brand/style-description", ...)',
);

// ── Section 4: Route registration (index.ts) ─────────────────────────────────

console.log("\nSection 4: Route registration — server/routes/index.ts");
const index = read("server/routes/index.ts");

check(
  "server/routes/index.ts imports brand-references.routes.js",
  index.includes("brand-references.routes.js"),
  'expected: import brandReferencesRoutes from "./brand-references.routes.js"',
);

check(
  "server/routes/index.ts calls router.use(brandReferencesRoutes)",
  index.includes("router.use(brandReferencesRoutes)"),
  "expected: router.use(brandReferencesRoutes) inside createApiRouter()",
);

// ── Summary ──────────────────────────────────────────────────────────────────

console.log("\n=== Phase 18 Verification ===");
for (const line of results) console.log(line);
if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll Phase 18 checks passed.");

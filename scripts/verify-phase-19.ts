/**
 * Phase 19 Verification Script (v1.5 — Settings UI: Style Tab)
 *
 * Statically verifies that the Phase 19 contract is in place:
 *   SET-01: New "Style" 4th tab in settings.tsx — grid-cols-4, ImagePlus icon
 *   SET-02: Reference photo grid — 10 slots, drag & drop, file picker, X-to-delete on hover
 *   SET-03: Style description textarea — 1000 char limit with counter, save button, toast
 *
 * All checks are static (file existence + string search). No live Supabase connection required.
 *
 * Run with: npx tsx scripts/verify-phase-19.ts
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

const settingsPath = "client/src/pages/settings.tsx";
const settingsExists = existsSync(resolve(ROOT, settingsPath));
const settings = read(settingsPath);

// ── Section 1: SET-01 — 4th Style Tab structure ───────────────────────────────

console.log("\nSection 1: SET-01 — Style tab structure (client/src/pages/settings.tsx)");

check(
  "settings.tsx exists",
  settingsExists,
  `expected at ${settingsPath}`,
);

check(
  "TabsList uses grid-cols-4 (changed from grid-cols-3)",
  settings.includes("grid-cols-4"),
  'expected: <TabsList className="grid w-full grid-cols-4">',
);

check(
  'Style TabsTrigger with value="style" exists',
  settings.includes('value="style"'),
  'expected: <TabsTrigger value="style" ...>',
);

check(
  "ImagePlus icon is imported and used in Style tab trigger",
  settings.includes("ImagePlus"),
  'expected: ImagePlus in lucide-react import and in TabsTrigger',
);

// ── Section 2: SET-02 — Reference photo grid ──────────────────────────────────

console.log("\nSection 2: SET-02 — Reference photo grid");

check(
  "handleUploadPhoto function is defined in settings.tsx",
  settings.includes("async function handleUploadPhoto(file: File)"),
  'expected: async function handleUploadPhoto(file: File) { ... }',
);

check(
  "handleDeletePhoto function is defined in settings.tsx",
  settings.includes("async function handleDeletePhoto(photoId: string)"),
  'expected: async function handleDeletePhoto(photoId: string) { ... }',
);

check(
  "useQuery for /api/brand/reference-photos is declared (queryKey check)",
  settings.includes('queryKey: ["/api/brand/reference-photos"]'),
  'expected: queryKey: ["/api/brand/reference-photos"] in useQuery call',
);

check(
  "10-photo cap guard exists (photos.length >= 10)",
  settings.includes("photos.length >= 10"),
  'expected: if (photos.length >= 10) { toast(... Limit reached ...) }',
);

check(
  "5MB size guard exists (5 * 1024 * 1024)",
  settings.includes("5 * 1024 * 1024"),
  'expected: if (file.size > 5 * 1024 * 1024) { ... }',
);

check(
  "X button uses opacity-0 group-hover:opacity-100 hover pattern",
  settings.includes("opacity-0 group-hover:opacity-100"),
  'expected: className="... opacity-0 group-hover:opacity-100 ..."',
);

check(
  "Photo grid uses responsive grid-cols-3 sm:grid-cols-4 md:grid-cols-5 layout",
  settings.includes("grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5"),
  'expected: className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3"',
);

check(
  'File input restricts to image/* only',
  settings.includes('accept="image/*"'),
  'expected: <input type="file" accept="image/*" ... />',
);

check(
  "Storage upload uses upsert: false",
  settings.includes("upsert: false"),
  'expected: .upload(filePath, file, { upsert: false })',
);

check(
  "Storage path uses references/ subdirectory",
  settings.includes("/references/"),
  'expected: `${user.id}/references/${crypto.randomUUID()}.${ext}`',
);

check(
  "POST to /api/brand/reference-photos via apiRequest",
  settings.includes('apiRequest("POST", "/api/brand/reference-photos"'),
  'expected: await apiRequest("POST", "/api/brand/reference-photos", { photo_url: publicUrl })',
);

check(
  "DELETE to /api/brand/reference-photos/:id via apiRequest",
  settings.includes('apiRequest("DELETE", `/api/brand/reference-photos/${photoId}`)'),
  'expected: await apiRequest("DELETE", `/api/brand/reference-photos/${photoId}`)',
);

// ── Section 3: SET-03 — Style description textarea ────────────────────────────

console.log("\nSection 3: SET-03 — Style description textarea and save");

check(
  "handleSaveStyleDescription function is defined in settings.tsx",
  settings.includes("async function handleSaveStyleDescription()"),
  'expected: async function handleSaveStyleDescription() { ... }',
);

check(
  "Textarea renders with maxLength={1000}",
  settings.includes("maxLength={1000}"),
  'expected: <Textarea maxLength={1000} ... />',
);

check(
  "Character counter {styleDescription.length}/1000 is rendered",
  settings.includes("styleDescription.length}/1000"),
  'expected: {styleDescription.length}/1000 in JSX',
);

check(
  "PATCH to /api/brand/style-description via apiRequest",
  settings.includes('apiRequest("PATCH", "/api/brand/style-description"'),
  'expected: await apiRequest("PATCH", "/api/brand/style-description", { style_description: ... })',
);

check(
  "style_description uses null-on-clear pattern (trim() || null)",
  settings.includes("style_description: styleDescription.trim() || null"),
  'expected: style_description: styleDescription.trim() || null',
);

check(
  "await refreshBrand() is called inside handleSaveStyleDescription",
  settings.includes("await refreshBrand()"),
  'expected: await refreshBrand() after PATCH in handleSaveStyleDescription',
);

check(
  'Save button has data-testid="button-save-style-description"',
  settings.includes('data-testid="button-save-style-description"'),
  'expected: data-testid="button-save-style-description" on Save button',
);

check(
  'Textarea has data-testid="textarea-style-description"',
  settings.includes('data-testid="textarea-style-description"'),
  'expected: data-testid="textarea-style-description" on Textarea',
);

// ── Section 4: Import correctness ─────────────────────────────────────────────

console.log("\nSection 4: Import correctness");

check(
  "BrandReferencePhotosResponse is imported from @shared/schema",
  settings.includes("type BrandReferencePhotosResponse") && settings.includes("@shared/schema"),
  'expected: import { ..., type BrandReferencePhotosResponse } from "@shared/schema"',
);

check(
  "queryClient and apiRequest imported from @/lib/queryClient",
  settings.includes('from "@/lib/queryClient"') && settings.includes("queryClient") && settings.includes("apiRequest"),
  'expected: import { queryClient, apiRequest } from "@/lib/queryClient"',
);

check(
  "Textarea imported from @/components/ui/textarea",
  settings.includes('from "@/components/ui/textarea"'),
  'expected: import { Textarea } from "@/components/ui/textarea"',
);

check(
  "styleDescription sync is inside the [brand] useEffect (single effect)",
  settings.includes("setStyleDescription(brand.style_description ?? \"\")"),
  'expected: setStyleDescription(brand.style_description ?? "") inside existing useEffect',
);

// ── Summary ───────────────────────────────────────────────────────────────────

const total = results.length;
const passed = total - failed;

console.log("\n=== Phase 19 Verification ===");
for (const line of results) console.log(line);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed. Phase 19 verification: ${passed}/${total} checks passed.`);
  process.exit(1);
}

console.log(`\nPhase 19 verification: ${passed}/${total} checks passed.`);

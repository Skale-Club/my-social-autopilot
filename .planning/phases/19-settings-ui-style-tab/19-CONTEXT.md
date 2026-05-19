---
phase: 19
name: Settings UI — Style Tab
milestone: v1.5
status: context_captured
date: 2026-05-16
mode: auto
---

# Phase 19 Context: Settings UI — Style Tab

## Phase Goal

Add a 4th "Style" tab to `client/src/pages/settings.tsx` with:
1. A reference photo upload grid (up to 10 slots — filled thumbnails + empty upload slots)
2. An optional style description textarea with save button

All changes are immediately reflected via TanStack Query cache invalidation.

## Requirements in Scope

- **SET-01**: New "Style" 4th tab in settings.tsx — grid-cols-3 → grid-cols-4, ImagePlus icon
- **SET-02**: Reference photo grid — 10 slots, drag & drop, file picker, X-to-delete on hover
- **SET-03**: Style description textarea — 1000 char limit with counter, save button, toast

## Key Decisions

### Tab Structure

Change `TabsList className="grid w-full grid-cols-3"` → `grid w-full grid-cols-4`.

Add 4th tab trigger:
```tsx
<TabsTrigger value="style" className="flex items-center gap-2">
  <ImagePlus className="w-4 h-4" />
  {t("Style")}
</TabsTrigger>
```

Add `ImagePlus` to the lucide-react import line (alongside existing icons). Tab is only rendered when brand exists (same guard as Info, Colors, Logo tabs — the existing `{brand ? ... : <Card><CardContent>No brand configured</CardContent></Card>}` pattern).

### Listing Photos — useQuery

```tsx
const { data: refPhotos, isLoading: loadingPhotos } = useQuery<BrandReferencePhotosResponse>({
  queryKey: ["/api/brand/reference-photos"],
  enabled: !!brand,
});
const photos = refPhotos?.photos ?? [];
```

Uses the default `getQueryFn` (auto-injects auth headers from `getAuthHeaders()`). Import `BrandReferencePhotosResponse` from `@shared/schema`.

### Upload Flow (matches logo pattern exactly)

1. User picks file via file input or drops onto empty slot
2. Client validates: `file.size > 5 * 1024 * 1024` → show inline error toast, abort
3. Client validates: `photos.length >= 10` → show inline error toast, abort
4. Upload to Supabase Storage:
   ```tsx
   const sb = supabase();
   const ext = file.name.split(".").pop() || "jpg";
   const filePath = `${user.id}/references/${crypto.randomUUID()}.${ext}`;
   const { error: uploadError } = await sb.storage
     .from("user_assets")
     .upload(filePath, file, { upsert: false });
   const { data: { publicUrl } } = sb.storage.from("user_assets").getPublicUrl(filePath);
   ```
5. Call POST endpoint with token:
   ```tsx
   await apiRequest("POST", "/api/brand/reference-photos", { photo_url: publicUrl });
   ```
6. Invalidate query: `queryClient.invalidateQueries({ queryKey: ["/api/brand/reference-photos"] })`

`crypto.randomUUID()` is available in modern browsers — no polyfill needed. Import `apiRequest` from `@/lib/queryClient`.

### Delete Flow

```tsx
async function handleDeletePhoto(photoId: string) {
  await apiRequest("DELETE", `/api/brand/reference-photos/${photoId}`);
  queryClient.invalidateQueries({ queryKey: ["/api/brand/reference-photos"] });
}
```

No confirmation dialog — photos can be re-uploaded easily. X button shown on hover only (use `group` + `group-hover:opacity-100` pattern, same as logo X button).

### Photo Grid Layout

```
10 total slots displayed as a 5-column responsive grid:
- grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3
- Each slot: aspect-square rounded-xl border-2

Filled slot: thumbnail img, X button absolute top-right (opacity-0 group-hover:opacity-100)
Empty slot: dashed border, "+" centered, acts as label[for hidden input]
```

State: `uploadingSlot: string | null` — tracks which slot is uploading (shows Loader2 spinner).
State: `isDragActive: boolean` — tracks drag-over state on any empty slot.

One shared hidden `<input type="file" accept="image/*" />` triggered by clicking any empty slot. On drag-drop: `e.dataTransfer.files[0]` piped through same upload flow.

### Style Description

Initial value: `brand?.style_description ?? ""` (from auth context — `brand.select("*")` already returns this column after Phase 18 migration).

```tsx
const [styleDescription, setStyleDescription] = useState(brand?.style_description ?? "");
const [savingStyleDesc, setSavingStyleDesc] = useState(false);

async function handleSaveStyleDescription() {
  setSavingStyleDesc(true);
  await apiRequest("PATCH", "/api/brand/style-description", {
    style_description: styleDescription.trim() || null,
  });
  await refreshBrand(); // updates auth context so style_description is fresh
  setSavingStyleDesc(false);
  toast({ title: t("Style description saved") });
}
```

Character counter: `{styleDescription.length}/1000`. Textarea `maxLength={1000}`. Save button disabled when `savingStyleDesc`.

### State vars to add to SettingsPage

```tsx
const [uploadingPhoto, setUploadingPhoto] = useState(false);
const [isPhotoDragActive, setIsPhotoDragActive] = useState(false);
const [styleDescription, setStyleDescription] = useState(brand?.style_description ?? "");
const [savingStyleDesc, setSavingStyleDesc] = useState(false);
```

Also import from queryClient: `import { queryClient, apiRequest } from "@/lib/queryClient";`

### useEffect to sync styleDescription with brand

```tsx
useEffect(() => {
  if (brand) {
    setStyleDescription(brand.style_description ?? "");
  }
}, [brand]);
```

(Mirrors the existing `useEffect` that syncs companyName, colors, etc. from brand.)

### Tab Content Structure

```
TabsContent value="style"
  Card (Reference Photos)
    CardHeader: "Style References", description
    CardContent:
      [Photo grid — 10 slots]
      [if uploadingPhoto: loading state on uploading slot]
  Card (Style Description)
    CardHeader: "Visual Style", description
    CardContent:
      Textarea (value=styleDescription, onChange, maxLength=1000, placeholder)
      div.flex.justify-between: span "{n}/1000", Button "Save Style"
```

### Import additions

```tsx
// Lucide icons — add ImagePlus to existing import
import { Loader2, Check, Palette, Upload, ImageIcon, X, Building2, ShieldCheck, Trash2, ImagePlus } from "lucide-react";

// Add Textarea
import { Textarea } from "@/components/ui/textarea";

// QueryClient for mutations + useQuery
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Shared types
import { BrandReferencePhotosResponse } from "@shared/schema";
```

## Code Context (Reusable Assets)

| Asset | Location | Used For |
|-------|----------|----------|
| Logo upload drag-drop pattern | `settings.tsx:89-150` | Reference for upload flow, drag state |
| Logo X button hover pattern | `settings.tsx:579-588` | X button on photo thumbnails |
| `apiRequest` | `client/src/lib/queryClient.ts:48` | Authenticated POST/DELETE/PATCH |
| `getQueryFn` (default) | `queryClient.ts:68` | useQuery auth auto-inject |
| `useAuth` → `brand`, `refreshBrand`, `user` | `client/src/lib/auth.tsx` | brand.style_description, user.id |
| `supabase()` | `client/src/lib/supabase.ts` | Direct Supabase Storage upload |
| `useToast` | `@/hooks/use-toast` | Success/error toasts |
| `useTranslation` → `t()` | `@/hooks/useTranslation` | All user-facing strings |

## Canonical References

- ROADMAP.md Phase 19 section — 4 success criteria
- `client/src/pages/settings.tsx` — file to modify (existing 3-tab structure)
- `client/src/lib/queryClient.ts` — `apiRequest`, `getQueryFn` patterns
- `shared/schema.ts` — `BrandReferencePhoto`, `BrandReferencePhotosResponse` types (from Phase 18)
- `server/routes/brand-references.routes.ts` — API contract (endpoints from Phase 18)

## Out of Scope for This Phase

- Creator dialog toggle (Phase 20)
- Server-side generation injection (Phase 20)
- Drag-to-reorder photos (deferred from v1.5 entirely)
- Photo captions or metadata beyond position

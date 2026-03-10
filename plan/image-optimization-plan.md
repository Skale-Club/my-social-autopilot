# Image Storage Optimization Plan

## Objective

Reduce Supabase storage costs by 70-80% through image compression, automatic thumbnail generation, and lifecycle management.

---

## Current State Analysis

### Storage Structure
- **Bucket:** `user_assets`
- **Format:** PNG (uncompressed)
- **Average size:** 1-5MB per image
- **Thumbnails:** Optional, not auto-generated
- **Cleanup:** None (orphaned files remain)

### Cost Impact
| Plan | Storage | Images (current) | Images (optimized) |
|------|---------|------------------|-------------------|
| Free | 500MB | ~250 | ~1,500 |
| Pro | 8GB | ~4,000 | ~24,000 |

---

## Implementation Plan

### Phase 1: Image Compression Service

**Goal:** Convert PNG → WebP with 80% quality (70% size reduction)

#### 1.1 Add sharp dependency

```bash
npm install sharp
npm install -D @types/sharp
```

#### 1.2 Create Image Optimization Service

**File:** `server/services/image-optimization.service.ts`

```typescript
import sharp from 'sharp';

export interface OptimizedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ThumbnailOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_THUMBNAIL_OPTIONS: ThumbnailOptions = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 70,
};

/**
 * Optimize an image buffer to WebP format
 */
export async function optimizeImage(
  inputBuffer: Buffer,
  quality: number = 80
): Promise<OptimizedImage> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  
  const optimizedBuffer = await image
    .webp({ quality, effort: 4 })
    .toBuffer();
  
  return {
    buffer: optimizedBuffer,
    mimeType: 'image/webp',
    width: metadata.width || 0,
    height: metadata.height || 0,
    sizeBytes: optimizedBuffer.length,
  };
}

/**
 * Generate a thumbnail from an image buffer
 */
export async function generateThumbnail(
  inputBuffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<OptimizedImage> {
  const { maxWidth = 400, maxHeight = 400, quality = 70 } = options;
  
  const thumbnail = sharp(inputBuffer);
  const metadata = await thumbnail.metadata();
  
  const resizedBuffer = await thumbnail
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();
  
  return {
    buffer: resizedBuffer,
    mimeType: 'image/webp',
    width: Math.min(metadata.width || maxWidth, maxWidth),
    height: Math.min(metadata.height || maxHeight, maxHeight),
    sizeBytes: resizedBuffer.length,
  };
}

/**
 * Optimize and generate thumbnail in parallel
 */
export async function processImageWithThumbnail(
  inputBuffer: Buffer,
  imageQuality: number = 80,
  thumbnailOptions?: ThumbnailOptions
): Promise<{ image: OptimizedImage; thumbnail: OptimizedImage }> {
  const [image, thumbnail] = await Promise.all([
    optimizeImage(inputBuffer, imageQuality),
    generateThumbnail(inputBuffer, thumbnailOptions),
  ]);
  
  return { image, thumbnail };
}
```

---

### Phase 2: Update Generate Route

**File:** `server/routes/generate.routes.ts`

#### Changes needed:

1. Import optimization service
2. Process image after Gemini generation
3. Upload both image and thumbnail
4. Store content_type as 'image/webp'

```typescript
// After generating image with Gemini:
import { processImageWithThumbnail } from '../services/image-optimization.service.js';

// Replace current upload block:
const { image: optimizedImage, thumbnail } = await processImageWithThumbnail(imageBuffer);

// Upload optimized image
const imageUrl = await uploadFile(
  sb, 
  'user_assets', 
  `${user.id}/${postId}.webp`,  // Note: .webp extension
  optimizedImage.buffer, 
  'image/webp'
);

// Upload thumbnail
const thumbnailUrl = await uploadFile(
  sb,
  'user_assets',
  `${user.id}/thumbnails/${postId}.webp`,
  thumbnail.buffer,
  'image/webp'
);

// Save post with both URLs
await supabase.from('posts').insert({
  id: postId,
  user_id: user.id,
  image_url: imageUrl,
  thumbnail_url: thumbnailUrl,
  content_type: 'image',
  // ...
});
```

---

### Phase 3: Update Edit Route

**File:** `server/routes/edit.routes.ts`

Same pattern as generate route:
1. Optimize edited image
2. Generate thumbnail
3. Upload both

---

### Phase 4: Lifecycle Management

#### 4.1 Database Function for Orphan Detection

**File:** `supabase/migrations/YYYYMMDD_storage_cleanup.sql`

```sql
-- Function to list orphaned storage files
create or replace function public.get_orphaned_storage_paths()
returns table (path text, created_at timestamptz)
language plpgsql
security definer
as $$
begin
  -- This would need to be implemented based on Supabase storage schema
  -- Supabase stores file metadata in storage.objects
  return query
  select 
    o.name as path,
    o.created_at
  from storage.objects o
  where o.bucket_id = 'user_assets'
    and not exists (
      select 1 from public.posts p 
      where p.image_url like '%' || o.name || '%'
         or p.thumbnail_url like '%' || o.name || '%'
    )
    and o.created_at < now() - interval '7 days';
end;
$$;
```

#### 4.2 Cleanup Edge Function (Optional)

Create a Supabase Edge Function to run weekly cleanup:

```typescript
// supabase/functions/storage-cleanup/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Get orphaned files
  const { data: orphans } = await supabase
    .rpc('get_orphaned_storage_paths');
  
  if (!orphans?.length) {
    return new Response(JSON.stringify({ deleted: 0 }));
  }
  
  // Delete files
  const pathsToDelete = orphans.map(o => o.path);
  const { error } = await supabase.storage
    .from('user_assets')
    .remove(pathsToDelete);
  
  return new Response(JSON.stringify({ 
    deleted: pathsToDelete.length,
    error 
  }));
});
```

---

### Phase 5: Version Limit

#### 5.1 Add Migration for Version Limit

```sql
-- Add trigger to limit versions per post
create or replace function public.limit_post_versions()
returns trigger
language plpgsql
as $$
declare
  max_versions int := 10;
  versions_to_delete uuid[];
begin
  -- Check if we exceed max versions
  select array_agg(id) into versions_to_delete
  from (
    select id
    from public.post_versions
    where post_id = new.post_id
    order by version_number desc
    offset max_versions
  ) sub;
  
  -- Delete old versions
  if versions_to_delete is not null then
    delete from public.post_versions
    where id = any(versions_to_delete);
  end if;
  
  return new;
end;
$$;

create trigger limit_post_versions_trigger
  after insert on public.post_versions
  for each row
  execute function public.limit_post_versions();
```

---

## Migration Strategy

### Step 1: Deploy New Code (Zero Downtime)
1. Add `sharp` dependency
2. Create optimization service
3. Update routes to use optimization
4. Deploy

### Step 2: Backfill Existing Images (Optional)
Create a script to re-optimize existing PNGs:

```typescript
// scripts/optimize-existing-images.ts
import { createClient } from '@supabase/supabase-js';
import { processImageWithThumbnail } from '../server/services/image-optimization.service';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: posts } = await supabase
    .from('posts')
    .select('id, image_url')
    .is('thumbnail_url', null)
    .limit(100);
  
  for (const post of posts || []) {
    // Download image
    const response = await fetch(post.image_url);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Optimize
    const { image, thumbnail } = await processImageWithThumbnail(buffer);
    
    // Upload new versions
    // ... upload logic
    
    // Update post
    await supabase
      .from('posts')
      .update({ 
        image_url: newImageUrl,
        thumbnail_url: newThumbnailUrl 
      })
      .eq('id', post.id);
    
    console.log(`Optimized post ${post.id}`);
  }
}

main();
```

---

## Expected Results

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Image size | ~2MB | ~400KB | 80% |
| Thumbnail size | N/A | ~50KB | - |
| Storage per 1000 images | ~2GB | ~450MB | 77.5% |
| Bandwidth per 1000 views | ~2GB | ~50MB* | 97.5% |

*With thumbnails served in gallery view

---

## Files to Create/Modify

### New Files
- `server/services/image-optimization.service.ts`
- `supabase/migrations/YYYYMMDD_storage_cleanup.sql`
- `supabase/functions/storage-cleanup/index.ts` (optional)

### Modified Files
- `server/routes/generate.routes.ts`
- `server/routes/edit.routes.ts`
- `package.json` (add sharp)

---

## Timeline

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Compression Service | 2h | High |
| Phase 2: Update Generate Route | 1h | High |
| Phase 3: Update Edit Route | 1h | High |
| Phase 4: Lifecycle Management | 3h | Medium |
| Phase 5: Version Limit | 1h | Medium |
| Backfill Script | 2h | Low |

**Total: ~10 hours**

---

## Next Steps

1. [ ] Approve plan
2. [ ] Implement Phase 1 (compression service)
3. [ ] Implement Phase 2 (generate route)
4. [ ] Implement Phase 3 (edit route)
5. [ ] Test with real images
6. [ ] Deploy to production
7. [ ] Implement Phase 4 & 5 (optional)
8. [ ] Run backfill script (optional)

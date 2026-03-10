/**
 * Storage Cleanup Service
 * Handles deletion of orphaned files from Supabase Storage
 * Works in conjunction with the version_cleanup_log table
 */

import { createAdminSupabase } from "../supabase.js";

interface CleanupItem {
    id: string;
    image_url: string;
    thumbnail_url: string | null;
}

/**
 * Extract storage path from public URL
 */
function extractPathFromUrl(url: string): string | null {
    try {
        const urlObj = new URL(url);
        // Path format: /storage/v1/object/public/user_assets/{path}
        const match = urlObj.pathname.match(/\/user_assets\/(.+)$/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

/**
 * Process pending storage cleanup items
 * Should be called periodically or after version creation
 */
export async function processStorageCleanup(batchSize: number = 50): Promise<number> {
    const supabase = createAdminSupabase();

    // Get pending cleanup items
    const { data: pendingItems, error: fetchError } = await supabase
        .rpc("get_pending_storage_cleanup", { limit_count: batchSize });

    if (fetchError) {
        console.error("[Storage Cleanup] Failed to fetch pending items:", fetchError.message);
        return 0;
    }

    if (!pendingItems || pendingItems.length === 0) {
        return 0;
    }

    let cleanedCount = 0;

    for (const item of pendingItems as CleanupItem[]) {
        const filesToDelete: string[] = [];

        // Extract paths from URLs
        const imagePath = extractPathFromUrl(item.image_url);
        if (imagePath) filesToDelete.push(imagePath);

        if (item.thumbnail_url) {
            const thumbnailPath = extractPathFromUrl(item.thumbnail_url);
            if (thumbnailPath) filesToDelete.push(thumbnailPath);
        }

        if (filesToDelete.length === 0) {
            // Mark as cleaned even if no files to delete
            await supabase.rpc("mark_storage_cleaned", { p_id: item.id });
            continue;
        }

        // Delete files from storage
        const { error: deleteError } = await supabase.storage
            .from("user_assets")
            .remove(filesToDelete);

        if (deleteError) {
            console.warn(`[Storage Cleanup] Failed to delete files for item ${item.id}:`, deleteError.message);
            // Don't mark as cleaned if deletion failed
            continue;
        }

        // Mark as cleaned
        await supabase.rpc("mark_storage_cleaned", { p_id: item.id });
        cleanedCount++;
    }

    if (cleanedCount > 0) {
        console.log(`[Storage Cleanup] Cleaned up ${cleanedCount} version files`);
    }

    return cleanedCount;
}

/**
 * Delete files associated with a version when it's pushed out of the limit
 * This is called from the edit route after a new version is created
 */
export async function cleanupOldVersionFiles(
    imageUrl: string,
    thumbnailUrl: string | null
): Promise<boolean> {
    const supabase = createAdminSupabase();
    const filesToDelete: string[] = [];

    const imagePath = extractPathFromUrl(imageUrl);
    if (imagePath) filesToDelete.push(imagePath);

    if (thumbnailUrl) {
        const thumbnailPath = extractPathFromUrl(thumbnailUrl);
        if (thumbnailPath) filesToDelete.push(thumbnailPath);
    }

    if (filesToDelete.length === 0) {
        return true;
    }

    const { error } = await supabase.storage
        .from("user_assets")
        .remove(filesToDelete);

    if (error) {
        console.warn("[Storage Cleanup] Failed to delete old version files:", error.message);
        return false;
    }

    console.log(`[Storage Cleanup] Deleted ${filesToDelete.length} old version files`);
    return true;
}

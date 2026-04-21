/**
 * Carousel Generation Service (v1.1, Phase 6)
 * One master text call + N sequential image calls with thoughtSignature propagation.
 * Owns: storage upload + posts/post_slides DB writes (per D-16/D-17).
 * Does NOT own: route plumbing, SSE writer, credit deduction, idempotency lookup.
 */

import { createAdminSupabase } from "../supabase.js";
import { uploadFile } from "../storage.js";
import { processImageWithThumbnail } from "./image-optimization.service.js";
import { ensureCaptionQuality } from "./caption-quality.service.js";
import type { Brand, StyleCatalog, SupportedLanguage } from "../../shared/schema.js";

// ── Constants (D-02, D-03) ───────────────────────────────────────────────────

export const SLIDE_GENERATION_DELAY_MS = 3000; // D-02
export const RATE_LIMIT_BACKOFF_MS = 15_000; // D-03
export const ALLOWED_ASPECT_RATIOS = ["1:1", "4:5"] as const;
export type CarouselAspectRatio = typeof ALLOWED_ASPECT_RATIOS[number];

// ── Typed error hierarchy (D-14) ─────────────────────────────────────────────

export class CarouselTextPlanError extends Error {
    constructor(msg: string, public cause?: unknown) {
        super(msg);
        this.name = "CarouselTextPlanError";
    }
}

export class SlideGenerationError extends Error {
    constructor(msg: string, public slideNumber: number, public cause?: unknown) {
        super(msg);
        this.name = "SlideGenerationError";
    }
}

export class CarouselAbortedError extends Error {
    constructor(public savedSlideCount: number) {
        super(`Carousel aborted after ${savedSlideCount} slide(s)`);
        this.name = "CarouselAbortedError";
    }
}

export class CarouselFullFailureError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = "CarouselFullFailureError";
    }
}

export class CarouselInvalidAspectError extends Error {
    constructor(aspect: string) {
        super(`Invalid aspect ratio for carousel: ${aspect}. Allowed: 1:1, 4:5.`);
        this.name = "CarouselInvalidAspectError";
    }
}

// ── Params / progress / result contracts (D-15) ──────────────────────────────

export interface CarouselGenerationParams {
    userId: string;
    apiKey: string; // user's Gemini key
    brand: Brand;
    styleCatalog: StyleCatalog;
    prompt: string;
    slideCount: number; // 3..8 enforced by route schema
    aspectRatio: CarouselAspectRatio; // "1:1" | "4:5"
    postMood: string;
    contentLanguage: SupportedLanguage;
    idempotencyKey: string;
    textStyleIds?: string[];
    useLogo?: boolean;
    logoPosition?: string;
    signal?: AbortSignal;
    onProgress?: (event: CarouselProgressEvent) => void;
}

export type CarouselProgressEvent =
    | { type: "text_plan_start" }
    | { type: "text_plan_complete"; captionPreview: string }
    | { type: "slide_start"; slideNumber: number }
    | { type: "slide_complete"; slideNumber: number; imageUrl: string }
    | { type: "slide_failed"; slideNumber: number; reason: string }
    | { type: "complete"; savedSlideCount: number; status: "completed" | "draft" };

export interface CarouselSlideResult {
    slideNumber: number;
    imageUrl: string;
    thumbnailUrl: string | null;
}

export interface CarouselGenerationResult {
    postId: string;
    status: "completed" | "draft";
    slideCount: number; // actual successful slides
    slides: CarouselSlideResult[];
    caption: string;
    sharedStyle: string;
    tokenTotals: {
        textInputTokens: number;
        textOutputTokens: number;
        imageInputTokens: number; // summed across N image calls
        imageOutputTokens: number;
    };
    textModel: string; // "gemini-2.5-flash"
    imageModel: string; // "gemini-3.1-flash-image-preview"
}

// ── Public entrypoint (stub — implemented in Task 2) ─────────────────────────

// Touch imports referenced only by Task 2 helpers so Task-1 compile passes
// without "unused import" errors. Task 2 replaces the stub body with the
// real implementation that uses all of these.
void createAdminSupabase;
void uploadFile;
void processImageWithThumbnail;
void ensureCaptionQuality;

export async function generateCarousel(
    _params: CarouselGenerationParams,
): Promise<CarouselGenerationResult> {
    throw new Error("not implemented yet");
}

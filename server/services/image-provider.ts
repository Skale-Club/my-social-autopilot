/**
 * Image Provider Abstraction (Phase 12 — PROV-01)
 * Pluggable image-generation backend. Default: Gemini.
 */

import { generateImage, editImage } from "./image-generation.service.js";

// ── Canonical types (provider-agnostic) ───────────────────────────────────

export interface ReferenceImage {
  mimeType: string;  // e.g. "image/png", "image/webp", "image/jpeg"
  data: string;      // base64-encoded (no data: prefix)
}

export interface ImageGenerationInput {
  prompt: string;
  aspectRatio: string;      // "1:1" | "4:5" | "9:16" | "16:9"
  apiKey: string;
  resolution?: string;
  model?: string;
  referenceImages?: ReferenceImage[];
  logoImageData?: ReferenceImage | null;
}

export interface ImageEditInput {
  prompt: string;
  currentImage: ReferenceImage;          // base image being edited
  apiKey: string;
  model?: string;
  logoImageData?: ReferenceImage | null;
  additionalRefs?: ReferenceImage[];     // extra refs (carousel style consistency)
}

export interface ImageProviderResult {
  buffer: Buffer;
  mimeType: string;
  model?: string;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

export interface ImageProvider {
  readonly name: "gemini" | "openai";
  generate(input: ImageGenerationInput): Promise<ImageProviderResult>;
  edit(input: ImageEditInput): Promise<ImageProviderResult>;
}

// ── OpenAIImageProvider (stub — full implementation added in Plan 12-02) ─────
// This stub satisfies TypeScript compilation for the factory below.
// Plan 12-02 replaces this with the full Responses API implementation.

export class OpenAIImageProvider implements ImageProvider {
  readonly name = "openai" as const;

  async generate(_input: ImageGenerationInput): Promise<ImageProviderResult> {
    throw new Error("OpenAIImageProvider not yet implemented — awaiting Plan 12-02 merge");
  }

  async edit(_input: ImageEditInput): Promise<ImageProviderResult> {
    throw new Error("OpenAIImageProvider not yet implemented — awaiting Plan 12-02 merge");
  }
}

// ── GeminiImageProvider (default, thin wrapper) ───────────────────────────

export class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini" as const;

  async generate(input: ImageGenerationInput): Promise<ImageProviderResult> {
    const result = await generateImage({
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      model: input.model,
      apiKey: input.apiKey,
      referenceImages: input.referenceImages,
      logoImageData: input.logoImageData ?? null,
    });
    return {
      buffer: result.buffer,
      mimeType: result.mimeType,
      model: result.model,
      usage: result.usage,
    };
  }

  async edit(input: ImageEditInput): Promise<ImageProviderResult> {
    const result = await editImage({
      prompt: input.prompt,
      currentImageBase64: input.currentImage.data,
      currentImageMimeType: input.currentImage.mimeType,
      apiKey: input.apiKey,
      logoImageData: input.logoImageData ?? null,
      model: input.model,
    });
    return {
      buffer: result.buffer,
      mimeType: result.mimeType,
      model: result.model,
      usage: result.usage,
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────
import { getPlatformSetting } from "./app-settings.service.js";

export type ImageProviderName = "gemini" | "openai";

/**
 * Read platform_settings.image_provider and return the active provider
 * instance (PROV-04). Default: GeminiImageProvider when row missing or
 * unrecognized value (Pitfall 7 — null-row safe).
 *
 * No caching: setting changes rarely, and admin expects immediate effect
 * after toggling (12-RESEARCH.md anti-pattern: cache provider selection).
 */
export async function getActiveImageProvider(): Promise<ImageProvider> {
  const raw = await getPlatformSetting("image_provider");
  if (raw === "openai") {
    return new OpenAIImageProvider();
  }
  return new GeminiImageProvider();
}

/**
 * Read-only accessor for the configured provider name (admin UI / verify
 * script). Defaults to 'gemini' when row missing.
 */
export async function getActiveImageProviderName(): Promise<ImageProviderName> {
  const raw = await getPlatformSetting("image_provider");
  return raw === "openai" ? "openai" : "gemini";
}

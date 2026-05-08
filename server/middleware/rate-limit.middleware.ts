/**
 * AI endpoint rate limiting (HARD-01)
 *
 * Per-authenticated-user rate limiter for paid AI endpoints. Keys by req.user.id
 * (NOT IP — users behind shared NAT must not collectively get throttled).
 * Admin users (profile.is_admin === true) bypass the limit entirely.
 *
 * Storage: in-memory Map (built into express-rate-limit). Acceptable for the
 * current single-instance deploy. KNOWN LIMITATION for multi-instance: each
 * function instance has its own counter — see CONCERNS.md scalability section
 * for the migration to Redis or a Supabase-backed store when horizontal scaling
 * arrives.
 */

import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "./auth.middleware.js";

interface AiRateLimitOptions {
    max: number;        // requests per window
    windowMs: number;   // window length in ms
    endpointLabel?: string; // for log lines
}

/**
 * Default limits — overridable per-route. Values mirror the precedent in
 * translate.routes.ts (per-user, paid endpoints get a tighter cap than
 * transcribe).
 */
export const DEFAULT_AI_LIMITS = {
    // /api/generate, /api/edit-post, /api/carousel/generate, /api/enhance
    paid_image_video: {
        windowMs: Number(process.env.RATE_LIMIT_AI_WINDOW_MS) || 5 * 60 * 1000, // 5 min
        max: Number(process.env.RATE_LIMIT_AI_MAX) || 30,
    },
    // /api/transcribe — cheaper, higher cap
    transcribe: {
        windowMs: Number(process.env.RATE_LIMIT_TRANSCRIBE_WINDOW_MS) || 5 * 60 * 1000,
        max: Number(process.env.RATE_LIMIT_TRANSCRIBE_MAX) || 60,
    },
} as const;

export function aiRateLimit(opts: AiRateLimitOptions) {
    return rateLimit({
        windowMs: opts.windowMs,
        max: opts.max,
        keyGenerator: (req: Request) => {
            const authReq = req as AuthenticatedRequest;
            // Prefer authenticated user id; fall back to IP for unauthenticated
            // (route handlers run authenticateUser before this middleware in
            // every paid AI endpoint, so user.id is normally present).
            return authReq.user?.id ?? req.ip ?? "anon";
        },
        skip: (req: Request) => {
            const authReq = req as AuthenticatedRequest;
            return authReq.profile?.is_admin === true;
        },
        standardHeaders: "draft-7",   // RateLimit-* headers per IETF draft
        legacyHeaders: false,          // suppress X-RateLimit-*
        handler: (req: Request, res: Response) => {
            const authReq = req as AuthenticatedRequest;
            const retryAfter = Math.ceil(opts.windowMs / 1000);
            console.log(
                `[RateLimit] user=${authReq.user?.id ?? "anon"} endpoint=${req.path} retryAfter=${retryAfter}`,
            );
            res.set("Retry-After", String(retryAfter));
            res.status(429).json({
                error: "rate_limit_exceeded",
                retry_after_seconds: retryAfter,
            });
        },
    });
}

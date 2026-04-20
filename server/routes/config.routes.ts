/**
 * Config Routes - Public configuration endpoints
 * Handles app configuration and settings retrieval
 */

import { Router, Response } from "express";
import { config } from "../config/index.js";

const router = Router();

/**
 * GET /api/config
 * Returns public Supabase configuration for client-side initialization
 */
router.get("/api/config", (_, res: Response) => {
    res.json({
        supabaseUrl: config.SUPABASE_URL,
        supabaseAnonKey: config.SUPABASE_ANON_KEY,
    });
});

export default router;

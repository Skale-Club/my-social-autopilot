/**
 * Routes Index - Aggregates all route modules
 * This is the main entry point for registering all API routes
 */

import { Router } from "express";
import seoRoutes from "./seo.routes";
import configRoutes from "./config.routes";
import postsRoutes from "./posts.routes";
import styleCatalogRoutes from "./style-catalog.routes";
import generateRoutes from "./generate.routes";
import affiliateRoutes from "./affiliate.routes";
import affiliatePublicRoutes from "./affiliate-public.routes";
import markupRoutes from "./markup.routes";
import creditsRoutes from "./credits.routes";
import translateRoutes from "./translate.routes";
import transcribeRoutes from "./transcribe.routes";
import stripeRoutes from "./stripe.routes";

// Re-export for convenience
export { getStyleCatalogPayload } from "./style-catalog.routes";

/**
 * Create and configure the main router with all route modules
 */
export function createApiRouter(): Router {
    const router = Router();

    // Register route modules
    router.use(seoRoutes);
    router.use(configRoutes);
    router.use(postsRoutes);
    router.use(styleCatalogRoutes);
    router.use(generateRoutes);
    router.use(translateRoutes);
    router.use(transcribeRoutes);
    router.use(creditsRoutes);
    router.use(affiliatePublicRoutes);
    router.use(affiliateRoutes);
    router.use(markupRoutes);
    router.use(stripeRoutes);

    return router;
}

// Export individual route modules for selective registration
export {
    seoRoutes,
    configRoutes,
    postsRoutes,
    styleCatalogRoutes,
    generateRoutes,
    translateRoutes,
    transcribeRoutes,
    creditsRoutes,
    affiliatePublicRoutes,
    affiliateRoutes,
    markupRoutes,
    stripeRoutes,
};

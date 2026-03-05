import { z } from "zod";

/**
 * Environment variable schema validation
 * Validates all required environment variables at startup
 */

const envSchema = z.object({
    // Required Supabase configuration
    SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
    SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

    // Optional Gemini API key (required for non-admin/affiliate users)
    GEMINI_API_KEY: z.string().min(1).optional(),

    // Stripe configuration (optional for development)
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

    // Server configuration
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().regex(/^\d+$/).transform(Number).default("5000"),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * Throws an error with details if validation fails
 */
function validateEnv(): EnvConfig {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const errors = result.error.issues.map(
            (issue) => `  - ${issue.path.join(".")}: ${issue.message}`
        );

        console.error("\n❌ Environment variable validation failed:\n" + errors.join("\n"));
        console.error("\nPlease check your .env file and ensure all required variables are set.\n");

        // In development, allow the app to start with warnings
        // In production, fail fast
        if (process.env.NODE_ENV === "production") {
            process.exit(1);
        }

        // Return a partial config for development
        return {
            SUPABASE_URL: process.env.SUPABASE_URL || "",
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
            NODE_ENV: "development",
            PORT: 5000,
        };
    }

    return result.data;
}

/**
 * Validated configuration object
 * Use this instead of process.env directly
 */
export const config = validateEnv();

/**
 * Check if running in development mode
 */
export const isDevelopment = config.NODE_ENV === "development";

/**
 * Check if running in production mode
 */
export const isProduction = config.NODE_ENV === "production";

/**
 * Check if Gemini API is configured
 */
export const hasGeminiKey = Boolean(config.GEMINI_API_KEY);

/**
 * Check if Stripe is fully configured
 */
export const hasStripeConfig = Boolean(
    config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET
);

/**
 * Log configuration status on startup
 */
export function logConfigStatus(): void {
    console.log("\n📋 Configuration status:");
    console.log(`  Environment: ${config.NODE_ENV}`);
    console.log(`  Port: ${config.PORT}`);
    console.log(`  Supabase URL: ${config.SUPABASE_URL ? "✓ configured" : "✗ missing"}`);
    console.log(`  Gemini API: ${hasGeminiKey ? "✓ configured" : "⚠ not configured"}`);
    console.log(`  Stripe: ${hasStripeConfig ? "✓ configured" : "⚠ not configured"}`);
    console.log("");
}

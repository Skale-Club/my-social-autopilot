/**
 * Standardized error handling utilities
 * Provides consistent error responses across all API endpoints
 */

import { Response } from "express";

/**
 * Base application error class
 */
export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public code?: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = "AppError";
    }
}

/**
 * Pre-defined error types for common scenarios
 */
export class AuthenticationError extends AppError {
    constructor(message: string = "Authentication required") {
        super(message, 401, "authentication_required");
    }
}

export class InvalidAuthError extends AppError {
    constructor(message: string = "Invalid authentication") {
        super(message, 401, "invalid_authentication");
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = "Access denied") {
        super(message, 403, "forbidden");
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = "Resource") {
        super(`${resource} not found`, 404, "not_found");
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 400, "validation_error", details);
    }
}

export class InsufficientCreditsError extends AppError {
    constructor(
        public balanceMicros: number,
        public estimatedCostMicros: number
    ) {
        super("Insufficient credits. Add credits to continue.", 402, "insufficient_credits");
    }
}

export class ConfigurationError extends AppError {
    constructor(message: string) {
        super(message, 500, "configuration_error");
    }
}

export class ExternalServiceError extends AppError {
    constructor(service: string, message: string) {
        super(`${service} error: ${message}`, 502, "external_service_error");
    }
}

/**
 * Standard error response format
 */
interface ErrorResponse {
    error: string;
    message: string;
    details?: Record<string, unknown>;
}

/**
 * Send a standardized error response
 */
export function sendError(
    res: Response,
    error: AppError | Error
): void {
    if (error instanceof AppError) {
        const response: ErrorResponse = {
            error: error.code || "error",
            message: error.message,
        };

        if (error.details) {
            response.details = error.details;
        }

        // Special handling for specific error types
        if (error instanceof InsufficientCreditsError) {
            response.details = {
                balance_micros: error.balanceMicros,
                estimated_cost_micros: error.estimatedCostMicros,
            };
        }

        res.status(error.statusCode).json(response);
        return;
    }

    // Handle unknown errors
    console.error("Unhandled error:", error);

    res.status(500).json({
        error: "internal_error",
        message: "An unexpected error occurred",
    });
}

/**
 * Async handler wrapper that catches errors and passes them to Express error middleware
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
    fn: T
): T {
    return (async (...args: any[]) => {
        try {
            return await fn(...args);
        } catch (error) {
            const [, res, next] = args;
            if (error instanceof AppError) {
                sendError(res, error);
                return;
            }
            next(error);
        }
    }) as T;
}

/**
 * Type guard for checking if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Helper to create error responses for common scenarios
 */
export const Errors = {
    unauthorized: () => new AuthenticationError(),
    invalidAuth: () => new InvalidAuthError(),
    forbidden: () => new ForbiddenError(),
    notFound: (resource?: string) => new NotFoundError(resource),
    validation: (message: string, details?: Record<string, unknown>) =>
        new ValidationError(message, details),
    insufficientCredits: (balance: number, cost: number) =>
        new InsufficientCreditsError(balance, cost),
    configuration: (message: string) => new ConfigurationError(message),
    externalService: (service: string, message: string) =>
        new ExternalServiceError(service, message),
};

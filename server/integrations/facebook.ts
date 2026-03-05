/**
 * Facebook Conversions API Integration Service
 * 
 * Provides server-side event tracking via Facebook's Conversions API.
 * Supports PageView, Lead, CompleteRegistration, and Purchase events.
 * Implements SHA256 hashing for user data and event deduplication.
 */

import { createHash, randomUUID } from "crypto";

// Facebook Conversions API configuration
export interface FacebookConfig {
    pixelId: string;
    accessToken: string;
    testEventCode?: string;
}

// Facebook event types
export type FacebookEventName =
    | "PageView"
    | "Lead"
    | "CompleteRegistration"
    | "Purchase"
    | "ViewContent"
    | "AddToCart"
    | "InitiateCheckout"
    | "Subscribe";

// User data for Conversions API (all hashed with SHA256)
export interface FacebookUserData {
    email?: string;        // SHA256 hashed
    phone?: string;        // SHA256 hashed
    firstName?: string;    // SHA256 hashed
    lastName?: string;     // SHA256 hashed
    country?: string;      // ISO 2-letter code, lowercase
    state?: string;        // ISO state code, lowercase
    city?: string;         // Lowercase
    zip?: string;          // Lowercase
    externalId?: string;   // SHA256 hashed
    fbc?: string;          // Facebook Click ID
    fbp?: string;          // Facebook Browser ID
    clientIpAddress?: string;
    clientUserAgent?: string;
}

// Custom data for events
export interface FacebookCustomData {
    currency?: string;
    value?: number;
    contentName?: string;
    contentCategory?: string;
    contentIds?: string[];
    contentType?: string;
    numItems?: number;
    status?: string;
    [key: string]: unknown;
}

// Event payload
export interface FacebookEvent {
    eventName: FacebookEventName;
    eventId?: string;        // For deduplication
    eventTime: number;       // Unix timestamp
    eventSourceUrl?: string;
    userData: FacebookUserData;
    customData?: FacebookCustomData;
    actionSource: "website" | "email" | "other";
}

// API response
export interface FacebookEventResponse {
    success: boolean;
    eventId?: string;
    error?: string;
    fbTraceId?: string;
}

// Sync result for leads
export interface FacebookSyncResult {
    success: boolean;
    eventId?: string;
    error?: string;
}

const FACEBOOK_API_BASE = "https://graph.facebook.com/v18.0";

/**
 * SHA256 hash a string and return lowercase hex
 */
function sha256(value: string | undefined | null): string | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Normalize phone number for hashing (remove all non-digits)
 */
function normalizePhone(phone: string | undefined | null): string | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, "");
    if (!digits) return undefined;
    return digits;
}

/**
 * Generate a unique event ID for deduplication
 */
export function generateEventId(): string {
    return `evt_${Date.now()}_${randomUUID().replace(/-/g, "").substring(0, 16)}`;
}

/**
 * Mask an access token for display
 */
export function maskFacebookToken(token: string | null | undefined): string | null {
    if (!token || token.length < 16) {
        return token ? "********" : null;
    }
    return `${token.substring(0, 8)}${"*".repeat(8)}${token.substring(token.length - 8)}`;
}

/**
 * Build user data object with hashed fields
 */
export function buildFacebookUserData(data: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    state?: string;
    city?: string;
    zip?: string;
    externalId?: string;
    fbc?: string;
    fbp?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
}): FacebookUserData {
    return {
        email: sha256(data.email),
        phone: sha256(normalizePhone(data.phone)),
        firstName: sha256(data.firstName),
        lastName: sha256(data.lastName),
        country: data.country?.toLowerCase().substring(0, 2),
        state: sha256(data.state?.toLowerCase()),
        city: sha256(data.city?.toLowerCase()),
        zip: sha256(data.zip),
        externalId: sha256(data.externalId),
        fbc: data.fbc,
        fbp: data.fbp,
        clientIpAddress: data.clientIpAddress,
        clientUserAgent: data.clientUserAgent,
    };
}

/**
 * Send events to Facebook Conversions API
 */
export async function sendFacebookEvent(
    config: FacebookConfig,
    events: FacebookEvent[]
): Promise<FacebookEventResponse[]> {
    const url = `${FACEBOOK_API_BASE}/${config.pixelId}/events`;

    const requestData = {
        data: events.map((event) => ({
            event_name: event.eventName,
            event_time: event.eventTime,
            event_id: event.eventId,
            event_source_url: event.eventSourceUrl,
            action_source: event.actionSource,
            user_data: {
                em: event.userData.email ? [event.userData.email] : undefined,
                ph: event.userData.phone ? [event.userData.phone] : undefined,
                fn: event.userData.firstName,
                ln: event.userData.lastName,
                country: event.userData.country,
                st: event.userData.state,
                ct: event.userData.city,
                zp: event.userData.zip,
                external_id: event.userData.externalId ? [event.userData.externalId] : undefined,
                fbc: event.userData.fbc,
                fbp: event.userData.fbp,
                client_ip_address: event.userData.clientIpAddress,
                client_user_agent: event.userData.clientUserAgent,
            },
            custom_data: event.customData,
        })),
        access_token: config.accessToken,
        test_event_code: config.testEventCode,
    };

    // Remove undefined values
    const cleanRequestData = JSON.parse(JSON.stringify(requestData));

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(cleanRequestData),
        });

        const result = await response.json();

        if (!response.ok) {
            const error = result.error?.message || result.error?.error_user_msg || "Facebook API error";
            return events.map(() => ({
                success: false,
                error,
                fbTraceId: result.error?.fbtrace_id,
            }));
        }

        // Facebook returns array of results per event
        return events.map((event, index) => {
            const eventResult = result.events?.[index];
            return {
                success: true,
                eventId: event.eventId,
                fbTraceId: eventResult?.fb_trace_id,
            };
        });
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Network error";
        return events.map(() => ({
            success: false,
            error: errorMessage,
        }));
    }
}

/**
 * Send a single Lead event
 */
export async function sendLeadEvent(
    config: FacebookConfig,
    data: {
        eventId?: string;
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        country?: string;
        state?: string;
        city?: string;
        zip?: string;
        externalId?: string;
        fbc?: string;
        fbp?: string;
        clientIpAddress?: string;
        clientUserAgent?: string;
        eventSourceUrl?: string;
        contentName?: string;
        contentCategory?: string;
    }
): Promise<FacebookSyncResult> {
    const event: FacebookEvent = {
        eventName: "Lead",
        eventId: data.eventId || generateEventId(),
        eventTime: Math.floor(Date.now() / 1000),
        eventSourceUrl: data.eventSourceUrl,
        userData: buildFacebookUserData(data),
        customData: {
            contentName: data.contentName || "Lead Form Submission",
            contentCategory: data.contentCategory || "Lead",
            status: "completed",
        },
        actionSource: "website",
    };

    const results = await sendFacebookEvent(config, [event]);
    const result = results[0];

    return {
        success: result.success,
        eventId: event.eventId,
        error: result.error,
    };
}

/**
 * Send a CompleteRegistration event
 */
export async function sendCompleteRegistrationEvent(
    config: FacebookConfig,
    data: {
        eventId?: string;
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        externalId?: string;
        fbc?: string;
        fbp?: string;
        clientIpAddress?: string;
        clientUserAgent?: string;
        eventSourceUrl?: string;
        registrationMethod?: string;
    }
): Promise<FacebookSyncResult> {
    const event: FacebookEvent = {
        eventName: "CompleteRegistration",
        eventId: data.eventId || generateEventId(),
        eventTime: Math.floor(Date.now() / 1000),
        eventSourceUrl: data.eventSourceUrl,
        userData: buildFacebookUserData(data),
        customData: {
            registrationMethod: data.registrationMethod || "email",
            status: "completed",
        },
        actionSource: "website",
    };

    const results = await sendFacebookEvent(config, [event]);
    const result = results[0];

    return {
        success: result.success,
        eventId: event.eventId,
        error: result.error,
    };
}

/**
 * Send a Purchase event
 */
export async function sendPurchaseEvent(
    config: FacebookConfig,
    data: {
        eventId?: string;
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        externalId?: string;
        fbc?: string;
        fbp?: string;
        clientIpAddress?: string;
        clientUserAgent?: string;
        eventSourceUrl?: string;
        currency?: string;
        value?: number;
        contentIds?: string[];
        contentType?: string;
        numItems?: number;
    }
): Promise<FacebookSyncResult> {
    const event: FacebookEvent = {
        eventName: "Purchase",
        eventId: data.eventId || generateEventId(),
        eventTime: Math.floor(Date.now() / 1000),
        eventSourceUrl: data.eventSourceUrl,
        userData: buildFacebookUserData(data),
        customData: {
            currency: data.currency || "USD",
            value: data.value || 0,
            contentIds: data.contentIds,
            contentType: data.contentType || "product",
            numItems: data.numItems,
        },
        actionSource: "website",
    };

    const results = await sendFacebookEvent(config, [event]);
    const result = results[0];

    return {
        success: result.success,
        eventId: event.eventId,
        error: result.error,
    };
}

/**
 * Send a PageView event
 */
export async function sendPageViewEvent(
    config: FacebookConfig,
    data: {
        eventId?: string;
        fbc?: string;
        fbp?: string;
        clientIpAddress?: string;
        clientUserAgent?: string;
        eventSourceUrl?: string;
    }
): Promise<FacebookSyncResult> {
    const event: FacebookEvent = {
        eventName: "PageView",
        eventId: data.eventId || generateEventId(),
        eventTime: Math.floor(Date.now() / 1000),
        eventSourceUrl: data.eventSourceUrl,
        userData: {
            fbc: data.fbc,
            fbp: data.fbp,
            clientIpAddress: data.clientIpAddress,
            clientUserAgent: data.clientUserAgent,
        },
        actionSource: "website",
    };

    const results = await sendFacebookEvent(config, [event]);
    const result = results[0];

    return {
        success: result.success,
        eventId: event.eventId,
        error: result.error,
    };
}

/**
 * Test Facebook Conversions API connection
 */
export async function testFacebookConnection(config: FacebookConfig): Promise<{
    success: boolean;
    error?: string;
}> {
    // Send a test PageView event with test_event_code
    const testEvent: FacebookEvent = {
        eventName: "PageView",
        eventId: `test_${Date.now()}`,
        eventTime: Math.floor(Date.now() / 1000),
        userData: {},
        actionSource: "website",
    };

    const testConfig: FacebookConfig = {
        ...config,
        testEventCode: config.testEventCode || "TEST_EVENT_CODE",
    };

    const results = await sendFacebookEvent(testConfig, [testEvent]);
    const result = results[0];

    if (result.success) {
        return { success: true };
    }

    return {
        success: false,
        error: result.error || "Connection test failed",
    };
}

// Export service object for convenience
export const facebookService = {
    sendEvent: sendFacebookEvent,
    sendLeadEvent,
    sendCompleteRegistrationEvent,
    sendPurchaseEvent,
    sendPageViewEvent,
    testConnection: testFacebookConnection,
    generateEventId,
    buildUserData: buildFacebookUserData,
    maskToken: maskFacebookToken,
};

export default facebookService;

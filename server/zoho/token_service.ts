/**
 * =====================================================================
 * ZOHO BOOKS TOKEN SERVICE (server-side only)
 * ---------------------------------------------------------------------
 * Reusable helper that turns the one-time Zoho OAuth refresh token
 * (set up once by an administrator) into short-lived access tokens on
 * demand, so the Purchase Team never has to re-authorize Zoho.
 *
 * SECURITY:
 * - ZOHO_BOOKS_CLIENT_SECRET and ZOHO_BOOKS_REFRESH_TOKEN are read only
 *   from process.env here and are never sent to the frontend.
 * - Only the resulting short-lived access token is cached in memory,
 *   and only inside this backend process.
 * =====================================================================
 */

const ZOHO_BOOKS_CLIENT_ID = process.env.ZOHO_BOOKS_CLIENT_ID || "";
const ZOHO_BOOKS_CLIENT_SECRET = process.env.ZOHO_BOOKS_CLIENT_SECRET || "";
const ZOHO_BOOKS_REFRESH_TOKEN = process.env.ZOHO_BOOKS_REFRESH_TOKEN || "";
// India data center OAuth/account server (per Zoho Books account region).
const ZOHO_BOOKS_ACCOUNTS_URL =
    process.env.ZOHO_BOOKS_ACCOUNTS_URL || "https://accounts.zoho.in";

export function isZohoConfigured(): boolean {
    return Boolean(
        ZOHO_BOOKS_CLIENT_ID && ZOHO_BOOKS_CLIENT_SECRET && ZOHO_BOOKS_REFRESH_TOKEN
    );
}

let cachedAccessToken: string | null = null;
// Refresh a little before actual expiry to avoid edge-of-window failures.
let cachedTokenExpiresAt = 0;
const EXPIRY_SAFETY_MARGIN_MS = 60 * 1000;

// Avoid firing multiple concurrent refresh requests if several PO syncs
// happen to land at the same time.
let inFlightRefresh: Promise<string> | null = null;

async function requestNewAccessToken(): Promise<string> {
    if (!isZohoConfigured()) {
        throw new Error("ZOHO_NOT_CONFIGURED");
    }

    const url = new URL("/oauth/v2/token", ZOHO_BOOKS_ACCOUNTS_URL);
    url.searchParams.set("refresh_token", ZOHO_BOOKS_REFRESH_TOKEN);
    url.searchParams.set("client_id", ZOHO_BOOKS_CLIENT_ID);
    url.searchParams.set("client_secret", ZOHO_BOOKS_CLIENT_SECRET);
    url.searchParams.set("grant_type", "refresh_token");

    const res = await fetch(url.toString(), { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.access_token) {
        // Never log the refresh token / client secret / response body verbatim,
        // since Zoho error payloads can sometimes echo request parameters.
        console.error(
            "[zoho-token] Failed to refresh access token. HTTP status:",
            res.status,
            "error:",
            data?.error || "unknown_error"
        );
        throw new Error("ZOHO_AUTH_FAILED");
    }

    const expiresInSeconds = Number(data.expires_in) || 3600;
    cachedAccessToken = data.access_token as string;
    cachedTokenExpiresAt = Date.now() + expiresInSeconds * 1000 - EXPIRY_SAFETY_MARGIN_MS;

    console.log("[zoho-token] Refreshed Zoho Books access token (expires in", expiresInSeconds, "s)");
    return cachedAccessToken;
}

/**
 * Returns a valid Zoho Books access token, refreshing it via the stored
 * refresh token whenever the cached one is missing or about to expire.
 */
export async function getZohoAccessToken(): Promise<string> {
    if (cachedAccessToken && Date.now() < cachedTokenExpiresAt) {
        return cachedAccessToken;
    }

    if (!inFlightRefresh) {
        inFlightRefresh = requestNewAccessToken().finally(() => {
            inFlightRefresh = null;
        });
    }

    return inFlightRefresh;
}

/** Forces the next call to fetch a brand new token (used after a 401 from Zoho). */
export function invalidateCachedZohoAccessToken() {
    cachedAccessToken = null;
    cachedTokenExpiresAt = 0;
}
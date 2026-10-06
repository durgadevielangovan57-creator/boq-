import {
    getZohoAccessToken,
    invalidateCachedZohoAccessToken,
} from "./token_service";

export const ZOHO_BOOKS_API_DOMAIN =
    process.env.ZOHO_BOOKS_API_DOMAIN || "https://www.zohoapis.in";
export const ZOHO_BOOKS_ORGANIZATION_ID =
    process.env.ZOHO_BOOKS_ORGANIZATION_ID || "";

// This Zoho Books organization is on the GST (India) edition, which
// requires every Purchase Order line item to declare a Tax, a Tax
// Exemption, or Reverse Charge - it will 422 ("Specify either a Tax or
// Tax Exemption or Reverse Charge.") otherwise, even if the item itself
// has no tax preference configured. These are optional, admin-configured
// fallbacks used only when a line item's own Zoho Books item has no tax
// of its own (see zoho_routes.ts). Precedence when resolving a line
// item's tax: 1) the item's own Zoho Books tax_id, 2) ZOHO_DEFAULT_TAX_ID,
// 3) ZOHO_DEFAULT_TAX_EXEMPTION_ID. If none apply, the sync fails with a
// clear, actionable message instead of guessing.
export const ZOHO_DEFAULT_TAX_ID = process.env.ZOHO_DEFAULT_TAX_ID || "";
export const ZOHO_DEFAULT_TAX_EXEMPTION_ID =
    process.env.ZOHO_DEFAULT_TAX_EXEMPTION_ID || "";

/**
 * Backend-only helper for calling the Zoho Books v3 API. Handles attaching
 * the (server-cached) OAuth access token and org id, and retries once after
 * refreshing the token on a 401. Never accepts or logs a raw token from the
 * caller - the token is always sourced from token_service.
 */
export async function zohoApiRequest(
    path: string,
    init: { method?: string; body?: any } = {}
): Promise<{ ok: boolean; status: number; data: any }> {
    const accessToken = await getZohoAccessToken();

    const url = new URL(`/books/v3${path}`, ZOHO_BOOKS_API_DOMAIN);
    if (!url.searchParams.has("organization_id")) {
        url.searchParams.set("organization_id", ZOHO_BOOKS_ORGANIZATION_ID);
    }

    const doFetch = async (token: string) =>
        fetch(url.toString(), {
            method: init.method || "GET",
            headers: {
                Authorization: `Zoho-oauthtoken ${token}`,
                "Content-Type": "application/json",
            },
            body: init.body ? JSON.stringify(init.body) : undefined,
        });

    let res = await doFetch(accessToken);

    // If Zoho says the access token is invalid/expired, refresh once and retry.
    if (res.status === 401) {
        invalidateCachedZohoAccessToken();
        const freshToken = await getZohoAccessToken();
        res = await doFetch(freshToken);
    }

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}
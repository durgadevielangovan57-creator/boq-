import { zohoApiRequest } from "./api_client";
import { normalizeCompanyNameKey, pickSearchToken } from "./matching";

export interface ZohoItemCandidate {
    itemId: string;
    itemName: string;
    // The item's own default tax in Zoho Books, when it has one configured.
    // GST (India) organizations require every PO line item to declare a
    // tax/tax-exemption/reverse-charge, so this is used first before falling
    // back to any org-level default (see zoho_routes.ts).
    taxId?: string | null;
    // Name/percentage of that same tax, when the search result included
    // them - used to classify intra vs inter-state (see classifyTax below)
    // without an extra lookup. May be null even when taxId is set, if Zoho's
    // search response didn't echo them back; callers fall back to
    // getZohoItemTax(itemId) in that case.
    taxName?: string | null;
    taxPercentage?: number | null;
}

export type ItemMatchResult =
    | { status: "matched"; candidate: ZohoItemCandidate; matchedBy: "exact_name" | "normalized_name" }
    | { status: "ambiguous"; candidates: ZohoItemCandidate[] }
    | { status: "not_found" }
    | { status: "error"; message: string };

// --- TEMPORARY SAFE DIAGNOSTIC ---------------------------------------
// Added to investigate why a correctly-classified intrastate PO is still
// reaching Zoho with an IGST tax after the classifyTax() fix. Logs only
// the tax-shape fields on a raw Zoho item/tax object - never anything
// resembling a credential (Zoho items/taxes carry no auth data). Remove
// once the actual tax structure this org's items use is confirmed.
function logRawItemTaxShape(context: string, raw: any) {
    if (!raw) return;
    console.log(`[zoho-sync][diagnostic] ${context} - raw item tax-shape fields`, {
        item_id: raw?.item_id ?? null,
        name: raw?.name ?? null,
        tax_id: raw?.tax_id ?? null,
        tax_name: raw?.tax_name ?? null,
        tax_percentage: raw?.tax_percentage ?? null,
        tax_type: raw?.tax_type ?? null,
        tax_specific_type: raw?.tax_specific_type ?? null,
        tax_group_id: raw?.tax_group_id ?? null,
        tax_group_name: raw?.tax_group_name ?? null,
        taxes: raw?.taxes ?? null,
        is_taxable: raw?.is_taxable ?? null,
    });
}
// --- END TEMPORARY SAFE DIAGNOSTIC -------------------------------------

function toCandidate(raw: any): ZohoItemCandidate | null {
    const itemId = raw?.item_id;
    const itemName = raw?.name;
    if (!itemId || !itemName) return null;
    logRawItemTaxShape("search result", raw);
    return {
        itemId: String(itemId),
        itemName: String(itemName),
        taxId: raw?.tax_id ? String(raw.tax_id) : null,
        taxName: raw?.tax_name ? String(raw.tax_name) : null,
        taxPercentage: raw?.tax_percentage !== undefined && raw?.tax_percentage !== null ? Number(raw.tax_percentage) : null,
    };
}

// Materials don't have legal-entity suffixes like vendors do, so we reuse
// the same punctuation/case/whitespace-insensitive key (suffix-stripping is
// a no-op here since material names won't contain "Ltd"/"Pvt"/etc words).
function namesMatch(a: string, b: string): boolean {
    const ka = normalizeCompanyNameKey(a);
    const kb = normalizeCompanyNameKey(b);
    return Boolean(ka) && ka === kb;
}

async function exactNameSearch(itemName: string): Promise<ZohoItemCandidate[]> {
    const res = await zohoApiRequest(`/items?name=${encodeURIComponent(itemName.trim())}`);
    if (!res.ok) return [];
    const items: any[] = Array.isArray(res.data?.items) ? res.data.items : [];
    return items.map(toCandidate).filter((c): c is ZohoItemCandidate => !!c);
}

async function containsNameSearch(searchText: string, limit = 25): Promise<{ ok: boolean; candidates: ZohoItemCandidate[]; message?: string }> {
    const trimmed = (searchText || "").trim();
    if (!trimmed) return { ok: true, candidates: [] };
    const res = await zohoApiRequest(`/items?name_contains=${encodeURIComponent(trimmed)}&per_page=${limit}`);
    if (!res.ok) {
        return { ok: false, candidates: [], message: res.data?.message || `Zoho Books item search failed (HTTP ${res.status}).` };
    }
    const items: any[] = Array.isArray(res.data?.items) ? res.data.items : [];
    return { ok: true, candidates: items.map(toCandidate).filter((c): c is ZohoItemCandidate => !!c) };
}

/**
 * Raw "contains" text search against Zoho Books items, exposed for the
 * manual-mapping search endpoint (mirrors searchZohoVendorContacts). Does
 * not apply our own name normalization - callers decide how to interpret
 * results.
 */
export async function searchZohoBooksItems(
    searchText: string,
    limit = 25
): Promise<{ ok: boolean; candidates: ZohoItemCandidate[]; message?: string }> {
    return containsNameSearch(searchText, limit);
}

export interface ZohoTax {
    taxId: string;
    taxName: string;
    taxPercentage: number;
    taxType: string | null;
    taxSpecificType: string | null;
    isInterState: boolean | null;
}

/**
 * Classifies a tax name as inter-state (true, IGST), intra-state (false,
 * GST/CGST+SGST), or unclassifiable (null, e.g. a non-GST or custom tax -
 * never assumed to be intra-state just because it isn't named "IGST").
 * Exported so zoho_routes.ts can classify an item's own tax_name the same
 * way it classifies the org's full tax list.
 *
 * Zoho Books commonly runs the rate directly into the tax name with no
 * separator - e.g. "IGST18", "CGST9", "SGST9" - rather than "IGST 18%".
 * A trailing \b after the letters never matches in that form (both the
 * last letter and the following digit are word characters, so there's no
 * boundary between them), which previously made every such name fall
 * through as unclassified. Only a LEADING boundary is checked now, so
 * "IGST18" still matches while a name that merely contains "igst"/"gst"
 * as part of a longer, unrelated word would not.
 */
export function classifyTax(taxName: string | null | undefined, taxType?: string | null, taxSpecificType?: string | null): boolean | null {
    if (taxType === "tax_group") return false; // In Zoho India, tax groups combine CGST+SGST for intrastate
    if (taxSpecificType === "IGST") return true;
    if (taxSpecificType === "CGST" || taxSpecificType === "SGST") return false;

    const name = (taxName || "").trim();
    if (!name) return null;
    if (/\bigst/i.test(name)) return true;
    if (/\b(cgst|sgst)/i.test(name)) return false;
    return null;
}

/**
 * Lists this Zoho Books organization's configured taxes (Settings > Taxes),
 * used to populate the "Tax setup required" picker so the admin can choose
 * a real, existing tax by name instead of hunting for a raw tax id, and to
 * find an intra-state/inter-state equivalent of a given tax rate (see
 * findEquivalentTax below).
 */
export async function listZohoTaxes(): Promise<{ ok: boolean; taxes: ZohoTax[]; message?: string }> {
    const res = await zohoApiRequest(`/settings/taxes`);
    if (!res.ok) {
        return {
            ok: false,
            taxes: [],
            message: res.data?.message || `Failed to load Zoho Books taxes (HTTP ${res.status}).`,
        };
    }
    const taxes: any[] = Array.isArray(res.data?.taxes) ? res.data.taxes : [];
    // TEMPORARY SAFE DIAGNOSTIC - the org's full raw tax list, to confirm
    // exactly what /settings/taxes returns for this org (names, percentages,
    // and any tax_type/tax_specific_type fields) - no credentials here.
    console.log("[zoho-sync][diagnostic] raw Zoho org taxes (GET /settings/taxes)", {
        count: taxes.length,
        taxes: taxes.map((t) => ({
            tax_id: t?.tax_id ?? null,
            tax_name: t?.tax_name ?? null,
            tax_percentage: t?.tax_percentage ?? null,
            tax_type: t?.tax_type ?? null,
            tax_specific_type: t?.tax_specific_type ?? null,
        })),
    });
    return {
        ok: true,
        taxes: taxes
            .filter((t) => t?.tax_id && t?.tax_name)
            .map((t) => ({
                taxId: String(t.tax_id),
                taxName: String(t.tax_name),
                taxPercentage: Number(t.tax_percentage) || 0,
                taxType: t.tax_type ? String(t.tax_type) : null,
                taxSpecificType: t.tax_specific_type ? String(t.tax_specific_type) : null,
                isInterState: classifyTax(String(t.tax_name), t.tax_type, t.tax_specific_type),
            })),
    };
}

/**
 * TEMPORARY SAFE DIAGNOSTIC - fetches this org's Tax Groups (Settings >
 * Taxes > Tax Groups), a distinct Zoho Books concept from simple taxes:
 * a group (e.g. "GST18") bundles CGST9+SGST9 under its own id, and an
 * item can be configured with a tax_group_id instead of a plain tax_id.
 * Neither listZohoTaxes() nor getZohoItemTax() currently look at this
 * endpoint - logged here purely to confirm whether this org's items use
 * groups, so we know whether that's the missing piece. Not wired into
 * any production tax-selection logic. Remove once confirmed either way.
 */
export async function logZohoTaxGroupsDiagnostic(): Promise<void> {
    try {
        const res = await zohoApiRequest(`/settings/taxgroups`);
        const groups: any[] = Array.isArray(res.data?.tax_groups) ? res.data.tax_groups : [];
        console.log("[zoho-sync][diagnostic] raw Zoho tax groups (GET /settings/taxgroups)", {
            ok: res.ok,
            status: res.status,
            count: groups.length,
            groups: groups.map((g) => ({
                tax_group_id: g?.tax_group_id ?? null,
                tax_group_name: g?.tax_group_name ?? null,
                tax_percentage: g?.tax_percentage ?? null,
                taxes: Array.isArray(g?.taxes)
                    ? g.taxes.map((t: any) => ({ tax_id: t?.tax_id ?? null, tax_name: t?.tax_name ?? null }))
                    : null,
            })),
        });
    } catch (err: any) {
        console.log("[zoho-sync][diagnostic] GET /settings/taxgroups failed", { message: err?.message || String(err) });
    }
}

/**
 * Given an org's full tax list and a tax rate that's of the *wrong* type
 * for a transaction (e.g. an IGST18 tax on an intra-state PO), looks for
 * the matching-percentage counterpart of the correct type (e.g. an intra-
 * state 18% GST tax). Matches on percentage only, never on name text
 * beyond the intra/inter classification above - never guesses across
 * different rates. Returns undefined if no clean match exists.
 */
export function findEquivalentTax(
    taxes: ZohoTax[],
    percentage: number,
    wantInterState: boolean
): ZohoTax | undefined {
    const matches = taxes.filter(
        (t) => t.isInterState === wantInterState && Math.abs(t.taxPercentage - percentage) < 0.001
    );

    if (!wantInterState) {
        // Prioritize tax groups (CGST + SGST) over single taxes
        const groupMatch = matches.find(t => t.taxType === 'tax_group');
        if (groupMatch) return groupMatch;
    }

    return matches[0];
}

export interface ZohoItemTax {
    taxId: string;
    taxName: string | null;
    taxPercentage: number | null;
}

/**
 * Fetches a single Zoho Books item's own default tax (id, name and
 * percentage), for the case where a material's Zoho item mapping was
 * already cached (materials.zoho_item_id) so no search was performed and
 * no candidate with tax info is available. Returns null if the item has
 * no tax configured or the lookup fails (caller falls back to an
 * org-level default tax). Name/percentage are used to check the item's
 * tax against the transaction's required intra/inter-state type (see
 * zoho_routes.ts) - best-effort only, since not every Zoho item response
 * is guaranteed to echo tax_name/tax_percentage back.
 */
export async function getZohoItemTax(itemId: string): Promise<ZohoItemTax | null> {
    const trimmed = (itemId || "").trim();
    if (!trimmed) return null;
    try {
        const res = await zohoApiRequest(`/items/${encodeURIComponent(trimmed)}`);
        if (!res.ok) return null;
        const item = res.data?.item;
        logRawItemTaxShape("getZohoItemTax (cached-mapping path)", item);
        const taxId = item?.tax_id;
        if (!taxId) return null;
        return {
            taxId: String(taxId),
            taxName: item?.tax_name ? String(item.tax_name) : null,
            taxPercentage: item?.tax_percentage !== undefined && item?.tax_percentage !== null
                ? Number(item.tax_percentage)
                : null,
        };
    } catch {
        return null;
    }
}

/**
 * Back-compat convenience wrapper for callers that only need the id.
 */
export async function getZohoItemTaxId(itemId: string): Promise<string | null> {
    const tax = await getZohoItemTax(itemId);
    return tax?.taxId || null;
}

/**
 * Creates a brand-new item in Zoho Books for a material that genuinely
 * doesn't exist there yet. Used only as an explicit, user-initiated action
 * from the "Material mapping required" dialog (never automatically) - the
 * Purchase Team confirms the name and rate before anything is created.
 * Scoped to a single item creation call; the caller is responsible for
 * persisting the returned itemId against exactly one materials row.
 * If a default tax id is configured (see ZOHO_DEFAULT_TAX_ID), it's set on
 * the new item so future Purchase Orders for it don't need the org-level
 * fallback resolved every time.
 */
export async function createZohoBooksItem(
    name: string,
    rate: number,
    taxId?: string | null
): Promise<{ ok: boolean; candidate?: ZohoItemCandidate; message?: string }> {
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
        return { ok: false, message: "Item name is required." };
    }
    const safeRate = Number.isFinite(rate) && rate >= 0 ? rate : 0;

    const body: Record<string, any> = {
        name: trimmedName,
        rate: safeRate,
        purchase_rate: safeRate,
        product_type: "goods",
        item_type: "inventory",
    };
    if (taxId) {
        body.tax_id = taxId;
    }

    const res = await zohoApiRequest("/items", {
        method: "POST",
        body,
    });

    if (!res.ok || !res.data?.item?.item_id) {
        return {
            ok: false,
            message: res.data?.message || `Failed to create item in Zoho Books (HTTP ${res.status}).`,
        };
    }

    const candidate = toCandidate(res.data.item);
    if (!candidate) {
        return { ok: false, message: "Zoho Books returned an unexpected response while creating the item." };
    }
    return { ok: true, candidate };
}

/**
 * Attempts to safely resolve a BOQ material name to exactly one Zoho Books
 * item. Same safe-matching philosophy as findZohoVendorMatch: no fuzzy
 * scoring, no guessing on ambiguity.
 */
export async function findZohoItemMatch(materialName: string): Promise<ItemMatchResult> {
    const name = (materialName || "").trim();
    if (!name) return { status: "not_found" };

    try {
        let candidates = await exactNameSearch(name);

        if (candidates.length === 0) {
            const token = pickSearchToken(name);
            const broad = await containsNameSearch(token || name);
            if (!broad.ok) {
                return { status: "error", message: broad.message || "Zoho Books item search failed." };
            }
            candidates = broad.candidates;
        }

        const normalizedMatches = candidates.filter((c) => namesMatch(c.itemName, name));
        const uniqueById = Array.from(new Map(normalizedMatches.map((c) => [c.itemId, c])).values());

        if (uniqueById.length === 0) return { status: "not_found" };

        if (uniqueById.length === 1) {
            const exact = candidates.some(
                (c) => c.itemId === uniqueById[0].itemId && c.itemName.trim().toLowerCase() === name.toLowerCase()
            );
            return { status: "matched", candidate: uniqueById[0], matchedBy: exact ? "exact_name" : "normalized_name" };
        }

        return { status: "ambiguous", candidates: uniqueById };
    } catch (err: any) {
        return {
            status: "error",
            message: err?.message === "ZOHO_AUTH_FAILED" || err?.message === "ZOHO_NOT_CONFIGURED"
                ? err.message
                : "Zoho Books item search failed.",
        };
    }
}
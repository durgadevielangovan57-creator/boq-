import { zohoApiRequest } from "./api_client";
import { companyNamesMatch, phoneNumbersMatch, pickSearchToken } from "./matching";

export interface ZohoVendorCandidate {
    contactId: string;
    contactName: string;
    phone?: string | null;
}

export type VendorMatchResult =
    | { status: "matched"; candidate: ZohoVendorCandidate; matchedBy: "exact_name" | "normalized_name" | "normalized_name_and_phone" }
    | { status: "ambiguous"; candidates: ZohoVendorCandidate[] }
    | { status: "not_found" }
    | { status: "error"; message: string };

function toCandidate(raw: any): ZohoVendorCandidate | null {
    const contactId = raw?.contact_id;
    const contactName = raw?.contact_name;
    if (!contactId || !contactName) return null;
    return {
        contactId: String(contactId),
        contactName: String(contactName),
        phone: raw?.phone || raw?.mobile || null,
    };
}

/**
 * Raw text search against Zoho Books vendor contacts (contact_type=vendor).
 * Used both by the automatic matcher below and by the manual-mapping search
 * endpoint. Does not apply any of our own name normalization - callers
 * decide how to interpret results.
 */
export async function searchZohoVendorContacts(
    searchText: string,
    limit = 25
): Promise<{ ok: boolean; candidates: ZohoVendorCandidate[]; message?: string }> {
    const trimmed = (searchText || "").trim();
    if (!trimmed) return { ok: true, candidates: [] };

    const res = await zohoApiRequest(
        `/contacts?contact_type=vendor&contact_name_contains=${encodeURIComponent(
            trimmed
        )}&per_page=${limit}`
    );

    if (!res.ok) {
        return {
            ok: false,
            candidates: [],
            message: res.data?.message || `Zoho Books search failed (HTTP ${res.status}).`,
        };
    }

    const contacts: any[] = Array.isArray(res.data?.contacts) ? res.data.contacts : [];
    const candidates = contacts.map(toCandidate).filter((c): c is ZohoVendorCandidate => !!c);
    return { ok: true, candidates };
}

async function exactNameSearch(vendorName: string): Promise<ZohoVendorCandidate[]> {
    const res = await zohoApiRequest(
        `/contacts?contact_type=vendor&contact_name=${encodeURIComponent(vendorName.trim())}`
    );
    if (!res.ok) return [];
    const contacts: any[] = Array.isArray(res.data?.contacts) ? res.data.contacts : [];
    return contacts.map(toCandidate).filter((c): c is ZohoVendorCandidate => !!c);
}

export interface ZohoContactGstInfo {
    // State/UT code where the vendor is registered for GST purposes (e.g.
    // "TN", "KA") - this is what Zoho Books uses as source_of_supply on a
    // Purchase Order unless overridden. Null when Zoho has no place of
    // contact on file for this vendor (e.g. GST details were never filled
    // in on the contact).
    placeOfContact: string | null;
    // "overseas" contacts aren't part of India's intra/inter-state GST
    // split at all - callers should skip IGST-vs-CGST+SGST logic entirely
    // for these rather than force a classification that doesn't apply.
    gstTreatment: string | null;
}

/**
 * Fetches a vendor contact's GST place-of-contact (state/UT code), used to
 * determine whether a Purchase Order to this vendor is an intra-state or
 * inter-state transaction relative to our organization's home state (see
 * resolveTransactionType in zoho_routes.ts). Returns null fields rather
 * than throwing when the contact can't be read - callers treat that as
 * "unknown" and skip smart tax-type selection rather than guessing.
 */
export async function getZohoContactGstInfo(contactId: string): Promise<ZohoContactGstInfo> {
    const trimmed = (contactId || "").trim();
    if (!trimmed) return { placeOfContact: null, gstTreatment: null };
    try {
        const res = await zohoApiRequest(`/contacts/${encodeURIComponent(trimmed)}`);
        if (!res.ok) return { placeOfContact: null, gstTreatment: null };
        const contact = res.data?.contact || {};
        const placeOfContact = contact?.place_of_contact ? String(contact.place_of_contact).trim().toUpperCase() : null;
        const gstTreatment = contact?.gst_treatment ? String(contact.gst_treatment).trim().toLowerCase() : null;
        return { placeOfContact: placeOfContact || null, gstTreatment };
    } catch {
        return { placeOfContact: null, gstTreatment: null };
    }
}

/**
 * Attempts to safely resolve a BOQ vendor name (and optional phone number)
 * to exactly one Zoho Books vendor contact. Never guesses: returns
 * "ambiguous" when more than one distinct candidate survives normalized
 * matching, and "not_found" when none do.
 */
export async function findZohoVendorMatch(
    vendorName: string,
    vendorPhone?: string | null
): Promise<VendorMatchResult> {
    const name = (vendorName || "").trim();
    if (!name) return { status: "not_found" };

    try {
        // 1. Exact name search first (cheapest, most precise).
        let candidates = await exactNameSearch(name);

        // 2. Fall back to a broader "contains" search using the most
        // distinctive word in the name, then filter down ourselves using
        // strict (punctuation/case/suffix-insensitive, non-fuzzy) normalization.
        if (candidates.length === 0) {
            const token = pickSearchToken(name);
            const broad = await searchZohoVendorContacts(token || name);
            if (!broad.ok) {
                return { status: "error", message: broad.message || "Zoho Books vendor search failed." };
            }
            candidates = broad.candidates;
        }

        const normalizedMatches = candidates.filter((c) => companyNamesMatch(c.contactName, name));

        // De-duplicate by contact id (defensive - Zoho shouldn't return dupes).
        const uniqueById = Array.from(
            new Map(normalizedMatches.map((c) => [c.contactId, c])).values()
        );

        if (uniqueById.length === 0) {
            return { status: "not_found" };
        }

        if (uniqueById.length === 1) {
            const exact = candidates.some(
                (c) => c.contactId === uniqueById[0].contactId && c.contactName.trim().toLowerCase() === name.toLowerCase()
            );
            return {
                status: "matched",
                candidate: uniqueById[0],
                matchedBy: exact ? "exact_name" : "normalized_name",
            };
        }

        // 3. Multiple normalized matches - use phone as additional verification
        // to try to disambiguate, per the "safe matching" rules. Only accept
        // this if exactly one candidate's phone matches.
        if (vendorPhone) {
            const phoneMatches = uniqueById.filter((c) => phoneNumbersMatch(c.phone, vendorPhone));
            if (phoneMatches.length === 1) {
                return {
                    status: "matched",
                    candidate: phoneMatches[0],
                    matchedBy: "normalized_name_and_phone",
                };
            }
        }

        // Still ambiguous - do not guess.
        return { status: "ambiguous", candidates: uniqueById };
    } catch (err: any) {
        return {
            status: "error",
            message: err?.message === "ZOHO_AUTH_FAILED" || err?.message === "ZOHO_NOT_CONFIGURED"
                ? err.message
                : "Zoho Books vendor search failed.",
        };
    }
}
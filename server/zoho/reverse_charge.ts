import type { ZohoTax } from "./item_matching";

/**
 * Reverse charge (RCM) helpers for Zoho Books (India / GST edition).
 *
 * Zoho Books requires reverse charge on purchases from vendors whose GST
 * treatment is NOT "business_gst" (i.e. unregistered, consumer, overseas).
 * Otherwise PO creation fails with:
 *   "Reverse charge should be applied on import of services or purchases
 *    from unregistered vendors"
 *
 * Per the Zoho Books v3 Purchase Order API, reverse charge is expressed as:
 *   - header:  is_reverse_charge_applied: true
 *   - lines:   line_items[].reverse_charge_tax_id
 */

// Vendor GST treatments (Zoho contact.gst_treatment) that need reverse charge.
export const REVERSE_CHARGE_GST_TREATMENTS = ["business_none", "consumer", "overseas"];

export function vendorNeedsReverseCharge(gstTreatment: string | null | undefined): boolean {
    return !!gstTreatment && REVERSE_CHARGE_GST_TREATMENTS.includes(gstTreatment.trim().toLowerCase());
}

/** True when a Zoho error message is the "reverse charge required" validation. */
export function isReverseChargeRequiredError(message: string | null | undefined): boolean {
    return /reverse\s*charge/i.test(message || "");
}

/**
 * Picks the tax id to send as line_items[].reverse_charge_tax_id for a line
 * with the given GST %. Most Zoho orgs have no taxes literally named
 * "reverse charge", so the preference order is:
 *   1. an org tax explicitly named reverse / RCM with the same %
 *   2. the org's normal tax of the right type (IGST vs CGST+SGST) for that %
 *      (this is what Zoho's own "Reverse Charge Tax" dropdown lists)
 *   3. the tax already resolved for the line
 * Returns null when nothing usable exists.
 */
export function pickReverseChargeTaxId(params: {
    taxes: ZohoTax[];
    gstPercentage: number;
    isInterState: boolean | null;
    lineTaxId?: string | null;
}): string | null {
    const { taxes, gstPercentage, isInterState, lineTaxId } = params;
    const samePct = (t: ZohoTax) => Math.abs(t.taxPercentage - gstPercentage) < 0.001;

    const named = taxes.find(
        (t) => samePct(t) && /reverse|rcm/i.test(`${t.taxName} ${t.taxType || ""} ${t.taxSpecificType || ""}`)
    );
    if (named) return named.taxId;

    if (isInterState !== null) {
        const sameType = taxes.filter((t) => samePct(t) && t.isInterState === isInterState);
        // Prefer a tax group (CGST+SGST) for intra-state, same as normal tax selection.
        const group = !isInterState ? sameType.find((t) => t.taxType === "tax_group") : undefined;
        const match = group || sameType[0];
        if (match) return match.taxId;
    }

    return lineTaxId || null;
}

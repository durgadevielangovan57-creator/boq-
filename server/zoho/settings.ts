import { query } from "../db/client";

/**
 * Small persistent key/value store, scoped to this Zoho Books integration,
 * for admin-configured settings that shouldn't require a server restart or
 * redeploy the way an environment variable would (see ZOHO_DEFAULT_TAX_ID /
 * ZOHO_DEFAULT_TAX_EXEMPTION_ID in api_client.ts, which remain supported as
 * a lower-priority fallback). Currently used for a single, optional default
 * tax to satisfy Zoho Books GST (India) organizations, which require every
 * Purchase Order line item to declare a Tax, a Tax Exemption, or Reverse
 * Charge - set once from the "Tax setup required" dialog, reused forever
 * after.
 */
export async function ensureZohoSettingsSchema() {
    try {
        await query(`
      CREATE TABLE IF NOT EXISTS zoho_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    } catch (err: any) {
        console.warn("[zoho-settings] Could not verify/create zoho_settings table:", err?.message || err);
    }
}

export async function getZohoSetting(key: string): Promise<string | null> {
    try {
        const res = await query(`SELECT value FROM zoho_settings WHERE key = $1`, [key]);
        return res.rows[0]?.value ?? null;
    } catch {
        return null;
    }
}

export async function setZohoSetting(key: string, value: string): Promise<void> {
    await query(
        `INSERT INTO zoho_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value]
    );
}

export const DEFAULT_TAX_ID_KEY = "default_tax_id";
export const DEFAULT_TAX_EXEMPTION_ID_KEY = "default_tax_exemption_id";

// --- GST (India) intra-state vs inter-state support -----------------------
// Which specific tax (IGST vs CGST+SGST) is valid on a Purchase Order
// depends on the vendor's GST state relative to our organization's home
// state (Zoho Books rejects a mismatched tax outright, e.g. "IGST cannot
// be applied as this is an intrastate transaction"). Zoho's own APIs don't
// give us an unambiguous, code-formatted "our organization's home state"
// value to compare against (see zoho_routes.ts resolveTransactionType), so
// this is a one-time admin setting instead of something we guess - same
// philosophy as DEFAULT_TAX_ID_KEY above.
//
// ORG_STATE_CODE_KEY: our organization's GST state/UT code, e.g. "TN".
// Compared against each vendor contact's place_of_contact to classify a PO
// as intra-state (same code) or inter-state (different code). Leave unset
// to skip smart tax-type selection entirely (falls back to the previous,
// single-tax behavior with a clear error on mismatch).
export const ORG_STATE_CODE_KEY = "org_gst_state_code";
// Fallback default taxes used only when a material's own Zoho Books item
// has a tax of the *wrong* type for the transaction and no matching-rate
// counterpart exists in the org's tax list to auto-substitute (see
// findEquivalentTax in item_matching.ts). Optional; when unset, that case
// fails with a clear, actionable message instead of guessing a rate.
export const DEFAULT_INTRASTATE_TAX_ID_KEY = "default_intrastate_tax_id";
export const DEFAULT_INTERSTATE_TAX_ID_KEY = "default_interstate_tax_id";
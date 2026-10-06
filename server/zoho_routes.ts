import type { Express, Request, Response } from "express";
import { query } from "./db/client";
import { authMiddleware, requireRole } from "./middleware";
import { isZohoConfigured } from "./zoho/token_service";
import { zohoApiRequest, ZOHO_BOOKS_ORGANIZATION_ID, ZOHO_DEFAULT_TAX_ID, ZOHO_DEFAULT_TAX_EXEMPTION_ID } from "./zoho/api_client";
import { findZohoVendorMatch, searchZohoVendorContacts, getZohoContactGstInfo } from "./zoho/vendor_matching";
import { findZohoItemMatch, searchZohoBooksItems, createZohoBooksItem, getZohoItemTax, listZohoTaxes, findEquivalentTax, classifyTax, logZohoTaxGroupsDiagnostic } from "./zoho/item_matching";
import {
    ensureZohoSettingsSchema,
    getZohoSetting,
    setZohoSetting,
    DEFAULT_TAX_ID_KEY,
    DEFAULT_TAX_EXEMPTION_ID_KEY,
    ORG_STATE_CODE_KEY,
    DEFAULT_INTRASTATE_TAX_ID_KEY,
    DEFAULT_INTERSTATE_TAX_ID_KEY,
} from "./zoho/settings";

/**
 * =====================================================================
 * BOQ -> ZOHO BOOKS PURCHASE ORDER INTEGRATION (isolated, additive module)
 * ---------------------------------------------------------------------
 * - Does NOT modify server/routes.ts, existing PO calculations, the
 *   Annexure generation/download flow, or any existing table columns.
 * - Adds a small number of new, nullable columns (idempotent
 *   ADD COLUMN IF NOT EXISTS, same pattern as server/storage.ts) so the
 *   BOQ Purchase Order can remember its Zoho sync state.
 * - Exposes three new endpoints, all additive:
 *     POST /api/zoho-books/purchase-orders/:id/sync         - move PO to Zoho
 *     GET  /api/zoho-books/vendors/search?q=                - manual vendor search
 *     POST /api/zoho-books/purchase-orders/:id/map-vendor    - save manual vendor mapping
 * - Automatic vendor/material matching (see server/zoho/vendor_matching.ts
 *   and server/zoho/item_matching.ts) replaces the old requirement that an
 *   admin manually run SQL to set shops.zoho_contact_id / materials.zoho_item_id
 *   before every new vendor/material's first sync. Manual mapping remains
 *   as the fallback whenever a match can't be made safely.
 * =====================================================================
 */

// Statuses from which a PO is allowed to be sent to Zoho Books. Mirrors the
// same gate the existing frontend already uses for Download PDF / Download
// Excel (see PurchaseOrders.tsx / PurchaseOrderDetail.tsx: ['approved',
// 'ordered', 'delivered']), so "Move to Zoho Books" follows the same rule
// the Purchase Team already understands.
const SYNCABLE_STATUSES = ["approved", "ordered", "delivered"];

/** Adds the (nullable, additive-only) Zoho sync columns this feature needs. */
async function ensureZohoSchema() {
    try {
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS zoho_purchase_order_id TEXT`
        );
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS zoho_sync_status TEXT DEFAULT 'not_synced'`
        );
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS zoho_synced_at TIMESTAMPTZ`
        );
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS zoho_sync_error TEXT`
        );
        // Vendor -> Zoho Books Contact mapping. Reused if it already exists.
        await query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS zoho_contact_id TEXT`);
        // Fallback vendor mapping scoped to a single Purchase Order, used when
        // the PO's vendor was entered as free text and has no matching shops
        // row to persist a mapping against (see map-vendor route below) - lets
        // manual mapping still succeed and be remembered for retries of this
        // one PO, instead of hard-blocking with "contact the administrator".
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS zoho_vendor_contact_id TEXT`
        );
        // Material -> Zoho Books Item mapping. Reused if it already exists.
        await query(
            `ALTER TABLE materials ADD COLUMN IF NOT EXISTS zoho_item_id TEXT`
        );
        console.log("[zoho-routes] Zoho sync columns verified/created");
    } catch (err: any) {
        console.warn(
            "[zoho-routes] Could not verify/create Zoho sync columns:",
            err?.message || err
        );
    }
}

function safeLog(poId: string, message: string, extra?: Record<string, unknown>) {
    // Never log secrets or raw Zoho tokens - only safe, non-sensitive fields.
    console.log(`[zoho-sync] PO ${poId}: ${message}`, extra || "");
}

export async function registerZohoBooksRoutes(app: Express) {
    await ensureZohoSchema();
    await ensureZohoSettingsSchema();

    /**
     * Resolves the org-level default tax to fall back on when a material's
     * Zoho Books item has no tax of its own. Checks the DB-backed setting
     * first (set via the "Tax setup required" dialog - takes effect
     * immediately, no restart needed), then the ZOHO_DEFAULT_TAX_ID /
     * ZOHO_DEFAULT_TAX_EXEMPTION_ID environment variables as a lower-priority
     * fallback for deployments that prefer configuring it that way.
     */
    async function resolveDefaultTax(): Promise<{ taxId?: string; taxExemptionId?: string }> {
        const dbTaxId = await getZohoSetting(DEFAULT_TAX_ID_KEY);
        if (dbTaxId) return { taxId: dbTaxId };
        if (ZOHO_DEFAULT_TAX_ID) return { taxId: ZOHO_DEFAULT_TAX_ID };

        const dbExemptionId = await getZohoSetting(DEFAULT_TAX_EXEMPTION_ID_KEY);
        if (dbExemptionId) return { taxExemptionId: dbExemptionId };
        if (ZOHO_DEFAULT_TAX_EXEMPTION_ID) return { taxExemptionId: ZOHO_DEFAULT_TAX_EXEMPTION_ID };

        return {};
    }

    /**
     * Resolves the admin-configured fallback default tax for a specific
     * transaction type (intra-state or inter-state) - used only when a
     * material's own Zoho item tax is of the wrong type for this vendor and
     * no matching-rate counterpart exists in the org's tax list (see
     * findEquivalentTax). Falls back to the legacy single default tax
     * (DEFAULT_TAX_ID_KEY) so existing setups that never configured
     * type-specific defaults keep working exactly as before.
     */
    async function resolveDefaultTaxForType(isInterState: boolean): Promise<string | null> {
        const key = isInterState ? DEFAULT_INTERSTATE_TAX_ID_KEY : DEFAULT_INTRASTATE_TAX_ID_KEY;
        const specific = await getZohoSetting(key);
        if (specific) return specific;
        const legacy = await resolveDefaultTax();
        return legacy.taxId || null;
    }

    /**
     * Result of trying to determine whether a Purchase Order to a given
     * vendor is an intra-state or inter-state GST transaction.
     *
     * "overseas" means the vendor is an overseas Zoho contact, for which
     * India's intra/inter-state GST split doesn't apply at all - callers
     * treat this the same as before (skip smart tax-type selection, keep
     * the item's own tax untouched).
     *
     * "org_state_missing" and "vendor_state_missing" are genuine unknowns:
     * we cannot safely tell whether this PO is intra- or inter-state, so an
     * incorrect IGST/CGST+SGST tax could reach Zoho if we let the sync
     * continue. Callers MUST fail the sync before creating the Zoho
     * Purchase Order in these two cases rather than falling back to the
     * item's original tax.
     */
    type TransactionTypeResult =
        | { ok: true; isInterState: boolean; vendorStateCode: string; orgStateCode: string }
        | { ok: false; reason: "org_state_missing" }
        | { ok: false; reason: "vendor_state_missing" }
        | { ok: false; reason: "overseas" };

    /**
     * Determines whether a Purchase Order to a given vendor is an intra-state
     * or inter-state GST transaction, by comparing the vendor's Zoho Books
     * place_of_contact (GST state/UT code) against our organization's own
     * GST state code (an admin-configured setting - see ORG_STATE_CODE_KEY
     * in settings.ts for why this isn't auto-detected from Zoho).
     */
    async function resolveTransactionType(vendorContactId: string): Promise<TransactionTypeResult> {
        const orgStateCode = (await getZohoSetting(ORG_STATE_CODE_KEY))?.trim().toUpperCase();
        if (!orgStateCode) return { ok: false, reason: "org_state_missing" };

        const gstInfo = await getZohoContactGstInfo(vendorContactId);
        if (gstInfo.gstTreatment === "overseas") return { ok: false, reason: "overseas" };
        if (!gstInfo.placeOfContact) return { ok: false, reason: "vendor_state_missing" };

        return {
            ok: true,
            isInterState: gstInfo.placeOfContact !== orgStateCode,
            vendorStateCode: gstInfo.placeOfContact,
            orgStateCode,
        };
    }

    app.post(
        "/api/zoho-books/purchase-orders/:id/sync",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            const { id } = req.params;

            try {
                if (!isZohoConfigured()) {
                    return res.status(503).json({
                        message:
                            "Zoho Books authentication failed. Please contact the administrator.",
                    });
                }
                if (!ZOHO_BOOKS_ORGANIZATION_ID) {
                    return res.status(503).json({
                        message:
                            "Zoho Books is not fully configured. Please contact the administrator.",
                    });
                }

                // 1. Load PO + resolve vendor's Zoho contact mapping in one go.
                const poRes = await query(
                    `SELECT po.*,
                  COALESCE(po.vendor_name, s.name, po.vendor_id) as resolved_vendor_name,
                  s.id as vendor_shop_id,
                  s.zoho_contact_id as vendor_zoho_contact_id,
                  s.contactnumber as vendor_phone
           FROM purchase_orders po
           LEFT JOIN shops s
             ON (po.vendor_id::text = s.id::text OR TRIM(s.name) = TRIM(po.vendor_name))
           WHERE po.id = $1`,
                    [id]
                );

                if (poRes.rows.length === 0) {
                    return res.status(404).json({ message: "Purchase order not found." });
                }

                const po = poRes.rows[0];

                // 2. Duplicate protection: already synced -> return existing info, do
                // not create a second Zoho PO and do not re-send anything.
                if (po.zoho_sync_status === "synced" && po.zoho_purchase_order_id) {
                    return res.json({
                        zohoPurchaseOrderId: po.zoho_purchase_order_id,
                        zohoSyncStatus: "synced",
                        zohoSyncedAt: po.zoho_synced_at,
                        alreadySynced: true,
                    });
                }

                // Prevent duplicate concurrent clicks: atomically claim the PO by
                // moving it into 'syncing' only if it isn't already syncing/synced.
                const claim = await query(
                    `UPDATE purchase_orders
           SET zoho_sync_status = 'syncing', zoho_sync_error = NULL, updated_at = NOW()
           WHERE id = $1 AND (zoho_sync_status IS NULL OR zoho_sync_status NOT IN ('syncing', 'synced'))
           RETURNING id`,
                    [id]
                );
                if (claim.rows.length === 0) {
                    return res.status(409).json({
                        message:
                            "This Purchase Order is already being synced or has already been synced to Zoho Books.",
                    });
                }

                // 3. Validate PO status is appropriate for sending.
                if (!SYNCABLE_STATUSES.includes(String(po.status || "").toLowerCase())) {
                    const errorMessage = `Purchase Order must be Approved (or later) before it can be sent to Zoho Books. Current status: ${po.status}.`;
                    await query(
                        `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                        [errorMessage, id]
                    );
                    return res.status(400).json({ message: errorMessage });
                }

                // 4. Resolve vendor -> Zoho contact mapping.
                // 4a. If already mapped, reuse it directly - no Zoho search on every
                //     sync (see "Performance" requirement). A PO-level override
                //     (used when the vendor has no matching shops row - see
                //     map-vendor route) takes precedence since it's the more
                //     specific, most recently confirmed mapping for this exact PO.
                const vendorName = po.resolved_vendor_name || po.vendor_name || po.vendor_id;
                let vendorZohoContactId: string | null = po.zoho_vendor_contact_id || po.vendor_zoho_contact_id || null;

                if (!vendorZohoContactId) {
                    // 4b. No existing mapping - attempt a safe automatic match against
                    // Zoho Books vendor contacts (exact name, then normalized name,
                    // then phone as a disambiguator). Never guesses.
                    const match = await findZohoVendorMatch(vendorName, po.vendor_phone);

                    if (match.status === "matched") {
                        vendorZohoContactId = match.candidate.contactId;
                        safeLog(id, "vendor auto-matched to Zoho contact", {
                            vendorName,
                            zohoContactId: match.candidate.contactId,
                            matchedBy: match.matchedBy,
                        });

                        // 4c. Persist the mapping, scoped to exactly this vendor's shop
                        // row when one exists (benefits every future PO for this
                        // vendor), and only if it isn't already set (never overwrite an
                        // existing valid mapping here, and never touch other vendors).
                        // When there's no shops row at all (the vendor was entered as
                        // free text on this PO), fall back to storing the mapping
                        // against this one PO instead of losing it.
                        if (po.vendor_shop_id) {
                            await query(
                                `UPDATE shops SET zoho_contact_id = $1
                 WHERE id = $2 AND zoho_contact_id IS NULL`,
                                [vendorZohoContactId, po.vendor_shop_id]
                            );
                        } else {
                            await query(
                                `UPDATE purchase_orders SET zoho_vendor_contact_id = $1 WHERE id = $2`,
                                [vendorZohoContactId, id]
                            );
                            safeLog(id, "auto-matched vendor has no linked BOQ shop row - mapping saved against this PO only", { vendorName });
                        }
                    } else if (match.status === "ambiguous") {
                        const errorMessage = `Multiple Zoho Books vendors matched "${vendorName}". Please map the vendor manually.`;
                        await query(
                            `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                            [errorMessage, id]
                        );
                        safeLog(id, "vendor match ambiguous", { vendorName, candidateCount: match.candidates.length });
                        return res.status(422).json({
                            message: errorMessage,
                            zohoMappingRequired: true,
                            mappingType: "vendor",
                            candidates: match.candidates.map((c) => ({ id: c.contactId, name: c.contactName })),
                        });
                    } else if (match.status === "error") {
                        const isAuthError = match.message === "ZOHO_AUTH_FAILED" || match.message === "ZOHO_NOT_CONFIGURED";
                        const errorMessage = isAuthError
                            ? "Zoho Books authentication failed. Please contact the administrator."
                            : "Something went wrong while searching Zoho Books for this vendor. Please retry.";
                        await query(
                            `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                            [errorMessage, id]
                        );
                        return res.status(isAuthError ? 502 : 500).json({ message: errorMessage });
                    } else {
                        // not_found
                        const errorMessage = `Vendor "${vendorName}" was not found in Zoho Books. Please create/map the vendor before syncing this Purchase Order.`;
                        await query(
                            `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                            [errorMessage, id]
                        );
                        safeLog(id, "vendor not found in Zoho Books", { vendorName });
                        return res.status(422).json({ message: errorMessage, zohoMappingRequired: true, mappingType: "vendor", candidates: [] });
                    }
                }

                // 5. Load PO items and validate + resolve item mapping.
                const itemsRes = await query(
                    `SELECT poi.*, m.name as material_name, m.zoho_item_id as material_zoho_item_id
           FROM purchase_order_items poi
           LEFT JOIN materials m ON poi.material_id = m.id::text
           WHERE poi.po_id = $1
           ORDER BY poi.created_at ASC`,
                    [id]
                );

                if (itemsRes.rows.length === 0) {
                    const errorMessage = "Purchase Order has no items to send.";
                    await query(
                        `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                        [errorMessage, id]
                    );
                    return res.status(400).json({ message: errorMessage });
                }

                const lineItems: Array<{ item_id: string; name: string; quantity: number; rate: number; tax_id?: string; tax_exemption_id?: string }> = [];
                const defaultTax = await resolveDefaultTax();

                // Determine whether this PO is intra-state or inter-state relative
                // to our organization (see resolveTransactionType above), so each
                // line item's tax can be checked against it below.
                //
                // "overseas" is a legitimate case where India's intra/inter-state
                // split doesn't apply, so it falls through to `transactionType =
                // null` exactly as before (every line item below keeps whatever
                // tax it already had). "org_state_missing" and
                // "vendor_state_missing" are genuine unknowns and MUST fail the
                // sync now, before any item lookups or PO creation, rather than
                // silently sending a potentially-wrong tax to Zoho.
                // vendorZohoContactId is guaranteed non-null here: every branch
                // above that fails to resolve it already returned a response.
                const transactionTypeResult = await resolveTransactionType(vendorZohoContactId!);
                let transactionType: { isInterState: boolean; vendorStateCode: string; orgStateCode: string } | null = null;
                if (transactionTypeResult.ok) {
                    transactionType = transactionTypeResult;
                    safeLog(id, "GST transaction type resolved", {
                        orgState: transactionType.orgStateCode,
                        vendorState: transactionType.vendorStateCode,
                        transactionType: transactionType.isInterState ? "INTERSTATE" : "INTRASTATE",
                    });
                    // TEMPORARY SAFE DIAGNOSTIC - dump this org's Tax Groups once per
                    // sync attempt, to confirm whether items here use a tax_group_id
                    // (a distinct Zoho concept from a plain tax_id) instead of/in
                    // addition to a simple tax. Read-only; not used for selection.
                    await logZohoTaxGroupsDiagnostic();
                } else if (transactionTypeResult.reason === "org_state_missing") {
                    const errorMessage =
                        "Organization GST state is not configured. Please configure the organization GST state before syncing Purchase Orders.";
                    await query(
                        `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                        [errorMessage, id]
                    );
                    safeLog(id, "organization GST state not configured", {});
                    return res.status(422).json({ message: errorMessage, gstStateMissing: true, gstStateMissingReason: "organization" });
                } else if (transactionTypeResult.reason === "vendor_state_missing") {
                    const errorMessage =
                        "Unable to determine the vendor GST state. Please complete the vendor GST details before syncing this Purchase Order.";
                    await query(
                        `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                        [errorMessage, id]
                    );
                    safeLog(id, "vendor GST state not determinable", { vendorZohoContactId });
                    return res.status(422).json({ message: errorMessage, gstStateMissing: true, gstStateMissingReason: "vendor" });
                }
                // else "overseas": transactionType stays null, proceed exactly as
                // before (skip smart tax-type selection for this vendor).

                // Only fetched when actually needed (a mismatch shows up below), to
                // avoid an extra Zoho API call on every sync.
                let orgTaxesCache: Awaited<ReturnType<typeof listZohoTaxes>> | null = null;
                async function getOrgTaxes() {
                    if (!orgTaxesCache) orgTaxesCache = await listZohoTaxes();
                    return orgTaxesCache;
                }

                for (const row of itemsRes.rows) {
                    const displayName = row.material_name || row.item;
                    const qty = Number(row.qty);
                    const rate = Number(row.rate);

                    if (!qty || qty <= 0) {
                        const errorMessage = `Material "${displayName}" has an invalid quantity.`;
                        await query(
                            `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                            [errorMessage, id]
                        );
                        return res.status(422).json({ message: errorMessage });
                    }
                    if (rate === null || rate === undefined || isNaN(rate) || rate < 0) {
                        const errorMessage = `Material "${displayName}" has an invalid Purchase Rate.`;
                        await query(
                            `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                            [errorMessage, id]
                        );
                        return res.status(422).json({ message: errorMessage });
                    }

                    // Resolve material -> Zoho item mapping, same cached-first,
                    // safe-auto-match-second approach as vendor mapping above.
                    let materialZohoItemId: string | null = row.material_zoho_item_id || null;
                    // The item's own tax id in Zoho Books, when we can see it. Only
                    // populated here when a fresh search just returned it; the
                    // cached-mapping path below fetches it separately since a cached
                    // mapping means no search happened this time.
                    let materialTaxIdFromItem: string | null = null;
                    let materialTaxNameFromItem: string | null = null;
                    let materialTaxPercentageFromItem: number | null = null;

                    if (!materialZohoItemId) {
                        const itemMatch = await findZohoItemMatch(displayName);

                        if (itemMatch.status === "matched") {
                            materialZohoItemId = itemMatch.candidate.itemId;
                            materialTaxIdFromItem = itemMatch.candidate.taxId || null;
                            materialTaxNameFromItem = itemMatch.candidate.taxName ?? null;
                            materialTaxPercentageFromItem = itemMatch.candidate.taxPercentage ?? null;
                            safeLog(id, "material auto-matched to Zoho item", {
                                material: displayName,
                                zohoItemId: itemMatch.candidate.itemId,
                                matchedBy: itemMatch.matchedBy,
                            });
                            if (row.material_id) {
                                await query(
                                    `UPDATE materials SET zoho_item_id = $1 WHERE id::text = $2 AND zoho_item_id IS NULL`,
                                    [materialZohoItemId, String(row.material_id)]
                                );
                            }
                        } else if (itemMatch.status === "error") {
                            const isAuthError = itemMatch.message === "ZOHO_AUTH_FAILED" || itemMatch.message === "ZOHO_NOT_CONFIGURED";
                            const errorMessage = isAuthError
                                ? "Zoho Books authentication failed. Please contact the administrator."
                                : `Something went wrong while searching Zoho Books for material "${displayName}". Please retry.`;
                            await query(
                                `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                                [errorMessage, id]
                            );
                            safeLog(id, "item mapping search error", { material: displayName });
                            return res.status(isAuthError ? 502 : 500).json({ message: errorMessage });
                        } else {
                            // ambiguous or not_found - never guess. Return everything the
                            // frontend needs to offer either manual mapping to an existing
                            // Zoho Books item, or creating a brand-new one, scoped to this
                            // one material row.
                            const errorMessage =
                                itemMatch.status === "ambiguous"
                                    ? `Multiple Zoho Books items matched material "${displayName}". Please map the material manually.`
                                    : `A Zoho Books item could not be found for material "${displayName}".`;
                            await query(
                                `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                                [errorMessage, id]
                            );
                            safeLog(id, "item mapping unresolved", { material: displayName, status: itemMatch.status });
                            return res.status(422).json({
                                message: errorMessage,
                                zohoMappingRequired: true,
                                mappingType: "material",
                                materialId: row.material_id ? String(row.material_id) : null,
                                materialName: displayName,
                                materialRate: rate,
                                candidates:
                                    itemMatch.status === "ambiguous"
                                        ? itemMatch.candidates.map((c) => ({ id: c.itemId, name: c.itemName }))
                                        : [],
                            });
                        }
                    } else {
                        // Cached mapping - no search just happened, so fetch the item's
                        // own tax directly. Best-effort: a failed lookup here just
                        // means we fall through to the org-level default below instead
                        // of blocking the sync.
                        const itemTax = await getZohoItemTax(materialZohoItemId);
                        materialTaxIdFromItem = itemTax?.taxId || null;
                        materialTaxNameFromItem = itemTax?.taxName ?? null;
                        materialTaxPercentageFromItem = itemTax?.taxPercentage ?? null;
                    }

                    // A fresh item search sometimes returns tax_id without echoing
                    // back tax_name/tax_percentage - fetch them directly so the
                    // intra/inter-state check below can classify the tax. Best
                    // effort: a failed lookup just means this item's tax is left
                    // unclassified (treated as "don't touch it") rather than
                    // blocking the sync.
                    if (materialTaxIdFromItem && materialTaxNameFromItem === null && transactionType) {
                        const itemTax = await getZohoItemTax(materialZohoItemId!);
                        if (itemTax) {
                            materialTaxNameFromItem = itemTax.taxName;
                            materialTaxPercentageFromItem = itemTax.taxPercentage;
                        }
                    }

                    let targetGstPercentage = row.gst_percentage !== null && row.gst_percentage !== undefined ? Number(row.gst_percentage) : null;
                    if (targetGstPercentage === null) {
                        targetGstPercentage = materialTaxPercentageFromItem;
                    }

                    if (targetGstPercentage === null || targetGstPercentage === undefined || isNaN(targetGstPercentage)) {
                        const errorMessage = `GST rate is not configured for material '${displayName}'. Set the GST rate before syncing this Purchase Order.`;
                        await query(
                            `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                            [errorMessage, id]
                        );
                        safeLog(id, "GST rate missing", { material: displayName });
                        return res.status(422).json({ message: errorMessage });
                    }

                    let resolvedTaxId: string | null = null;
                    let resolvedTaxName: string | null = null;
                    let resolvedTaxType: string | null = null;

                    if (transactionType) {
                        const isInterStateTax = classifyTax(materialTaxNameFromItem);
                        const isCorrectType = isInterStateTax !== null && isInterStateTax === transactionType.isInterState;
                        const isCorrectPercentage = materialTaxPercentageFromItem !== null && Math.abs(materialTaxPercentageFromItem - targetGstPercentage) < 0.001;

                        if (materialTaxIdFromItem && isCorrectType && isCorrectPercentage) {
                            // Item's native tax is already correct for this transaction
                            resolvedTaxId = materialTaxIdFromItem;
                            resolvedTaxName = materialTaxNameFromItem;
                            resolvedTaxType = "native";
                        } else {
                            const orgTaxes = await getOrgTaxes();
                            if (orgTaxes.ok) {
                                const equivalent = findEquivalentTax(orgTaxes.taxes, targetGstPercentage, transactionType.isInterState);
                                if (equivalent) {
                                    resolvedTaxId = equivalent.taxId;
                                    resolvedTaxName = equivalent.taxName;
                                    resolvedTaxType = equivalent.taxType;
                                }
                            }
                        }

                        if (!resolvedTaxId) {
                            const requiredType = transactionType.isInterState ? "inter-state (IGST)" : "intra-state (CGST+SGST)";
                            const errorMessage = `No matching ${targetGstPercentage}% ${requiredType} tax was found in Zoho Books for material '${displayName}'. Please add the matching tax rate in Zoho Books.`;
                            await query(
                                `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                                [errorMessage, id]
                            );
                            safeLog(id, "tax type mismatch, no equivalent available", {
                                material: displayName,
                                requiredType,
                                gstRate: targetGstPercentage
                            });
                            return res.status(422).json({
                                message: errorMessage,
                                taxSetupRequired: true,
                                taxTypeMismatch: true,
                                materialName: displayName,
                            });
                        }
                    } else {
                        // Overseas / transactionType null: use item's original tax if available
                        resolvedTaxId = materialTaxIdFromItem;
                        resolvedTaxName = materialTaxNameFromItem;
                        resolvedTaxType = null;
                    }

                    safeLog(id, "line item GST tax resolution", {
                        orgState: transactionType?.orgStateCode,
                        vendorState: transactionType?.vendorStateCode,
                        transactionType: transactionType ? (transactionType.isInterState ? "INTERSTATE" : "INTRASTATE") : "UNKNOWN",
                        material: displayName,
                        zohoItemId: materialZohoItemId,
                        gstRate: targetGstPercentage,
                        originalTaxId: materialTaxIdFromItem,
                        originalTaxName: materialTaxNameFromItem,
                        originalTaxPercentage: materialTaxPercentageFromItem,
                        resolvedTaxId,
                        resolvedTaxName,
                        resolvedTaxType
                    });

                    const lineItem: { item_id: string; name: string; quantity: number; rate: number; tax_id?: string; tax_exemption_id?: string } = {
                        item_id: materialZohoItemId!,
                        name: displayName,
                        quantity: qty,
                        rate,
                    };

                    if (resolvedTaxId) {
                        lineItem.tax_id = resolvedTaxId;
                    } else if (defaultTax.taxId) {
                        lineItem.tax_id = defaultTax.taxId;
                    } else if (defaultTax.taxExemptionId) {
                        lineItem.tax_exemption_id = defaultTax.taxExemptionId;
                    } else {
                        const errorMessage = `Material "${displayName}" has no tax configured in Zoho Books, and no default tax is set up for this integration.`;
                        await query(
                            `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                            [errorMessage, id]
                        );
                        safeLog(id, "no tax available for line item", { material: displayName, zohoItemId: materialZohoItemId });
                        return res.status(422).json({
                            message: errorMessage,
                            taxSetupRequired: true,
                            materialName: displayName,
                        });
                    }

                    lineItems.push(lineItem);
                }

                // 6. Idempotency: if a PO with this reference number already exists in
                // Zoho (e.g. a prior request succeeded but the response was lost),
                // reuse it instead of creating a duplicate.
                try {
                    const search = await zohoApiRequest(
                        `/purchaseorders?reference_number=${encodeURIComponent(po.po_number)}`
                    );
                    const existing = search.data?.purchaseorders?.[0];
                    if (search.ok && existing?.purchaseorder_id) {
                        await query(
                            `UPDATE purchase_orders
               SET zoho_purchase_order_id = $1, zoho_sync_status = 'synced', zoho_synced_at = NOW(), zoho_sync_error = NULL, updated_at = NOW()
               WHERE id = $2`,
                            [existing.purchaseorder_id, id]
                        );
                        safeLog(id, "found existing Zoho PO by reference number, reused it", {
                            zohoPurchaseOrderId: existing.purchaseorder_id,
                        });
                        return res.json({
                            zohoPurchaseOrderId: existing.purchaseorder_id,
                            zohoSyncStatus: "synced",
                            zohoSyncedAt: new Date().toISOString(),
                            alreadySynced: true,
                        });
                    }
                } catch (lookupErr: any) {
                    // Non-fatal: fall through and attempt to create normally. Zoho's
                    // own reference_number behavior still protects against most
                    // accidental duplicates at creation time.
                    safeLog(id, "idempotency lookup failed, proceeding to create", {
                        reason: lookupErr?.message,
                    });
                }

                // 7. Build the Zoho Books Purchase Order payload from the PO's
                // actual stored values (no recalculation of BOQ figures).
                const payload: Record<string, any> = {
                    vendor_id: vendorZohoContactId,
                    reference_number: po.po_number,
                    date: po.po_date
                        ? new Date(po.po_date).toISOString().slice(0, 10)
                        : new Date().toISOString().slice(0, 10),
                    line_items: lineItems,
                };
                if (po.delivery_date) {
                    payload.delivery_date = new Date(po.delivery_date).toISOString().slice(0, 10);
                }
                if (po.shipping_address) {
                    payload.notes = `Shipping Address: ${po.shipping_address}`;
                }
                if (po.payment_terms) {
                    payload.terms = String(po.payment_terms);
                }
                // Set explicitly (rather than relying on Zoho's own defaulting to
                // the vendor contact's place_of_contact) so it's guaranteed
                // consistent with the intra/inter-state tax selection just applied
                // above to the line items - see resolveTransactionType.
                if (transactionType) {
                    payload.source_of_supply = transactionType.vendorStateCode;
                    payload.destination_of_supply = transactionType.orgStateCode;
                }

                // 8. Create the Purchase Order in Zoho Books.
                const createRes = await zohoApiRequest("/purchaseorders", {
                    method: "POST",
                    body: payload,
                });

                if (!createRes.ok || !createRes.data?.purchaseorder?.purchaseorder_id) {
                    const technicalMessage: string =
                        createRes.data?.message || `HTTP ${createRes.status}`;
                    console.error(
                        `[zoho-sync] PO ${id}: Zoho API error while creating purchase order:`,
                        technicalMessage
                    );

                    // GST (India) tax-type mismatch: the tax configured on one of the
                    // line items (see resolveDefaultTax / materialTaxIdFromItem above)
                    // is IGST (inter-state) or CGST+SGST (intra-state) but doesn't
                    // match what Zoho computes for this vendor vs. our organization's
                    // registered GST state. This is a Zoho Books configuration issue,
                    // not something safe to silently "fix" by guessing a different
                    // tax - surface it clearly so the admin can correct the tax on
                    // the Zoho Books item (or the vendor's/org's GST state) directly.
                    const isTaxTypeMismatch = /intrastate transaction|interstate transaction/i.test(
                        technicalMessage
                    );
                    const errorMessage = isTaxTypeMismatch
                        ? `Zoho Books rejected the tax on this Purchase Order: "${technicalMessage}". The tax configured on one of the materials' Zoho Books items doesn't match this vendor's state (IGST vs CGST+SGST). Please fix the tax on the item in Zoho Books, then retry.`
                        : `Failed to create the Purchase Order in Zoho Books: ${technicalMessage}`;

                    await query(
                        `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                        [errorMessage, id]
                    );
                    return res.status(502).json({ message: errorMessage, taxTypeMismatch: isTaxTypeMismatch });
                }

                const zohoPurchaseOrderId = createRes.data.purchaseorder.purchaseorder_id;

                await query(
                    `UPDATE purchase_orders
           SET zoho_purchase_order_id = $1, zoho_sync_status = 'synced', zoho_synced_at = NOW(), zoho_sync_error = NULL, updated_at = NOW()
           WHERE id = $2`,
                    [zohoPurchaseOrderId, id]
                );

                safeLog(id, "synced successfully", { zohoPurchaseOrderId });

                return res.json({
                    zohoPurchaseOrderId,
                    zohoSyncStatus: "synced",
                    zohoSyncedAt: new Date().toISOString(),
                });
            } catch (err: any) {
                const isAuthError = err?.message === "ZOHO_AUTH_FAILED" || err?.message === "ZOHO_NOT_CONFIGURED";
                const errorMessage = isAuthError
                    ? "Zoho Books authentication failed. Please contact the administrator."
                    : "Something went wrong while syncing to Zoho Books. Please retry.";

                console.error(`[zoho-sync] PO ${id}: unexpected error:`, err?.message || err);

                try {
                    await query(
                        `UPDATE purchase_orders SET zoho_sync_status = 'failed', zoho_sync_error = $1, updated_at = NOW() WHERE id = $2`,
                        [errorMessage, id]
                    );
                } catch {
                    // best-effort status update only
                }

                return res.status(isAuthError ? 502 : 500).json({ message: errorMessage });
            }
        }
    );

    /**
     * Manual vendor mapping fallback (kept per "Important: Existing Mapping
     * UI / Manual Mapping" - required whenever automatic matching cannot
     * safely resolve a vendor: ambiguous matches, vendors not found in Zoho,
     * or vendors with genuinely different names). Lets the Purchase Team
     * search Zoho Books vendors by name (never raw IDs) and pick the right
     * one; the endpoint updates the shops row Zoho previously handled purely
     * via manual SQL.
     */
    app.get(
        "/api/zoho-books/vendors/search",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            try {
                if (!isZohoConfigured() || !ZOHO_BOOKS_ORGANIZATION_ID) {
                    return res.status(503).json({
                        message: "Zoho Books authentication failed. Please contact the administrator.",
                    });
                }
                const q = String(req.query.q || "").trim();
                if (q.length < 2) {
                    return res.json({ vendors: [] });
                }
                const result = await searchZohoVendorContacts(q, 20);
                if (!result.ok) {
                    return res.status(502).json({
                        message: "Failed to search Zoho Books vendors. Please try again.",
                    });
                }
                return res.json({
                    vendors: result.candidates.map((c) => ({ id: c.contactId, name: c.contactName })),
                });
            } catch (err: any) {
                console.error("[zoho-vendor-search] unexpected error:", err?.message || err);
                return res.status(500).json({ message: "Failed to search Zoho Books vendors. Please try again." });
            }
        }
    );

    /**
     * Saves an explicit, user-chosen vendor mapping for the BOQ vendor behind
     * a given Purchase Order. This is the "safety mechanism" fallback - it
     * always overwrites (the user explicitly remapped). When the vendor is
     * linked to a shops row, the mapping is saved there so every future PO
     * for that vendor benefits (scoped to that single shop row - never a
     * bulk update). When the vendor was entered as free text on the PO and
     * has no matching shops row, the mapping is instead saved against this
     * one Purchase Order only, so the mapping still isn't lost. After saving,
     * it clears any previous failed sync state so the Purchase Team can just
     * click "Move to Zoho Books" again.
     */
    app.post(
        "/api/zoho-books/purchase-orders/:id/map-vendor",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            const { id } = req.params;
            const zohoContactId = String(req.body?.zohoContactId || "").trim();
            if (!zohoContactId) {
                return res.status(400).json({ message: "A Zoho Books vendor must be selected." });
            }

            try {
                const poRes = await query(
                    `SELECT po.id, po.vendor_name, po.vendor_id, s.id as vendor_shop_id
           FROM purchase_orders po
           LEFT JOIN shops s
             ON (po.vendor_id::text = s.id::text OR TRIM(s.name) = TRIM(po.vendor_name))
           WHERE po.id = $1`,
                    [id]
                );
                if (poRes.rows.length === 0) {
                    return res.status(404).json({ message: "Purchase order not found." });
                }
                const po = poRes.rows[0];

                if (po.vendor_shop_id) {
                    // Scoped to exactly this one vendor's shop row - never a bulk update.
                    await query(`UPDATE shops SET zoho_contact_id = $1 WHERE id = $2`, [
                        zohoContactId,
                        po.vendor_shop_id,
                    ]);
                } else {
                    // No BOQ vendor/shop record to save a reusable mapping against -
                    // scope the mapping to this one Purchase Order instead of
                    // blocking the Purchase Team entirely.
                    await query(`UPDATE purchase_orders SET zoho_vendor_contact_id = $1 WHERE id = $2`, [
                        zohoContactId,
                        id,
                    ]);
                }

                // Clear any previous failed-sync state so a retry starts clean.
                await query(
                    `UPDATE purchase_orders
           SET zoho_sync_status = CASE WHEN zoho_sync_status = 'synced' THEN zoho_sync_status ELSE NULL END,
               zoho_sync_error = NULL,
               updated_at = NOW()
           WHERE id = $1`,

                    [id]
                );

                safeLog(id, "vendor manually mapped", {
                    scope: po.vendor_shop_id ? "shop" : "purchase_order",
                    vendorShopId: po.vendor_shop_id || null,
                    zohoContactId,
                });
                return res.json({ ok: true });
            } catch (err: any) {
                console.error("[zoho-map-vendor] unexpected error:", err?.message || err);
                return res.status(500).json({ message: "Failed to save vendor mapping. Please try again." });
            }
        }
    );

    /**
     * Manual material mapping search (mirrors /vendors/search). Lets the
     * Purchase Team search Zoho Books items by name and pick the right one
     * when automatic matching couldn't safely resolve a material.
     */
    app.get(
        "/api/zoho-books/items/search",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            try {
                if (!isZohoConfigured() || !ZOHO_BOOKS_ORGANIZATION_ID) {
                    return res.status(503).json({
                        message: "Zoho Books authentication failed. Please contact the administrator.",
                    });
                }
                const q = String(req.query.q || "").trim();
                if (q.length < 2) {
                    return res.json({ items: [] });
                }
                const result = await searchZohoBooksItems(q, 20);
                if (!result.ok) {
                    return res.status(502).json({
                        message: "Failed to search Zoho Books items. Please try again.",
                    });
                }
                return res.json({
                    items: result.candidates.map((c) => ({ id: c.itemId, name: c.itemName })),
                });
            } catch (err: any) {
                console.error("[zoho-item-search] unexpected error:", err?.message || err);
                return res.status(500).json({ message: "Failed to search Zoho Books items. Please try again." });
            }
        }
    );

    /**
     * Saves an explicit, user-chosen material -> Zoho Books item mapping.
     * Scoped to exactly one materials row (never a bulk update), validated
     * to actually belong to a line item on this Purchase Order so the
     * dialog can't be used to repoint an unrelated material. Always
     * overwrites (the user explicitly remapped) and clears any previous
     * failed sync state so the Purchase Team can just retry.
     */
    app.post(
        "/api/zoho-books/purchase-orders/:id/map-material",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            const { id } = req.params;
            const materialId = String(req.body?.materialId || "").trim();
            const zohoItemId = String(req.body?.zohoItemId || "").trim();
            if (!materialId) {
                return res.status(400).json({ message: "A material could not be identified for this mapping." });
            }
            if (!zohoItemId) {
                return res.status(400).json({ message: "A Zoho Books item must be selected." });
            }

            try {
                const check = await query(
                    `SELECT 1 FROM purchase_order_items poi
           WHERE poi.po_id = $1 AND poi.material_id = $2
           LIMIT 1`,
                    [id, materialId]
                );
                if (check.rows.length === 0) {
                    return res.status(422).json({
                        message: "This material does not belong to the selected Purchase Order.",
                    });
                }

                // Scoped to exactly this one material - never a bulk update.
                await query(`UPDATE materials SET zoho_item_id = $1 WHERE id::text = $2`, [
                    zohoItemId,
                    materialId,
                ]);

                // Clear any previous failed-sync state so a retry starts clean.
                await query(
                    `UPDATE purchase_orders
           SET zoho_sync_status = CASE WHEN zoho_sync_status = 'synced' THEN zoho_sync_status ELSE NULL END,
               zoho_sync_error = NULL,
               updated_at = NOW()
           WHERE id = $1`,
                    [id]
                );

                safeLog(id, "material manually mapped", { materialId, zohoItemId });
                return res.json({ ok: true });
            } catch (err: any) {
                console.error("[zoho-map-material] unexpected error:", err?.message || err);
                return res.status(500).json({ message: "Failed to save material mapping. Please try again." });
            }
        }
    );

    /**
     * Creates a brand-new item in Zoho Books for a material that genuinely
     * doesn't exist there yet, then saves the mapping - a single explicit,
     * user-initiated action from the "Material mapping required" dialog.
     * Never runs automatically as part of a sync. Scoped to exactly one
     * materials row, and validated to belong to this Purchase Order first.
     */
    app.post(
        "/api/zoho-books/purchase-orders/:id/create-material",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            const { id } = req.params;
            const materialId = String(req.body?.materialId || "").trim();
            const name = String(req.body?.name || "").trim();
            const rate = Number(req.body?.rate);

            if (!materialId) {
                return res.status(400).json({ message: "A material could not be identified for this mapping." });
            }
            if (!name) {
                return res.status(400).json({ message: "An item name is required." });
            }

            try {
                if (!isZohoConfigured() || !ZOHO_BOOKS_ORGANIZATION_ID) {
                    return res.status(503).json({
                        message: "Zoho Books authentication failed. Please contact the administrator.",
                    });
                }

                const check = await query(
                    `SELECT 1 FROM purchase_order_items poi
           WHERE poi.po_id = $1 AND poi.material_id = $2
           LIMIT 1`,
                    [id, materialId]
                );
                if (check.rows.length === 0) {
                    return res.status(422).json({
                        message: "This material does not belong to the selected Purchase Order.",
                    });
                }

                const defaultTax = await resolveDefaultTax();
                const created = await createZohoBooksItem(name, Number.isFinite(rate) ? rate : 0, defaultTax.taxId || null);
                if (!created.ok || !created.candidate) {
                    return res.status(502).json({
                        message: created.message || "Failed to create the item in Zoho Books. Please try again.",
                    });
                }

                // Scoped to exactly this one material - never a bulk update.
                await query(`UPDATE materials SET zoho_item_id = $1 WHERE id::text = $2`, [
                    created.candidate.itemId,
                    materialId,
                ]);

                await query(
                    `UPDATE purchase_orders
           SET zoho_sync_status = CASE WHEN zoho_sync_status = 'synced' THEN zoho_sync_status ELSE NULL END,
               zoho_sync_error = NULL,
               updated_at = NOW()
           WHERE id = $1`,
                    [id]
                );

                safeLog(id, "material created as new Zoho item", { materialId, zohoItemId: created.candidate.itemId, name });
                return res.json({ ok: true, zohoItemId: created.candidate.itemId, zohoItemName: created.candidate.itemName });
            } catch (err: any) {
                console.error("[zoho-create-material] unexpected error:", err?.message || err);
                return res.status(500).json({ message: "Failed to create item in Zoho Books. Please try again." });
            }
        }
    );

    /**
     * Lists this Zoho Books organization's configured taxes, so the "Tax
     * setup required" dialog can offer a real dropdown of existing taxes by
     * name instead of asking the admin to find and paste a raw tax id.
     */
    app.get(
        "/api/zoho-books/taxes",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (_req: Request, res: Response) => {
            try {
                if (!isZohoConfigured() || !ZOHO_BOOKS_ORGANIZATION_ID) {
                    return res.status(503).json({
                        message: "Zoho Books authentication failed. Please contact the administrator.",
                    });
                }
                const result = await listZohoTaxes();
                if (!result.ok) {
                    return res.status(502).json({ message: result.message || "Failed to load Zoho Books taxes." });
                }
                return res.json({
                    taxes: result.taxes.map((t) => ({
                        id: t.taxId,
                        name: `${t.taxName} (${t.taxPercentage}%)`,
                        // "interstate" | "intrastate" | "unknown" - lets the UI label
                        // each option so the admin can pick the right one for the
                        // intra-state/inter-state default tax settings below without
                        // having to already know Zoho's naming convention.
                        transactionType: t.isInterState === true ? "interstate" : t.isInterState === false ? "intrastate" : "unknown",
                    })),
                });
            } catch (err: any) {
                console.error("[zoho-taxes] unexpected error:", err?.message || err);
                return res.status(500).json({ message: "Failed to load Zoho Books taxes. Please try again." });
            }
        }
    );

    /**
     * Saves the org-level default tax used whenever a material's own Zoho
     * Books item has no tax configured (see resolveDefaultTax above). This is
     * a one-time admin action from the "Tax setup required" dialog - takes
     * effect immediately for every subsequent sync, no server restart needed.
     */
    app.post(
        "/api/zoho-books/settings/default-tax",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            const taxId = String(req.body?.taxId || "").trim();
            if (!taxId) {
                return res.status(400).json({ message: "A tax must be selected." });
            }
            try {
                await setZohoSetting(DEFAULT_TAX_ID_KEY, taxId);
                console.log("[zoho-settings] default tax configured", { taxId });
                return res.json({ ok: true });
            } catch (err: any) {
                console.error("[zoho-settings] unexpected error saving default tax:", err?.message || err);
                return res.status(500).json({ message: "Failed to save default tax. Please try again." });
            }
        }
    );

    /**
     * Reads the current GST (India) intra-state/inter-state settings - our
     * organization's GST state code and the type-specific default taxes -
     * for a settings screen to prefill. See settings.ts for why the org
     * state code is a one-time admin setting rather than auto-detected.
     */
    app.get(
        "/api/zoho-books/settings/gst",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (_req: Request, res: Response) => {
            try {
                const [orgStateCode, intrastateTaxId, interstateTaxId] = await Promise.all([
                    getZohoSetting(ORG_STATE_CODE_KEY),
                    getZohoSetting(DEFAULT_INTRASTATE_TAX_ID_KEY),
                    getZohoSetting(DEFAULT_INTERSTATE_TAX_ID_KEY),
                ]);
                return res.json({ orgStateCode, intrastateTaxId, interstateTaxId });
            } catch (err: any) {
                console.error("[zoho-settings] unexpected error reading GST settings:", err?.message || err);
                return res.status(500).json({ message: "Failed to load GST settings. Please try again." });
            }
        }
    );

    /**
     * Saves our organization's GST state/UT code and, optionally, the
     * fallback default taxes for intra-state and inter-state transactions
     * (see resolveTransactionType / resolveDefaultTaxForType above). Setting
     * the org state code is what turns on automatic IGST-vs-CGST+SGST
     * correction for future syncs; leaving it unset keeps the previous
     * single-tax behavior. Takes effect immediately, no restart needed.
     */
    app.post(
        "/api/zoho-books/settings/gst",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            const orgStateCode = String(req.body?.orgStateCode || "").trim().toUpperCase();
            const intrastateTaxId = req.body?.intrastateTaxId ? String(req.body.intrastateTaxId).trim() : "";
            const interstateTaxId = req.body?.interstateTaxId ? String(req.body.interstateTaxId).trim() : "";
            if (!orgStateCode) {
                return res.status(400).json({ message: "Your organization's GST state code is required (e.g. TN, KA, MH)." });
            }
            try {
                await setZohoSetting(ORG_STATE_CODE_KEY, orgStateCode);
                if (intrastateTaxId) await setZohoSetting(DEFAULT_INTRASTATE_TAX_ID_KEY, intrastateTaxId);
                if (interstateTaxId) await setZohoSetting(DEFAULT_INTERSTATE_TAX_ID_KEY, interstateTaxId);
                console.log("[zoho-settings] GST intra/inter-state settings configured", {
                    orgStateCode,
                    intrastateTaxId: intrastateTaxId || null,
                    interstateTaxId: interstateTaxId || null,
                });
                return res.json({ ok: true });
            } catch (err: any) {
                console.error("[zoho-settings] unexpected error saving GST settings:", err?.message || err);
                return res.status(500).json({ message: "Failed to save GST settings. Please try again." });
            }
        }
    );
}
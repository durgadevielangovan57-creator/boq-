import type { Express, Request, Response } from "express";
import { query } from "./db/client";
import { authMiddleware, requireRole } from "./middleware";
import { isZohoConfigured } from "./zoho/token_service";
import {
    zohoApiRequest,
    ZOHO_BOOKS_ORGANIZATION_ID,
    ZOHO_DEFAULT_TAX_ID,
    ZOHO_DEFAULT_TAX_EXEMPTION_ID,
} from "./zoho/api_client";
import { getZohoContactGstInfo } from "./zoho/vendor_matching";
import {
    findZohoItemMatch,
    getZohoItemTax,
    getZohoItemUsability,
    listZohoTaxes,
    findEquivalentTax,
    classifyTax,
} from "./zoho/item_matching";
import {
    ensureZohoSettingsSchema,
    getZohoSetting,
    DEFAULT_TAX_ID_KEY,
    DEFAULT_TAX_EXEMPTION_ID_KEY,
    ORG_STATE_CODE_KEY,
} from "./zoho/settings";

/**
 * =====================================================================
 * ZOHO BOOKS: ADD NEW ITEMS TO AN ALREADY-SYNCED PURCHASE ORDER
 * (isolated, additive module)
 * ---------------------------------------------------------------------
 * - Does NOT modify the existing sync route (zoho_routes.ts), the manual PO
 *   edit route, or any table/column. It never changes a PO's
 *   zoho_sync_status / zoho_purchase_order_id, so the existing sync flow
 *   (including its duplicate protection) behaves exactly as before.
 * - It is stateless: it reads the live Zoho PO, works out which local PO
 *   items are not on it yet, and appends only those.
 *
 *   GET  /api/zoho-books/purchase-orders/:id/new-items   -> preview (read only)
 *   POST /api/zoho-books/purchase-orders/:id/sync-new-items -> append them
 *
 * How "already in Zoho" is decided: each local item is matched against the
 * Zoho PO's current lines by Zoho item id (when known) or by name; every
 * Zoho line can be consumed once, so duplicates are handled. Local items
 * left over are "new". Existing Zoho lines are sent back unchanged (with
 * their line_item_id), because Zoho replaces the full line list on update.
 * Local edits/deletions of already-synced lines are NOT pushed.
 * =====================================================================
 */

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const inFlight = new Set<string>();

// Zoho statuses in which a PO can still be changed.
const EDITABLE_ZOHO_STATUSES = ["draft", "open", "issued", "pending_approval", "approved"];

function log(poId: string, message: string, extra?: Record<string, unknown>) {
    console.log(`[zoho-add-items] PO ${poId}: ${message}`, extra || "");
}

class HttpError extends Error {
    constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
        super(message);
    }
}

async function resolveDefaultTax(): Promise<{ taxId?: string; taxExemptionId?: string }> {
    const dbTaxId = await getZohoSetting(DEFAULT_TAX_ID_KEY);
    if (dbTaxId) return { taxId: dbTaxId };
    if (ZOHO_DEFAULT_TAX_ID) return { taxId: ZOHO_DEFAULT_TAX_ID };
    const dbEx = await getZohoSetting(DEFAULT_TAX_EXEMPTION_ID_KEY);
    if (dbEx) return { taxExemptionId: dbEx };
    if (ZOHO_DEFAULT_TAX_EXEMPTION_ID) return { taxExemptionId: ZOHO_DEFAULT_TAX_EXEMPTION_ID };
    return {};
}

type Ctx = {
    po: any;
    zohoPo: any;
    existingLines: any[];
    newRows: any[];
};

/** Loads the local + live Zoho PO and works out which local items are missing in Zoho. */
async function buildContext(id: string): Promise<Ctx> {
    if (!isZohoConfigured()) {
        throw new HttpError(503, "Zoho Books authentication failed. Please contact the administrator.");
    }
    if (!ZOHO_BOOKS_ORGANIZATION_ID) {
        throw new HttpError(503, "Zoho Books is not fully configured. Please contact the administrator.");
    }

    const poRes = await query(
        `SELECT id::text AS id, po_number, zoho_purchase_order_id, zoho_sync_status
         FROM purchase_orders WHERE id::text = $1`,
        [id]
    );
    if (poRes.rows.length === 0) throw new HttpError(404, "Purchase order not found.");
    const po = poRes.rows[0];
    if (po.zoho_sync_status !== "synced" || !po.zoho_purchase_order_id) {
        throw new HttpError(
            409,
            "This Purchase Order has not been synced to Zoho Books yet. Use the normal sync first."
        );
    }

    const zres = await zohoApiRequest(`/purchaseorders/${encodeURIComponent(po.zoho_purchase_order_id)}`);
    if (!zres.ok || !zres.data?.purchaseorder) {
        throw new HttpError(
            502,
            `Could not read the Purchase Order from Zoho Books: ${zres.data?.message || `HTTP ${zres.status}`}`
        );
    }
    const zohoPo = zres.data.purchaseorder;
    const existingLines: any[] = Array.isArray(zohoPo.line_items) ? zohoPo.line_items : [];

    const itemsRes = await query(
        `SELECT poi.*, m.name AS material_name, m.zoho_item_id AS material_zoho_item_id
         FROM purchase_order_items poi
         LEFT JOIN materials m ON poi.material_id = m.id::text
         WHERE poi.po_id::text = $1
         ORDER BY poi.created_at ASC`,
        [id]
    );

    // Each Zoho line can account for one local item only.
    const remaining = [...existingLines];
    const newRows: any[] = [];
    for (const row of itemsRes.rows) {
        const displayName = row.material_name || row.item;
        const knownZohoId = row.zoho_item_id || row.material_zoho_item_id || null;
        const idx = remaining.findIndex(
            (l) =>
                (knownZohoId && String(l.item_id) === String(knownZohoId)) ||
                norm(l.name) === norm(displayName) ||
                norm(l.name) === norm(row.item)
        );
        if (idx >= 0) remaining.splice(idx, 1);
        else newRows.push(row);
    }
    return { po, zohoPo, existingLines, newRows };
}

export async function registerZohoPoAdditionsRoutes(app: Express) {
    // Idempotent (CREATE TABLE IF NOT EXISTS) - the same call the existing Zoho module makes.
    await ensureZohoSettingsSchema().catch((e: any) =>
        console.warn("[zoho-add-items] settings schema check failed:", e?.message || e)
    );
    // ---- Preview: which items would be added? (read only) ----
    app.get(
        "/api/zoho-books/purchase-orders/:id/new-items",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            try {
                const { po, zohoPo, newRows } = await buildContext(req.params.id);
                res.json({
                    synced: true,
                    zohoStatus: zohoPo.status || null,
                    editableInZoho: EDITABLE_ZOHO_STATUSES.includes(String(zohoPo.status || "").toLowerCase()),
                    pendingCount: newRows.length,
                    pendingItems: newRows.map((r) => r.material_name || r.item),
                    poNumber: po.po_number,
                });
            } catch (err: any) {
                if (err instanceof HttpError) {
                    // "Not synced" is a normal answer for a preview, not an error.
                    if (err.status === 409) return res.json({ synced: false, pendingCount: 0, pendingItems: [] });
                    return res.status(err.status).json({ message: err.message });
                }
                console.error("[zoho-add-items] preview error:", err?.message || err);
                res.status(500).json({ message: "Could not check items against Zoho Books." });
            }
        }
    );

    // ---- Append the new items to the existing Zoho PO ----
    app.post(
        "/api/zoho-books/purchase-orders/:id/sync-new-items",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            const { id } = req.params;
            if (inFlight.has(id)) {
                return res.status(409).json({ message: "A sync for this Purchase Order is already running." });
            }
            inFlight.add(id);
            try {
                const { po, zohoPo, existingLines, newRows } = await buildContext(id);

                if (newRows.length === 0) {
                    return res.json({ addedCount: 0, message: "No new items to sync. Zoho Books is already up to date." });
                }

                const zohoStatus = String(zohoPo.status || "").toLowerCase();
                if (zohoStatus && !EDITABLE_ZOHO_STATUSES.includes(zohoStatus)) {
                    throw new HttpError(
                        422,
                        `This Purchase Order is "${zohoPo.status}" in Zoho Books, so items can no longer be added to it.`
                    );
                }

                const vendorZohoContactId: string | undefined = zohoPo.vendor_id;
                if (!vendorZohoContactId) throw new HttpError(502, "Zoho Books did not return the vendor of this Purchase Order.");

                // --- Same GST transaction-type logic as the first sync ---
                const orgStateCode = (await getZohoSetting(ORG_STATE_CODE_KEY))?.trim().toUpperCase();
                if (!orgStateCode) {
                    throw new HttpError(
                        422,
                        "Organization GST state is not configured. Please configure the organization GST state before syncing Purchase Orders.",
                        { gstStateMissing: true, gstStateMissingReason: "organization" }
                    );
                }
                const gstInfo = await getZohoContactGstInfo(vendorZohoContactId);
                let transactionType: { isInterState: boolean } | null = null;
                if (gstInfo.gstTreatment !== "overseas") {
                    if (!gstInfo.placeOfContact) {
                        throw new HttpError(
                            422,
                            "Unable to determine the vendor GST state. Please complete the vendor GST details before syncing this Purchase Order.",
                            { gstStateMissing: true, gstStateMissingReason: "vendor" }
                        );
                    }
                    transactionType = { isInterState: gstInfo.placeOfContact !== orgStateCode };
                }

                const defaultTax = await resolveDefaultTax();
                let orgTaxes: Awaited<ReturnType<typeof listZohoTaxes>> | null = null;

                const newLines: any[] = [];
                for (const row of newRows) {
                    const displayName = row.material_name || row.item;
                    const qty = Number(row.qty);
                    const rate = Number(row.rate);
                    if (!qty || qty <= 0) throw new HttpError(422, `Material "${displayName}" has an invalid quantity.`);
                    if (isNaN(rate) || rate < 0) throw new HttpError(422, `Material "${displayName}" has an invalid Purchase Rate.`);

                    let zohoItemId: string | null = row.zoho_item_id || row.material_zoho_item_id || null;
                    let taxId: string | null = null;
                    let taxName: string | null = null;
                    let taxPct: number | null = null;

                    if (zohoItemId) {
                        const usability = await getZohoItemUsability(zohoItemId);
                        if (usability === "inactive" || usability === "not_found") zohoItemId = null;
                    }

                    if (!zohoItemId) {
                        const match = await findZohoItemMatch(displayName);
                        if (match.status === "matched") {
                            zohoItemId = match.candidate.itemId;
                            taxId = match.candidate.taxId || null;
                            taxName = match.candidate.taxName ?? null;
                            taxPct = match.candidate.taxPercentage ?? null;
                            // Same shared mapping caches the existing sync writes to.
                            if (row.material_id) {
                                await query(
                                    `UPDATE materials SET zoho_item_id = $1 WHERE id::text = $2 AND zoho_item_id IS NULL`,
                                    [zohoItemId, String(row.material_id)]
                                );
                            }
                            await query(`UPDATE purchase_order_items SET zoho_item_id = $1 WHERE id::text = $2`, [
                                zohoItemId,
                                String(row.id),
                            ]);
                        } else if (match.status === "error") {
                            throw new HttpError(500, `Something went wrong while searching Zoho Books for material "${displayName}". Please retry.`);
                        } else {
                            throw new HttpError(
                                422,
                                match.status === "ambiguous"
                                    ? `Multiple Zoho Books items matched material "${displayName}". Please map the material manually.`
                                    : `A Zoho Books item could not be found for material "${displayName}".`,
                                {
                                    zohoMappingRequired: true,
                                    mappingType: "material",
                                    materialId: row.material_id ? String(row.material_id) : null,
                                    itemRowId: row.id ? String(row.id) : null,
                                    materialName: displayName,
                                    materialRate: rate,
                                    candidates:
                                        match.status === "ambiguous"
                                            ? match.candidates.map((c) => ({ id: c.itemId, name: c.itemName }))
                                            : [],
                                }
                            );
                        }
                    } else {
                        const t = await getZohoItemTax(zohoItemId);
                        taxId = t?.taxId || null;
                        taxName = t?.taxName ?? null;
                        taxPct = t?.taxPercentage ?? null;
                    }

                    if (taxId && taxName === null && transactionType) {
                        const t = await getZohoItemTax(zohoItemId!);
                        if (t) {
                            taxName = t.taxName;
                            taxPct = t.taxPercentage;
                        }
                    }

                    const targetGst =
                        row.gst_percentage !== null && row.gst_percentage !== undefined ? Number(row.gst_percentage) : 18;
                    if (isNaN(targetGst)) {
                        throw new HttpError(422, `GST rate is not configured for material '${displayName}'.`);
                    }

                    let resolvedTaxId: string | null = null;
                    if (transactionType) {
                        const itemIsInter = classifyTax(taxName);
                        const okType = itemIsInter !== null && itemIsInter === transactionType.isInterState;
                        const okPct = taxPct !== null && Math.abs(taxPct - targetGst) < 0.001;
                        if (taxId && okType && okPct) {
                            resolvedTaxId = taxId;
                        } else {
                            if (!orgTaxes) orgTaxes = await listZohoTaxes();
                            if (orgTaxes.ok) {
                                const eq = findEquivalentTax(orgTaxes.taxes, targetGst, transactionType.isInterState);
                                if (eq) resolvedTaxId = eq.taxId;
                            }
                        }
                        if (!resolvedTaxId) {
                            const requiredType = transactionType.isInterState ? "inter-state (IGST)" : "intra-state (CGST+SGST)";
                            throw new HttpError(
                                422,
                                `No matching ${targetGst}% ${requiredType} tax was found in Zoho Books for material '${displayName}'. Please add the matching tax rate in Zoho Books.`,
                                { taxSetupRequired: true, taxTypeMismatch: true, materialName: displayName }
                            );
                        }
                    } else {
                        resolvedTaxId = taxId;
                    }

                    const line: Record<string, any> = { item_id: zohoItemId, name: displayName, quantity: qty, rate };
                    if (resolvedTaxId) line.tax_id = resolvedTaxId;
                    else if (defaultTax.taxId) line.tax_id = defaultTax.taxId;
                    else if (defaultTax.taxExemptionId) line.tax_exemption_id = defaultTax.taxExemptionId;
                    else {
                        throw new HttpError(
                            422,
                            `Material "${displayName}" has no tax configured in Zoho Books, and no default tax is set up for this integration.`,
                            { taxSetupRequired: true, materialName: displayName }
                        );
                    }
                    newLines.push(line);
                }

                // Existing lines go back exactly as Zoho holds them (with line_item_id),
                // otherwise Zoho would delete / recreate them.
                const KEEP = [
                    "line_item_id", "item_id", "name", "description", "item_order", "rate", "quantity",
                    "unit", "tax_id", "tax_exemption_id", "hsn_or_sac", "discount", "account_id",
                ];
                const keptLines = existingLines.map((l) => {
                    const o: Record<string, any> = {};
                    for (const k of KEEP) if (l[k] !== undefined && l[k] !== null && l[k] !== "") o[k] = l[k];
                    return o;
                });

                const payload: Record<string, any> = {
                    vendor_id: vendorZohoContactId,
                    line_items: [...keptLines, ...newLines],
                };
                if (zohoPo.reference_number) payload.reference_number = zohoPo.reference_number;
                if (zohoPo.date) payload.date = zohoPo.date;
                if (zohoPo.source_of_supply) payload.source_of_supply = zohoPo.source_of_supply;
                if (zohoPo.destination_of_supply) payload.destination_of_supply = zohoPo.destination_of_supply;

                const upd = await zohoApiRequest(`/purchaseorders/${encodeURIComponent(po.zoho_purchase_order_id)}`, {
                    method: "PUT",
                    body: payload,
                });
                if (!upd.ok || (upd.data?.code !== undefined && upd.data.code !== 0)) {
                    const msg = upd.data?.message || `HTTP ${upd.status}`;
                    console.error(`[zoho-add-items] PO ${id}: Zoho update failed:`, msg);
                    throw new HttpError(502, `Zoho Books rejected the update: ${msg}`);
                }

                log(id, "appended new items", { count: newLines.length });
                return res.json({
                    addedCount: newLines.length,
                    addedItems: newRows.map((r) => r.material_name || r.item),
                    zohoPurchaseOrderId: po.zoho_purchase_order_id,
                    message: `${newLines.length} new item${newLines.length > 1 ? "s" : ""} added to the Purchase Order in Zoho Books.`,
                });
            } catch (err: any) {
                if (err instanceof HttpError) {
                    return res.status(err.status).json({ message: err.message, ...err.extra });
                }
                const isAuth = err?.message === "ZOHO_AUTH_FAILED" || err?.message === "ZOHO_NOT_CONFIGURED";
                console.error(`[zoho-add-items] PO ${id}: unexpected error:`, err?.message || err);
                return res
                    .status(isAuth ? 502 : 500)
                    .json({ message: isAuth ? "Zoho Books authentication failed. Please contact the administrator." : "Something went wrong while syncing the new items to Zoho Books. Please retry." });
            } finally {
                inFlight.delete(id);
            }
        }
    );

    console.log("[zoho-add-items] routes registered");
}
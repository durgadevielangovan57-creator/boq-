import type { Express, Request, Response } from "express";
import { query } from "../db/client";
import { authMiddleware, requireRole } from "../middleware";
import { isZohoConfigured } from "./token_service";
import { zohoApiRequest, ZOHO_BOOKS_ORGANIZATION_ID } from "./api_client";

/**
 * =====================================================================
 * ZOHO BOOKS: BACKFILL LINE DESCRIPTIONS ON ALREADY-SYNCED PURCHASE ORDERS
 * ---------------------------------------------------------------------
 * Early syncs did not send each PO line's description to Zoho Books. New
 * syncs now do, but POs that are already in Zoho need a one-time update.
 *
 *   POST /api/zoho-books/purchase-orders/:id/sync-descriptions
 *   POST /api/zoho-books/sync-descriptions            (all synced POs)
 *
 * Options (JSON body or query string):
 *   dryRun=true     -> report what WOULD change, change nothing
 *   overwrite=true  -> also replace descriptions Zoho already has
 *                      (default: only fill lines whose Zoho description is empty)
 *
 * Safety:
 *   - Never creates a PO and never touches the PO's sync status columns.
 *   - Zoho replaces the whole line list on update, so every existing line
 *     is sent back exactly as Zoho holds it (with its line_item_id); only
 *     `description` is changed on matched lines.
 *   - POs that Zoho no longer allows editing (billed / closed / etc.) are
 *     skipped and reported, not failed.
 * =====================================================================
 */

const EDITABLE_ZOHO_STATUSES = ["draft", "open", "issued", "pending_approval", "approved"];

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

// Fields of an existing Zoho line that are sent back unchanged.
const KEEP_LINE_FIELDS = [
    "line_item_id", "item_id", "name", "description", "item_order", "rate", "quantity",
    "unit", "tax_id", "tax_exemption_id", "reverse_charge_tax_id", "hsn_or_sac", "discount", "account_id",
];

export type DescriptionBackfillResult = {
    poId: string;
    poNumber?: string;
    status: "updated" | "nothing_to_update" | "skipped" | "failed" | "dry_run";
    updatedLines?: number;
    lines?: Array<{ name: string; description: string }>;
    message?: string;
};

function log(poId: string, message: string, extra?: Record<string, unknown>) {
    console.log(`[zoho-desc-backfill] PO ${poId}: ${message}`, extra || "");
}

async function backfillOnePo(
    id: string,
    opts: { dryRun: boolean; overwrite: boolean }
): Promise<DescriptionBackfillResult> {
    const poRes = await query(
        `SELECT id::text AS id, po_number, zoho_purchase_order_id, zoho_sync_status
         FROM purchase_orders WHERE id::text = $1`,
        [id]
    );
    if (poRes.rows.length === 0) return { poId: id, status: "failed", message: "Purchase order not found." };
    const po = poRes.rows[0];

    if (po.zoho_sync_status !== "synced" || !po.zoho_purchase_order_id) {
        return {
            poId: id,
            poNumber: po.po_number,
            status: "skipped",
            message: "This Purchase Order has not been synced to Zoho Books yet.",
        };
    }

    const zres = await zohoApiRequest(`/purchaseorders/${encodeURIComponent(po.zoho_purchase_order_id)}`);
    if (!zres.ok || !zres.data?.purchaseorder) {
        return {
            poId: id,
            poNumber: po.po_number,
            status: "failed",
            message: `Could not read the Purchase Order from Zoho Books: ${zres.data?.message || `HTTP ${zres.status}`}`,
        };
    }
    const zohoPo = zres.data.purchaseorder;
    const zohoStatus = String(zohoPo.status || "").toLowerCase();
    if (zohoStatus && !EDITABLE_ZOHO_STATUSES.includes(zohoStatus)) {
        return {
            poId: id,
            poNumber: po.po_number,
            status: "skipped",
            message: `This Purchase Order is "${zohoPo.status}" in Zoho Books and can no longer be edited.`,
        };
    }
    const zohoLines: any[] = Array.isArray(zohoPo.line_items) ? zohoPo.line_items : [];

    const itemsRes = await query(
        `SELECT poi.*, m.name AS material_name, m.zoho_item_id AS material_zoho_item_id
         FROM purchase_order_items poi
         LEFT JOIN materials m ON poi.material_id = m.id::text
         WHERE poi.po_id::text = $1
         ORDER BY poi.created_at ASC`,
        [id]
    );

    // Match each Zoho line to one local item (each local item used once), by
    // Zoho item id when known, otherwise by name - same rule as the other
    // Zoho modules.
    const remaining = [...itemsRes.rows];
    const changes: Array<{ name: string; description: string }> = [];
    const outLines = zohoLines.map((zl) => {
        const idx = remaining.findIndex((row) => {
            const knownZohoId = row.zoho_item_id || row.material_zoho_item_id || null;
            const displayName = row.material_name || row.item;
            return (
                (knownZohoId && String(zl.item_id) === String(knownZohoId)) ||
                norm(zl.name) === norm(displayName) ||
                norm(zl.name) === norm(row.item)
            );
        });
        const kept: Record<string, any> = {};
        for (const k of KEEP_LINE_FIELDS) {
            if (zl[k] !== undefined && zl[k] !== null && zl[k] !== "") kept[k] = zl[k];
        }
        if (idx < 0) return kept;
        const [row] = remaining.splice(idx, 1);

        const localDesc = String(row.description ?? "").trim().slice(0, 2000);
        const zohoDesc = String(zl.description ?? "").trim();
        if (!localDesc || localDesc === zohoDesc) return kept;
        if (zohoDesc && !opts.overwrite) return kept;

        kept.description = localDesc;
        changes.push({ name: zl.name, description: localDesc });
        return kept;
    });

    if (changes.length === 0) {
        return { poId: id, poNumber: po.po_number, status: "nothing_to_update", updatedLines: 0 };
    }
    if (opts.dryRun) {
        return { poId: id, poNumber: po.po_number, status: "dry_run", updatedLines: changes.length, lines: changes };
    }

    const payload: Record<string, any> = {
        vendor_id: zohoPo.vendor_id,
        line_items: outLines,
    };
    if (zohoPo.reference_number) payload.reference_number = zohoPo.reference_number;
    if (zohoPo.date) payload.date = zohoPo.date;
    if (zohoPo.source_of_supply) payload.source_of_supply = zohoPo.source_of_supply;
    if (zohoPo.destination_of_supply) payload.destination_of_supply = zohoPo.destination_of_supply;
    // Keep reverse charge on if this PO was created with it.
    if (zohoPo.is_reverse_charge_applied === true) payload.is_reverse_charge_applied = true;
    if (zohoPo.gst_treatment) payload.gst_treatment = zohoPo.gst_treatment;

    const upd = await zohoApiRequest(`/purchaseorders/${encodeURIComponent(po.zoho_purchase_order_id)}`, {
        method: "PUT",
        body: payload,
    });
    if (!upd.ok || (upd.data?.code !== undefined && upd.data.code !== 0)) {
        const msg = upd.data?.message || `HTTP ${upd.status}`;
        console.error(`[zoho-desc-backfill] PO ${id}: Zoho update failed:`, msg);
        return {
            poId: id,
            poNumber: po.po_number,
            status: "failed",
            message: `Zoho Books rejected the update: ${msg}`,
        };
    }

    log(id, "descriptions updated in Zoho", { lines: changes.length });
    return { poId: id, poNumber: po.po_number, status: "updated", updatedLines: changes.length, lines: changes };
}

function readFlag(req: Request, key: string): boolean {
    const v = (req.body && (req.body as any)[key]) ?? req.query[key];
    return v === true || String(v).toLowerCase() === "true" || String(v) === "1";
}

export function registerZohoDescriptionBackfillRoutes(app: Express) {
    const inFlight = new Set<string>();
    let bulkRunning = false;

    const guard = (res: Response): boolean => {
        if (!isZohoConfigured()) {
            res.status(503).json({ message: "Zoho Books authentication failed. Please contact the administrator." });
            return false;
        }
        if (!ZOHO_BOOKS_ORGANIZATION_ID) {
            res.status(503).json({ message: "Zoho Books is not fully configured. Please contact the administrator." });
            return false;
        }
        return true;
    };

    // ---- One already-synced PO ----
    app.post(
        "/api/zoho-books/purchase-orders/:id/sync-descriptions",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            const id = String(req.params.id);
            if (!guard(res)) return;
            if (inFlight.has(id) || bulkRunning) {
                return res.status(409).json({ message: "A description sync is already running for this Purchase Order." });
            }
            inFlight.add(id);
            try {
                const result = await backfillOnePo(id, {
                    dryRun: readFlag(req, "dryRun"),
                    overwrite: readFlag(req, "overwrite"),
                });
                const code = result.status === "failed" ? 502 : result.status === "skipped" ? 409 : 200;
                return res.status(code).json(result);
            } catch (err: any) {
                const isAuth = err?.message === "ZOHO_AUTH_FAILED" || err?.message === "ZOHO_NOT_CONFIGURED";
                console.error(`[zoho-desc-backfill] PO ${id}: unexpected error:`, err?.message || err);
                return res.status(isAuth ? 502 : 500).json({
                    message: isAuth
                        ? "Zoho Books authentication failed. Please contact the administrator."
                        : "Something went wrong while updating descriptions in Zoho Books. Please retry.",
                });
            } finally {
                inFlight.delete(id);
            }
        }
    );

    // ---- Every already-synced PO (one-time backfill) ----
    app.post(
        "/api/zoho-books/sync-descriptions",
        authMiddleware,
        requireRole("admin", "software_team"),
        async (req: Request, res: Response) => {
            if (!guard(res)) return;
            if (bulkRunning) {
                return res.status(409).json({ message: "A bulk description sync is already running." });
            }
            bulkRunning = true;
            try {
                const dryRun = readFlag(req, "dryRun");
                const overwrite = readFlag(req, "overwrite");
                const poIds: string[] | null = Array.isArray((req.body as any)?.poIds)
                    ? (req.body as any).poIds.map(String)
                    : null;

                const listRes = poIds
                    ? await query(
                        `SELECT id::text AS id FROM purchase_orders
                           WHERE zoho_sync_status = 'synced' AND zoho_purchase_order_id IS NOT NULL AND id::text = ANY($1::text[])`,
                        [poIds]
                    )
                    : await query(
                        `SELECT id::text AS id FROM purchase_orders
                           WHERE zoho_sync_status = 'synced' AND zoho_purchase_order_id IS NOT NULL
                           ORDER BY created_at ASC`
                    );

                const results: DescriptionBackfillResult[] = [];
                for (const row of listRes.rows) {
                    try {
                        results.push(await backfillOnePo(row.id, { dryRun, overwrite }));
                    } catch (err: any) {
                        const isAuth = err?.message === "ZOHO_AUTH_FAILED" || err?.message === "ZOHO_NOT_CONFIGURED";
                        results.push({
                            poId: row.id,
                            status: "failed",
                            message: isAuth ? "Zoho Books authentication failed." : (err?.message || "Unexpected error."),
                        });
                        if (isAuth) break;
                    }
                    // Stay well under Zoho's API rate limit.
                    await new Promise((r) => setTimeout(r, 700));
                }

                const count = (s: DescriptionBackfillResult["status"]) => results.filter((r) => r.status === s).length;
                return res.json({
                    dryRun,
                    total: results.length,
                    updated: count("updated"),
                    wouldUpdate: count("dry_run"),
                    nothingToUpdate: count("nothing_to_update"),
                    skipped: count("skipped"),
                    failed: count("failed"),
                    results,
                });
            } catch (err: any) {
                console.error("[zoho-desc-backfill] bulk error:", err?.message || err);
                return res.status(500).json({ message: "Bulk description sync failed. Please retry." });
            } finally {
                bulkRunning = false;
            }
        }
    );

    console.log("[zoho-desc-backfill] routes registered");
}

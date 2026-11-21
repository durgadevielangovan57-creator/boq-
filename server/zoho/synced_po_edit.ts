import type { Express, Request, Response } from "express";
import { pool, query } from "../db/client";
import { authMiddleware, requireRole } from "../middleware";
import { isZohoConfigured } from "./token_service";
import { zohoApiRequest, ZOHO_BOOKS_ORGANIZATION_ID } from "./api_client";

/**
 * =====================================================================
 * EDIT A DIRECT PURCHASE ORDER AFTER IT HAS BEEN SYNCED TO ZOHO BOOKS
 * ---------------------------------------------------------------------
 *   PUT /api/manual-purchase-orders/:id/edit-synced
 *
 * Normally an approved direct PO is locked. This endpoint is the one
 * controlled exception, for POs that are approved/ordered AND already in
 * Zoho Books. It lets the team add, delete or change items.
 *
 * What it does:
 *   1. Checks the Zoho PO still exists and is still editable in Zoho
 *      (draft / open / issued / approved ...). A billed or closed Zoho PO
 *      is refused BEFORE anything is changed here, so the two systems
 *      can never end up out of step for that reason.
 *   2. Enforces the "no increase" rule (see below).
 *   3. Saves the edit in ONE database transaction (all or nothing).
 *   4. Flags the PO `zoho_update_pending = true`. The existing Zoho sync
 *      endpoint then UPDATES THE SAME Zoho PO in place (a PUT using each
 *      line's original line_item_id). It never creates a second PO.
 *
 * NO-INCREASE RULE
 *   For every material that is ALREADY on the PO, the total quantity and
 *   the total line amount may be reduced but never increased. Materials
 *   that are not on the PO yet can be added, and materials can be removed.
 *   Set ENFORCE_NO_INCREASE to false to switch the rule off.
 *
 * PO number, vendor and project are fixed after sync and are ignored if sent.
 * =====================================================================
 */

export const ENFORCE_NO_INCREASE = true;

/** Zoho Books PO statuses in which the PO can still be edited. */
export const ZOHO_EDITABLE_PO_STATUSES = ["draft", "open", "issued", "pending_approval", "approved"];

/** Local statuses of a direct PO that may be edited after sync. */
const EDITABLE_LOCAL_STATUSES = ["approved", "ordered"];

const EPSILON = 0.005;
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Identity of a material on a PO: its material id, else its (lower-cased) name. */
const materialKey = (materialId: unknown, name: unknown) =>
    materialId ? `id:${String(materialId)}` : `name:${norm(name)}`;

type RuleLine = { materialId?: unknown; name: unknown; qty: number; amount: number };

/**
 * No-increase rule, shared by "edit a synced Direct PO" and "revise a synced Annexure PO".
 * For every material that is already on the PO, the total quantity and total amount may be
 * reduced but not increased. Removing a material, or adding a new one, is always allowed.
 * Returns one human-readable message per violation (empty = fine).
 */
export function findIncreaseViolations(before: RuleLine[], after: RuleLine[]): string[] {
    const old = new Map<string, { name: string; qty: number; amount: number }>();
    for (const b of before) {
        const k = materialKey(b.materialId, b.name);
        const cur = old.get(k) || { name: String(b.name ?? ""), qty: 0, amount: 0 };
        cur.qty += Number(b.qty) || 0;
        cur.amount += Number(b.amount) || 0;
        old.set(k, cur);
    }
    const now = new Map<string, { qty: number; amount: number }>();
    for (const a of after) {
        const k = materialKey(a.materialId, a.name);
        const cur = now.get(k) || { qty: 0, amount: 0 };
        cur.qty += Number(a.qty) || 0;
        cur.amount += Number(a.amount) || 0;
        now.set(k, cur);
    }
    const problems: string[] = [];
    for (const [k, o] of old) {
        const n = now.get(k);
        if (!n) continue; // removed: always allowed
        if (n.qty > o.qty + EPSILON) {
            problems.push(`${o.name}: quantity cannot be increased (currently ${o.qty}, you entered ${n.qty})`);
        } else if (n.amount > o.amount + EPSILON) {
            problems.push(`${o.name}: amount cannot be increased (currently ${money(o.amount)}, you entered ${money(n.amount)})`);
        }
    }
    return problems;
}

export function registerSyncedPoEditRoutes(app: Express) {
    const inFlight = new Set<string>();

    app.put(
        "/api/manual-purchase-orders/:id/edit-synced",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            const id = String(req.params.id);
            if (inFlight.has(id)) {
                return res.status(409).json({ message: "This Purchase Order is already being edited. Please wait." });
            }
            inFlight.add(id);

            try {
                if (!isZohoConfigured() || !ZOHO_BOOKS_ORGANIZATION_ID) {
                    return res.status(503).json({
                        message: "Zoho Books is not configured, so a synced Purchase Order cannot be edited right now.",
                    });
                }

                const { deliveryDate, paymentTerms, deliveryAddress, notes, items } = req.body || {};

                // ---- 1. The PO must be an approved, synced direct PO ----
                const poRes = await query(
                    `SELECT id::text AS id, po_number, source, status, zoho_sync_status, zoho_purchase_order_id
                       FROM purchase_orders WHERE id::text = $1`,
                    [id]
                );
                if (poRes.rows.length === 0) return res.status(404).json({ message: "Purchase Order not found." });
                const po = poRes.rows[0];

                if (po.source !== "manual") {
                    return res.status(400).json({ message: "Only direct Purchase Orders can be edited here." });
                }
                if (!EDITABLE_LOCAL_STATUSES.includes(norm(po.status))) {
                    return res.status(409).json({
                        message: `A Purchase Order in "${po.status}" status cannot be edited after sync.`,
                    });
                }
                if (po.zoho_sync_status !== "synced" || !po.zoho_purchase_order_id) {
                    return res.status(409).json({
                        message: "This Purchase Order has not been synced to Zoho Books yet.",
                    });
                }

                // ---- 2. Validate the submitted items ----
                if (!Array.isArray(items) || items.length === 0) {
                    return res.status(400).json({
                        message: "A Purchase Order must keep at least one item. To cancel the order, cancel it in Zoho Books.",
                    });
                }
                const cleanItems = items.map((it: any) => {
                    const qty = Number(it.qty);
                    const rate = Number(it.rate);
                    const discountPercent = Number(it.discountPercent) || 0;
                    const gstPercentage = Number(it.gstPercentage) || 0;
                    const taxable = qty * rate * (1 - discountPercent / 100);
                    return {
                        materialId: it.materialId || null,
                        item: String(it.item || "").trim(),
                        description: it.description ? String(it.description) : null,
                        hsnCode: it.hsnCode || null,
                        sacCode: it.sacCode || null,
                        unit: it.unit || null,
                        qty,
                        rate,
                        discountPercent,
                        gstPercentage,
                        taxable,
                        tax: taxable * (gstPercentage / 100),
                    };
                });
                for (const it of cleanItems) {
                    if (!it.item) return res.status(400).json({ message: "Every item needs a name." });
                    if (!Number.isFinite(it.qty) || it.qty <= 0) {
                        return res.status(400).json({
                            message: `Quantity of "${it.item}" must be greater than 0. Remove the item instead if it is no longer needed.`,
                        });
                    }
                    if (!Number.isFinite(it.rate) || it.rate < 0) {
                        return res.status(400).json({ message: `Rate of "${it.item}" is not valid.` });
                    }
                }

                // ---- 3. NO-INCREASE rule, per material already on the PO ----
                const baseRes = await query(
                    `SELECT id::text AS id, material_id, item, description, qty, original_qty, amount FROM purchase_order_items
                      WHERE po_id::text = $1 ORDER BY created_at ASC`,
                    [id]
                );
                if (ENFORCE_NO_INCREASE) {
                    const problems = findIncreaseViolations(
                        baseRes.rows.map((b: any) => ({
                            materialId: b.material_id,
                            name: b.item,
                            qty: Number(b.qty) || 0,
                            amount: Number(b.amount) || 0,
                        })),
                        cleanItems.map((it) => ({ materialId: it.materialId, name: it.item, qty: it.qty, amount: it.taxable }))
                    );
                    if (problems.length > 0) {
                        return res.status(422).json({
                            message: `Quantities and amounts of existing materials can be reduced but not increased. ${problems.join("; ")}.`,
                            violations: problems,
                        });
                    }
                }

                // ---- 4. The Zoho PO must still exist and be editable ----
                const zres = await zohoApiRequest(`/purchaseorders/${encodeURIComponent(po.zoho_purchase_order_id)}`);
                if (!zres.ok || !zres.data?.purchaseorder) {
                    return res.status(502).json({
                        message: `Could not check this Purchase Order in Zoho Books (${zres.data?.message || `HTTP ${zres.status}`}). Nothing was changed.`,
                    });
                }
                const zohoStatus = norm(zres.data.purchaseorder.status);
                if (zohoStatus && !ZOHO_EDITABLE_PO_STATUSES.includes(zohoStatus)) {
                    return res.status(409).json({
                        message: `This Purchase Order is "${zres.data.purchaseorder.status}" in Zoho Books and can no longer be edited, so it cannot be changed here. Nothing was changed.`,
                    });
                }

                // ---- 5. Save in ONE transaction ----
                const subtotal = cleanItems.reduce((a, it) => a + it.taxable, 0);
                const totalTax = cleanItems.reduce((a, it) => a + it.tax, 0);
                const total = subtotal + totalTax;

                // Match each submitted line to an existing item row of the same material so that
                // row is UPDATED IN PLACE (its id never changes). Other parts of the app point at
                // PO item ids (e.g. rate-reduction requests/history), so rows must not be recreated.
                // Pass 1: same material + same description. Pass 2: same material.
                const matchedRowFor: Array<(typeof baseRes.rows)[number] | null> = cleanItems.map(() => null);
                const usedRowIds = new Set<string>();
                for (const requireSameDescription of [true, false]) {
                    cleanItems.forEach((it, i) => {
                        if (matchedRowFor[i]) return;
                        const k = materialKey(it.materialId, it.item);
                        const row = baseRes.rows.find(
                            (b: any) =>
                                !usedRowIds.has(b.id) &&
                                materialKey(b.material_id, b.item) === k &&
                                (!requireSameDescription || norm(b.description) === norm(it.description))
                        );
                        if (row) {
                            usedRowIds.add(row.id);
                            matchedRowFor[i] = row;
                        }
                    });
                }

                const client = await pool.connect();
                try {
                    await client.query("BEGIN");
                    const upd = await client.query(
                        `UPDATE purchase_orders SET
                           delivery_date = $1, payment_terms = $2, delivery_address = $3, shipping_address = $3,
                           notes = $4, comments = $4,
                           subtotal = $5, tax = $6, total = $7,
                           zoho_update_pending = true, zoho_sync_error = NULL, updated_at = NOW()
                         WHERE id::text = $8 AND source = 'manual'
                           AND LOWER(status) IN ('approved', 'ordered')
                           AND zoho_sync_status = 'synced'
                         RETURNING id`,
                        [
                            deliveryDate || null,
                            paymentTerms || null,
                            deliveryAddress || null,
                            notes || null,
                            money(subtotal),
                            money(totalTax),
                            money(total),
                            id,
                        ]
                    );
                    if (upd.rows.length === 0) {
                        await client.query("ROLLBACK");
                        return res.status(409).json({
                            message: "This Purchase Order changed while you were editing it. Please refresh and try again.",
                        });
                    }

                    // Rows that were removed from the PO.
                    const removedIds = baseRes.rows.map((b: any) => b.id).filter((rid: string) => !usedRowIds.has(rid));
                    if (removedIds.length > 0) {
                        await client.query(
                            `DELETE FROM purchase_order_items WHERE po_id::text = $1 AND id::text = ANY($2::text[])`,
                            [id, removedIds]
                        );
                    }
                    for (let i = 0; i < cleanItems.length; i++) {
                        const it = cleanItems[i];
                        const row: any = matchedRowFor[i];
                        if (row) {
                            // Existing item: update in place; keep its first-ever (original) quantity.
                            const originalQty = Number(row.original_qty ?? row.qty) || 0;
                            await client.query(
                                `UPDATE purchase_order_items SET
                                   material_id = $1, item = $2, description = $3, unit = $4, qty = $5,
                                   rate = $6, amount = $7, hsn_code = $8, sac_code = $9,
                                   discount_percent = $10, tax_amount = $11, gst_percentage = $12, qty_modified = $13
                                 WHERE id::text = $14 AND po_id::text = $15`,
                                [
                                    it.materialId, it.item, it.description, it.unit, it.qty,
                                    it.rate, money(it.taxable), it.hsnCode, it.sacCode,
                                    it.discountPercent, money(it.tax), it.gstPercentage,
                                    Math.abs(it.qty - originalQty) > EPSILON,
                                    row.id, id,
                                ]
                            );
                        } else {
                            // Newly added item.
                            await client.query(
                                `INSERT INTO purchase_order_items
                                   (po_id, material_id, item, description, unit, qty, original_qty,
                                    rate, amount, hsn_code, sac_code, discount_percent, tax_amount,
                                    gst_percentage, qty_modified)
                                 VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,false)`,
                                [
                                    id, it.materialId, it.item, it.description, it.unit, it.qty,
                                    it.rate, money(it.taxable), it.hsnCode, it.sacCode,
                                    it.discountPercent, money(it.tax), it.gstPercentage,
                                ]
                            );
                        }
                    }
                    await client.query("COMMIT");
                } catch (txErr) {
                    try {
                        await client.query("ROLLBACK");
                    } catch {
                        /* already rolled back */
                    }
                    throw txErr;
                } finally {
                    client.release();
                }

                console.log(`[zoho-edit-synced] PO ${po.po_number}: edit saved, Zoho update pending`);
                return res.json({
                    message: "Changes saved. They will now be updated in Zoho Books.",
                    needsZohoUpdate: true,
                    purchaseOrder: { id, poNumber: po.po_number, subtotal, tax: totalTax, total },
                });
            } catch (err: any) {
                if (err?.message === "ZOHO_AUTH_FAILED" || err?.message === "ZOHO_NOT_CONFIGURED") {
                    return res.status(502).json({
                        message: "Zoho Books authentication failed. Nothing was changed. Please contact the administrator.",
                    });
                }
                console.error("PUT /api/manual-purchase-orders/:id/edit-synced error:", err?.message || err);
                return res.status(500).json({ message: "Failed to save changes to the Purchase Order." });
            } finally {
                inFlight.delete(id);
            }
        }
    );

    console.log("[zoho-edit-synced] routes registered");
}
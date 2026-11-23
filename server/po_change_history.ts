import type { Express, Request, Response } from "express";
import { query } from "./db/client";
import { authMiddleware } from "./middleware";

/**
 * =====================================================================
 * PURCHASE ORDER CHANGE HISTORY (additive)
 * ---------------------------------------------------------------------
 * One row per change made to a PO after it was created:
 *   item_added | item_removed | qty_increased | qty_decreased | rate_changed
 * Each row keeps the old / new values, the reason the user gave, who did it
 * and when. Written by:
 *   - PUT  /api/purchase-orders/:id/edit-synced   (edit & sync only changes)
 *   - POST /api/purchase-orders/:id/revise        (generated PO revision)
 * Read by:
 *   - GET  /api/purchase-orders/:id/change-history
 *   - GET  /api/projects/:projectId/po-change-history
 * =====================================================================
 */

export type PoChangeType = "item_added" | "item_removed" | "qty_increased" | "qty_decreased" | "rate_changed";

/** Changes that must come with a reason typed by the user. */
export const REASON_REQUIRED_TYPES: PoChangeType[] = ["item_added", "item_removed", "qty_increased", "qty_decreased", "rate_changed"];

const EPS = 0.005;
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export interface PoChange {
    type: PoChangeType;
    itemName: string;
    oldQty: number | null;
    newQty: number | null;
    oldRate: number | null;
    newRate: number | null;
    oldAmount: number | null;
    newAmount: number | null;
}

/** Key used to match a submitted reason to a change: "<type>|<item name>". */
export const changeKey = (type: string, itemName: unknown) => `${type}|${norm(itemName)}`;

export function pairChanges(
    pairs: Array<{ before: { name: string; qty: number; rate: number; amount: number } | null; after: { name: string; qty: number; rate: number; amount: number } | null }>
): PoChange[] {
    const out: PoChange[] = [];
    for (const { before, after } of pairs) {
        if (!before && after) {
            out.push({ type: "item_added", itemName: after.name, oldQty: null, newQty: after.qty, oldRate: null, newRate: after.rate, oldAmount: null, newAmount: after.amount });
        } else if (before && !after) {
            out.push({ type: "item_removed", itemName: before.name, oldQty: before.qty, newQty: null, oldRate: before.rate, newRate: null, oldAmount: before.amount, newAmount: null });
        } else if (before && after) {
            if (after.qty > before.qty + EPS) {
                out.push({ type: "qty_increased", itemName: after.name, oldQty: before.qty, newQty: after.qty, oldRate: before.rate, newRate: after.rate, oldAmount: before.amount, newAmount: after.amount });
            } else if (after.qty < before.qty - EPS) {
                out.push({ type: "qty_decreased", itemName: after.name, oldQty: before.qty, newQty: after.qty, oldRate: before.rate, newRate: after.rate, oldAmount: before.amount, newAmount: after.amount });
            }
            if (Math.abs(after.rate - before.rate) > EPS) {
                out.push({ type: "rate_changed", itemName: after.name, oldQty: before.qty, newQty: after.qty, oldRate: before.rate, newRate: after.rate, oldAmount: before.amount, newAmount: after.amount });
            }
        }
    }
    return out;
}

/** Looks up the reason for a change in a { "<type>|<item>": "reason" } map. */
export function reasonFor(reasons: Record<string, string> | undefined, c: PoChange): string {
    return String(reasons?.[changeKey(c.type, c.itemName)] ?? "").trim();
}

/** Human readable "what is missing" list for changes that need a reason. */
export function findMissingReasons(changes: PoChange[], reasons: Record<string, string> | undefined): string[] {
    const missing: string[] = [];
    for (const c of changes) {
        if (!REASON_REQUIRED_TYPES.includes(c.type)) continue;
        if (reasonFor(reasons, c)) continue;
        const what =
            c.type === "item_added" ? "adding" :
                c.type === "item_removed" ? "removing" :
                    c.type === "qty_increased" ? "increasing the quantity of" :
                        c.type === "qty_decreased" ? "reducing the quantity of" :
                            "changing the rate of";
        missing.push(`Reason required for ${what} "${c.itemName}"`);
    }
    return missing;
}

let tableReady: Promise<void> | null = null;
export function ensurePoChangeHistoryTable(): Promise<void> {
    if (!tableReady) {
        tableReady = (async () => {
            await query(`
                CREATE TABLE IF NOT EXISTS po_change_history (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    po_id TEXT NOT NULL,
                    po_number TEXT,
                    project_id TEXT,
                    project_name TEXT,
                    vendor_name TEXT,
                    change_type TEXT NOT NULL,
                    item_name TEXT,
                    old_qty NUMERIC(15,3),
                    new_qty NUMERIC(15,3),
                    old_rate NUMERIC(15,2),
                    new_rate NUMERIC(15,2),
                    old_amount NUMERIC(15,2),
                    new_amount NUMERIC(15,2),
                    reason TEXT,
                    action TEXT,
                    changed_by TEXT,
                    changed_by_name TEXT,
                    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )`);
            await query(`CREATE INDEX IF NOT EXISTS idx_po_change_history_po ON po_change_history(po_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_po_change_history_project ON po_change_history(project_id)`);
        })().catch((e) => {
            tableReady = null;
            throw e;
        });
    }
    return tableReady;
}

/** Runner = pool client or the shared `query` helper (anything with .query(text, params)). */
export async function recordPoChanges(
    runner: { query: (text: string, params?: any[]) => Promise<any> },
    po: { id: string; po_number: string; project_id?: string | null; project_name?: string | null; vendor_name?: string | null },
    changes: PoChange[],
    reasons: Record<string, string> | undefined,
    fallbackReason: string,
    action: "edit_synced" | "revise",
    user: { id?: string; fullName?: string; username?: string } | undefined
) {
    if (changes.length === 0) return;
    for (const c of changes) {
        await runner.query(
            `INSERT INTO po_change_history
               (po_id, po_number, project_id, project_name, vendor_name, change_type, item_name,
                old_qty, new_qty, old_rate, new_rate, old_amount, new_amount, reason, action, changed_by, changed_by_name)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
                String(po.id),
                po.po_number,
                po.project_id != null ? String(po.project_id) : null,
                po.project_name || null,
                po.vendor_name || null,
                c.type,
                c.itemName,
                c.oldQty,
                c.newQty,
                c.oldRate,
                c.newRate,
                c.oldAmount,
                c.newAmount,
                reasonFor(reasons, c) || fallbackReason || null,
                action,
                user?.id != null ? String(user.id) : null,
                user?.fullName || user?.username || null,
            ]
        );
    }
}

export async function registerPoChangeHistoryRoutes(app: Express) {
    try {
        await ensurePoChangeHistoryTable();
    } catch (e: any) {
        console.error("[po-change-history] could not create table:", e?.message || e);
    }

    // History of one PO and every other version of it (-R1, -R2, ...).
    app.get("/api/purchase-orders/:id/change-history", authMiddleware, async (req: Request, res: Response) => {
        try {
            await ensurePoChangeHistoryTable();
            const id = String(req.params.id);
            const poRes = await query(`SELECT po_number FROM purchase_orders WHERE id::text = $1`, [id]);
            if (poRes.rows.length === 0) return res.status(404).json({ message: "Purchase Order not found." });
            const base = String(poRes.rows[0].po_number || "").replace(/-(R\d+|Deferred\d+)$/, "");
            const escaped = base.replace(/[\\%_]/g, (c) => "\\" + c);
            const rows = await query(
                `SELECT * FROM po_change_history
                  WHERE po_id = $1 OR po_number = $2 OR po_number LIKE $3
                  ORDER BY changed_at DESC`,
                [id, base, escaped + "-%"]
            );
            res.json({ history: rows.rows });
        } catch (err: any) {
            console.error("GET /api/purchase-orders/:id/change-history error:", err?.message || err);
            res.status(500).json({ message: "Failed to load PO history." });
        }
    });

    // History of every PO in a project.
    app.get("/api/projects/:projectId/po-change-history", authMiddleware, async (req: Request, res: Response) => {
        try {
            await ensurePoChangeHistoryTable();
            const projectId = String(req.params.projectId);
            const rows = await query(
                `SELECT * FROM po_change_history WHERE project_id = $1 ORDER BY changed_at DESC`,
                [projectId]
            );
            res.json({ history: rows.rows });
        } catch (err: any) {
            console.error("GET /api/projects/:projectId/po-change-history error:", err?.message || err);
            res.status(500).json({ message: "Failed to load project PO history." });
        }
    });

    console.log("[po-change-history] routes registered");
}
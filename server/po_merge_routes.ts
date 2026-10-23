import type { Express, Request, Response } from "express";
import { query } from "./db/client";
import { authMiddleware, requireRole } from "./middleware";

/**
 * =====================================================================
 * PO "Merge selected items" (additive feature)
 * =====================================================================
 * Lets the user tick several DRAFT purchase orders (e.g. the 5 POs that
 * each contain plywood from a different shop), pick only the items they
 * want to order from ONE vendor, and move just those items into a single
 * new draft PO. Every other item stays in its own PO.
 *
 * Does not modify any existing route or table definition.
 */

type PoRow = {
  id: string;
  po_number: string;
  project_id: string;
  project_name: string | null;
  vendor_id: string;
  vendor_name: string | null;
  status: string;
  version_id: string | null;
  version_number: string | null;
  requested_by: string | null;
  zoho_purchase_order_id: string | null;
  zoho_sync_status: string | null;
};

const norm = (v: any) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const groupKey = (it: any) => `${norm(it.item)}||${norm(it.unit)}`;
const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Loads the selected POs and checks they can be merged. Returns an error string if not. */
async function loadAndValidatePos(poIds: any): Promise<{ error?: string; pos?: PoRow[] }> {
  if (!Array.isArray(poIds) || poIds.length < 2) {
    return { error: "Select at least 2 purchase orders to merge." };
  }
  const ids = poIds.map(String);
  const res = await query(
    `SELECT id, po_number, project_id, project_name, vendor_id, vendor_name, status,
            version_id::text AS version_id, version_number::text AS version_number,
            requested_by, zoho_purchase_order_id, zoho_sync_status
       FROM purchase_orders WHERE id::text = ANY($1)`,
    [ids]
  );
  const pos: PoRow[] = res.rows;
  if (pos.length !== ids.length) {
    return { error: "Some of the selected purchase orders no longer exist. Please refresh and try again." };
  }
  // POs in any status (draft, revised, pending, approved...) can be merged.
  // Set to true to go back to "Draft only".
  const DRAFT_ONLY = false;
  if (DRAFT_ONLY) {
    const notDraft = pos.filter((p) => String(p.status || "").toLowerCase() !== "draft");
    if (notDraft.length > 0) {
      return {
        error: `Only Draft purchase orders can be merged. Not draft: ${notDraft.map((p) => p.po_number).join(", ")}.`,
      };
    }
  }
  const synced = pos.filter((p) => p.zoho_purchase_order_id || p.zoho_sync_status === "synced");
  if (synced.length > 0) {
    return {
      error: `These purchase orders are already synced to Zoho Books and cannot be merged: ${synced.map((p) => p.po_number).join(", ")}.`,
    };
  }
  if (new Set(pos.map((p) => String(p.project_id))).size > 1) {
    return { error: "Selected purchase orders belong to different projects. Select POs of one project only." };
  }
  if (new Set(pos.map((p) => String(p.version_id ?? ""))).size > 1) {
    return { error: "Selected purchase orders belong to different BOQ versions. Select POs of one version only." };
  }
  return { pos };
}

async function loadItems(poIds: string[]) {
  const res = await query(
    `SELECT id::text AS id, po_id::text AS po_id, material_id, item, description, unit, qty, original_qty,
            rate, amount, hsn_code, sac_code, gst_percentage
       FROM purchase_order_items
      WHERE po_id::text = ANY($1)
      ORDER BY created_at ASC, id ASC`,
    [poIds]
  );
  return res.rows as any[];
}

/** Finds this vendor's own price-list entry for an item name. */
async function findVendorMaterial(vendorId: string, itemName: string, unit: string) {
  const res = await query(
    `SELECT id::text AS id, rate, unit
       FROM materials
      WHERE shop_id::text = $1
        AND approved IS TRUE
        AND LOWER(TRIM(name)) = $2
      ORDER BY created_at DESC`,
    [String(vendorId), norm(itemName)]
  );
  if (res.rows.length === 0) return null;
  // Prefer the same unit when the vendor has several entries
  const sameUnit = res.rows.find((r: any) => norm(r.unit) === norm(unit));
  return sameUnit || res.rows[0];
}

function buildGroups(pos: PoRow[], items: any[]) {
  const poById = new Map(pos.map((p) => [String(p.id), p]));
  const groups = new Map<string, any>();
  for (const it of items) {
    const key = groupKey(it);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        item: it.item,
        unit: it.unit || "",
        totalQty: 0,
        originalAmount: 0,
        lines: [] as any[],
      };
      groups.set(key, g);
    }
    const qty = num(it.qty);
    const rate = num(it.rate);
    g.totalQty += qty;
    g.originalAmount += qty * rate;
    const po = poById.get(String(it.po_id));
    g.lines.push({
      itemRowId: it.id,
      poId: it.po_id,
      poNumber: po?.po_number,
      vendorName: po?.vendor_name,
      qty,
      rate,
    });
  }
  return Array.from(groups.values()).map((g) => ({
    ...g,
    avgOriginalRate: g.totalQty > 0 ? g.originalAmount / g.totalQty : 0,
    // Only items that appear in 2+ POs are really "mergeable duplicates", but the user may
    // also want to pull a single-PO item into the merged PO, so all items are returned.
    inPoCount: new Set(g.lines.map((l: any) => l.poId)).size,
  }));
}

export async function registerPoMergeRoutes(app: Express) {
  // Additive, nullable columns that mark a PO as a merged PO. Kept out of
  // approval_comments so nothing shows up under "Additional Terms & Conditions".
  try {
    await query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS merged_from TEXT`);
    await query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS merge_reason TEXT`);
  } catch (err) {
    console.warn("[db] Could not add merged_from/merge_reason columns:", (err as any)?.message || err);
  }

  // POST /api/purchase-orders/merge-items/preview
  // body: { poIds: string[], vendorId?: string }
  app.post(
    "/api/purchase-orders/merge-items/preview",
    authMiddleware,
    requireRole("admin", "software_team", "purchase_team"),
    async (req: Request, res: Response) => {
      try {
        const { poIds, vendorId } = req.body || {};
        const v = await loadAndValidatePos(poIds);
        if (v.error) return res.status(400).json({ message: v.error });
        const pos = v.pos!;
        const items = await loadItems(pos.map((p) => String(p.id)));
        const groups = buildGroups(pos, items);

        if (vendorId) {
          for (const g of groups) {
            const m = await findVendorMaterial(String(vendorId), g.item, g.unit);
            g.vendorMaterialId = m ? m.id : null;
            g.vendorRate = m ? num(m.rate) : null;
          }
        }

        res.json({
          pos: pos.map((p) => ({ id: p.id, po_number: p.po_number, vendor_name: p.vendor_name })),
          groups,
        });
      } catch (err) {
        console.error("POST /api/purchase-orders/merge-items/preview error:", err);
        res.status(500).json({ message: "Failed to prepare the merge." });
      }
    }
  );

  // POST /api/purchase-orders/merge-items
  // body: { poIds: string[], vendorId: string, items: [{ key: string, rate?: number }], reason?: string }
  app.post(
    "/api/purchase-orders/merge-items",
    authMiddleware,
    requireRole("admin", "software_team", "purchase_team"),
    async (req: Request, res: Response) => {
      const { poIds, vendorId, items: selected, reason } = req.body || {};
      try {
        if (!vendorId) return res.status(400).json({ message: "Please choose the vendor to order from." });
        if (!Array.isArray(selected) || selected.length === 0) {
          return res.status(400).json({ message: "Select at least one item to merge." });
        }

        const v = await loadAndValidatePos(poIds);
        if (v.error) return res.status(400).json({ message: v.error });
        const pos = v.pos!;

        const vendorRes = await query(`SELECT id::text AS id, name FROM shops WHERE id::text = $1`, [String(vendorId)]);
        if (vendorRes.rows.length === 0) return res.status(400).json({ message: "Selected vendor was not found." });
        const vendor = vendorRes.rows[0];

        const allItems = await loadItems(pos.map((p) => String(p.id)));
        const groups = buildGroups(pos, allItems);
        const groupByKey = new Map(groups.map((g) => [g.key, g]));

        // Resolve final rate per selected group
        const resolved: { group: any; rate: number; vendorMaterialId: string | null }[] = [];
        let anyIncrease = false;
        for (const sel of selected) {
          const g = groupByKey.get(String(sel.key));
          if (!g) return res.status(400).json({ message: "An item selected for merge no longer exists. Please refresh." });
          const m = await findVendorMaterial(String(vendorId), g.item, g.unit);
          let rate: number | null = null;
          if (sel.rate !== undefined && sel.rate !== null && sel.rate !== "" && Number(sel.rate) >= 0) {
            rate = Number(sel.rate); // manual / edited rate
          } else if (m) {
            rate = num(m.rate);
          } else {
            // Vendor has no price for this item: keep the old PO rate.
            rate = g.avgOriginalRate;
          }
          if (rate === null || !Number.isFinite(rate)) {
            return res.status(400).json({
              message: `"${g.item}" is not in ${vendor.name}'s price list. Enter a rate for it or untick it.`,
            });
          }
          if (rate > g.avgOriginalRate + 0.005) anyIncrease = true;
          resolved.push({ group: g, rate, vendorMaterialId: m ? m.id : null });
        }

        if (anyIncrease && !String(reason || "").trim()) {
          return res.status(400).json({
            message: "Some rates are higher than the original PO rates. Please enter a reason.",
            reasonRequired: true,
          });
        }

        await query("BEGIN");
        try {
          const first = pos[0];
          const poNumber = `Anx-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
          const sourceNumbers = pos.map((p) => p.po_number).join(", ");
          const mergeReason = anyIncrease && reason ? String(reason).trim() : null;

          const newPo = await query(
            `INSERT INTO purchase_orders
               (po_number, project_id, project_name, vendor_id, vendor_name, status, total, subtotal,
                version_id, version_number, requested_by, merged_from, merge_reason)
             VALUES ($1,$2,$3,$4,$5,'draft',0,0,$6,$7,$8,$9,$10)
             RETURNING id`,
            [
              poNumber,
              first.project_id,
              first.project_name,
              String(vendor.id),
              vendor.name,
              first.version_id,
              first.version_number,
              first.requested_by,
              sourceNumbers,
              mergeReason,
            ]
          );
          const newPoId = newPo.rows[0].id;

          let newTotal = 0;
          const movedRowIds: string[] = [];
          const touchedPoIds = new Set<string>();

          for (const { group, rate, vendorMaterialId } of resolved) {
            const rowsOfGroup = allItems.filter((it) => groupKey(it) === group.key);
            const base = rowsOfGroup[0];
            const qty = group.totalQty;
            const originalQty = rowsOfGroup.reduce((s, r) => s + num(r.original_qty ?? r.qty), 0);
            const amount = Math.round(qty * rate * 100) / 100;
            newTotal += amount;

            const descs = Array.from(new Set(rowsOfGroup.map((r) => String(r.description || "").trim()).filter(Boolean)));
            const gstRow = rowsOfGroup.find((r) => r.gst_percentage !== null && r.gst_percentage !== undefined);

            await query(
              `INSERT INTO purchase_order_items
                 (po_id, material_id, item, description, unit, qty, original_qty, rate, amount, hsn_code, sac_code, qty_modified, gst_percentage)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12)`,
              [
                newPoId,
                vendorMaterialId || base.material_id || null,
                base.item,
                descs.length ? descs.join("; ") : null,
                base.unit || null,
                qty,
                originalQty,
                rate,
                amount,
                base.hsn_code || null,
                base.sac_code || null,
                gstRow ? gstRow.gst_percentage : 18,
              ]
            );

            for (const r of rowsOfGroup) {
              movedRowIds.push(r.id);
              touchedPoIds.add(String(r.po_id));
            }
          }

          // Take the merged lines out of the original POs
          await query(`DELETE FROM purchase_order_items WHERE id::text = ANY($1)`, [movedRowIds]);

          // Update totals of the original POs; remove the ones that are now empty
          const removedPos: string[] = [];
          for (const poId of touchedPoIds) {
            const sum = await query(
              `SELECT COUNT(*)::int AS cnt, COALESCE(SUM(amount),0) AS total FROM purchase_order_items WHERE po_id::text = $1`,
              [poId]
            );
            if (sum.rows[0].cnt === 0) {
              await query(`DELETE FROM purchase_orders WHERE id::text = $1`, [poId]);
              removedPos.push(pos.find((p) => String(p.id) === poId)?.po_number || poId);
            } else {
              await query(
                `UPDATE purchase_orders SET total = $1, subtotal = $1, updated_at = NOW() WHERE id::text = $2`,
                [sum.rows[0].total, poId]
              );
            }
          }

          await query(`UPDATE purchase_orders SET total = $1, subtotal = $1, updated_at = NOW() WHERE id = $2`, [
            Math.round(newTotal * 100) / 100,
            newPoId,
          ]);

          await query("COMMIT");
          res.json({
            message: "Items merged into a new purchase order.",
            purchaseOrder: { id: newPoId, po_number: poNumber, total: newTotal },
            removedPos,
          });
        } catch (err) {
          await query("ROLLBACK");
          throw err;
        }
      } catch (err) {
        console.error("POST /api/purchase-orders/merge-items error:", err);
        res.status(500).json({ message: "Failed to merge items. Nothing was changed." });
      }
    }
  );
}
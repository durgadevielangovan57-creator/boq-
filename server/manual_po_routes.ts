import type { Express, Request, Response } from "express";
import { query } from "./db/client";
import { authMiddleware, requireRole } from "./middleware";
import { isManualPoEditable } from "./manual_po_workflow";

/**
 * =====================================================================
 * MANUAL PURCHASE ORDER CREATION (isolated, additive module)
 * ---------------------------------------------------------------------
 * - Does NOT modify server/routes.ts, the existing PO generation flow,
 *   Annexure generation, or any existing table columns/routes.
 * - Uses the same `purchase_orders` and `purchase_order_items` tables
 *   as the existing BOM-generated POs — the newly-created POs are
 *   first-class citizens and work with the existing listing, detail,
 *   approval, Zoho sync, and delivery tracker flows without any changes.
 * - Exposes additive-only endpoints:
 *     GET    /api/manual-purchase-orders/projects      — list active projects
 *     GET    /api/manual-purchase-orders/vendors       — list vendors (shops)
 *     GET    /api/manual-purchase-orders/materials     — search materials
 *     GET    /api/manual-purchase-orders/next-number   — generate next PO number
 *     GET    /api/manual-purchase-orders/:id           — get PO data for editing
 *     POST   /api/manual-purchase-orders               — create a new PO
 *     PUT    /api/manual-purchase-orders/:id           — update a draft PO
 * =====================================================================
 */

/** Adds any additive-only columns this feature needs (idempotent). */
async function ensureManualPoSchema() {
    try {
        // Mark POs created via manual flow vs BOM generation (nullable, additive).
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'generated'`
        );
        // PO Date
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_date DATE DEFAULT CURRENT_DATE`
        );
        // Payment terms for manual POs
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_terms TEXT`
        );
        // Delivery address / notes for manual POs
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT`
        );
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT`
        );
        // Reference number (optional)
        await query(
            `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS reference_number TEXT`
        );
        // Discount & tax on item level
        await query(
            `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0`
        );
        await query(
            `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) DEFAULT 0`
        );
        console.log("[manual-po-routes] Manual PO schema columns verified/created");
    } catch (err: any) {
        console.warn(
            "[manual-po-routes] Could not verify/create manual PO schema columns:",
            err?.message || err
        );
    }
}

export async function registerManualPoRoutes(app: Express) {
    await ensureManualPoSchema();

    // GET /api/manual-purchase-orders/next-number - Generate next PO number
    app.get(
        "/api/manual-purchase-orders/next-number",
        authMiddleware,
        async (_req: Request, res: Response) => {
            try {
                const result = await query(
                    `SELECT po_number FROM purchase_orders 
                     WHERE po_number LIKE 'PO-%' 
                     ORDER BY created_at DESC LIMIT 50`
                );
                let maxNum = 1000;
                for (const row of result.rows) {
                    const match = (row.po_number || "").match(/PO-(\d+)/);
                    if (match) {
                        const val = parseInt(match[1], 10);
                        if (!isNaN(val) && val > maxNum) {
                            maxNum = val;
                        }
                    }
                }
                const poNumber = `PO-${String(maxNum + 1).padStart(4, "0")}`;
                res.json({ poNumber });
            } catch (err) {
                console.error("GET /api/manual-purchase-orders/next-number error:", err);
                res.status(500).json({ message: "Failed to generate PO number" });
            }
        }
    );

    // GET /api/manual-purchase-orders/projects - List projects for PO creation
    app.get(
        "/api/manual-purchase-orders/projects",
        authMiddleware,
        async (_req: Request, res: Response) => {
            try {
                const result = await query(
                    `SELECT id, name, client, location, status 
                     FROM boq_projects 
                     ORDER BY name ASC`
                );
                res.json({ projects: result.rows });
            } catch (err) {
                console.error("GET /api/manual-purchase-orders/projects error:", err);
                res.status(500).json({ message: "Failed to load projects" });
            }
        }
    );

    // GET /api/manual-purchase-orders/vendors - List vendors/shops for PO creation
    app.get(
        "/api/manual-purchase-orders/vendors",
        authMiddleware,
        async (_req: Request, res: Response) => {
            try {
                const result = await query(
                    `SELECT id, name, location, new_location, city, state, pincode, 
                            gstno, contactnumber, phonecountrycode, terms_and_conditions,
                            zoho_contact_id
                     FROM shops 
                     WHERE approved IS NOT FALSE 
                     ORDER BY name ASC`
                );
                res.json({ vendors: result.rows });
            } catch (err) {
                console.error("GET /api/manual-purchase-orders/vendors error:", err);
                res.status(500).json({ message: "Failed to load vendors" });
            }
        }
    );

    // GET /api/manual-purchase-orders/materials - Search materials for PO items
    app.get(
        "/api/manual-purchase-orders/materials",
        authMiddleware,
        async (req: Request, res: Response) => {
            try {
                const search = (req.query.q as string || "").trim();
                let queryStr = `SELECT m.id, m.name, m.unit, m.rate, m.category, m.subcategory, m.brandname AS "brandName",
                                       m.technicalspecification, 
                                       COALESCE(
                                           NULLIF(TRIM(m.hsn_code), ''),
                                           NULLIF(TRIM(mt.hsn_code), ''),
                                           NULLIF(TRIM(m.sac_code), ''),
                                           NULLIF(TRIM(mt.sac_code), ''),
                                           NULLIF(TRIM(m.tax_code_value), ''),
                                           NULLIF(TRIM(mt.tax_code_value), ''),
                                           NULLIF(TRIM(m.hsn_sac), ''),
                                           NULLIF(TRIM(mt.hsn_sac), '')
                                       ) as hsn_code,
                                       COALESCE(
                                           NULLIF(TRIM(m.sac_code), ''),
                                           NULLIF(TRIM(mt.sac_code), '')
                                       ) as sac_code,
                                       COALESCE(m.code, mt.code, '') as code
                                FROM materials m
                                LEFT JOIN material_templates mt ON m.template_id = mt.id
                                WHERE (m.disabled IS NOT TRUE AND m.is_trashed IS NOT TRUE)`;
                const params: any[] = [];
                // Optional category / subcategory filters (exact, case-insensitive)
                const categoryFilter = (req.query.category as string || "").trim();
                const subcategoryFilter = (req.query.subcategory as string || "").trim();
                if (categoryFilter) {
                    params.push(categoryFilter);
                    queryStr += ` AND LOWER(TRIM(COALESCE(m.category, ''))) = LOWER($${params.length})`;
                }
                if (subcategoryFilter) {
                    params.push(subcategoryFilter);
                    queryStr += ` AND LOWER(TRIM(COALESCE(m.subcategory, ''))) = LOWER($${params.length})`;
                }

                let orderBy = ` ORDER BY m.name ASC`;
                if (search.length >= 2) {
                    // Multi-word search: every word must match somewhere (name, code, spec, HSN/SAC, category, brand),
                    // in any order — so "door closer dorma" finds "Door Closer ... (Dorma)".
                    const tokens = search.split(/\s+/).filter(Boolean).slice(0, 6);
                    for (const tok of tokens) {
                        params.push(`%${tok}%`);
                        const n = params.length;
                        queryStr += ` AND (m.name ILIKE $${n}
                                        OR COALESCE(m.code, mt.code, '') ILIKE $${n}
                                        OR COALESCE(m.technicalspecification, '') ILIKE $${n}
                                        OR COALESCE(m.hsn_code, mt.hsn_code, '') ILIKE $${n}
                                        OR COALESCE(m.sac_code, mt.sac_code, '') ILIKE $${n}
                                        OR COALESCE(m.category, '') ILIKE $${n}
                                        OR COALESCE(m.subcategory, '') ILIKE $${n}
                                        OR COALESCE(m.brandname, '') ILIKE $${n})`;
                    }
                    // Best matches first: whole phrase in name, then name starting with the first word
                    params.push(`%${search}%`);
                    const phraseIdx = params.length;
                    params.push(`${tokens[0]}%`);
                    const startsIdx = params.length;
                    orderBy = ` ORDER BY CASE WHEN m.name ILIKE $${startsIdx} THEN 0 WHEN m.name ILIKE $${phraseIdx} THEN 1 ELSE 2 END, m.name ASC`;
                }
                queryStr += `${orderBy} LIMIT 500`;
                const result = await query(queryStr, params);
                res.json({ materials: result.rows });
            } catch (err) {
                console.error("GET /api/manual-purchase-orders/materials error:", err);
                res.status(500).json({ message: "Failed to search materials" });
            }
        }
    );

    // GET /api/manual-purchase-orders/material-filters - Distinct category / subcategory options for the catalog filters
    app.get(
        "/api/manual-purchase-orders/material-filters",
        authMiddleware,
        async (_req: Request, res: Response) => {
            try {
                const result = await query(
                    `SELECT TRIM(m.category) AS category,
                            COALESCE(TRIM(m.subcategory), '') AS subcategory,
                            COUNT(*)::int AS count
                     FROM materials m
                     WHERE (m.disabled IS NOT TRUE AND m.is_trashed IS NOT TRUE)
                       AND COALESCE(TRIM(m.category), '') <> ''
                     GROUP BY TRIM(m.category), COALESCE(TRIM(m.subcategory), '')
                     ORDER BY TRIM(m.category) ASC, COALESCE(TRIM(m.subcategory), '') ASC`
                );
                res.set("Cache-Control", "private, max-age=60");
                res.json({ filters: result.rows });
            } catch (err) {
                console.error("GET /api/manual-purchase-orders/material-filters error:", err);
                res.status(500).json({ message: "Failed to load catalog filters" });
            }
        }
    );

    // GET /api/manual-purchase-orders/:id - Get PO and its items for editing
    app.get(
        "/api/manual-purchase-orders/:id",
        authMiddleware,
        async (req: Request, res: Response) => {
            try {
                const { id } = req.params;
                const poRes = await query(
                    `SELECT po.*,
                            p.name as project_name, p.client as project_client, p.location as project_location,
                            s.name as vendor_name, s.location as vendor_location, s.city as vendor_city,
                            s.state as vendor_state, s.pincode as vendor_pincode, s.gstno as vendor_gstin,
                            s.contactnumber as vendor_phone, s.terms_and_conditions as vendor_terms
                     FROM purchase_orders po
                     LEFT JOIN boq_projects p ON po.project_id = p.id
                     LEFT JOIN shops s ON (po.vendor_id::text = s.id::text OR TRIM(s.name) = TRIM(po.vendor_name))
                     WHERE po.id = $1`,
                    [id]
                );

                if (poRes.rows.length === 0) {
                    return res.status(404).json({ message: "Purchase order not found" });
                }

                const po = poRes.rows[0];
                const itemsRes = await query(
                    `SELECT poi.*, m.technicalspecification as technical_specification
                     FROM purchase_order_items poi
                     LEFT JOIN materials m ON poi.material_id = m.id::text
                     WHERE poi.po_id = $1
                     ORDER BY poi.created_at ASC`,
                    [id]
                );

                res.json({
                    purchaseOrder: po,
                    items: itemsRes.rows,
                });
            } catch (err) {
                console.error("GET /api/manual-purchase-orders/:id error:", err);
                res.status(500).json({ message: "Failed to load Purchase Order details" });
            }
        }
    );

    // POST /api/manual-purchase-orders - Create a new manual Purchase Order
    app.post(
        "/api/manual-purchase-orders",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            try {
                const {
                    poNumber,
                    referenceNumber,
                    projectId,
                    projectName,
                    vendorId,
                    vendorName,
                    status,
                    poDate,
                    deliveryDate,
                    paymentTerms,
                    deliveryAddress,
                    notes,
                    items,
                } = req.body;

                if (!poNumber || !projectId || !vendorId || !items || items.length === 0) {
                    return res.status(400).json({
                        message: "PO Number, Project, Vendor, and at least one item are required.",
                    });
                }

                // Check for duplicate PO number
                const existCheck = await query(
                    `SELECT id FROM purchase_orders WHERE po_number = $1`,
                    [poNumber]
                );
                if (existCheck.rows.length > 0) {
                    return res.status(409).json({
                        message: `PO Number "${poNumber}" already exists. Please choose a different number.`,
                    });
                }

                // Calculate totals
                let subtotal = 0;
                let totalTax = 0;
                const processedItems = items.map((item: any) => {
                    const qty = Number(item.qty) || 0;
                    const rate = Number(item.rate) || 0;
                    const discountPercent = Number(item.discountPercent) || 0;
                    const gstPercentage = Number(item.gstPercentage) || 0;

                    const lineTotal = qty * rate;
                    const discountAmount = lineTotal * (discountPercent / 100);
                    const taxableAmount = lineTotal - discountAmount;
                    const taxAmount = taxableAmount * (gstPercentage / 100);
                    const amount = taxableAmount + taxAmount;

                    subtotal += taxableAmount;
                    totalTax += taxAmount;

                    return {
                        ...item,
                        qty,
                        rate,
                        discountPercent,
                        gstPercentage,
                        taxableAmount,
                        taxAmount,
                        amount,
                    };
                });

                const total = subtotal + totalTax;
                const formattedPoDate = poDate || new Date().toISOString().split("T")[0];
                // Direct POs always start as Draft. Approval is only reachable through
                // "Submit for Approval" -> Admin decision on PO Approvals, never via the payload.
                const poStatus = "draft";

                // Insert PO header
                const poResult = await query(
                    `INSERT INTO purchase_orders 
                     (po_number, reference_number, project_id, project_name, vendor_id, vendor_name, 
                      subtotal, tax, total, status, source,
                      po_date, delivery_date, payment_terms, delivery_address, shipping_address,
                      notes, comments, requested_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual', $11, $12, $13, $14, $15, $16, $17, $18)
                     RETURNING id`,
                    [
                        poNumber,
                        referenceNumber || null,
                        projectId,
                        projectName || null,
                        vendorId,
                        vendorName || null,
                        subtotal.toFixed(2),
                        totalTax.toFixed(2),
                        total.toFixed(2),
                        poStatus,
                        formattedPoDate,
                        deliveryDate || null,
                        paymentTerms || null,
                        deliveryAddress || null,
                        deliveryAddress || null, // populate both delivery_address and shipping_address
                        notes || null,
                        notes || null, // populate both notes and comments
                        (req as any).user?.id || null,
                    ]
                );

                const poId = poResult.rows[0].id;

                // Insert PO items
                for (const item of processedItems) {
                    await query(
                        `INSERT INTO purchase_order_items 
                         (po_id, material_id, item, description, unit, qty, original_qty, 
                          rate, amount, hsn_code, sac_code, discount_percent, tax_amount, 
                          gst_percentage, qty_modified)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
                        [
                            poId,
                            item.materialId || null,
                            item.item || "Unknown Item",
                            item.description || null,
                            item.unit || null,
                            item.qty,
                            item.qty,
                            item.rate,
                            item.taxableAmount.toFixed(2),
                            item.hsnCode || null,
                            item.sacCode || null,
                            item.discountPercent,
                            item.taxAmount.toFixed(2),
                            item.gstPercentage,
                        ]
                    );
                }

                res.json({
                    message: "Purchase Order created successfully",
                    purchaseOrder: {
                        id: poId,
                        poNumber,
                        subtotal,
                        tax: totalTax,
                        total,
                        status: poStatus,
                    },
                });
            } catch (err) {
                console.error("POST /api/manual-purchase-orders error:", err);
                res.status(500).json({ message: "Failed to create Purchase Order" });
            }
        }
    );

    // PUT /api/manual-purchase-orders/:id - Update a manual Purchase Order
    app.put(
        "/api/manual-purchase-orders/:id",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            try {
                const { id } = req.params;
                const {
                    poNumber,
                    referenceNumber,
                    projectId,
                    projectName,
                    vendorId,
                    vendorName,
                    status,
                    poDate,
                    deliveryDate,
                    paymentTerms,
                    deliveryAddress,
                    notes,
                    items,
                } = req.body;

                // Verify PO exists
                const existing = await query(
                    `SELECT id, status, source FROM purchase_orders WHERE id = $1`,
                    [id]
                );
                if (existing.rows.length === 0) {
                    return res.status(404).json({ message: "Purchase Order not found" });
                }

                if (existing.rows[0].source !== "manual") {
                    return res.status(400).json({ message: "Only manually created purchase orders can be edited." });
                }

                // Editable only in Draft / Rejected. Pending approval = locked for review,
                // Approved (and later) = permanently locked.
                if (!isManualPoEditable(existing.rows[0].status)) {
                    const st = String(existing.rows[0].status || "").toLowerCase();
                    return res.status(409).json({
                        message:
                            st === "pending_approval"
                                ? "This Purchase Order is awaiting approval and cannot be modified."
                                : "Approved purchase orders cannot be edited.",
                    });
                }

                // Calculate totals
                let subtotal = 0;
                let totalTax = 0;
                const processedItems = (items || []).map((item: any) => {
                    const qty = Number(item.qty) || 0;
                    const rate = Number(item.rate) || 0;
                    const discountPercent = Number(item.discountPercent) || 0;
                    const gstPercentage = Number(item.gstPercentage) || 0;

                    const lineTotal = qty * rate;
                    const discountAmount = lineTotal * (discountPercent / 100);
                    const taxableAmount = lineTotal - discountAmount;
                    const taxAmount = taxableAmount * (gstPercentage / 100);

                    subtotal += taxableAmount;
                    totalTax += taxAmount;

                    return {
                        ...item,
                        qty,
                        rate,
                        discountPercent,
                        gstPercentage,
                        taxableAmount,
                        taxAmount,
                    };
                });

                const total = subtotal + totalTax;
                const formattedPoDate = poDate || new Date().toISOString().split("T")[0];

                // Update PO header. The status is never taken from the request body
                // (it only changes through the submit/approve endpoints) and the WHERE
                // clause re-checks editability so a concurrent submit/approve can't be overwritten.
                const headerUpdate = await query(
                    `UPDATE purchase_orders SET
                     po_number = $1, reference_number = $2, project_id = $3, project_name = $4,
                     vendor_id = $5, vendor_name = $6, subtotal = $7, tax = $8,
                     total = $9, status = COALESCE(status, $10), po_date = $11, delivery_date = $12,
                     payment_terms = $13, delivery_address = $14, shipping_address = $15,
                     notes = $16, comments = $17, updated_at = NOW()
                     WHERE id = $18 AND source = 'manual'
                       AND (status IS NULL OR LOWER(status) IN ('draft', 'rejected'))
                     RETURNING id`,
                    [
                        poNumber,
                        referenceNumber || null,
                        projectId,
                        projectName || null,
                        vendorId,
                        vendorName || null,
                        subtotal.toFixed(2),
                        totalTax.toFixed(2),
                        total.toFixed(2),
                        "draft",
                        formattedPoDate,
                        deliveryDate || null,
                        paymentTerms || null,
                        deliveryAddress || null,
                        deliveryAddress || null,
                        notes || null,
                        notes || null,
                        id,
                    ]
                );
                if (headerUpdate.rows.length === 0) {
                    return res.status(409).json({
                        message: "This Purchase Order is no longer editable (it was submitted or approved). Please refresh.",
                    });
                }

                // Replace items: delete old, insert new
                await query(`DELETE FROM purchase_order_items WHERE po_id = $1`, [id]);

                for (const item of processedItems) {
                    await query(
                        `INSERT INTO purchase_order_items 
                         (po_id, material_id, item, description, unit, qty, original_qty, 
                          rate, amount, hsn_code, sac_code, discount_percent, tax_amount, 
                          gst_percentage, qty_modified)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
                        [
                            id,
                            item.materialId || null,
                            item.item || "Unknown Item",
                            item.description || null,
                            item.unit || null,
                            item.qty,
                            item.qty,
                            item.rate,
                            item.taxableAmount.toFixed(2),
                            item.hsnCode || null,
                            item.sacCode || null,
                            item.discountPercent,
                            item.taxAmount.toFixed(2),
                            item.gstPercentage,
                        ]
                    );
                }

                res.json({
                    message: "Purchase Order updated successfully",
                    purchaseOrder: {
                        id,
                        poNumber,
                        subtotal,
                        tax: totalTax,
                        total,
                    },
                });
            } catch (err) {
                console.error("PUT /api/manual-purchase-orders/:id error:", err);
                res.status(500).json({ message: "Failed to update Purchase Order" });
            }
        }
    );

    console.log("[manual-po-routes] Manual PO routes registered");
}
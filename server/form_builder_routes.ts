import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { pool, query } from "./db/client";
import { authMiddleware, requireRole } from "./middleware";

/**
 * =====================================================================
 * FORM BUILDER / SUMMARY SHEET / QUOTE MODULE (Fully Isolated)
 * ---------------------------------------------------------------------
 * - Does NOT modify server/routes.ts, server/tender_routes.ts, or any
 *   existing tables. Creates its own et_fb_* tables on startup.
 * - Lets Admin build custom forms (fields/rows/columns) in the frontend,
 *   save them as reusable templates, attach them to a tender, choose
 *   what is visible to the vendor, create Summary Sheets the same way,
 *   and create simple Quotes where a vendor only fills in rates.
 * =====================================================================
 */

const ADMIN_ROLES = ["admin", "purchase_team", "super_admin", "pre_sales"];
const VENDOR_ROLES = ["vendor", "supplier"];

async function ensureFormBuilderTables(): Promise<void> {
    // 1. Reusable templates (Forms & Summary Sheets are both stored here, distinguished by `category`)
    await pool.query(`
    CREATE TABLE IF NOT EXISTS et_fb_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
      category VARCHAR(30) NOT NULL DEFAULT 'FORM', -- 'FORM' | 'SUMMARY_SHEET'
      name VARCHAR(255) NOT NULL,
      description TEXT,
      schema JSONB NOT NULL DEFAULT '{"sections":[]}',
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(36),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

    // 2. A template attached ("used") on a specific tender - snapshot of the schema at attach time,
    //    plus whether it is visible to vendors at all.
    await pool.query(`
    CREATE TABLE IF NOT EXISTS et_fb_tender_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL,
      template_id UUID REFERENCES et_fb_templates(id) ON DELETE SET NULL,
      category VARCHAR(30) NOT NULL DEFAULT 'FORM',
      name VARCHAR(255) NOT NULL,
      schema JSONB NOT NULL DEFAULT '{"sections":[]}',
      visible_to_vendor BOOLEAN DEFAULT true,
      created_by VARCHAR(36),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

    // 3. Vendor's filled-in data against a tender link (one per vendor per link)
    await pool.query(`
    CREATE TABLE IF NOT EXISTS et_fb_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_link_id UUID NOT NULL REFERENCES et_fb_tender_links(id) ON DELETE CASCADE,
      vendor_id VARCHAR(36) NOT NULL,
      data JSONB NOT NULL DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'Draft', -- Draft | Submitted
      submitted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tender_link_id, vendor_id)
    )
  `);

    // 4. Quotes (standalone - not tied to the full tender workflow)
    await pool.query(`
    CREATE TABLE IF NOT EXISTS et_fb_quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
      quote_number VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'Draft', -- Draft | Sent | Closed
      valid_until TIMESTAMPTZ,
      extra_columns JSONB NOT NULL DEFAULT '[]', -- optional custom columns vendor fills besides rate/remarks
      created_by VARCHAR(36),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

    // 5. Quote line items defined by Admin
    await pool.query(`
    CREATE TABLE IF NOT EXISTS et_fb_quote_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id UUID NOT NULL REFERENCES et_fb_quotes(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      description TEXT,
      uom VARCHAR(50),
      quantity NUMERIC DEFAULT 0,
      spec TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

    // 6. Vendors a quote was sent to
    await pool.query(`
    CREATE TABLE IF NOT EXISTS et_fb_quote_recipients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id UUID NOT NULL REFERENCES et_fb_quotes(id) ON DELETE CASCADE,
      vendor_id VARCHAR(36) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Sent', -- Sent | Viewed | Submitted
      token VARCHAR(64) UNIQUE,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      submitted_at TIMESTAMPTZ,
      UNIQUE (quote_id, vendor_id)
    )
  `);
    await pool.query(`ALTER TABLE et_fb_quote_recipients ADD COLUMN IF NOT EXISTS token VARCHAR(64) UNIQUE`);
    await pool.query(`ALTER TABLE et_fb_quotes ADD COLUMN IF NOT EXISTS quote_kind VARCHAR(30) NOT NULL DEFAULT 'standard'`);
    await pool.query(`ALTER TABLE et_fb_quotes ADD COLUMN IF NOT EXISTS project_ids JSONB NOT NULL DEFAULT '[]'`);
    // Generic "Copy Link" (not tied to a specific vendor) - anyone with the link can fill in their shop name & submit.
    await pool.query(`ALTER TABLE et_fb_quotes ADD COLUMN IF NOT EXISTS open_token VARCHAR(64) UNIQUE`);
    await pool.query(`ALTER TABLE et_fb_quote_recipients ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255)`);

    // 7. Vendor's rate responses per item
    await pool.query(`
    CREATE TABLE IF NOT EXISTS et_fb_quote_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id UUID NOT NULL REFERENCES et_fb_quotes(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES et_fb_quote_items(id) ON DELETE CASCADE,
      vendor_id VARCHAR(36) NOT NULL,
      rate NUMERIC,
      amount NUMERIC,
      remarks TEXT,
      extra JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (quote_id, item_id, vendor_id)
    )
  `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_et_fb_links_tender ON et_fb_tender_links(tender_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_et_fb_quote_items_quote ON et_fb_quote_items(quote_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_et_fb_quote_resp_quote ON et_fb_quote_responses(quote_id)`);

    await pool.query(`ALTER TABLE et_fb_tender_links ADD COLUMN IF NOT EXISTS admin_data JSONB DEFAULT '{}'`);

    // 8. Generic "Copy Link" for a Tender (Google-Forms style, no vendor login required).
    //    Mirrors the et_fb_quotes.open_token pattern above, just scoped to a Tender instead.
    await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS open_token VARCHAR(64) UNIQUE`);

    // 9. Whoever fills a tender via the public open link isn't a logged-in vendor, so we
    //    capture their company/contact details here instead of relying on a users row.
    await pool.query(`
    CREATE TABLE IF NOT EXISTS et_fb_open_respondents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL,
      vendor_id VARCHAR(64) NOT NULL UNIQUE, -- synthetic id, e.g. "open-abcd1234"
      company_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_et_fb_open_respondents_tender ON et_fb_open_respondents(tender_id)`);

    console.log("[form-builder-module] Tables ensured.");
}

function isVendor(req: Request): boolean {
    return !!req.user && VENDOR_ROLES.includes(req.user.role);
}

// Strip out fields/columns marked visibleToVendor === false, for the vendor-facing view.
function filterSchemaForVendor(schema: any) {
    const sections = Array.isArray(schema?.sections) ? schema.sections : [];
    const filtered = sections
        .map((s: any) => {
            if (s.type === "grid") {
                const columns = (s.columns || []).filter((c: any) => c.visibleToVendor !== false);
                if (columns.length === 0) return null;
                return { ...s, columns };
            }
            const fields = (s.fields || []).filter((f: any) => f.visibleToVendor !== false);
            if (fields.length === 0) return null;
            return { ...s, fields };
        })
        .filter(Boolean);
    return { sections: filtered };
}

export async function registerFormBuilderRoutes(app: Express): Promise<void> {
    await ensureFormBuilderTables();

    // ---------------------------------------------------------------
    // TEMPLATES (Forms & Summary Sheets)
    // ---------------------------------------------------------------

    app.get("/api/fb/templates", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const category = (req.query.category as string) || null;
            const result = category
                ? await query(`SELECT * FROM et_fb_templates WHERE category = $1 AND is_active = true ORDER BY updated_at DESC`, [category])
                : await query(`SELECT * FROM et_fb_templates WHERE is_active = true ORDER BY updated_at DESC`);
            res.json({ templates: result.rows });
        } catch (err: any) {
            console.error("[fb templates:list]", err);
            res.status(500).json({ message: "Failed to load templates" });
        }
    });

    app.get("/api/fb/templates/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const result = await query(`SELECT * FROM et_fb_templates WHERE id = $1`, [req.params.id]);
            if (!result.rows[0]) return res.status(404).json({ message: "Not found" });
            res.json({ template: result.rows[0] });
        } catch (err: any) {
            res.status(500).json({ message: "Failed to load template" });
        }
    });

    app.post("/api/fb/templates", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const { category, name, description, schema } = req.body;
            if (!name || !schema) return res.status(400).json({ message: "name and schema are required" });
            const result = await query(
                `INSERT INTO et_fb_templates (category, name, description, schema, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
                [category || "FORM", name, description || null, JSON.stringify(schema), req.user?.id || null]
            );
            res.status(201).json({ template: result.rows[0] });
        } catch (err: any) {
            console.error("[fb templates:create]", err);
            res.status(500).json({ message: "Failed to create template" });
        }
    });

    app.put("/api/fb/templates/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const { name, description, schema, is_active } = req.body;
            const result = await query(
                `UPDATE et_fb_templates SET
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           schema = COALESCE($4, schema),
           is_active = COALESCE($5, is_active),
           updated_at = now()
         WHERE id = $1 RETURNING *`,
                [req.params.id, name || null, description ?? null, schema ? JSON.stringify(schema) : null, is_active ?? null]
            );
            if (!result.rows[0]) return res.status(404).json({ message: "Not found" });
            res.json({ template: result.rows[0] });
        } catch (err: any) {
            console.error("[fb templates:update]", err);
            res.status(500).json({ message: "Failed to update template" });
        }
    });

    app.delete("/api/fb/templates/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            await query(`UPDATE et_fb_templates SET is_active = false, updated_at = now() WHERE id = $1`, [req.params.id]);
            res.json({ message: "Deleted" });
        } catch (err: any) {
            res.status(500).json({ message: "Failed to delete template" });
        }
    });

    // Duplicate a template (handy for "save as new template" while editing)
    app.post("/api/fb/templates/:id/duplicate", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const src = await query(`SELECT * FROM et_fb_templates WHERE id = $1`, [req.params.id]);
            if (!src.rows[0]) return res.status(404).json({ message: "Not found" });
            const t = src.rows[0];
            const result = await query(
                `INSERT INTO et_fb_templates (category, name, description, schema, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
                [t.category, `${t.name} (Copy)`, t.description, JSON.stringify(t.schema), req.user?.id || null]
            );
            res.status(201).json({ template: result.rows[0] });
        } catch (err: any) {
            res.status(500).json({ message: "Failed to duplicate template" });
        }
    });

    // ---------------------------------------------------------------
    // ATTACHING A TEMPLATE (FORM or SUMMARY SHEET) TO A TENDER
    // ---------------------------------------------------------------

    // Admin: list all forms/summary-sheets attached to a tender
    app.get("/api/fb/tenders/:tenderId/forms", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const result = await query(
                `SELECT l.*, 
           (SELECT COUNT(*) FROM et_fb_submissions s WHERE s.tender_link_id = l.id AND s.status = 'Submitted') AS submission_count
         FROM et_fb_tender_links l WHERE l.tender_id = $1 ORDER BY l.created_at DESC`,
                [req.params.tenderId]
            );
            res.json({ forms: result.rows });
        } catch (err: any) {
            console.error("[fb tender-links:list]", err);
            res.status(500).json({ message: "Failed to load forms" });
        }
    });

    // Admin: attach a template to a tender (creates a snapshot, so future template edits don't retroactively change a live tender)
    app.post("/api/fb/tenders/:tenderId/forms", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const { templateId, name, category, schema, visibleToVendor, adminData } = req.body;
            let finalSchema = schema;
            let finalCategory = category || "FORM";
            let finalName = name;

            if (templateId) {
                const t = await query(`SELECT * FROM et_fb_templates WHERE id = $1`, [templateId]);
                if (!t.rows[0]) return res.status(404).json({ message: "Template not found" });
                finalSchema = finalSchema || t.rows[0].schema;
                finalCategory = t.rows[0].category;
                finalName = finalName || t.rows[0].name;
            }

            if (!finalSchema || !finalName) {
                return res.status(400).json({ message: "name and schema (or templateId) are required" });
            }

            const result = await query(
                `INSERT INTO et_fb_tender_links (tender_id, template_id, category, name, schema, visible_to_vendor, admin_data, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                [req.params.tenderId, templateId || null, finalCategory, finalName, JSON.stringify(finalSchema), visibleToVendor !== false, JSON.stringify(adminData || {}), req.user?.id || null]
            );
            res.status(201).json({ form: result.rows[0] });
        } catch (err: any) {
            console.error("[fb tender-links:create]", err);
            res.status(500).json({ message: "Failed to attach form to tender" });
        }
    });

    // Fetch a single attached form/summary-sheet link (used by the print/export view)
    app.get("/api/fb/tender-links/:id", authMiddleware, async (req: Request, res: Response) => {
        try {
            const result = await query(`SELECT * FROM et_fb_tender_links WHERE id = $1`, [req.params.id]);
            const link = result.rows[0];
            if (!link) return res.status(404).json({ message: "Not found" });
            if (isVendor(req) && !link.visible_to_vendor) {
                return res.status(403).json({ message: "Not visible to vendors" });
            }
            res.json({ form: link });
        } catch (err: any) {
            console.error("[fb tender-links:get]", err);
            res.status(500).json({ message: "Failed to load form" });
        }
    });

    app.put("/api/fb/tender-links/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const { name, schema, visibleToVendor } = req.body;
            const result = await query(
                `UPDATE et_fb_tender_links SET
           name = COALESCE($2, name),
           schema = COALESCE($3, schema),
           visible_to_vendor = COALESCE($4, visible_to_vendor),
           updated_at = now()
         WHERE id = $1 RETURNING *`,
                [req.params.id, name || null, schema ? JSON.stringify(schema) : null, visibleToVendor ?? null]
            );
            if (!result.rows[0]) return res.status(404).json({ message: "Not found" });
            res.json({ form: result.rows[0] });
        } catch (err: any) {
            res.status(500).json({ message: "Failed to update form" });
        }
    });

    app.delete("/api/fb/tender-links/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            await query(`DELETE FROM et_fb_tender_links WHERE id = $1`, [req.params.id]);
            res.json({ message: "Removed" });
        } catch (err: any) {
            res.status(500).json({ message: "Failed to remove form" });
        }
    });

    // Admin: view every vendor's submission for a given form on a tender (comparison view)
    app.get("/api/fb/tender-links/:id/submissions", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const result = await query(
                `SELECT s.*, u.username, u.full_name, u.company_name
         FROM et_fb_submissions s
         LEFT JOIN users u ON u.id::text = s.vendor_id
         WHERE s.tender_link_id = $1 ORDER BY s.updated_at DESC`,
                [req.params.id]
            );
            res.json({ submissions: result.rows });
        } catch (err: any) {
            console.error("[fb submissions:list]", err);
            res.status(500).json({ message: "Failed to load submissions" });
        }
    });

    // ---------------------------------------------------------------
    // VENDOR SIDE - viewing & filling forms/summary sheets for a tender
    // ---------------------------------------------------------------

    app.get("/api/fb/vendor/tenders/:tenderId/forms", authMiddleware, async (req: Request, res: Response) => {
        try {
            const vendorId = req.user!.id;
            const result = await query(
                `SELECT l.*, s.data as my_data, s.status as my_status, s.submitted_at as my_submitted_at
         FROM et_fb_tender_links l
         LEFT JOIN et_fb_submissions s ON s.tender_link_id = l.id AND s.vendor_id = $2
         WHERE l.tender_id = $1 AND l.visible_to_vendor = true
         ORDER BY l.created_at ASC`,
                [req.params.tenderId, vendorId]
            );
            const forms = result.rows.map((r: any) => ({
                ...r,
                schema: filterSchemaForVendor(r.schema),
            }));
            res.json({ forms });
        } catch (err: any) {
            console.error("[fb vendor-forms:list]", err);
            res.status(500).json({ message: "Failed to load forms" });
        }
    });

    // Vendor: save (draft or submit) their answers for a form
    app.post("/api/fb/tender-links/:id/respond", authMiddleware, async (req: Request, res: Response) => {
        try {
            const vendorId = req.user!.id;
            const { data, submit } = req.body;
            const status = submit ? "Submitted" : "Draft";
            const result = await query(
                `INSERT INTO et_fb_submissions (tender_link_id, vendor_id, data, status, submitted_at)
         VALUES ($1,$2,$3,$4, CASE WHEN $4 = 'Submitted' THEN now() ELSE NULL END)
         ON CONFLICT (tender_link_id, vendor_id)
         DO UPDATE SET data = $3, status = $4,
           submitted_at = CASE WHEN $4 = 'Submitted' THEN now() ELSE et_fb_submissions.submitted_at END,
           updated_at = now()
         RETURNING *`,
                [req.params.id, vendorId, JSON.stringify(data || {}), status]
            );
            res.json({ submission: result.rows[0] });
        } catch (err: any) {
            console.error("[fb respond]", err);
            res.status(500).json({ message: "Failed to save response" });
        }
    });

    // ---------------------------------------------------------------
    // QUOTES (simple: Admin defines items, Vendor only fills rate)
    // ---------------------------------------------------------------

    app.get("/api/fb/quotes", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const result = await query(
                `SELECT q.*, 
           (SELECT COUNT(*) FROM et_fb_quote_recipients r WHERE r.quote_id = q.id) AS recipient_count,
           (SELECT COUNT(*) FROM et_fb_quote_recipients r WHERE r.quote_id = q.id AND r.status = 'Submitted') AS submitted_count
         FROM et_fb_quotes q ORDER BY q.created_at DESC`
            );
            res.json({ quotes: result.rows });
        } catch (err: any) {
            console.error("[fb quotes:list]", err);
            res.status(500).json({ message: "Failed to load quotes" });
        }
    });

    app.post("/api/fb/quotes", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        const client = await pool.connect();
        try {
            const { title, description, validUntil, items, extraColumns, quoteKind, projectIds } = req.body;
            if (!title || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ message: "title and at least one item are required" });
            }
            await client.query("BEGIN");
            const quoteNumber = `QT-${Date.now().toString(36).toUpperCase()}`;
            const qRes = await client.query(
                `INSERT INTO et_fb_quotes (quote_number, title, description, valid_until, extra_columns, created_by, quote_kind, project_ids)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                [
                    quoteNumber, title, description || null, validUntil || null, JSON.stringify(extraColumns || []), req.user?.id || null,
                    quoteKind || "standard", JSON.stringify(projectIds || []),
                ]
            );
            const quote = qRes.rows[0];

            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                await client.query(
                    `INSERT INTO et_fb_quote_items (quote_id, item_name, description, uom, quantity, spec, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [quote.id, it.itemName, it.description || null, it.uom || null, it.quantity || 0, it.spec || null, i]
                );
            }
            await client.query("COMMIT");
            res.status(201).json({ quote });
        } catch (err: any) {
            await client.query("ROLLBACK");
            console.error("[fb quotes:create]", err);
            res.status(500).json({ message: "Failed to create quote" });
        } finally {
            client.release();
        }
    });

    app.get("/api/fb/quotes/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const quoteRes = await query(`SELECT * FROM et_fb_quotes WHERE id = $1`, [req.params.id]);
            if (!quoteRes.rows[0]) return res.status(404).json({ message: "Not found" });
            const itemsRes = await query(`SELECT * FROM et_fb_quote_items WHERE quote_id = $1 ORDER BY sort_order ASC`, [req.params.id]);
            const recipientsRes = await query(
                `SELECT r.*, COALESCE(r.shop_name, u.full_name, u.username) AS full_name, u.username, u.company_name
         FROM et_fb_quote_recipients r LEFT JOIN users u ON u.id::text = r.vendor_id
         WHERE r.quote_id = $1`,
                [req.params.id]
            );
            const responsesRes = await query(`SELECT * FROM et_fb_quote_responses WHERE quote_id = $1`, [req.params.id]);
            res.json({
                quote: quoteRes.rows[0],
                items: itemsRes.rows,
                recipients: recipientsRes.rows,
                responses: responsesRes.rows,
            });
        } catch (err: any) {
            console.error("[fb quotes:get]", err);
            res.status(500).json({ message: "Failed to load quote" });
        }
    });

    app.put("/api/fb/quotes/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const { title, description, validUntil, status, items } = req.body;
            const result = await client.query(
                `UPDATE et_fb_quotes SET
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           valid_until = COALESCE($4, valid_until),
           status = COALESCE($5, status),
           updated_at = now()
         WHERE id = $1 RETURNING *`,
                [req.params.id, title || null, description ?? null, validUntil || null, status || null]
            );
            if (!result.rows[0]) {
                await client.query("ROLLBACK");
                return res.status(404).json({ message: "Not found" });
            }

            if (Array.isArray(items)) {
                // Get existing items to know what to delete
                const existingRes = await client.query(`SELECT id FROM et_fb_quote_items WHERE quote_id = $1`, [req.params.id]);
                const existingIds = new Set(existingRes.rows.map((r: any) => r.id));
                const incomingIds = new Set(items.filter((i: any) => i.id).map((i: any) => i.id));

                // Delete items that are no longer in the payload
                for (const oldId of Array.from(existingIds)) {
                    if (!incomingIds.has(oldId)) {
                        await client.query(`DELETE FROM et_fb_quote_items WHERE id = $1`, [oldId]);
                    }
                }

                // Upsert incoming items
                for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    if (it.id && existingIds.has(it.id)) {
                        await client.query(
                            `UPDATE et_fb_quote_items SET item_name = $1, description = $2, uom = $3, quantity = $4, spec = $5, sort_order = $6 WHERE id = $7`,
                            [it.itemName, it.description || null, it.uom || null, it.quantity || 0, it.spec || null, i, it.id]
                        );
                    } else {
                        await client.query(
                            `INSERT INTO et_fb_quote_items (quote_id, item_name, description, uom, quantity, spec, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                            [req.params.id, it.itemName, it.description || null, it.uom || null, it.quantity || 0, it.spec || null, i]
                        );
                    }
                }
            }

            await client.query("COMMIT");
            res.json({ quote: result.rows[0] });
        } catch (err: any) {
            await client.query("ROLLBACK");
            console.error("[fb quotes:update]", err);
            res.status(500).json({ message: "Failed to update quote" });
        } finally {
            client.release();
        }
    });

    app.delete("/api/fb/quotes/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            await query(`DELETE FROM et_fb_quotes WHERE id = $1`, [req.params.id]);
            res.json({ message: "Deleted" });
        } catch (err: any) {
            res.status(500).json({ message: "Failed to delete quote" });
        }
    });

    // Admin: send the quote to one or more vendors (also generates a no-login public link per vendor)
    app.post("/api/fb/quotes/:id/send", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const { vendorIds } = req.body;
            if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
                return res.status(400).json({ message: "vendorIds is required" });
            }
            const links: Record<string, string> = {};
            for (const vendorId of vendorIds) {
                const token = crypto.randomBytes(20).toString("hex");
                const result = await query(
                    `INSERT INTO et_fb_quote_recipients (quote_id, vendor_id, status, token)
           VALUES ($1,$2,'Sent',$3)
           ON CONFLICT (quote_id, vendor_id) DO UPDATE SET token = COALESCE(et_fb_quote_recipients.token, EXCLUDED.token)
           RETURNING token`,
                    [req.params.id, vendorId, token]
                );
                links[vendorId] = result.rows[0].token;
            }
            await query(`UPDATE et_fb_quotes SET status = 'Sent', updated_at = now() WHERE id = $1 AND status = 'Draft'`, [req.params.id]);
            res.json({ message: "Quote sent", links });
        } catch (err: any) {
            console.error("[fb quotes:send]", err);
            res.status(500).json({ message: "Failed to send quote" });
        }
    });

    // Admin: get (or create) the generic no-login "Copy Link" for a quote - not tied to any
    // specific vendor. Whoever opens it fills in their own shop name and submits their rates.
    app.post("/api/fb/quotes/:id/open-link", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const existing = await query(`SELECT open_token FROM et_fb_quotes WHERE id = $1`, [req.params.id]);
            if (!existing.rows[0]) return res.status(404).json({ message: "Not found" });
            let token = existing.rows[0].open_token;
            if (!token) {
                token = crypto.randomBytes(20).toString("hex");
                await query(`UPDATE et_fb_quotes SET open_token = $1 WHERE id = $2`, [token, req.params.id]);
            }
            await query(`UPDATE et_fb_quotes SET status = 'Sent', updated_at = now() WHERE id = $1 AND status = 'Draft'`, [req.params.id]);
            res.json({ token });
        } catch (err: any) {
            console.error("[fb quotes:open-link]", err);
            res.status(500).json({ message: "Failed to create link" });
        }
    });

    // ---------------------------------------------------------------
    // QUOTES - Vendor side
    // ---------------------------------------------------------------

    app.get("/api/fb/vendor/quotes", authMiddleware, async (req: Request, res: Response) => {
        try {
            const vendorId = req.user!.id;
            const result = await query(
                `SELECT q.*, r.status AS my_status, r.sent_at, r.submitted_at
         FROM et_fb_quote_recipients r
         JOIN et_fb_quotes q ON q.id = r.quote_id
         WHERE r.vendor_id = $1
         ORDER BY r.sent_at DESC`,
                [vendorId]
            );
            res.json({ quotes: result.rows });
        } catch (err: any) {
            console.error("[fb vendor-quotes:list]", err);
            res.status(500).json({ message: "Failed to load quotes" });
        }
    });

    app.get("/api/fb/vendor/quotes/:id", authMiddleware, async (req: Request, res: Response) => {
        try {
            const vendorId = req.user!.id;
            const access = await query(`SELECT * FROM et_fb_quote_recipients WHERE quote_id = $1 AND vendor_id = $2`, [req.params.id, vendorId]);
            if (!access.rows[0]) return res.status(403).json({ message: "This quote was not sent to you" });

            if (access.rows[0].status === "Sent") {
                await query(`UPDATE et_fb_quote_recipients SET status = 'Viewed' WHERE id = $1`, [access.rows[0].id]);
            }

            const quoteRes = await query(`SELECT * FROM et_fb_quotes WHERE id = $1`, [req.params.id]);
            const itemsRes = await query(`SELECT * FROM et_fb_quote_items WHERE quote_id = $1 ORDER BY sort_order ASC`, [req.params.id]);
            const myResponses = await query(`SELECT * FROM et_fb_quote_responses WHERE quote_id = $1 AND vendor_id = $2`, [req.params.id, vendorId]);
            res.json({ quote: quoteRes.rows[0], items: itemsRes.rows, myResponses: myResponses.rows, recipient: access.rows[0] });
        } catch (err: any) {
            console.error("[fb vendor-quotes:get]", err);
            res.status(500).json({ message: "Failed to load quote" });
        }
    });

    // Vendor: fill in rates and (optionally) submit
    app.post("/api/fb/vendor/quotes/:id/respond", authMiddleware, async (req: Request, res: Response) => {
        const client = await pool.connect();
        try {
            const vendorId = req.user!.id;
            const { responses, submit } = req.body; // responses: [{itemId, rate, remarks, extra}]
            if (!Array.isArray(responses)) return res.status(400).json({ message: "responses array is required" });

            const access = await client.query(`SELECT * FROM et_fb_quote_recipients WHERE quote_id = $1 AND vendor_id = $2`, [req.params.id, vendorId]);
            if (!access.rows[0]) return res.status(403).json({ message: "This quote was not sent to you" });

            await client.query("BEGIN");
            for (const r of responses) {
                const itemRes = await client.query(`SELECT quantity FROM et_fb_quote_items WHERE id = $1 AND quote_id = $2`, [r.itemId, req.params.id]);
                const qty = itemRes.rows[0]?.quantity || 0;
                const amount = r.rate != null ? Number(r.rate) * Number(qty) : null;
                await client.query(
                    `INSERT INTO et_fb_quote_responses (quote_id, item_id, vendor_id, rate, amount, remarks, extra)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (quote_id, item_id, vendor_id)
           DO UPDATE SET rate = $4, amount = $5, remarks = $6, extra = $7, updated_at = now()`,
                    [req.params.id, r.itemId, vendorId, r.rate ?? null, amount, r.remarks || null, JSON.stringify(r.extra || {})]
                );
            }
            if (submit) {
                await client.query(
                    `UPDATE et_fb_quote_recipients SET status = 'Submitted', submitted_at = now() WHERE quote_id = $1 AND vendor_id = $2`,
                    [req.params.id, vendorId]
                );
            }
            await client.query("COMMIT");
            res.json({ message: submit ? "Quote submitted" : "Draft saved" });
        } catch (err: any) {
            await client.query("ROLLBACK");
            console.error("[fb vendor-quotes:respond]", err);
            res.status(500).json({ message: "Failed to save response" });
        } finally {
            client.release();
        }
    });

    // Admin: comparison of all vendor responses for a quote (rate comparison sheet)
    app.get("/api/fb/quotes/:id/comparison", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const itemsRes = await query(`SELECT * FROM et_fb_quote_items WHERE quote_id = $1 ORDER BY sort_order ASC`, [req.params.id]);
            const responsesRes = await query(
                `SELECT resp.*, COALESCE(rec.shop_name, u.full_name, u.username) AS full_name, u.company_name, u.username
         FROM et_fb_quote_responses resp
         LEFT JOIN users u ON u.id::text = resp.vendor_id
         LEFT JOIN et_fb_quote_recipients rec ON rec.quote_id = resp.quote_id AND rec.vendor_id = resp.vendor_id
         WHERE resp.quote_id = $1`,
                [req.params.id]
            );
            res.json({ items: itemsRes.rows, responses: responsesRes.rows });
        } catch (err: any) {
            console.error("[fb quotes:comparison]", err);
            res.status(500).json({ message: "Failed to load comparison" });
        }
    });

    // ---------------------------------------------------------------
    // QUOTES - Public, no-login link (Google-Forms style)
    // ---------------------------------------------------------------

    // Vendor opens {app}/q/:token on their phone/browser - no account needed.
    app.get("/api/fb/public/quotes/:token", async (req: Request, res: Response) => {
        try {
            const recipientRes = await query(`SELECT * FROM et_fb_quote_recipients WHERE token = $1`, [req.params.token]);
            const recipient = recipientRes.rows[0];
            if (!recipient) return res.status(404).json({ message: "This link is invalid or has expired." });

            if (recipient.status === "Sent") {
                await query(`UPDATE et_fb_quote_recipients SET status = 'Viewed' WHERE id = $1`, [recipient.id]);
            }

            const quoteRes = await query(`SELECT * FROM et_fb_quotes WHERE id = $1`, [recipient.quote_id]);
            const itemsRes = await query(`SELECT * FROM et_fb_quote_items WHERE quote_id = $1 ORDER BY sort_order ASC`, [recipient.quote_id]);
            const myResponses = await query(
                `SELECT * FROM et_fb_quote_responses WHERE quote_id = $1 AND vendor_id = $2`,
                [recipient.quote_id, recipient.vendor_id]
            );
            const vendorRes = await query(`SELECT username, full_name, company_name FROM users WHERE id::text = $1`, [recipient.vendor_id]);

            res.json({
                quote: quoteRes.rows[0],
                items: itemsRes.rows,
                myResponses: myResponses.rows,
                recipient: { status: recipient.status, submitted_at: recipient.submitted_at },
                vendor: vendorRes.rows[0] || null,
            });
        } catch (err: any) {
            console.error("[fb public quote:get]", err);
            res.status(500).json({ message: "Failed to load quote" });
        }
    });

    // Vendor submits rates through the public link - no login required.
    app.post("/api/fb/public/quotes/:token/respond", async (req: Request, res: Response) => {
        const client = await pool.connect();
        try {
            const { responses, submit } = req.body;
            if (!Array.isArray(responses)) return res.status(400).json({ message: "responses array is required" });

            const recipientRes = await client.query(`SELECT * FROM et_fb_quote_recipients WHERE token = $1`, [req.params.token]);
            const recipient = recipientRes.rows[0];
            if (!recipient) return res.status(404).json({ message: "This link is invalid or has expired." });

            // Server-side mirror of the frontend "every item needs a valid rate" check.
            // The frontend already blocks this, but that alone can be bypassed (stale page,
            // direct API call, etc.), which was letting recipients get marked Submitted with
            // missing rates. Re-validate here before allowing submit=true to take effect.
            if (submit) {
                const allItemsRes = await client.query(`SELECT id FROM et_fb_quote_items WHERE quote_id = $1`, [recipient.quote_id]);
                const rateById = new Map(responses.map((r: any) => [r.itemId, r.rate]));
                const missing = allItemsRes.rows.some((it: any) => {
                    const rate = rateById.get(it.id);
                    return rate === undefined || rate === null || String(rate).trim() === "" || isNaN(Number(rate));
                });
                if (missing) {
                    return res.status(400).json({ message: "Please enter a valid rate for every item before submitting." });
                }
            }

            await client.query("BEGIN");
            for (const r of responses) {
                const itemRes = await client.query(`SELECT quantity FROM et_fb_quote_items WHERE id = $1 AND quote_id = $2`, [r.itemId, recipient.quote_id]);
                const qty = itemRes.rows[0]?.quantity || 0;
                const amount = r.rate != null ? Number(r.rate) * Number(qty) : null;
                await client.query(
                    `INSERT INTO et_fb_quote_responses (quote_id, item_id, vendor_id, rate, amount, remarks, extra)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (quote_id, item_id, vendor_id)
           DO UPDATE SET rate = $4, amount = $5, remarks = $6, extra = $7, updated_at = now()`,
                    [recipient.quote_id, r.itemId, recipient.vendor_id, r.rate ?? null, amount, r.remarks || null, JSON.stringify(r.extra || {})]
                );
            }
            if (submit) {
                await client.query(`UPDATE et_fb_quote_recipients SET status = 'Submitted', submitted_at = now() WHERE id = $1`, [recipient.id]);
            }
            await client.query("COMMIT");
            res.json({ message: submit ? "Quote submitted" : "Draft saved" });
        } catch (err: any) {
            await client.query("ROLLBACK");
            console.error("[fb public quote:respond]", err);
            res.status(500).json({ message: "Failed to save response" });
        } finally {
            client.release();
        }
    });

    // Anyone opens {app}/q/open/:token - generic link, not tied to a vendor. They type in
    // their own shop name and submit; each submission becomes its own recipient row.
    app.get("/api/fb/public/quotes/open/:token", async (req: Request, res: Response) => {
        try {
            const quoteRes = await query(`SELECT * FROM et_fb_quotes WHERE open_token = $1`, [req.params.token]);
            const quote = quoteRes.rows[0];
            if (!quote) return res.status(404).json({ message: "This link is invalid or has expired." });

            const itemsRes = await query(`SELECT * FROM et_fb_quote_items WHERE quote_id = $1 ORDER BY sort_order ASC`, [quote.id]);
            res.json({ quote, items: itemsRes.rows });
        } catch (err: any) {
            console.error("[fb public quote:open:get]", err);
            res.status(500).json({ message: "Failed to load quote" });
        }
    });

    // Submits rates + shop name through the generic link - no login required.
    app.post("/api/fb/public/quotes/open/:token/respond", async (req: Request, res: Response) => {
        const client = await pool.connect();
        try {
            const { responses, shopName } = req.body;
            if (!Array.isArray(responses)) return res.status(400).json({ message: "responses array is required" });
            if (!shopName || !String(shopName).trim()) return res.status(400).json({ message: "Shop name is required" });

            const quoteRes = await client.query(`SELECT * FROM et_fb_quotes WHERE open_token = $1`, [req.params.token]);
            const quote = quoteRes.rows[0];
            if (!quote) return res.status(404).json({ message: "This link is invalid or has expired." });

            // This route always marks the recipient 'Submitted' immediately (no draft-save step),
            // so re-validate server-side that every item has a valid rate — the frontend check
            // alone can be bypassed via a direct API call.
            const allItemsRes = await client.query(`SELECT id FROM et_fb_quote_items WHERE quote_id = $1`, [quote.id]);
            const rateById = new Map(responses.map((r: any) => [r.itemId, r.rate]));
            const missingRate = allItemsRes.rows.some((it: any) => {
                const rate = rateById.get(it.id);
                return rate === undefined || rate === null || String(rate).trim() === "" || isNaN(Number(rate));
            });
            if (missingRate) {
                return res.status(400).json({ message: "Please enter a valid rate for every item before submitting." });
            }

            const vendorId = `open-${crypto.randomBytes(10).toString("hex")}`;

            await client.query("BEGIN");
            const recipientRes = await client.query(
                `INSERT INTO et_fb_quote_recipients (quote_id, vendor_id, status, shop_name, submitted_at)
         VALUES ($1,$2,'Submitted',$3,now())
         RETURNING id`,
                [quote.id, vendorId, String(shopName).trim()]
            );
            for (const r of responses) {
                const itemRes = await client.query(`SELECT quantity FROM et_fb_quote_items WHERE id = $1 AND quote_id = $2`, [r.itemId, quote.id]);
                const qty = itemRes.rows[0]?.quantity || 0;
                const amount = r.rate != null ? Number(r.rate) * Number(qty) : null;
                await client.query(
                    `INSERT INTO et_fb_quote_responses (quote_id, item_id, vendor_id, rate, amount, remarks, extra)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [quote.id, r.itemId, vendorId, r.rate ?? null, amount, r.remarks || null, JSON.stringify(r.extra || {})]
                );
            }
            await client.query("COMMIT");
            res.json({ message: "Quote submitted", recipientId: recipientRes.rows[0].id });
        } catch (err: any) {
            await client.query("ROLLBACK");
            console.error("[fb public quote:open:respond]", err);
            res.status(500).json({ message: "Failed to submit quote" });
        } finally {
            client.release();
        }
    });

    // ---------------------------------------------------------------
    // TENDERS - Public, no-login "Copy Link" (mirrors the Quotes open-link flow)
    // ---------------------------------------------------------------

    // Admin: get (or create) the tender's generic no-login share link. Anyone with the
    // link can view the tender and submit the Form(s) attached to it as their quotation -
    // no vendor account required.
    app.post("/api/fb/tenders/:tenderId/open-link", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const existing = await query(`SELECT open_token FROM et_tenders WHERE id = $1`, [req.params.tenderId]);
            if (!existing.rows[0]) return res.status(404).json({ message: "Tender not found" });
            let token = existing.rows[0].open_token;
            if (!token) {
                token = crypto.randomBytes(20).toString("hex");
                await query(`UPDATE et_tenders SET open_token = $1 WHERE id = $2`, [token, req.params.tenderId]);
            }
            res.json({ token });
        } catch (err: any) {
            console.error("[fb tenders:open-link]", err);
            res.status(500).json({ message: "Failed to create link" });
        }
    });

    // Public: whoever opens {app}/t/open/:token sees the tender + any Forms attached to
    // it that are marked visible-to-vendor. No login needed.
    app.get("/api/fb/public/tenders/:token", async (req: Request, res: Response) => {
        try {
            const tenderRes = await query(
                `SELECT id, tender_number, title, description, category_name, location, address,
                estimated_budget, status, is_published, submission_start, submission_deadline, end_date
         FROM et_tenders WHERE open_token = $1`,
                [req.params.token]
            );
            const tender = tenderRes.rows[0];
            if (!tender) return res.status(404).json({ message: "This link is invalid or has expired." });

            const docsRes = await query(
                `SELECT id, name, file_type, uploaded_at FROM et_tender_documents WHERE tender_id = $1 AND share_with_vendor = true ORDER BY uploaded_at ASC`,
                [tender.id]
            );

            const linksRes = await query(
                `SELECT id, name, category, schema FROM et_fb_tender_links WHERE tender_id = $1 AND category = 'FORM' AND visible_to_vendor = true ORDER BY created_at ASC`,
                [tender.id]
            );
            const forms = linksRes.rows.map((r: any) => ({ ...r, schema: filterSchemaForVendor(r.schema) }));

            res.json({ tender, documents: docsRes.rows, forms });
        } catch (err: any) {
            console.error("[fb public tender:get]", err);
            res.status(500).json({ message: "Failed to load tender" });
        }
    });

    // Public: submit the filled-in form(s) via the open link - no login required.
    // Creates a synthetic vendor id (like the Quotes open-link flow) and saves one
    // et_fb_submissions row per attached Form, plus the company/contact details.
    app.post("/api/fb/public/tenders/:token/submit", async (req: Request, res: Response) => {
        const client = await pool.connect();
        try {
            const { companyName, contactName, email, phone, forms } = req.body;
            if (!companyName || !String(companyName).trim()) {
                return res.status(400).json({ message: "Company / Firm name is required" });
            }
            if (!forms || typeof forms !== "object") {
                return res.status(400).json({ message: "forms is required" });
            }

            const tenderRes = await client.query(`SELECT id FROM et_tenders WHERE open_token = $1`, [req.params.token]);
            const tender = tenderRes.rows[0];
            if (!tender) return res.status(404).json({ message: "This link is invalid or has expired." });

            // Only allow responses against forms that are actually attached + visible for this tender.
            const linksRes = await client.query(
                `SELECT id FROM et_fb_tender_links WHERE tender_id = $1 AND category = 'FORM' AND visible_to_vendor = true`,
                [tender.id]
            );
            const validLinkIds = new Set(linksRes.rows.map((r: any) => r.id));

            const vendorId = `open-${crypto.randomBytes(10).toString("hex")}`;

            await client.query("BEGIN");

            await client.query(
                `INSERT INTO et_fb_open_respondents (tender_id, vendor_id, company_name, contact_name, email, phone)
         VALUES ($1,$2,$3,$4,$5,$6)`,
                [tender.id, vendorId, String(companyName).trim(), contactName || null, email || null, phone || null]
            );

            for (const [linkId, data] of Object.entries(forms)) {
                if (!validLinkIds.has(linkId)) continue;
                await client.query(
                    `INSERT INTO et_fb_submissions (tender_link_id, vendor_id, data, status, submitted_at)
           VALUES ($1,$2,$3,'Submitted', now())
           ON CONFLICT (tender_link_id, vendor_id)
           DO UPDATE SET data = $3, status = 'Submitted', submitted_at = now(), updated_at = now()`,
                    [linkId, vendorId, JSON.stringify(data || {})]
                );
            }

            await client.query("COMMIT");
            res.json({ message: "Tender submitted successfully", vendorId });
        } catch (err: any) {
            await client.query("ROLLBACK");
            console.error("[fb public tender:submit]", err);
            res.status(500).json({ message: "Failed to submit tender" });
        } finally {
            client.release();
        }
    });

    // ---------------------------------------------------------------
    // PROJECTS (for the "Project Comparison Quote" flow)
    // ---------------------------------------------------------------

    app.get("/api/fb/projects", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const result = await query(
                `SELECT p.id, p.name, p.client, p.location,
           EXISTS (SELECT 1 FROM boq_versions v WHERE v.project_id = p.id AND v.is_last_final = TRUE AND v.type = 'BOM') AS has_final_bom
         FROM boq_projects p ORDER BY p.updated_at DESC LIMIT 500`
            );
            res.json({ projects: result.rows });
        } catch (err: any) {
            console.error("[fb projects:list]", err);
            res.status(500).json({ message: "Failed to load projects" });
        }
    });

    // Helper: list vendors (for the "send to" picker) - reuses existing users table, no schema change
    app.get("/api/fb/vendors", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const result = await query(
                `SELECT id, username, full_name as "fullName", company_name as "companyName"
         FROM users WHERE role IN ('vendor','supplier') ORDER BY full_name ASC`
            );
            res.json({ vendors: result.rows });
        } catch (err: any) {
            console.error("[fb vendors:list]", err);
            res.status(500).json({ message: "Failed to load vendors" });
        }
    });

    // Helper: pull every materialLine/step11_item out of a project's finalized BOM version's boq_items,
    // tagging each with whichever shop it came from (shop_id if present, else the shop name as the key).
    async function getFinalBomMaterialLines(projectId: string): Promise<{ version: any; lines: any[] } | null> {
        const verRes = await query(
            `SELECT * FROM boq_versions WHERE project_id = $1 AND type = 'bom' AND is_last_final = TRUE
       ORDER BY version_number DESC LIMIT 1`,
            [projectId]
        );
        const version = verRes.rows[0];
        if (!version) return null;

        const itemsRes = await query(`SELECT id, table_data FROM boq_items WHERE version_id = $1`, [version.id]);
        const lines: any[] = [];
        for (const row of itemsRes.rows) {
            const td = typeof row.table_data === "string" ? JSON.parse(row.table_data) : row.table_data;
            if (!td) continue;
            const raw = Array.isArray(td.materialLines) ? td.materialLines : Array.isArray(td.step11_items) ? td.step11_items : [];
            for (const l of raw) {
                const shopName = (l.shop_name || l.shopName || "").toString().trim();
                if (!shopName) continue; // items without a shop can't be sourced to a vendor for this flow
                const rawShopId = l.shop_id || l.shopId;
                lines.push({
                    boqItemId: row.id,
                    materialId: l.material_id || l.materialId || l.id || null,
                    name: l.name || l.item_name || l.itemName || "Unnamed material",
                    unit: l.unit || "",
                    shopId: rawShopId ? String(rawShopId) : null,
                    shopName,
                    qty: Number(l.roundOffQty || l.roundOff || l.qty || l.requiredQty || l.baseQty || 0) || 0,
                });
            }
        }
        return { version, lines };
    }

    // Admin: for a selected project, list the distinct shops that were actually sourced in its
    // finalized BOM, resolved to the vendor login (if that shop's owner has a vendor/supplier account).
    app.get("/api/fb/projects/:id/bom-shops", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const data = await getFinalBomMaterialLines(req.params.id);
            if (!data) return res.json({ shops: [], hasFinalBom: false });

            const byShop = new Map<string, { shopId: string | null; shopName: string; itemCount: number }>();
            for (const l of data.lines) {
                const key = l.shopId || l.shopName;
                if (!byShop.has(key)) byShop.set(key, { shopId: l.shopId, shopName: l.shopName, itemCount: 0 });
                byShop.get(key)!.itemCount++;
            }

            const shopIds = Array.from(byShop.values()).map((s) => s.shopId).filter(Boolean);
            const shopNames = Array.from(byShop.values()).map((s) => s.shopName);
            let ownerRows: any[] = [];
            if (shopIds.length > 0 || shopNames.length > 0) {
                const r = await query(
                    `SELECT s.id AS shop_id, s.name AS shop_name, u.id AS vendor_id, u.full_name AS vendor_name, u.company_name AS vendor_company
           FROM shops s LEFT JOIN users u ON u.id::text = s.owner_id::text
           WHERE s.id::text = ANY($1::text[]) OR s.name = ANY($2::text[])`,
                    [shopIds.length ? shopIds : [""], shopNames.length ? shopNames : [""]]
                );
                ownerRows = r.rows;
            }

            const shops = Array.from(byShop.values()).map((s) => {
                const owner = ownerRows.find((o) => (s.shopId && o.shop_id === s.shopId) || o.shop_name === s.shopName);
                return {
                    key: s.shopId || s.shopName,
                    shopId: s.shopId,
                    shopName: s.shopName,
                    itemCount: s.itemCount,
                    vendorId: owner?.vendor_id || null,
                    vendorName: owner?.vendor_name || null,
                    vendorCompany: owner?.vendor_company || null,
                };
            });

            res.json({ shops, hasFinalBom: true, versionId: data.version.id });
        } catch (err: any) {
            console.error("[fb bom-shops]", err);
            res.status(500).json({ message: "Failed to load shops for this project's finalized BOM" });
        }
    });

    // Admin: for a selected project + shop, list only the materials sourced from that shop
    // in the finalized BOM (searchable client-side; small per-shop lists).
    app.get("/api/fb/projects/:id/bom-materials", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
        try {
            const shopKey = (req.query.shop as string) || "";
            if (!shopKey) return res.status(400).json({ message: "shop query param is required" });

            const data = await getFinalBomMaterialLines(req.params.id);
            if (!data) return res.json({ materials: [] });

            // Robust matching: try shopId === shopKey OR shopName === shopKey (case-insensitive, trimmed).
            const shopKeyTrimmed = shopKey.trim();
            const shopKeyLower = shopKeyTrimmed.toLowerCase();
            const matched = data.lines.filter((l) => {
                if (l.shopId && String(l.shopId).trim() === shopKeyTrimmed) return true;
                if (l.shopName && l.shopName.trim().toLowerCase() === shopKeyLower) return true;
                return false;
            });

            console.log("[fb bom-materials] projectId:", req.params.id, "shopKey:", JSON.stringify(shopKey), "matched:", matched.length, "lines total:", data.lines.length);
            if (matched.length === 0 && data.lines.length > 0) {
                const uniqueKeys = new Set(data.lines.map((l: any) => JSON.stringify({ shopId: l.shopId, shopName: l.shopName })));
                console.log("[fb bom-materials] All distinct shop keys in BOM:", Array.from(uniqueKeys));
            }

            // Resolve technical specification from the Materials Master where possible.
            const materialIds = Array.from(new Set(matched.map((l) => l.materialId).filter(Boolean)));
            let specById: Record<string, string> = {};
            if (materialIds.length > 0) {
                const specRes = await query(
                    `SELECT id::text AS id, technicalspecification AS spec FROM materials WHERE id::text = ANY($1::text[])`,
                    [materialIds]
                );
                specRes.rows.forEach((r: any) => { specById[r.id] = r.spec; });
            }

            // De-dupe by material identity (same material can appear on multiple boq_items).
            const byKey = new Map<string, any>();
            for (const l of matched) {
                const key = l.materialId || l.name;
                if (!byKey.has(key)) {
                    byKey.set(key, {
                        materialId: l.materialId,
                        name: l.name,
                        unit: l.unit,
                        spec: (l.materialId && specById[l.materialId]) || "",
                        quantity: l.qty,
                    });
                } else {
                    byKey.get(key).quantity += l.qty;
                }
            }
            res.json({ materials: Array.from(byKey.values()) });
        } catch (err: any) {
            console.error("[fb bom-materials]", err);
            res.status(500).json({ message: "Failed to load materials for this shop" });
        }
    });

    // ---------------------------------------------------------------
    // SUMMARY SHEET REPORT DATA (placeholder tokens + bindable tables)
    // ---------------------------------------------------------------

    // Returns the tender/vendor data needed to resolve {{tokens}} in a Summary Sheet,
    // plus any grid ("table") sections found in Forms attached to this tender that a
    // report table element can bind to by title, filled with that vendor's rows if vendorId is given.
    app.get("/api/fb/tenders/:tenderId/report-context", authMiddleware, async (req: Request, res: Response) => {
        try {
            const tenderId = req.params.tenderId;
            let vendorId = (req.query.vendorId as string) || null;

            // Vendors may only ever resolve their own data.
            if (isVendor(req)) {
                vendorId = req.user!.id;
            }

            const tenderRes = await query(
                `SELECT tender_number, title, client_name, location, address, description, status,
                category_name, estimated_budget, start_date, end_date, submission_deadline
         FROM et_tenders WHERE id = $1`,
                [tenderId]
            );
            const t = tenderRes.rows[0] || {};

            let vendor: any = null;
            if (vendorId) {
                const vRes = await query(`SELECT username, full_name, company_name FROM users WHERE id::text = $1`, [vendorId]);
                if (vRes.rows[0]) {
                    vendor = { name: vRes.rows[0].full_name || vRes.rows[0].username, company: vRes.rows[0].company_name, username: vRes.rows[0].username };
                }
            }

            // Discover grid/table sections inside any Form (not Summary Sheet) attached to this tender.
            const linksRes = await query(
                `SELECT id, schema FROM et_fb_tender_links WHERE tender_id = $1 AND category = 'FORM'`,
                [tenderId]
            );
            let submissionRows: Record<string, any[]> = {};
            if (vendorId) {
                const subsRes = await query(
                    `SELECT tender_link_id, data FROM et_fb_submissions WHERE vendor_id = $1 AND tender_link_id = ANY($2::uuid[])`,
                    [vendorId, linksRes.rows.map((r: any) => r.id)]
                );
                subsRes.rows.forEach((s: any) => { submissionRows[s.tender_link_id] = s.data; });
            }

            const gridSources: any[] = [];
            linksRes.rows.forEach((link: any) => {
                const sections = link.schema?.sections || [];
                sections.forEach((s: any) => {
                    if (s.type === "grid") {
                        const data = submissionRows[link.id] || {};
                        gridSources.push({
                            linkId: link.id,
                            sectionId: s.id,
                            title: s.title,
                            columns: (s.columns || []).map((c: any) => ({ id: c.id, label: c.label })),
                            rows: vendorId ? (data[s.id] || []) : [],
                        });
                    }
                });
            });

            res.json({
                tender: {
                    number: t.tender_number || "",
                    title: t.title || "",
                    clientName: t.client_name || "",
                    location: t.location || "",
                    address: t.address || "",
                    description: t.description || "",
                    status: t.status || "",
                    category: t.category_name || "",
                    estimatedBudget: t.estimated_budget || "",
                    startDate: t.start_date ? new Date(t.start_date).toLocaleDateString() : "",
                    endDate: t.end_date ? new Date(t.end_date).toLocaleDateString() : "",
                    submissionDeadline: t.submission_deadline ? new Date(t.submission_deadline).toLocaleDateString() : "",
                },
                vendor,
                gridSources,
                today: new Date().toLocaleDateString(),
            });
        } catch (err: any) {
            console.error("[fb report-context]", err);
            res.status(500).json({ message: "Failed to load report data" });
        }
    });

    console.log("[form-builder-module] Form Builder / Summary Sheet / Quote routes registered.");
}
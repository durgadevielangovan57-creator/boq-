import type { Express, Request, Response, NextFunction } from "express";
import { pool, query } from "./db/client";
import { authMiddleware, requireRole } from "./middleware";
import { hashPassword } from "./auth";
import { Resend } from "resend";
import multer from "multer";
import { registerFormBuilderRoutes } from "./form_builder_routes";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key_to_avoid_crash");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit

/**
 * =====================================================================
 * ENTERPRISE TENDER MANAGEMENT MODULE (Fully Isolated & Multi-Tenant Ready)
 * ---------------------------------------------------------------------
 * - Does NOT modify server/routes.ts or any existing BOQ tables.
 * - Creates 14 isolated et_* tables on startup.
 * - Master Data, Templates, Workflows, Dynamic Forms, Revisions, RBAC.
 * - Reuses existing users.role for auth boundaries.
 * =====================================================================
 */

const ADMIN_ROLES = ["admin", "purchase_team", "super_admin"];
const VENDOR_ROLE = "supplier";
const CLIENT_ROLE = "client"; // Assuming client role might be added

// --- Audit Logger Middleware ---
async function logAudit(req: Request, action: string, details: string, originId: string | null = null, beforeData: any = null, afterData: any = null) {
  try {
    const user = (req as any).user;
    if (!user) return;

    await query(
      `INSERT INTO et_audit_logs 
       (tenant_id, user_id, username, role, action, module, origin_id, details, before_data, after_data, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        'default', // Future multi-tenant
        user.id,
        user.username,
        user.role,
        action,
        'Tenders',
        originId,
        details,
        beforeData ? JSON.stringify(beforeData) : null,
        afterData ? JSON.stringify(afterData) : null,
        req.ip || null,
        req.get('User-Agent') || null
      ]
    );
  } catch (err) {
    console.error("[TenderAudit] Failed to log:", err);
  }
}

// --- Table Bootstrap ---

async function ensureEnterpriseTenderTables(): Promise<void> {
  // 1. Master Data
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_master_data (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
      category VARCHAR(100) NOT NULL, -- e.g., 'TENDER_TYPE', 'CURRENCY', 'INCOTERM'
      code VARCHAR(100) NOT NULL,
      value TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, category, code)
    )
  `);

  // 2. Templates
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
      template_type VARCHAR(100) NOT NULL, -- 'FORM', 'WORKFLOW', 'NOTIFICATION', 'TENDER_CONFIG'
      name VARCHAR(255) NOT NULL,
      description TEXT,
      config JSONB NOT NULL DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(36),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 3. Tenders Core
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_tenders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
      tender_number VARCHAR(100) NOT NULL,
      title TEXT NOT NULL,
      tender_type_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      project_category_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      project_id VARCHAR(100), -- Link to existing BOQ Project ID (Soft Link)
      boq_snapshot_id VARCHAR(100), -- Link to BOQ snapshot if spawned from BOQ
      status VARCHAR(50) NOT NULL DEFAULT 'Draft',
      stage VARCHAR(50) NOT NULL DEFAULT 'Configuration',
      version INT NOT NULL DEFAULT 1,
      parent_tender_id UUID, -- For retendering
      created_by VARCHAR(36),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      description TEXT,
      location VARCHAR(255),
      address TEXT,
      start_date TIMESTAMPTZ,
      end_date TIMESTAMPTZ,
      num_discussions INT DEFAULT 0,
      client_name VARCHAR(255),
      client_info JSONB DEFAULT '{}',
      client_info_enabled BOOLEAN DEFAULT false,
      is_published BOOLEAN DEFAULT false,
      category_name VARCHAR(100),
      estimated_budget NUMERIC,
      submission_start TIMESTAMPTZ,
      submission_deadline TIMESTAMPTZ,
      visibility VARCHAR(50) DEFAULT 'Public',
      UNIQUE (tenant_id, tender_number, version)
    )
  `);

  // 4. Tender Timelines
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_tender_timelines (
      tender_id UUID PRIMARY KEY REFERENCES et_tenders(id) ON DELETE CASCADE,
      registration_start TIMESTAMPTZ,
      registration_end TIMESTAMPTZ,
      submission_start TIMESTAMPTZ,
      submission_end TIMESTAMPTZ,
      tech_eval_start TIMESTAMPTZ,
      comm_eval_start TIMESTAMPTZ,
      negotiation_start TIMESTAMPTZ,
      negotiation_end TIMESTAMPTZ,
      award_date TIMESTAMPTZ,
      project_start TIMESTAMPTZ,
      project_end TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 5. Tender Settings & Config
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_tender_settings (
      tender_id UUID PRIMARY KEY REFERENCES et_tenders(id) ON DELETE CASCADE,
      currency_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      tax_type_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      auto_close_submissions BOOLEAN DEFAULT true,
      max_negotiation_rounds INT DEFAULT 5,
      current_negotiation_round INT DEFAULT 0,
      two_envelope_bidding BOOLEAN DEFAULT false,
      allow_clarifications BOOLEAN DEFAULT true,
      client_visibility_config JSONB DEFAULT '{}',
      notification_config JSONB DEFAULT '{}',
      evaluation_criteria JSONB DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 6. Tender Dynamic Forms (JSON Schemas for this specific tender)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_dynamic_forms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL REFERENCES et_tenders(id) ON DELETE CASCADE,
      form_type VARCHAR(50) NOT NULL, -- 'VENDOR_REG', 'CLIENT_REG', 'PROJECT_DETAILS'
      schema JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tender_id, form_type)
    )
  `);

  // 7. Invitations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
      tender_id UUID REFERENCES et_tenders(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL, -- 'vendor', 'client'
      status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- Pending, Registered, Expired
      invited_by VARCHAR(36),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 8. Profiles (Generated from Dynamic Forms)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_vendor_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
      profile_data JSONB NOT NULL DEFAULT '{}',
      status VARCHAR(50) NOT NULL DEFAULT 'Pending Approval', -- Approved, Rejected
      verified_by VARCHAR(36),
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, tenant_id)
    )
  `);

  // 9. Tender Documents
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_tender_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL REFERENCES et_tenders(id) ON DELETE CASCADE,
      document_type_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      file_type VARCHAR(100),
      version INT DEFAULT 1,
      is_active BOOLEAN DEFAULT true,
      uploaded_by VARCHAR(36),
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 10. Submissions (Bids) - Round Aware
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL REFERENCES et_tenders(id) ON DELETE CASCADE,
      vendor_id VARCHAR(36) NOT NULL,
      round_number INT NOT NULL DEFAULT 0,
      bid_type VARCHAR(50) DEFAULT 'Commercial', -- Technical, Commercial
      total_amount NUMERIC,
      tax_amount NUMERIC,
      delivery_terms_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      payment_terms_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      warranty_terms_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      remarks TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'Draft', -- Draft, Submitted, Evaluated, Awarded, Rejected
      submitted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tender_id, vendor_id, round_number, bid_type)
    )
  `);

  // 11. Submission Items (Line Items for Comparison)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_submission_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_id UUID NOT NULL REFERENCES et_submissions(id) ON DELETE CASCADE,
      boq_item_id VARCHAR(100), -- Link to original BOQ if applicable
      item_name TEXT NOT NULL,
      work_category_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      uom_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      quantity NUMERIC NOT NULL DEFAULT 0,
      unit_rate NUMERIC NOT NULL DEFAULT 0,
      total_price NUMERIC NOT NULL DEFAULT 0,
      tax_percentage NUMERIC DEFAULT 0,
      remarks TEXT
    )
  `);

  // 12. Submission Files
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_submission_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_id UUID NOT NULL REFERENCES et_submissions(id) ON DELETE CASCADE,
      document_type_id UUID REFERENCES et_master_data(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      file_type VARCHAR(100),
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 13. Clarifications (Q&A)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_clarifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL REFERENCES et_tenders(id) ON DELETE CASCADE,
      vendor_id VARCHAR(36) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      answered_by VARCHAR(36),
      answered_at TIMESTAMPTZ,
      is_public BOOLEAN DEFAULT false, -- If true, visible to all vendors
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 14. Audit Logs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS et_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(50) NOT NULL DEFAULT 'default',
      user_id VARCHAR(36),
      username VARCHAR(255),
      role VARCHAR(50),
      action VARCHAR(100) NOT NULL,
      module VARCHAR(100) NOT NULL,
      origin_id VARCHAR(100), -- e.g. tender_id
      details TEXT,
      before_data JSONB,
      after_data JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Indexes for Performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_et_tenders_tenant_status ON et_tenders(tenant_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_et_submissions_tender_vendor ON et_submissions(tender_id, vendor_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_et_audit_origin ON et_audit_logs(origin_id)`);

  // --- New columns for Create Tender form ---
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS location TEXT`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS address TEXT`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE et_tenders ALTER COLUMN start_date TYPE TIMESTAMPTZ USING start_date::timestamptz`).catch(() => { });
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE et_tenders ALTER COLUMN end_date TYPE TIMESTAMPTZ USING end_date::timestamptz`).catch(() => { });
  await pool.query(`ALTER TABLE et_tenders ALTER COLUMN end_date TYPE TIMESTAMPTZ USING end_date::TIMESTAMPTZ`).catch(() => { });
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS num_discussions INT DEFAULT 0`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS client_name TEXT`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS client_info JSONB DEFAULT '{}'`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS client_info_enabled BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS category_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS submission_deadline TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'Public'`);
  await pool.query(`ALTER TABLE et_tender_documents ADD COLUMN IF NOT EXISTS share_with_vendor BOOLEAN DEFAULT false`);

  console.log("[enterprise-tender-module] 14 Master and Transaction Tables Verified/Created.");
}

/* ------------------------------ routes ------------------------------- */

export async function registerTenderRoutes(app: Express): Promise<void> {
  await ensureEnterpriseTenderTables().catch((err) => {
    console.error("[enterprise-tender-module] Failed to ensure tables:", err?.message || err);
  });

  await registerFormBuilderRoutes(app);

  /* ============================ MASTER DATA ============================ */

  app.get("/api/et/master-data", authMiddleware, async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string;
      const params: any[] = [];
      let queryStr = `SELECT * FROM et_master_data WHERE is_active = true`;

      if (category) {
        params.push(category);
        queryStr += ` AND category = $1`;
      }
      queryStr += ` ORDER BY category, sort_order ASC, code ASC`;

      const result = await query(queryStr, params);
      res.json({ data: result.rows });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load master data" });
    }
  });

  app.post("/api/et/master-data", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
      const { category, code, value } = req.body;
      if (!category || !code || !value) {
        return res.status(400).json({ message: "Category, code, and value are required" });
      }

      const result = await query(
        `INSERT INTO et_master_data (category, code, value) VALUES ($1, $2, $3) RETURNING *`,
        [category, code, value]
      );
      res.status(201).json({ data: result.rows[0] });
    } catch (err: any) {
      if (err.code === '23505') { // Unique violation
        return res.status(409).json({ message: "This category and code combination already exists." });
      }
      res.status(500).json({ message: "Failed to create master data entry" });
    }
  });

  app.delete("/api/et/master-data/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(`DELETE FROM et_master_data WHERE id = $1 RETURNING *`, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Master data entry not found" });
      }
      res.json({ message: "Deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete master data entry" });
    }
  });

  /* ============================ INVITATIONS ============================ */

  app.get("/api/et/invitations", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
      const result = await query(`SELECT * FROM et_invitations ORDER BY created_at DESC`);
      res.json({ invitations: result.rows });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load invitations" });
    }
  });

  app.post("/api/et/invitations/generate", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
      const { email, role, tenderId, sendEmail } = req.body;
      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }

      // Generate a simple unique token
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Token valid for 7 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const result = await query(
        `INSERT INTO et_invitations (token, email, role, tender_id, invited_by, expires_at) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [token, email, role, tenderId || null, req.user!.id, expiresAt]
      );

      const invitation = result.rows[0];
      const link = `${process.env.FRONTEND_URL || "http://localhost:5011"}/register/${role}/${token}`;

      if (sendEmail) {
        if (!process.env.RESEND_API_KEY) {
          return res.status(500).json({ message: "RESEND_API_KEY is not configured on the server." });
        }

        await resend.emails.send({
          from: process.env.FROM_EMAIL || "auth@knockturn.cloud",
          to: email,
          subject: "You have been invited to register on BuildEst",
          html: `
            <h2>Welcome to BuildEst!</h2>
            <p>You have been invited to register as a <strong>${role}</strong>.</p>
            <p>Please click the button below to complete your registration:</p>
            <a href="${link}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:5px;">Complete Registration</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p>${link}</p>
            <p>This link will expire in 7 days.</p>
          `,
        });
      }

      res.status(201).json({ invitation, link, emailSent: sendEmail });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to generate invitation" });
    }
  });

  /* ============================ ADMIN ============================ */

  app.get("/api/et/admin/tenders", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
      // Auto-close tenders whose submission_deadline has passed
      await query(`
        UPDATE et_tenders 
        SET status = 'Closed' 
        WHERE status NOT IN ('Closed', 'Awarded', 'Cancelled') 
          AND end_date IS NOT NULL 
          AND end_date < NOW()
      `);

      const result = await query(`SELECT * FROM et_tenders ORDER BY created_at DESC`);
      res.json({ tenders: result.rows });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load tenders" });
    }
  });

  // Create a new tender
  app.post("/api/et/admin/tenders", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const b = req.body || {};

      // Auto-generate tender number
      const year = new Date().getFullYear();
      const countRes = await client.query(`SELECT COUNT(*) FROM et_tenders WHERE tender_number LIKE $1`, [`ETND-${year}-%`]);
      const seq = (parseInt(countRes.rows[0]?.count || "0", 10) + 1).toString().padStart(4, "0");
      const tenderNumber = `ETND-${year}-${seq}`;

      const tRes = await client.query(
        `INSERT INTO et_tenders (
          tender_number, title, description, location, address,
          start_date, end_date, num_discussions,
          client_name, client_info, client_info_enabled, is_published,
          category_name, estimated_budget, submission_start, submission_deadline, visibility,
          tender_type_id, project_category_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
        [
          tenderNumber,
          b.title,
          b.description || null,
          b.location || null,
          b.address || null,
          b.startDate || null,
          b.endDate || null,
          b.numDiscussions || 0,
          b.clientName || null,
          b.clientInfo || '{}',
          b.clientInfoEnabled || false,
          b.isPublished || false,
          b.category || null,
          b.estimatedBudget || null,
          b.submissionStart || null,
          b.submissionDeadline || null,
          b.visibility || 'Public',
          b.tenderTypeId || null,
          b.projectCategoryId || null,
          req.user!.id
        ]
      );
      const tender = tRes.rows[0];

      await client.query(`INSERT INTO et_tender_timelines (tender_id, registration_start, registration_end) VALUES ($1, $2, $3)`,
        [tender.id, b.startDate || null, b.endDate || null]);
      await client.query(`INSERT INTO et_tender_settings (tender_id, client_visibility_config) VALUES ($1, $2)`,
        [tender.id, b.visibilityConfig || '{}']);

      // Handle documents
      if (b.documents && Array.isArray(b.documents)) {
        for (const doc of b.documents) {
          await client.query(
            `INSERT INTO et_tender_documents (tender_id, name, url, file_type, share_with_vendor, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tender.id, doc.name, doc.url, doc.fileType, doc.shareWithVendor || false, req.user!.id]
          );
        }
      }

      await logAudit(req, 'CREATE_TENDER', `Created Tender ${tenderNumber}`, tender.id, null, { title: b.title });

      await client.query("COMMIT");
      res.status(201).json(tender);
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[tenders] create error:", err);
      res.status(500).json({ message: "Failed to create tender" });
    } finally {
      client.release();
    }
  });

  // PUT /api/et/admin/tenders/:id
  app.put("/api/et/admin/tenders/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { id } = req.params;
      const b = req.body;

      await client.query(
        `UPDATE et_tenders SET 
          title = $1, description = $2, category_name = $3, estimated_budget = $4,
          location = $5, address = $6, start_date = $7, end_date = $8,
          num_discussions = $9, client_name = $10, client_info = $11, client_info_enabled = $12,
          visibility = $13, submission_start = $14, submission_deadline = $15, updated_at = NOW()
         WHERE id = $16`,
        [
          b.title.trim(), b.description?.trim() || null, b.category || null, b.estimatedBudget || null,
          b.location?.trim() || null, b.address?.trim() || null, b.startDate || null, b.endDate || null,
          b.numDiscussions || 0, b.clientName?.trim() || null, b.clientInfo || '{}', b.clientInfoEnabled || false,
          b.visibility || 'Public', b.submissionStart || null, b.submissionDeadline || null, id
        ]
      );

      // Handle documents (append new ones)
      if (b.documents && Array.isArray(b.documents)) {
        for (const doc of b.documents) {
          await client.query(
            `INSERT INTO et_tender_documents (tender_id, name, url, file_type, share_with_vendor, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, doc.name, doc.url, doc.fileType, false, req.user!.id]
          );
        }
      }

      await logAudit(req, 'UPDATE_TENDER', `Updated Tender Details`, id, null, { title: b.title });

      await client.query("COMMIT");
      res.json({ message: "Tender updated successfully" });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[tenders] update error:", err);
      res.status(500).json({ message: "Failed to update tender" });
    } finally {
      client.release();
    }
  });

  // GET /api/et/admin/tenders/:id/documents
  app.get("/api/et/admin/tenders/:id/documents", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(`SELECT * FROM et_tender_documents WHERE tender_id = $1 ORDER BY uploaded_at ASC`, [id]);
      res.json({ documents: result.rows });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load documents" });
    }
  });

  // POST /api/et/admin/tenders/:id/publish
  app.post("/api/et/admin/tenders/:id/publish", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { id } = req.params;
      const { visibilityConfig, documentIdsToShare } = req.body;

      // 1. Update status and is_published
      await client.query(`UPDATE et_tenders SET is_published = true, status = 'Published', updated_at = NOW() WHERE id = $1`, [id]);

      // 2. Update client_visibility_config in settings
      await client.query(`UPDATE et_tender_settings SET client_visibility_config = $2, updated_at = NOW() WHERE tender_id = $1`, [id, visibilityConfig]);

      // 3. Update documents share status
      await client.query(`UPDATE et_tender_documents SET share_with_vendor = false WHERE tender_id = $1`, [id]);
      if (documentIdsToShare && documentIdsToShare.length > 0) {
        await client.query(`UPDATE et_tender_documents SET share_with_vendor = true WHERE id = ANY($1)`, [documentIdsToShare]);
      }

      await logAudit(req, 'PUBLISH_TENDER', `Published Tender Configuration`, id);

      await client.query("COMMIT");
      res.json({ message: "Tender published successfully" });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[tenders] publish error:", err);
      res.status(500).json({ message: "Failed to publish tender" });
    } finally {
      client.release();
    }
  });

  // POST /api/et/admin/tenders/:id/extend
  app.post("/api/et/admin/tenders/:id/extend", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newEndDate } = req.body;
      if (!newEndDate) return res.status(400).json({ message: "newEndDate is required" });

      // Update end_date and reset status to Published if it was Closed
      await query(`
        UPDATE et_tenders 
        SET end_date = $2,
            status = CASE WHEN status = 'Closed' THEN 'Published' ELSE status END,
            updated_at = NOW()
        WHERE id = $1
      `, [id, newEndDate]);

      // Update timeline
      await query(`UPDATE et_tender_timelines SET registration_end = $2, updated_at = NOW() WHERE tender_id = $1`, [id, newEndDate]);

      await logAudit(req, 'EXTEND_TENDER', `Extended Tender Deadline`, id, null, { newEndDate });
      res.json({ message: "Timeline extended successfully" });
    } catch (err: any) {
      console.error("[tenders] extend error:", err);
      res.status(500).json({ message: "Failed to extend timeline" });
    }
  });

  // DELETE /api/et/admin/tenders/:id
  app.delete("/api/et/admin/tenders/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { id } = req.params;

      const existing = await client.query(`SELECT id, title, tender_number FROM et_tenders WHERE id = $1`, [id]);
      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Tender not found" });
      }
      const tender = existing.rows[0];

      // Clean up tables that reference tender_id without an ON DELETE CASCADE constraint.
      // Everything else (timelines, settings, dynamic forms, documents, submissions,
      // clarifications, invitations) cascades automatically via FK constraints.
      await client.query(`DELETE FROM et_fb_open_respondents WHERE tender_id = $1`, [id]);
      await client.query(`DELETE FROM et_fb_tender_links WHERE tender_id = $1`, [id]);

      await client.query(`DELETE FROM et_tenders WHERE id = $1`, [id]);

      await logAudit(req, 'DELETE_TENDER', `Deleted Tender ${tender.tender_number} - ${tender.title}`, id);

      await client.query("COMMIT");
      res.json({ message: "Tender deleted successfully" });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[tenders] delete error:", err);
      res.status(500).json({ message: "Failed to delete tender" });
    } finally {
      client.release();
    }
  });

  /* ============================ VENDOR FACING ============================ */

  // GET /api/et/vendor/tenders - Fetch published tenders for vendors
  app.get("/api/et/vendor/tenders", authMiddleware, async (req: Request, res: Response) => {
    try {
      // Auto-close tenders whose end_date has passed
      await query(`
        UPDATE et_tenders 
        SET status = 'Closed' 
        WHERE status NOT IN ('Closed', 'Awarded', 'Cancelled') 
          AND end_date IS NOT NULL 
          AND end_date < NOW()
      `);

      const result = await query(`
        SELECT t.id, t.tender_number, t.title, t.description, t.category_name,
               t.status, t.end_date, t.location, t.address, t.visibility,
               t.estimated_budget, t.client_name, t.client_info_enabled,
               t.is_published, t.created_at, t.submission_start, t.submission_deadline,
               s.client_visibility_config
        FROM et_tenders t
        LEFT JOIN et_tender_settings s ON s.tender_id = t.id
        WHERE t.is_published = true
          AND t.status IN ('Published')
        ORDER BY t.created_at DESC
      `);

      // Apply visibility config to each tender
      const tenders = result.rows.map((t: any) => {
        const vc = t.client_visibility_config || {};
        return {
          id: t.id,
          tender_number: t.tender_number,
          title: t.title,
          description: t.description,
          category_name: t.category_name,
          status: t.status,
          end_date: t.end_date,
          submission_start: t.submission_start,
          submission_deadline: t.submission_deadline,
          location: vc.location ? t.location : null,
          address: vc.location ? t.address : null,
          estimated_budget: vc.budget ? t.estimated_budget : null,
          client_name: vc.clientInfo ? t.client_name : null,
          created_at: t.created_at,
        };
      });

      res.json({ tenders });
    } catch (err: any) {
      console.error("[vendor-tenders] error:", err);
      res.status(500).json({ message: "Failed to load tenders" });
    }
  });

  // GET /api/et/vendor/tenders/:id/documents - Fetch shared documents for a tender
  app.get("/api/et/vendor/tenders/:id/documents", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT id, name, file_type, uploaded_at FROM et_tender_documents WHERE tender_id = $1 AND share_with_vendor = true ORDER BY uploaded_at ASC`,
        [id]
      );
      res.json({ documents: result.rows });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load documents" });
    }
  });

  // GET /api/et/vendor/tenders/:id/my-submission - Fetch vendor's own submission
  app.get("/api/et/vendor/tenders/:id/my-submission", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const subRes = await query(
        `SELECT * FROM et_submissions WHERE tender_id = $1 AND vendor_id = $2 AND round_number = 0 AND bid_type = 'Commercial'`,
        [id, userId]
      );

      if (subRes.rows.length === 0) {
        return res.json({ submission: null });
      }

      const submission = subRes.rows[0];

      const filesRes = await query(
        `SELECT id, name, file_type, url FROM et_submission_files WHERE submission_id = $1 ORDER BY uploaded_at ASC`,
        [submission.id]
      );

      submission.attachments = filesRes.rows;

      res.json({ submission });
    } catch (err: any) {
      console.error("[vendor-my-submission] error:", err);
      res.status(500).json({ message: "Failed to load submission" });
    }
  });

  // POST /api/et/vendor/tenders/:id/submit - Save or submit a vendor quotation
  app.post("/api/et/vendor/tenders/:id/submit", authMiddleware, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { id } = req.params;
      const userId = req.user!.id;
      const { deliveryTimeline, paymentTerms, remarks, status, attachments } = req.body;
      // status = 'Draft' or 'Submitted'

      // Check if submission already exists for this vendor + tender
      const existing = await client.query(
        `SELECT id FROM et_submissions WHERE tender_id = $1 AND vendor_id = $2 AND round_number = 0 AND bid_type = 'Commercial'`,
        [id, userId]
      );

      let submissionId: string;

      if (existing.rows.length > 0) {
        // Update existing
        submissionId = existing.rows[0].id;
        await client.query(
          `UPDATE et_submissions SET 
            remarks = $1, status = $2, updated_at = NOW(),
            submitted_at = CASE WHEN $4::boolean = true THEN NOW() ELSE submitted_at END
           WHERE id = $3`,
          [
            JSON.stringify({ deliveryTimeline, paymentTerms, remarks: remarks || '' }),
            status || 'Draft',
            submissionId,
            status === 'Submitted'
          ]
        );
      } else {
        // Create new
        const subRes = await client.query(
          `INSERT INTO et_submissions (tender_id, vendor_id, round_number, bid_type, remarks, status, submitted_at)
           VALUES ($1, $2, 0, 'Commercial', $3, $4, $5) RETURNING id`,
          [
            id, userId,
            JSON.stringify({ deliveryTimeline, paymentTerms, remarks: remarks || '' }),
            status || 'Draft',
            status === 'Submitted' ? new Date().toISOString() : null
          ]
        );
        submissionId = subRes.rows[0].id;
      }

      // Handle attachments (base64 encoded files)
      if (attachments && Array.isArray(attachments)) {
        await client.query(`DELETE FROM et_submission_files WHERE submission_id = $1`, [submissionId]);

        for (const att of attachments) {
          await client.query(
            `INSERT INTO et_submission_files (submission_id, name, url, file_type) VALUES ($1, $2, $3, $4)`,
            [submissionId, att.name, att.url, att.fileType]
          );
        }
      }

      await client.query("COMMIT");

      const msg = status === 'Submitted' ? 'Quotation submitted successfully!' : 'Draft saved successfully!';
      res.json({ message: msg, submissionId });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[vendor-submit] error:", err);
      res.status(500).json({ message: "Failed to save quotation", error: err.message, stack: err.stack, details: err });
    } finally {
      client.release();
    }
  });

  // GET /api/et/vendor/tenders/:id/my-submission - Get vendor's own submission
  app.get("/api/et/vendor/tenders/:id/my-submission", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const result = await query(
        `SELECT * FROM et_submissions WHERE tender_id = $1 AND vendor_id = $2 AND round_number = 0 AND bid_type = 'Commercial' LIMIT 1`,
        [id, userId]
      );
      if (result.rows.length === 0) {
        return res.json({ submission: null });
      }
      const sub = result.rows[0];

      // Get attached files
      const filesRes = await query(
        `SELECT id, name, file_type, uploaded_at FROM et_submission_files WHERE submission_id = $1 ORDER BY uploaded_at ASC`,
        [sub.id]
      );

      res.json({ submission: { ...sub, files: filesRes.rows } });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load submission" });
    }
  });

  // POST /api/et/register-vendor
  app.post("/api/et/register-vendor", async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const {
        email, password, registerName, phone,
        companyName, tradeName, companyType,
        gstNumber, panNumber, cin
      } = req.body;

      if (!email || !password || !panNumber) {
        return res.status(400).json({ message: "Email, password, and PAN are required." });
      }

      await client.query("BEGIN");

      // 1. Check if user already exists
      const existingUser = await client.query(`SELECT id FROM users WHERE username = $1`, [email]);
      if (existingUser.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Username/Email already exists." });
      }

      // 2. Hash password & Create user in main BOQ users table with role "vendor"
      const hashedPassword = await hashPassword(password);

      const userRes = await client.query(
        `INSERT INTO users (username, password, role, full_name, mobile_number, company_name, gst_number, approved) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [email, hashedPassword, "vendor", registerName, phone, companyName, gstNumber, "approved"]
      );
      const userId = userRes.rows[0].id;

      // 3. Insert into et_vendor_profiles
      const profileData = {
        tradeName, companyType, cin, panNumber
      };

      await client.query(
        `INSERT INTO et_vendor_profiles (user_id, profile_data, status) VALUES ($1, $2, $3)`,
        [userId, JSON.stringify(profileData), "Approved"] // Auto approved for prototype
      );

      await client.query("COMMIT");
      res.status(201).json({ message: "Vendor registered successfully.", userId });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("[register-vendor] Error:", error);
      res.status(500).json({ message: "Registration failed." });
    } finally {
      client.release();
    }
  });

  // POST /api/et/register-client
  app.post("/api/et/register-client", async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { email, password, organizationName, contactPerson, token } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
      }

      await client.query("BEGIN");

      // 1. Check existing
      const existingUser = await client.query(`SELECT id FROM users WHERE username = $1`, [email]);
      if (existingUser.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Username/Email already exists." });
      }

      // 2. Hash & Create
      const hashedPassword = await hashPassword(password);
      const userRes = await client.query(
        `INSERT INTO users (username, password, role, full_name, company_name, approved) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [email, hashedPassword, "client", contactPerson, organizationName, "approved"]
      );

      // 3. Mark token as registered (if provided)
      if (token) {
        await client.query(`UPDATE et_invitations SET status = 'Registered', updated_at = now() WHERE token = $1`, [token]);
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Client registered successfully." });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("[register-client] Error:", error);
      res.status(500).json({ message: "Registration failed." });
    } finally {
      client.release();
    }
  });

  console.log("[enterprise-tender-module] Enterprise Tender Routes registered.");

  // Register the isolated Form Builder / Summary Sheet / Quote module.
  // Hooked in here (instead of server/index.ts) so index.ts never needs to change.
  await registerFormBuilderRoutes(app);
}
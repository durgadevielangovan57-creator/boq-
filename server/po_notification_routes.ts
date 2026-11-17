import type { Express, Request, Response } from "express";
import { Resend } from "resend";
import { query } from "./db/client";
import { authMiddleware } from "./middleware";

/**
 * =====================================================================
 * PURCHASE ORDER NOTIFICATIONS (isolated, additive module)
 * ---------------------------------------------------------------------
 * - Does NOT modify any existing PO route, table, column or calculation.
 * - Uses its own table `po_notifications` (+ `po_notification_reads`).
 * - Recipients are role based: `admin` and `pre_sales`.
 *
 * Endpoints
 *   POST /api/po-notifications/check-new-items
 *        Given { projectId, items[], excludePoId? } returns which items are
 *        "new" for the project (used by the UI to demand a reason).
 *   POST /api/po-notifications/purchase-order-created
 *        Given { poId, newItemsReason? } creates the in-app notification
 *        and sends the e-mail to Admin + Presales.
 *   GET  /api/po-notifications                (admin / pre_sales)
 *   GET  /api/po-notifications/unread-count   (admin / pre_sales)
 *   POST /api/po-notifications/:id/read       (admin / pre_sales)
 *   POST /api/po-notifications/read-all       (admin / pre_sales)
 *
 * "New item" = an item that is not already part of the project, i.e. it is
 * neither a line of the project's BOQ/BOM (boq_items) nor an item of any
 * other Purchase Order of the same project. Matching is done on material id
 * first and on a normalised item name second.
 * =====================================================================
 */

const NOTIFY_ROLES = ["admin", "pre_sales"];

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

type PoItemInput = {
  materialId?: string | null;
  item?: string | null;
  qty?: number | string | null;
  unit?: string | null;
  rate?: number | string | null;
};

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const inr = (n: unknown) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

async function ensureSchema() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS po_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        po_id UUID NOT NULL UNIQUE,
        po_number TEXT,
        project_id VARCHAR(100),
        project_name TEXT,
        vendor_name TEXT,
        subtotal NUMERIC DEFAULT 0,
        tax NUMERIC DEFAULT 0,
        total NUMERIC DEFAULT 0,
        item_count INTEGER DEFAULT 0,
        items JSONB DEFAULT '[]'::jsonb,
        new_items JSONB DEFAULT '[]'::jsonb,
        new_items_reason TEXT,
        created_by_id VARCHAR(100),
        created_by_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_po_notifications_created_at ON po_notifications (created_at DESC)`
    );
    await query(`
      CREATE TABLE IF NOT EXISTS po_notification_reads (
        notification_id UUID NOT NULL REFERENCES po_notifications(id) ON DELETE CASCADE,
        user_id VARCHAR(100) NOT NULL,
        read_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (notification_id, user_id)
      )
    `);
    console.log("[po-notifications] tables verified/created");
  } catch (err: any) {
    console.warn("[po-notifications] could not create tables:", err?.message || err);
  }
}

/** Collects every material id / name already used in a project's BOQ + other POs. */
async function loadProjectKnownItems(projectId: string, excludePoId?: string | null) {
  const ids = new Set<string>();
  const names = new Set<string>();

  // 1) BOQ / BOM lines
  try {
    const boq = await query(`SELECT table_data FROM boq_items WHERE project_id = $1`, [projectId]);
    const visit = (node: any, depth = 0) => {
      if (!node || depth > 8) return;
      if (Array.isArray(node)) {
        node.forEach((n) => visit(n, depth + 1));
        return;
      }
      if (typeof node !== "object") return;
      for (const k of ["id", "materialId", "material_id"]) {
        if (typeof node[k] === "string" && node[k]) ids.add(node[k]);
      }
      for (const k of ["name", "title", "item", "description"]) {
        if (typeof node[k] === "string" && node[k].trim()) names.add(norm(node[k]));
      }
      for (const v of Object.values(node)) {
        if (v && typeof v === "object") visit(v, depth + 1);
      }
    };
    for (const row of boq.rows) {
      let td = row.table_data;
      if (typeof td === "string") {
        try {
          td = JSON.parse(td);
        } catch {
          td = null;
        }
      }
      if (td) {
        visit(td?.materialLines);
        visit(td?.step11_items);
      }
    }
  } catch (err: any) {
    console.warn("[po-notifications] could not read boq_items:", err?.message || err);
  }

  // 2) Items of the project's other POs
  try {
    const params: any[] = [projectId];
    let sql = `SELECT poi.material_id, poi.item
               FROM purchase_order_items poi
               JOIN purchase_orders po ON po.id = poi.po_id
               WHERE po.project_id = $1`;
    if (excludePoId) {
      sql += ` AND po.id::text <> $2`;
      params.push(excludePoId);
    }
    const r = await query(sql, params);
    for (const row of r.rows) {
      if (row.material_id) ids.add(String(row.material_id));
      if (row.item) names.add(norm(row.item));
    }
  } catch (err: any) {
    console.warn("[po-notifications] could not read purchase_order_items:", err?.message || err);
  }

  return { ids, names };
}

async function detectNewItems(
  projectId: string,
  items: PoItemInput[],
  excludePoId?: string | null
): Promise<PoItemInput[]> {
  const known = await loadProjectKnownItems(projectId, excludePoId);
  const seen = new Set<string>();
  const result: PoItemInput[] = [];
  for (const it of items) {
    const name = norm(it.item);
    if (!name) continue;
    const mid = it.materialId ? String(it.materialId) : "";
    const isKnown = (mid && known.ids.has(mid)) || known.names.has(name);
    if (isKnown) continue;
    const key = mid || name;
    if (seen.has(key)) continue; // same new item typed twice
    seen.add(key);
    result.push(it);
  }
  return result;
}

async function getRecipientEmails(): Promise<string[]> {
  const emails = new Set<string>();
  try {
    const r = await query(
      `SELECT username FROM users WHERE role = ANY($1) AND approved = 'approved'`,
      [NOTIFY_ROLES]
    );
    for (const row of r.rows) {
      const u = String(row.username || "").trim();
      if (u.includes("@")) emails.add(u);
    }
  } catch (err: any) {
    console.warn("[po-notifications] could not load recipients:", err?.message || err);
  }
  const envAdmin = process.env.ADMIN_EMAIL;
  if (envAdmin && envAdmin.includes("@")) emails.add(envAdmin.trim());
  return Array.from(emails).filter((e) => {
    const l = e.toLowerCase();
    return !l.endsWith("@example.com") && !l.endsWith("@test.com");
  });
}

function buildEmailHtml(n: {
  poNumber: string;
  projectName: string;
  vendorName: string;
  createdBy: string;
  subtotal: number;
  tax: number;
  total: number;
  items: PoItemInput[];
  newItems: PoItemInput[];
  reason: string | null;
}) {
  const row = (it: PoItemInput) =>
    `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${esc(it.item)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${esc(it.qty)} ${esc(it.unit || "")}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${inr(it.rate)}</td>
    </tr>`;
  const head = `<tr style="background:#f1f5f9;">
      <th style="padding:8px 10px;text-align:left;font-size:12px;color:#475569;">Item</th>
      <th style="padding:8px 10px;text-align:right;font-size:12px;color:#475569;">Qty</th>
      <th style="padding:8px 10px;text-align:right;font-size:12px;color:#475569;">Rate</th></tr>`;

  const newSection = n.newItems.length
    ? `<div style="margin:20px 0;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
         <p style="margin:0 0 8px 0;font-weight:700;color:#92400e;">Newly added items (${n.newItems.length})</p>
         <table style="width:100%;border-collapse:collapse;font-size:13px;">${head}${n.newItems.map(row).join("")}</table>
         <p style="margin:12px 0 0 0;font-size:13px;color:#78350f;"><strong>Reason:</strong> ${esc(n.reason || "Not provided")}</p>
       </div>`
    : `<p style="margin:16px 0;font-size:13px;color:#475569;">No new items were added in this PO.</p>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
    <div style="background:#1e293b;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h2 style="margin:0;color:#fff;font-size:18px;">New Purchase Order Created</h2>
    </div>
    <div style="padding:24px 28px;border:1px solid #e2e8f0;border-top:none;">
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#64748b;width:130px;">Project</td><td><strong>${esc(n.projectName)}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">PO Number</td><td><strong>${esc(n.poNumber)}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Vendor</td><td>${esc(n.vendorName || "—")}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Created by</td><td>${esc(n.createdBy)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Items</td><td>${n.items.length}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Subtotal</td><td>${inr(n.subtotal)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Tax</td><td>${inr(n.tax)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Total</td><td><strong>${inr(n.total)}</strong></td></tr>
      </table>
      ${newSection}
      <p style="margin:18px 0 6px 0;font-weight:700;font-size:13px;">All PO items</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">${head}${n.items.map(row).join("")}</table>
    </div>
    <div style="background:#f1f5f9;padding:14px 28px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;text-align:center;font-size:12px;color:#64748b;">
      Automated notification from the BOQ Management System.
    </div>
  </div>`;
}

async function sendPoCreatedEmail(html: string, subject: string) {
  if (!resend) {
    console.warn("[po-notifications] Resend not configured — skipping e-mail");
    return;
  }
  const to = await getRecipientEmails();
  if (to.length === 0) {
    console.warn("[po-notifications] no Admin/Presales e-mail recipients found; skipping e-mail");
    return;
  }
  try {
    const response: any = await resend.emails.send({ from: fromEmail, to, subject, html });
    if (response?.error) {
      console.error("[po-notifications] Resend error:", response.error);
    } else {
      console.log("[po-notifications] e-mail sent to", to);
    }
  } catch (err) {
    console.error("[po-notifications] e-mail failed:", err);
  }
}

const isNotifyRole = (req: Request) => NOTIFY_ROLES.includes((req as any).user?.role);

export async function registerPoNotificationRoutes(app: Express) {
  await ensureSchema();

  // ---- Detect new items (read-only helper for the Create PO screen) ----
  app.post("/api/po-notifications/check-new-items", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { projectId, items, excludePoId } = req.body || {};
      if (!projectId || !Array.isArray(items)) {
        return res.status(400).json({ message: "projectId and items are required" });
      }
      const newItems = await detectNewItems(String(projectId), items, excludePoId || null);
      res.json({
        newItems: newItems.map((i) => ({ materialId: i.materialId || null, item: i.item })),
      });
    } catch (err) {
      console.error("POST /api/po-notifications/check-new-items error:", err);
      res.status(500).json({ message: "Failed to check new items" });
    }
  });

  // ---- Create notification + e-mail for a freshly created PO ----
  app.post(
    "/api/po-notifications/purchase-order-created",
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const { poId, newItemsReason } = req.body || {};
        if (!poId) return res.status(400).json({ message: "poId is required" });

        const poRes = await query(
          `SELECT po.id::text AS id, po.po_number, po.project_id, po.vendor_name, po.subtotal, po.tax,
                  po.total, po.requested_by, COALESCE(p.name, po.project_name) AS project_name
           FROM purchase_orders po
           LEFT JOIN boq_projects p ON po.project_id = p.id
           WHERE po.id::text = $1`,
          [String(poId)]
        );
        if (poRes.rows.length === 0) return res.status(404).json({ message: "Purchase Order not found" });
        const po = poRes.rows[0];

        // Only the creator (or an admin) may announce a PO.
        if (String(po.requested_by || "") !== String(user.id) && user.role !== "admin") {
          return res.status(403).json({ message: "Only the creator of the PO can send its notification" });
        }

        const existing = await query(`SELECT id FROM po_notifications WHERE po_id = $1`, [po.id]);
        if (existing.rows.length > 0) return res.json({ message: "Notification already exists", duplicate: true });

        const itemsRes = await query(
          `SELECT material_id AS "materialId", item, qty, unit, rate
           FROM purchase_order_items WHERE po_id = $1 ORDER BY created_at ASC`,
          [po.id]
        );
        const items: PoItemInput[] = itemsRes.rows;
        const newItems = await detectNewItems(String(po.project_id), items, po.id);

        const reason = String(newItemsReason || "").trim();
        if (newItems.length > 0 && !reason) {
          return res.status(400).json({
            message: "A reason is required when a PO contains new items.",
            newItems: newItems.map((i) => i.item),
          });
        }

        let createdBy: string = user.username || "Unknown user";
        try {
          const u = await query(`SELECT full_name FROM users WHERE id::text = $1`, [String(user.id)]);
          if (u.rows[0]?.full_name) createdBy = `${u.rows[0].full_name} (${user.username})`;
        } catch {
          /* fall back to username */
        }
        const ins = await query(
          `INSERT INTO po_notifications
             (po_id, po_number, project_id, project_name, vendor_name, subtotal, tax, total,
              item_count, items, new_items, new_items_reason, created_by_id, created_by_name)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14)
           ON CONFLICT (po_id) DO NOTHING
           RETURNING id::text`,
          [
            po.id,
            po.po_number,
            po.project_id,
            po.project_name,
            po.vendor_name,
            po.subtotal || 0,
            po.tax || 0,
            po.total || 0,
            items.length,
            JSON.stringify(items),
            JSON.stringify(newItems),
            newItems.length > 0 ? reason : null,
            user.id,
            createdBy,
          ]
        );
        if (ins.rows.length === 0) return res.json({ message: "Notification already exists", duplicate: true });

        res.status(201).json({ message: "Notification created", id: ins.rows[0].id, newItemCount: newItems.length });

        // Fire-and-forget e-mail (never affects the response / PO flow)
        (async () => {
          const html = buildEmailHtml({
            poNumber: po.po_number,
            projectName: po.project_name || "—",
            vendorName: po.vendor_name || "",
            createdBy,
            subtotal: Number(po.subtotal) || 0,
            tax: Number(po.tax) || 0,
            total: Number(po.total) || 0,
            items,
            newItems,
            reason: newItems.length ? reason : null,
          });
          await sendPoCreatedEmail(
            html,
            `New PO ${po.po_number} — ${po.project_name || "Project"}${
              newItems.length ? ` (${newItems.length} new item${newItems.length > 1 ? "s" : ""})` : ""
            }`
          );
        })().catch((e) => console.error("[po-notifications] email task error:", e));
      } catch (err) {
        console.error("POST /api/po-notifications/purchase-order-created error:", err);
        res.status(500).json({ message: "Failed to create notification" });
      }
    }
  );

  // ---- In-app notification feed (Admin + Presales only) ----
  app.get("/api/po-notifications", authMiddleware, async (req: Request, res: Response) => {
    if (!isNotifyRole(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const uid = (req as any).user.id;
      const r = await query(
        `SELECT n.id::text, n.po_id::text AS "poId", n.po_number AS "poNumber", n.project_id AS "projectId",
                n.project_name AS "projectName", n.vendor_name AS "vendorName", n.subtotal, n.tax, n.total,
                n.item_count AS "itemCount", n.items, n.new_items AS "newItems",
                n.new_items_reason AS "newItemsReason", n.created_by_name AS "createdByName",
                n.created_at AS "createdAt",
                (r.user_id IS NOT NULL) AS read
         FROM po_notifications n
         LEFT JOIN po_notification_reads r ON r.notification_id = n.id AND r.user_id = $1
         ORDER BY n.created_at DESC LIMIT 100`,
        [uid]
      );
      res.json({ notifications: r.rows, unread: r.rows.filter((x: any) => !x.read).length });
    } catch (err) {
      console.error("GET /api/po-notifications error:", err);
      res.status(500).json({ message: "Failed to load notifications" });
    }
  });

  app.get("/api/po-notifications/unread-count", authMiddleware, async (req: Request, res: Response) => {
    if (!isNotifyRole(req)) return res.json({ unread: 0 });
    try {
      const r = await query(
        `SELECT COUNT(*)::int AS c FROM po_notifications n
         WHERE NOT EXISTS (SELECT 1 FROM po_notification_reads r WHERE r.notification_id = n.id AND r.user_id = $1)`,
        [(req as any).user.id]
      );
      res.json({ unread: r.rows[0].c });
    } catch (err) {
      console.error("GET /api/po-notifications/unread-count error:", err);
      res.status(500).json({ message: "Failed" });
    }
  });

  app.post("/api/po-notifications/read-all", authMiddleware, async (req: Request, res: Response) => {
    if (!isNotifyRole(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      await query(
        `INSERT INTO po_notification_reads (notification_id, user_id)
         SELECT n.id, $1 FROM po_notifications n
         ON CONFLICT DO NOTHING`,
        [(req as any).user.id]
      );
      res.json({ message: "ok" });
    } catch (err) {
      console.error("POST /api/po-notifications/read-all error:", err);
      res.status(500).json({ message: "Failed" });
    }
  });

  app.post("/api/po-notifications/:id/read", authMiddleware, async (req: Request, res: Response) => {
    if (!isNotifyRole(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      await query(
        `INSERT INTO po_notification_reads (notification_id, user_id)
         SELECT n.id, $2 FROM po_notifications n WHERE n.id::text = $1
         ON CONFLICT DO NOTHING`,
        [req.params.id, (req as any).user.id]
      );
      res.json({ message: "ok" });
    } catch (err) {
      console.error("POST /api/po-notifications/:id/read error:", err);
      res.status(500).json({ message: "Failed" });
    }
  });

  console.log("[po-notifications] routes registered");
}
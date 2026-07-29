import { query } from "./db/client";
import type { Request, Response, NextFunction } from "express";

export async function logActivity(params: {
  userId?: string;
  username?: string;
  role?: string;
  action: string;
  module?: string;
  page?: string;
  details?: string;
  beforeData?: any;
  afterData?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    // Uses the actual DB column names: user_role, description, metadata, requested_at
    await query(
      `INSERT INTO audit_logs (user_id, username, user_role, action, module, description, metadata, ip_address, page, user_agent, requested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        params.userId || null,
        params.username || null,
        params.role || null,
        params.action.toUpperCase(),
        params.module || "SYSTEM",
        params.details || params.page || null,
        (params.beforeData || params.afterData) ? JSON.stringify({ before: params.beforeData, after: params.afterData }) : null,
        params.ipAddress || null,
        params.page || null,
        params.userAgent || null,
      ]
    );
  } catch (err: any) {
    if (err.code === '42P01') {
      console.warn("[AUDIT] audit_logs table does not exist. Skipping log.");
    } else {
      console.error("[AUDIT] Failed to log activity:", err.message);
    }
  }
}

/**
 * Middleware to catch all sensitive actions (POST, PUT, DELETE) 
 * and log them automatically.
 */
export const auditMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const method = req.method;
  const path = req.path;

  if (method === "GET") {
    return next();
  }

  const user = (req as any).user;

  res.on("finish", async () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      let action = "ACTION";
      if (method === "POST") action = "CREATE";
      if (method === "PUT" || method === "PATCH") action = "UPDATE";
      if (method === "DELETE") action = "DELETE";

      // Don't log audit routes themselves to avoid recursion
      if (path.startsWith("/api/audit")) return;

      await logActivity({
        userId: user?.id,
        username: user?.username,
        role: user?.role,
        action: action,
        module: path.split("/")[2]?.toUpperCase() || "System",
        page: path,
        details: `${method} ${path}`,
        afterData: action === "DELETE" ? null : (Object.keys(req.body || {}).length > 0 ? req.body : null),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    }
  });

  next();
};

/**
 * Helper to fetch "Before" data for specific modules
 */
export async function getBeforeData(module: string, id: string): Promise<any | null> {
  try {
    let tableName = "";
    if (module === "materials") tableName = "materials";
    else if (module === "shops") tableName = "shops";
    else if (module === "boq_projects") tableName = "boq_projects";
    else if (module === "products") tableName = "products";
    else if (module === "boq_versions") tableName = "boq_versions";

    if (!tableName) return null;

    const result = await query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
    return result.rows[0] || null;
  } catch (e) {
    console.error(`[AUDIT] Failed to fetch before data for ${module}/${id}:`, e);
    return null;
  }
}

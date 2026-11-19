import type { Express, Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { query } from "./db/client";
import { authMiddleware } from "./middleware";

/**
 * =====================================================================
 * PROJECT DOCUMENTS (quotes, drawings, invoices ... per project)
 * (isolated, additive module)
 * ---------------------------------------------------------------------
 * - Brand-new table `project_documents` and a brand-new PRIVATE storage
 *   bucket `project-documents`. No existing table, column, route or bucket
 *   is read-modified or changed.
 * - Upload / list / view / download, plus delete (admin or uploader only). No edit.
 * - Access: users who have BOM access (same rule the Generate BOM page uses)
 *   AND access to that project (same rule as the projects list).
 *
 *   GET  /api/projects/:projectId/documents
 *   POST /api/projects/:projectId/documents            (multipart: file, category, description)
 *   GET  /api/projects/:projectId/documents/:docId/url?mode=download
 *   GET  /api/projects/:projectId/documents/:docId/file        (in-app preview)
 *   DELETE /api/projects/:projectId/documents/:docId           (admin or uploader only)
 * =====================================================================
 */

const BUCKET = "project-documents";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT = new Set(["pdf", "xlsx", "xls", "csv", "doc", "docx", "png", "jpg", "jpeg"]);
const CATEGORIES = new Set(["Quote", "Drawing", "Invoice", "Contract", "Other"]);
// Types a browser can display itself. Everything else (Excel, Word, CSV) can only be downloaded.
const INLINE_TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
// Spreadsheets are read by the app itself and shown in the preview dialog.
const SHEET_TYPES: Record<string, string> = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel", csv: "text/csv" };

// Same roles that see "Generate BOM" by default (client/src/components/BoqTabBar.tsx)
const BOM_DEFAULT_ROLES = new Set(["admin", "software_team", "pre_sales", "product_manager", "purchase_team", "finance", "finance_team"]);
// Same roles that see every project (GET /api/projects)
const ALL_PROJECT_ROLES = new Set(["admin", "software_team", "purchase_team", "pre_sales", "product_manager", "finance_team"]);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws as any } })
    : null;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } });

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
    if (!schemaReady) {
        schemaReady = (async () => {
            await query(`
        CREATE TABLE IF NOT EXISTS project_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id VARCHAR(100) NOT NULL,
          file_name TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          mime_type TEXT,
          size_bytes BIGINT,
          category VARCHAR(50) NOT NULL DEFAULT 'Other',
          description TEXT,
          uploaded_by VARCHAR(36),
          uploaded_by_name TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
            await query(`CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents(project_id)`);
            // Additive column: which BOM version was open when the file was uploaded (info only)
            await query(`ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS version_label VARCHAR(50)`);
        })().catch((e) => { schemaReady = null; throw e; });
    }
    return schemaReady;
}

let bucketReady = false;
async function ensurePrivateBucket() {
    if (bucketReady || !supabase) return;
    try {
        const { data } = await supabase.storage.getBucket(BUCKET);
        if (!data) await supabase.storage.createBucket(BUCKET, { public: false });
        bucketReady = true;
    } catch {
        try { await supabase.storage.createBucket(BUCKET, { public: false }); bucketReady = true; } catch { /* may already exist */ }
    }
}

async function hasBomAccess(user: { id: string; role: string }): Promise<boolean> {
    if (BOM_DEFAULT_ROLES.has(user.role)) return true;
    try {
        const r = await query(
            `SELECT 1 FROM user_sidebar_permissions WHERE user_id = $1 AND module_name = 'generate_bom' LIMIT 1`,
            [user.id]
        );
        return (r.rowCount ?? 0) > 0;
    } catch { return false; }
}

async function hasProjectAccess(user: { id: string; role: string }, projectId: string): Promise<boolean> {
    if (ALL_PROJECT_ROLES.has(user.role)) return true;
    try {
        const r = await query(
            `SELECT 1 FROM user_project_permissions WHERE user_id = $1 AND project_id = $2 LIMIT 1`,
            [user.id, projectId]
        );
        return (r.rowCount ?? 0) > 0;
    } catch { return false; }
}

async function guard(req: Request, res: Response): Promise<string | null> {
    const user = req.user;
    const projectId = String(req.params.projectId || "").trim();
    if (!user || !projectId) { res.status(400).json({ message: "Invalid request" }); return null; }
    if (user.role === "supplier" || !(await hasBomAccess(user)) || !(await hasProjectAccess(user, projectId))) {
        res.status(403).json({ message: "You do not have access to this project's documents." });
        return null;
    }
    return projectId;
}

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "file";

export function registerProjectDocumentsRoutes(app: Express) {
    app.get("/api/projects/:projectId/documents", authMiddleware, async (req: Request, res: Response) => {
        try {
            const projectId = await guard(req, res); if (!projectId) return;
            await ensureSchema();
            const r = await query(
                `SELECT id, project_id, file_name, mime_type, size_bytes, category, description, uploaded_by, uploaded_by_name, version_label, created_at
         FROM project_documents WHERE project_id = $1 ORDER BY created_at DESC`,
                [projectId]
            );
            const me = req.user!;
            res.json({
                documents: r.rows.map(({ uploaded_by, ...d }: any) => ({
                    ...d,
                    // Only an admin or the person who uploaded the file may delete it
                    can_delete: me.role === "admin" || uploaded_by === me.id,
                })),
            });
        } catch (err: any) {
            console.error("[project-documents] list error:", err);
            res.status(500).json({ message: "Failed to load documents" });
        }
    });

    app.post("/api/projects/:projectId/documents", authMiddleware, (req: Request, res: Response, next) => {
        upload.single("file")(req, res, (err: any) => {
            if (err) {
                const tooBig = err?.code === "LIMIT_FILE_SIZE";
                return res.status(tooBig ? 413 : 400).json({ message: tooBig ? "File is too large (max 10 MB)." : "Upload failed." });
            }
            next();
        });
    }, async (req: Request, res: Response) => {
        try {
            const projectId = await guard(req, res); if (!projectId) return;
            if (!supabase) return res.status(500).json({ message: "File storage is not configured." });
            const file = req.file;
            if (!file) return res.status(400).json({ message: "No file uploaded." });

            const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
            const ext = (originalName.split(".").pop() || "").toLowerCase();
            if (!ALLOWED_EXT.has(ext)) {
                return res.status(400).json({ message: `File type .${ext || "?"} is not allowed. Allowed: ${[...ALLOWED_EXT].join(", ")}` });
            }
            const category = CATEGORIES.has(String(req.body?.category)) ? String(req.body.category) : "Other";
            const description = String(req.body?.description || "").slice(0, 500) || null;
            const versionLabel = String(req.body?.versionLabel || "").trim().slice(0, 50) || null;

            await ensureSchema();
            await ensurePrivateBucket();

            const storagePath = `${projectId}/${randomUUID()}-${safeName(originalName)}`;
            const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file.buffer, {
                contentType: file.mimetype || "application/octet-stream",
                upsert: false,
            });
            if (error) throw error;

            let uploaderName: string | null = null;
            try {
                const u = await query(`SELECT COALESCE(full_name, username) AS n FROM users WHERE id::text = $1`, [req.user!.id]);
                uploaderName = u.rows[0]?.n ?? null;
            } catch { /* fall back to username below */ }
            uploaderName = uploaderName || req.user!.username || null;

            const ins = await query(
                `INSERT INTO project_documents (project_id, file_name, storage_path, mime_type, size_bytes, category, description, uploaded_by, uploaded_by_name, version_label)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, project_id, file_name, mime_type, size_bytes, category, description, uploaded_by_name, version_label, created_at`,
                [projectId, originalName, storagePath, file.mimetype || null, file.size, category, description, req.user!.id, uploaderName, versionLabel]
            );
            res.json({ document: ins.rows[0] });
        } catch (err: any) {
            console.error("[project-documents] upload error:", err);
            res.status(500).json({ message: "Failed to upload document" });
        }
    });

    app.get("/api/projects/:projectId/documents/:docId/url", authMiddleware, async (req: Request, res: Response) => {
        try {
            const projectId = await guard(req, res); if (!projectId) return;
            if (!supabase) return res.status(500).json({ message: "File storage is not configured." });
            await ensureSchema();
            const r = await query(
                `SELECT file_name, storage_path FROM project_documents WHERE id::text = $1 AND project_id = $2`,
                [String(req.params.docId), projectId]
            );
            if (r.rowCount === 0) return res.status(404).json({ message: "Document not found" });
            const { file_name, storage_path } = r.rows[0];
            const download = req.query.mode === "download";
            const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(
                storage_path, 120, download ? { download: file_name } : undefined
            );
            if (error || !data?.signedUrl) throw error || new Error("No signed URL");
            res.json({ url: data.signedUrl, fileName: file_name });
        } catch (err: any) {
            console.error("[project-documents] url error:", err);
            res.status(500).json({ message: "Failed to open document" });
        }
    });

    // View in browser: streams the file with an inline Content-Disposition so PDFs / images
    // open in the tab instead of downloading.
    app.get("/api/projects/:projectId/documents/:docId/file", authMiddleware, async (req: Request, res: Response) => {
        try {
            const projectId = await guard(req, res); if (!projectId) return;
            if (!supabase) return res.status(500).json({ message: "File storage is not configured." });
            await ensureSchema();
            const r = await query(
                `SELECT file_name, storage_path FROM project_documents WHERE id::text = $1 AND project_id = $2`,
                [String(req.params.docId), projectId]
            );
            if (r.rowCount === 0) return res.status(404).json({ message: "Document not found" });
            const { file_name, storage_path } = r.rows[0];
            const ext = (String(file_name).split(".").pop() || "").toLowerCase();
            const type = INLINE_TYPES[ext] || SHEET_TYPES[ext];
            if (!type) return res.status(415).json({ message: "This file type can't be previewed. Please use Download." });
            const { data, error } = await supabase.storage.from(BUCKET).download(storage_path);
            if (error || !data) throw error || new Error("Download failed");
            const buf = Buffer.from(await data.arrayBuffer());
            res.setHeader("Content-Type", type);
            res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file_name)}`);
            res.setHeader("Cache-Control", "private, no-store");
            res.send(buf);
        } catch (err: any) {
            console.error("[project-documents] view error:", err);
            res.status(500).json({ message: "Failed to open document" });
        }
    });

    // Delete: only an admin or the uploader. Removes the stored file and its record.
    app.delete("/api/projects/:projectId/documents/:docId", authMiddleware, async (req: Request, res: Response) => {
        try {
            const projectId = await guard(req, res); if (!projectId) return;
            if (!supabase) return res.status(500).json({ message: "File storage is not configured." });
            await ensureSchema();
            const r = await query(
                `SELECT storage_path, uploaded_by FROM project_documents WHERE id::text = $1 AND project_id = $2`,
                [String(req.params.docId), projectId]
            );
            if (r.rowCount === 0) return res.status(404).json({ message: "Document not found" });
            const { storage_path, uploaded_by } = r.rows[0];
            if (req.user!.role !== "admin" && uploaded_by !== req.user!.id) {
                return res.status(403).json({ message: "Only an admin or the person who uploaded this file can delete it." });
            }
            const { error } = await supabase.storage.from(BUCKET).remove([storage_path]);
            if (error) throw error;
            await query(`DELETE FROM project_documents WHERE id::text = $1 AND project_id = $2`, [String(req.params.docId), projectId]);
            res.json({ success: true });
        } catch (err: any) {
            console.error("[project-documents] delete error:", err);
            res.status(500).json({ message: "Failed to delete document" });
        }
    });
}
/**
 * PMS SYNC MODULE  (isolated, additive)
 * --------------------------------------------------------------------------
 * Pushes the FINAL BOM / BOQ version of a project into the PMS app as tasks.
 *
 *   BOM  (type = 'bom') -> key step "Procurement": one task per material line
 *   BOQ  (type = 'boq') -> key step "Execution"  : one task per consolidated
 *                                                  product (BOQ item)
 *
 * Design rules:
 *  - Does NOT modify any existing route, table or column. It only creates two
 *    new tables (pms_sync_project_map, pms_sync_task_map) and new endpoints
 *    under /api/pms-sync/*.
 *  - Talks to PMS purely through PMS's existing public REST API
 *    (login, projects, key-steps, tasks). Nothing in PMS is changed.
 *  - Disabled (503) until PMS_BASE_URL / PMS_EMP_CODE / PMS_PASSWORD are set.
 *  - Never edits or deletes anything in PMS; re-sync only adds NEW tasks.
 */
import type { Express, Request, Response } from "express";
import { query } from "./db/client";
import { authMiddleware } from "./middleware";
import { archiveService } from "./archive_service";

/* ------------------------------ config ------------------------------- */

const cfg = () => ({
    baseUrl: (process.env.PMS_BASE_URL || "").replace(/\/+$/, ""),
    empCode: process.env.PMS_EMP_CODE || "",
    password: process.env.PMS_PASSWORD || "",
});

const isConfigured = () => {
    const c = cfg();
    return !!(c.baseUrl && c.empCode && c.password);
};

/** Days between task start and end (PMS allows max 7 on task creation). */
const TASK_SPAN_DAYS = 7;

/* ------------------------------ PMS client --------------------------- */

let cachedToken: { token: string; expiresAt: number } | null = null;

async function pmsLogin(): Promise<string> {
    const c = cfg();
    const resp = await fetch(`${c.baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: c.empCode, password: c.password }),
    });
    if (!resp.ok) {
        throw new Error(`PMS login failed (${resp.status}). Check PMS_EMP_CODE / PMS_PASSWORD.`);
    }
    const data: any = await resp.json();
    if (!data?.token) throw new Error("PMS login returned no token");
    // PMS sessions last 7 days; refresh well before that.
    cachedToken = { token: data.token, expiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000 };
    return data.token;
}

async function pmsToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
    return pmsLogin();
}

/** Authenticated call to PMS; re-logs in once if the token was rejected. */
async function pms(path: string, init: RequestInit = {}): Promise<any> {
    const c = cfg();
    const doCall = async (token: string) =>
        fetch(`${c.baseUrl}${path}`, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                ...(init.headers || {}),
                Authorization: `Bearer ${token}`,
            },
        });

    let resp = await doCall(await pmsToken());
    if (resp.status === 401) {
        cachedToken = null;
        resp = await doCall(await pmsLogin());
    }
    const text = await resp.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!resp.ok) {
        const msg = (body && (body.error || body.message)) || `PMS ${path} failed (${resp.status})`;
        const details = body && body.details ? ` ${JSON.stringify(body.details)}` : "";
        throw new Error(`${msg}${details}`);
    }
    return body;
}

/** Public (no auth) PMS lookups, with the same token attached harmlessly. */
const pmsList = async (path: string): Promise<any[]> => {
    const body = await pms(path);
    return Array.isArray(body) ? body : [];
};

/* ------------------------------ helpers ------------------------------ */

const norm = (s: string) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/** YYYY-MM-DD in India time, offset by N days. */
function istDate(offsetDays = 0): string {
    const now = new Date(Date.now() + offsetDays * 86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

function parseTableData(raw: any): any {
    if (typeof raw === "string") {
        try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw || {};
}

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

export type SyncLine = {
    /** Dedup key (stable across versions): normalised name + occurrence no. */
    key: string;
    name: string;
    qty: number;
    unit: string;
    category: string;
    extra: string;
};

/** Flatten nested consolidated products (same helper the PO generator uses). */
function flattenItems(items: any[]): any[] {
    const out: any[] = [];
    for (const item of items) {
        if (Array.isArray(item.step11_items) && item.step11_items.length > 0) {
            out.push(...flattenItems(item.step11_items));
        } else {
            out.push(item);
        }
    }
    return out;
}

/**
 * BOM material lines of one boq_item. Mirrors the quantity logic of the
 * Generate-PO route so that tasks match the BOM quantities exactly.
 */
export function bomLinesOfItem(tableData: any): any[] {
    let lines: any[] = [];

    if (tableData.materialLines && tableData.targetRequiredQty !== undefined) {
        const base = Number(tableData.baseRequiredQty || tableData.configBasis?.baseRequiredQty || 1);
        const target = Number(tableData.targetRequiredQty) || 0;

        if (Array.isArray(tableData.materialLines)) {
            for (const l of tableData.materialLines) {
                const baseQty = Number(l.baseQty || l.qty || 0);
                const applyR =
                    l.apply_rounding !== undefined
                        ? Boolean(l.apply_rounding)
                        : l.applyRounding !== undefined
                            ? Boolean(l.applyRounding)
                            : true;
                const applyW = l.applyWastage !== false;
                let defaultW = 0;
                if (tableData.configBasis?.wastagePctDefault !== undefined) {
                    defaultW = Number(tableData.configBasis.wastagePctDefault) / 100;
                }
                const rowWRaw = l.wastagePct !== undefined ? Number(l.wastagePct) : NaN;
                const rowW = !isNaN(rowWRaw) ? rowWRaw / 100 : undefined;
                const wastagePctUsed = applyW ? (rowW !== undefined ? rowW : defaultW) : 0;
                const wastageQty = baseQty * wastagePctUsed;
                const isFrozen =
                    l.freezeAndEdit === true || l.freezeAndEdit === "true" || l.freezeAndEdit === 1 ||
                    l.freeze_and_edit === true || l.freeze_and_edit === "true" || l.freeze_and_edit === 1;

                const effectiveQtyAtBasis = baseQty + wastageQty;
                const roundedQtyAtBasis = applyR ? Math.ceil(effectiveQtyAtBasis) : effectiveQtyAtBasis;
                const perUnitQty = base > 0 ? roundedQtyAtBasis / base : 0;
                const scaledQty = isFrozen ? roundedQtyAtBasis : Number((perUnitQty * target).toFixed(2));
                const qty = isFrozen ? roundedQtyAtBasis : applyR ? Math.ceil(scaledQty) : scaledQty;

                lines.push({ ...l, qty, item: l.name || l.material_name || "Unknown Item" });
            }
        }

        if (Array.isArray(tableData.step11_items)) {
            for (const it of tableData.step11_items.filter((x: any) => x.manual === true)) {
                lines.push({ ...it, qty: Number(it.qty || 0), item: it.title || it.name || "Unknown Item" });
            }
        }
    } else {
        if (Array.isArray(tableData.step11_items)) lines = flattenItems(tableData.step11_items);
        else if (Array.isArray(tableData.materialLines)) lines = flattenItems(tableData.materialLines);
        else if (Array.isArray(tableData.rows)) lines = flattenItems(tableData.rows);
        else if (Array.isArray(tableData.items)) lines = flattenItems(tableData.items);

        if (
            lines.length === 1 &&
            typeof tableData.finalize_description === "string" &&
            tableData.finalize_description.trim() !== ""
        ) {
            lines[0] = { ...lines[0], description: tableData.finalize_description };
        }
    }
    return lines;
}

/** Load the version's items (same filters as the BOM / PO screens). */
async function loadVersionItems(versionId: string): Promise<any[]> {
    const result = await query(
        `SELECT id, estimator, table_data FROM boq_items
      WHERE version_id = $1 AND user_added = true
      ORDER BY sort_order ASC, created_at ASC`,
        [versionId],
    );
    const archived = new Set(await archiveService.getArchivedItemIds("boq_items"));
    const trashed = new Set(await archiveService.getTrashedItemIds("boq_items"));
    return result.rows.filter((r: any) => !archived.has(r.id) && !trashed.has(r.id));
}

/** Build the list of lines to turn into PMS tasks for a version. */
async function buildLines(versionId: string, type: "bom" | "boq"): Promise<SyncLine[]> {
    const rows = await loadVersionItems(versionId);
    const raw: Omit<SyncLine, "key">[] = [];

    for (const row of rows) {
        const td = parseTableData(row.table_data);
        const category = String(td.category || "General");

        if (type === "boq") {
            // One task per consolidated product (the BOQ line the client sees).
            const step11 = Array.isArray(td.step11_items) ? td.step11_items : [];
            const derived = td.product_name || row.estimator || "";
            const isManual =
                derived === "Manual Product" || derived === "Manual" ||
                row.estimator === "manual_product" || row.estimator === "Manual";
            const name = String(
                (isManual ? step11[0]?.title || step11[0]?.description : null) || derived || "Unnamed Item",
            ).trim();
            const unit = String(td.finalize_unit || "nos");
            const isLumpSum = td.is_lump_sum === true || unit.toLowerCase() === "ls";
            const qtyRaw =
                td.finalize_qty !== undefined && td.finalize_qty !== null
                    ? parseFloat(String(td.finalize_qty)) || 0
                    : Number(step11[0]?.qty || 0);
            const qty = isLumpSum ? 1 : qtyRaw;
            const total = Number(td.total_revenue || td.project_value || 0);
            raw.push({
                name,
                qty,
                unit: isLumpSum ? "LS" : unit,
                category,
                extra: total > 0 ? `Item total: ${total.toLocaleString("en-IN")}` : "",
            });
        } else {
            // BOM: one task per material line.
            const bomLines = bomLinesOfItem(td);
            if (bomLines.length === 0) {
                console.log(
                    `[pms-sync] BOM item ${row.id} (${row.estimator}) gave 0 material lines. table_data keys: ${Object.keys(td).join(", ")}`,
                );
            }
            for (const l of bomLines) {
                const qty = parseFloat(l.qty || l.quantity || l.requiredQty || 0);
                if (!(qty > 0)) continue;
                const name = String(l.item || l.name || l.title || l.description || "Unnamed Material").trim();
                const vendor = String(l.shop_name || l.shopName || "").trim();
                raw.push({
                    name,
                    qty,
                    unit: String(l.unit || l.uom || "nos"),
                    category,
                    extra: vendor ? `Vendor: ${vendor}` : "",
                });
            }
        }
    }

    // Dedup key: normalised name + occurrence number, so duplicate names keep
    // their own task and a later version re-using the same material matches.
    const seen = new Map<string, number>();
    return raw.map((r) => {
        const base = `${type}|${norm(r.name)}`;
        const n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        return { ...r, key: `${base}|${n}` };
    });
}

export const taskNameFor = (type: "bom" | "boq", l: SyncLine) =>
    `${type === "bom" ? "Procure" : "Execute"}: ${l.name} – ${fmtQty(l.qty)} ${l.unit}`.slice(0, 250);

/* --------------------------- table bootstrap -------------------------- */

async function ensureTables() {
    await query(`
    CREATE TABLE IF NOT EXISTS pms_sync_project_map (
      boq_project_id VARCHAR(100) PRIMARY KEY,
      pms_project_id VARCHAR(100) NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await query(`
    CREATE TABLE IF NOT EXISTS pms_sync_task_map (
      id SERIAL PRIMARY KEY,
      boq_project_id VARCHAR(100) NOT NULL,
      sync_type VARCHAR(10) NOT NULL,
      source_key TEXT NOT NULL,
      version_id VARCHAR(100),
      pms_project_id VARCHAR(100) NOT NULL,
      pms_keystep_id VARCHAR(100),
      pms_task_id VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (boq_project_id, sync_type, source_key)
    )`);
}

/* ------------------------------- routes ------------------------------- */

async function getFinalVersion(versionId: string) {
    const r = await query(
        `SELECT id, project_id, type, version_number, is_last_final, source_version_id FROM boq_versions WHERE id = $1`,
        [versionId],
    );
    return r.rows[0] as
        | { id: string; project_id: string; type: "bom" | "boq"; version_number: number; is_last_final: boolean; source_version_id?: string | null }
        | undefined;
}

type VersionRow = NonNullable<Awaited<ReturnType<typeof getFinalVersion>>>;

/** For a BOQ version: the BOM version it was created from (if any). */
async function linkedBomOf(ver: VersionRow): Promise<VersionRow | undefined> {
    if (ver.type !== "boq" || !ver.source_version_id) return undefined;
    const b = await getFinalVersion(ver.source_version_id);
    return b && b.type === "bom" ? b : undefined;
}

/** How many lines of one version are new vs already in PMS. */
async function countFor(ver: VersionRow) {
    const lines = await buildLines(ver.id, ver.type);
    const existing = await query(
        `SELECT source_key FROM pms_sync_task_map WHERE boq_project_id = $1 AND sync_type = $2`,
        [ver.project_id, ver.type],
    );
    const have = new Set(existing.rows.map((r: any) => r.source_key));
    const items = lines.map((l) => ({
        name: taskNameFor(ver.type, l),
        category: l.category,
        alreadySynced: have.has(l.key),
    }));
    const skipCount = items.filter((i) => i.alreadySynced).length;
    return {
        type: ver.type,
        keyStep: ver.type === "bom" ? "Procurement" : "Execution",
        versionNumber: ver.version_number,
        total: items.length,
        newCount: items.length - skipCount,
        skipCount,
        items,
    };
}

/** Counts for a version plus (for a BOQ) its linked source BOM. */
async function countWithLinked(ver: VersionRow) {
    const self = await countFor(ver);
    const bomVer = await linkedBomOf(ver);
    const linked = bomVer ? await countFor(bomVer) : null;
    const parts = [self, ...(linked ? [linked] : [])];
    return {
        ...self,
        total: parts.reduce((n, p) => n + p.total, 0),
        newCount: parts.reduce((n, p) => n + p.newCount, 0),
        skipCount: parts.reduce((n, p) => n + p.skipCount, 0),
        parts,
    };
}

export async function registerPmsSyncRoutes(app: Express): Promise<void> {
    await ensureTables().catch((err) => {
        console.error("[pms-sync] Failed to ensure tables (feature will error on use):", err?.message || err);
    });

    const guard = (res: Response): boolean => {
        if (!isConfigured()) {
            res.status(503).json({
                message: "PMS sync is not configured. Set PMS_BASE_URL, PMS_EMP_CODE and PMS_PASSWORD on the server.",
            });
            return false;
        }
        return true;
    };

    /** Is the feature switched on? (used by the UI to show/hide the button) */
    app.get("/api/pms-sync/config", authMiddleware, (_req: Request, res: Response) => {
        res.json({ enabled: isConfigured() });
    });

    /** Dropdown data for the dialog. */
    app.get("/api/pms-sync/options", authMiddleware, async (req: Request, res: Response) => {
        if (!guard(res)) return;
        try {
            const boqProjectId = String(req.query.boqProjectId || "");
            const [departments, employees, pmsProjects] = await Promise.all([
                pmsList("/api/departments"),
                pmsList("/api/employees"),
                pmsList("/api/projects"),
            ]);

            const projects = pmsProjects.map((p: any) => ({
                id: p.id,
                title: p.title || p.name || "",
                projectCode: p.projectCode || p.project_code || "",
            }));

            let selectedProjectId: string | null = null;
            let matchedBy: "saved" | "name" | null = null;
            if (boqProjectId) {
                const saved = await query(`SELECT pms_project_id FROM pms_sync_project_map WHERE boq_project_id = $1`, [boqProjectId]);
                const savedId = saved.rows[0]?.pms_project_id;
                if (savedId && projects.some((p) => p.id === savedId)) {
                    selectedProjectId = savedId;
                    matchedBy = "saved";
                } else {
                    const bp = await query(`SELECT name FROM boq_projects WHERE id = $1`, [boqProjectId]);
                    const bname = norm(bp.rows[0]?.name || "");
                    const hit = bname ? projects.find((p) => norm(p.title) === bname) : null;
                    if (hit) {
                        selectedProjectId = hit.id;
                        matchedBy = "name";
                    }
                }
            }

            res.json({
                departments,
                employees: employees.map((e: any) => ({
                    id: e.id,
                    name: e.name,
                    empCode: e.empCode,
                    department: e.department || "",
                    designation: e.designation || "",
                })),
                projects,
                selectedProjectId,
                matchedBy,
            });
        } catch (err: any) {
            console.error("[pms-sync] options error:", err?.message || err);
            res.status(502).json({ message: err?.message || "Could not load PMS data" });
        }
    });

    /** Preview: what would be created / skipped. Writes nothing. */
    // Lightweight "is this version already in PMS?" check (used for the button badge).
    app.get("/api/pms-sync/status", authMiddleware, async (req: Request, res: Response) => {
        if (!guard(res)) return;
        try {
            const versionId = String(req.query.versionId || "");
            if (!versionId) return res.status(400).json({ message: "versionId is required" });
            const ver = await getFinalVersion(versionId);
            if (!ver) return res.status(404).json({ message: "Version not found" });
            const c = await countWithLinked(ver);
            res.json({
                total: c.total,
                newCount: c.newCount,
                skipCount: c.skipCount,
                synced: c.total > 0 && c.newCount === 0,
            });
        } catch (err: any) {
            console.error("[pms-sync] status error:", err?.message || err);
            res.status(500).json({ message: "Failed to read sync status" });
        }
    });

    app.post("/api/pms-sync/preview", authMiddleware, async (req: Request, res: Response) => {
        try {
            const { versionId } = req.body || {};
            if (!versionId) return res.status(400).json({ message: "versionId is required" });
            const ver = await getFinalVersion(versionId);
            if (!ver) return res.status(404).json({ message: "Version not found" });
            if (!ver.is_last_final) return res.status(400).json({ message: "Only the FINAL version can be synced to PMS" });

            res.json(await countWithLinked(ver));
        } catch (err: any) {
            console.error("[pms-sync] preview error:", err?.message || err);
            res.status(500).json({ message: "Failed to build preview" });
        }
    });

    /** Do the sync. */
    app.post("/api/pms-sync/sync", authMiddleware, async (req: Request, res: Response) => {
        if (!guard(res)) return;
        try {
            const { versionId, pmsProjectId, assignerId, taskOwnerId, department } = req.body || {};
            // Assignees (task members): any number; falls back to the task owner if none picked.
            const assigneeIds: string[] = Array.from(
                new Set(
                    (Array.isArray(req.body?.assigneeIds) ? req.body.assigneeIds : [])
                        .filter((x: any) => typeof x === "string" && x.trim() !== ""),
                ),
            ) as string[];
            const members = assigneeIds.length > 0 ? assigneeIds : [taskOwnerId];
            if (!versionId || !pmsProjectId || !assignerId || !taskOwnerId) {
                return res.status(400).json({ message: "versionId, pmsProjectId, assignerId and taskOwnerId are required" });
            }
            const base = await getFinalVersion(versionId);
            if (!base) return res.status(404).json({ message: "Version not found" });
            if (!base.is_last_final) return res.status(400).json({ message: "Only the FINAL version can be synced to PMS" });
            // part = "linked_bom": sync the BOM this BOQ was created from (Procurement tasks).
            const ver = req.body?.part === "linked_bom" ? await linkedBomOf(base) : base;
            if (!ver) return res.status(400).json({ message: "This BOQ has no linked BOM version" });

            const lines = await buildLines(ver.id, ver.type);
            if (lines.length === 0) return res.status(400).json({ message: "This version has no items to sync" });

            const existing = await query(
                `SELECT source_key FROM pms_sync_task_map WHERE boq_project_id = $1 AND sync_type = $2`,
                [ver.project_id, ver.type],
            );
            const have = new Set(existing.rows.map((r: any) => r.source_key));
            const pending = lines.filter((l) => !have.has(l.key));
            // Optional batching (used by the dialog's progress bar). Without `limit`
            // everything pending is created in one go, exactly as before.
            // `skip` = pending lines already tried and failed in earlier batches.
            const limit = Math.max(0, Math.floor(Number(req.body?.limit) || 0));
            const skip = Math.max(0, Math.floor(Number(req.body?.skip) || 0));
            const toCreate = limit > 0 ? pending.slice(skip, skip + limit) : pending.slice(skip);

            const keyStepTitle = ver.type === "bom" ? "Procurement" : "Execution";
            const start = istDate(0);
            const end = istDate(TASK_SPAN_DAYS);

            // 1. Find or create the key step.
            const steps = await pmsList(`/api/projects/${encodeURIComponent(pmsProjectId)}/key-steps?status=all`);
            let keyStep = steps.find((s: any) => !s.parentKeyStepId && norm(s.title) === norm(keyStepTitle));
            let keyStepCreated = false;
            if (!keyStep && toCreate.length > 0) {
                const maxPhase = steps.reduce((m: number, s: any) => Math.max(m, Number(s.phase) || 0), 0);
                keyStep = await pms(`/api/key-steps`, {
                    method: "POST",
                    body: JSON.stringify({
                        projectId: pmsProjectId,
                        title: keyStepTitle,
                        description: `Auto-created from BOQ app (${ver.type.toUpperCase()} V${ver.version_number})`,
                        phase: maxPhase + 1,
                        status: "pending",
                        startDate: start,
                        endDate: end,
                    }),
                });
                keyStepCreated = true;
            }

            // 2. Create tasks one by one; record each success immediately so a
            //    mid-way failure never causes duplicates on retry.
            let created = 0;
            const failures: { name: string; error: string }[] = [];
            for (const l of toCreate) {
                try {
                    const task = await pms(`/api/tasks`, {
                        method: "POST",
                        body: JSON.stringify({
                            projectId: pmsProjectId,
                            keyStepId: keyStep.id,
                            taskName: taskNameFor(ver.type, l),
                            description: [
                                `Source: BOQ app – ${ver.type.toUpperCase()} V${ver.version_number}`,
                                `Item: ${l.name}`,
                                `Quantity: ${fmtQty(l.qty)} ${l.unit}`,
                                `Category: ${l.category}`,
                                l.extra,
                            ].filter(Boolean).join("\n"),
                            status: "pending",
                            priority: "medium",
                            startDate: start,
                            endDate: end,
                            assignerId,
                            taskOwnerId,
                            taskMembers: members,
                        }),
                    });
                    await query(
                        `INSERT INTO pms_sync_task_map
               (boq_project_id, sync_type, source_key, version_id, pms_project_id, pms_keystep_id, pms_task_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (boq_project_id, sync_type, source_key) DO NOTHING`,
                        [ver.project_id, ver.type, l.key, ver.id, pmsProjectId, keyStep.id, task.id],
                    );
                    created++;
                } catch (e: any) {
                    failures.push({ name: l.name, error: e?.message || "failed" });
                }
            }

            // Remember the project mapping for next time.
            await query(
                `INSERT INTO pms_sync_project_map (boq_project_id, pms_project_id) VALUES ($1,$2)
         ON CONFLICT (boq_project_id) DO UPDATE SET pms_project_id = EXCLUDED.pms_project_id, updated_at = NOW()`,
                [ver.project_id, pmsProjectId],
            );

            console.log(
                `[pms-sync] ${ver.type} V${ver.version_number} project=${ver.project_id}: created=${created} skipped=${lines.length - pending.length} failed=${failures.length} assignees=${members.length} dept=${department || "-"}`,
            );
            res.json({
                keyStep: keyStepTitle,
                keyStepCreated,
                created,
                skipped: lines.length - pending.length,
                remaining: Math.max(0, pending.length - skip - toCreate.length),
                failed: failures.length,
                failures: failures.slice(0, 20),
            });
        } catch (err: any) {
            console.error("[pms-sync] sync error:", err?.message || err);
            res.status(502).json({ message: err?.message || "Sync failed" });
        }
    });

    console.log(`[pms-sync] routes registered (configured: ${isConfigured()})`);
}
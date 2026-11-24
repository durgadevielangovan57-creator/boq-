import type { Express, Request, Response } from "express";
import { query } from "./db/client";
import { authMiddleware, requireRole } from "./middleware";

/**
 * =====================================================================
 * MATERIAL PRICE HISTORY + 90-DAY PRICE VALIDITY (additive / independent)
 * ---------------------------------------------------------------------
 * - material_price_history : append-only log, one row per rate change of a
 *   material (a materials row already is "material + shop"), holding the
 *   previous rate, new rate, date/time, who did it and the shop.
 * - A DB trigger on `materials` writes the rows, so EVERY path that changes
 *   a rate (admin edit, supplier, proposal approval, import ...) is captured
 *   without touching any existing handler or calculation.
 * - The existing PUT /api/materials/:id keeps working exactly as before; this
 *   module only (a) fills in "changed_by" afterwards and (b) exposes read APIs.
 *
 *   GET  /api/material-prices/validity          list + filters + counts
 *   GET  /api/material-prices/:id/history       full history of one material
 *   POST /api/material-prices/:id/confirm       "rate still valid" (resets 90d)
 *
 * Validity rule: a rate is valid for 90 days from its latest update.
 *   fresh   : 0 - 74 days     warning : 75 - 90 days     expired : 91+ days
 * =====================================================================
 */

export const PRICE_VALIDITY_DAYS = 90;
export const PRICE_WARNING_FROM_DAYS = 75;

let ensured: Promise<void> | null = null;

export function ensureMaterialPriceHistory(): Promise<void> {
    if (ensured) return ensured;
    ensured = (async () => {
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS material_price_history (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    material_id TEXT NOT NULL,
                    material_name TEXT,
                    material_code TEXT,
                    shop_id TEXT,
                    shop_name TEXT,
                    previous_rate NUMERIC(15,2),
                    new_rate NUMERIC(15,2),
                    changed_by TEXT,
                    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    source TEXT NOT NULL DEFAULT 'updated',
                    note TEXT
                )
            `);
            await query(`CREATE INDEX IF NOT EXISTS idx_mph_material ON material_price_history(material_id, changed_at DESC)`);

            // History is append-only: no deletes, and the only allowed update is
            // filling a still-empty "changed_by".
            await query(`
                CREATE OR REPLACE FUNCTION material_price_history_guard() RETURNS trigger AS $fn$
                BEGIN
                    IF TG_OP = 'DELETE' THEN
                        RAISE EXCEPTION 'material_price_history is append-only';
                    END IF;
                    IF OLD.changed_by IS NULL
                       AND NEW.material_id = OLD.material_id
                       AND NEW.previous_rate IS NOT DISTINCT FROM OLD.previous_rate
                       AND NEW.new_rate IS NOT DISTINCT FROM OLD.new_rate
                       AND NEW.changed_at = OLD.changed_at
                       AND NEW.source = OLD.source THEN
                        RETURN NEW;
                    END IF;
                    RAISE EXCEPTION 'material_price_history is append-only';
                END
                $fn$ LANGUAGE plpgsql
            `);
            await query(`
                DO $do$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mph_guard' AND NOT tgisinternal) THEN
                        CREATE TRIGGER trg_mph_guard BEFORE UPDATE OR DELETE ON material_price_history
                        FOR EACH ROW EXECUTE FUNCTION material_price_history_guard();
                    END IF;
                END $do$
            `);

            // Small per-material summary (last update + number of changes) kept in
            // step by a trigger, so the dashboard list never has to aggregate the
            // whole history table (fast even with 100k+ materials).
            await query(`
                CREATE TABLE IF NOT EXISTS material_price_state (
                    material_id TEXT PRIMARY KEY,
                    last_changed_at TIMESTAMPTZ NOT NULL,
                    change_count INT NOT NULL DEFAULT 1
                )
            `);
            await query(`
                CREATE OR REPLACE FUNCTION material_price_state_sync() RETURNS trigger AS $fn$
                BEGIN
                    INSERT INTO material_price_state (material_id, last_changed_at, change_count)
                    VALUES (NEW.material_id, NEW.changed_at, 1)
                    ON CONFLICT (material_id) DO UPDATE
                        SET last_changed_at = GREATEST(material_price_state.last_changed_at, EXCLUDED.last_changed_at),
                            change_count = material_price_state.change_count + 1;
                    RETURN NEW;
                END
                $fn$ LANGUAGE plpgsql
            `);
            await query(`
                DO $do$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mph_state' AND NOT tgisinternal) THEN
                        CREATE TRIGGER trg_mph_state AFTER INSERT ON material_price_history
                        FOR EACH ROW EXECUTE FUNCTION material_price_state_sync();
                    END IF;
                END $do$
            `);

            // Capture every rate change on materials. Errors are swallowed so this
            // can never block a material save.
            await query(`
                CREATE OR REPLACE FUNCTION material_price_history_capture() RETURNS trigger AS $fn$
                DECLARE v_shop TEXT; v_old NUMERIC; v_new NUMERIC;
                BEGIN
                    BEGIN
                        BEGIN
                            SELECT name INTO v_shop FROM shops WHERE id = NEW.shop_id;
                        EXCEPTION WHEN OTHERS THEN
                            SELECT name INTO v_shop FROM shops WHERE id::text = NEW.shop_id::text;
                        END;
                        v_new := NULLIF(NEW.rate::text, '')::numeric;
                        IF TG_OP = 'INSERT' THEN
                            INSERT INTO material_price_history
                                (material_id, material_name, material_code, shop_id, shop_name, previous_rate, new_rate, source)
                            VALUES (NEW.id::text, NEW.name, NEW.code, NEW.shop_id::text, v_shop, NULL, v_new, 'created');
                        ELSE
                            v_old := NULLIF(OLD.rate::text, '')::numeric;
                            IF v_new IS DISTINCT FROM v_old THEN
                                INSERT INTO material_price_history
                                    (material_id, material_name, material_code, shop_id, shop_name, previous_rate, new_rate, source)
                                VALUES (NEW.id::text, NEW.name, NEW.code, NEW.shop_id::text, v_shop, v_old, v_new, 'updated');
                            END IF;
                        END IF;
                    EXCEPTION WHEN OTHERS THEN
                        NULL;
                    END;
                    RETURN NEW;
                END
                $fn$ LANGUAGE plpgsql
            `);
            await query(`
                DO $do$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_material_price_history' AND NOT tgisinternal) THEN
                        CREATE TRIGGER trg_material_price_history AFTER INSERT OR UPDATE OF rate ON materials
                        FOR EACH ROW EXECUTE FUNCTION material_price_history_capture();
                    END IF;
                END $do$
            `);

            // One-time baseline for materials that existed before this feature:
            // "original rate" dated at the material's creation. Idempotent.
            // Runs in the background so a big materials table can never delay
            // server start-up. Until it finishes, lists fall back to
            // materials.created_at, so results are the same.
            query(`
                INSERT INTO material_price_history
                    (material_id, material_name, material_code, shop_id, shop_name, previous_rate, new_rate, changed_at, source)
                SELECT m.id::text, m.name, m.code, m.shop_id::text, s.name, NULL, m.rate::numeric,
                       COALESCE(m.created_at, now()), 'initial'
                FROM materials m
                LEFT JOIN shops s ON s.id = m.shop_id
                WHERE NOT EXISTS (SELECT 1 FROM material_price_history h WHERE h.material_id = m.id::text)
            `).then(() =>
                // catch-up for any history rows written before the summary table existed
                query(`
                    INSERT INTO material_price_state (material_id, last_changed_at, change_count)
                    SELECT h.material_id, MAX(h.changed_at), COUNT(*)::int
                    FROM material_price_history h
                    WHERE NOT EXISTS (SELECT 1 FROM material_price_state st WHERE st.material_id = h.material_id)
                    GROUP BY h.material_id
                    ON CONFLICT (material_id) DO NOTHING
                `),
            ).catch((e) => console.error("[material-price-history] baseline failed:", e?.message));
        } catch (err) {
            ensured = null; // retry next time
            console.error("[material-price-history] setup failed:", err);
        }
    })();
    return ensured;
}

const AGE_BUCKET_SQL = `
    CASE
        WHEN days_old < 30 THEN 'lt1'
        WHEN days_old < 60 THEN '1m'
        WHEN days_old < 90 THEN '2m'
        WHEN days_old = 90 THEN '3m'
        ELSE 'gt3'
    END`;

const STATUS_SQL = `
    CASE
        WHEN days_old > ${PRICE_VALIDITY_DAYS} THEN 'expired'
        WHEN days_old >= ${PRICE_WARNING_FROM_DAYS} THEN 'warning'
        ELSE 'fresh'
    END`;

const BASE_CTE = `
    WITH calc AS (
        SELECT m.id::text AS id, m.name, m.code, m.rate::numeric AS rate, m.unit, m.category,
               m.shop_id::text AS shop_id, s.name AS shop_name,
               COALESCE(st.last_changed_at, m.created_at) AS last_updated,
               COALESCE(st.change_count, 0)::int AS history_count,
               GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(st.last_changed_at, m.created_at))) / 86400))::int AS days_old
        FROM materials m
        LEFT JOIN shops s ON s.id = m.shop_id
        LEFT JOIN material_price_state st ON st.material_id = m.id::text
        WHERE m.approved IS TRUE
          AND NOT EXISTS (
              SELECT 1 FROM archive_records ar
              WHERE ar.module = 'materials' AND ar.origin_id = m.id::text
                AND ar.status IN ('archived', 'trashed')
          )
    ),
    tagged AS (
        SELECT calc.*, ${AGE_BUCKET_SQL} AS age_bucket, ${STATUS_SQL} AS status FROM calc
    )`;

function userName(req: Request): string {
    const u = (req as any).user;
    return u?.username || u?.name || "Unknown";
}

export async function registerMaterialPriceHistoryRoutes(app: Express) {
    await ensureMaterialPriceHistory();

    // Fill in "updated by" after the existing material update has finished.
    // Does not alter the request/response in any way.
    app.use((req: Request, res: Response, next) => {
        if (req.method !== "PUT") return next();
        const m = /^\/api\/materials\/([^/?]+)\/?$/.exec(req.path);
        if (!m) return next();
        const materialId = m[1];
        res.on("finish", () => {
            if (res.statusCode < 200 || res.statusCode >= 300) return;
            if (!req.body || req.body.rate === undefined) return;
            const who = userName(req);
            query(
                `UPDATE material_price_history SET changed_by = $2
                 WHERE id = (
                     SELECT id FROM material_price_history
                     WHERE material_id = $1 AND changed_by IS NULL
                     ORDER BY changed_at DESC LIMIT 1
                 )`,
                [materialId, who],
            ).catch((e) => console.warn("[material-price-history] attribute failed:", e?.message));
        });
        next();
    });

    // ---- list + filters ------------------------------------------------
    app.get("/api/material-prices/validity", authMiddleware, async (req: Request, res: Response) => {
        try {
            await ensureMaterialPriceHistory();
            const search = String(req.query.search || "").trim();
            const shopId = String(req.query.shop_id || "").trim();
            const age = String(req.query.age || "").trim(); // lt1 | 1m | 2m | 3m | gt3
            const status = String(req.query.status || "").trim(); // fresh | warning | expired
            const sort = String(req.query.sort || "oldest");
            const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);
            const offset = Math.max(parseInt(String(req.query.offset || "0"), 10) || 0, 0);

            const params: any[] = [];
            const baseWhere: string[] = [];
            if (search) {
                params.push(`%${search}%`);
                baseWhere.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length} OR shop_name ILIKE $${params.length} OR category ILIKE $${params.length})`);
            }
            if (shopId) {
                params.push(shopId);
                baseWhere.push(`shop_id = $${params.length}`);
            }
            const baseSql = baseWhere.length ? `WHERE ${baseWhere.join(" AND ")}` : "";

            const listWhere = [...baseWhere];
            if (["lt1", "1m", "2m", "3m", "gt3"].includes(age)) {
                params.push(age);
                listWhere.push(`age_bucket = $${params.length}`);
            }
            if (["fresh", "warning", "expired"].includes(status)) {
                params.push(status);
                listWhere.push(`status = $${params.length}`);
            }
            const listSql = listWhere.length ? `WHERE ${listWhere.join(" AND ")}` : "";
            const orderBy =
                sort === "newest" ? "days_old ASC, name ASC" : sort === "name" ? "name ASC" : "days_old DESC, name ASC";
            params.push(limit, offset);
            const limIdx = params.length - 1;
            const offIdx = params.length;

            // One statement: `tagged` is computed once and shared by the chip
            // counts (search/shop only), the filtered total and the page of rows.
            const out = await query(
                `${BASE_CTE}
                 SELECT
                   (SELECT row_to_json(c) FROM (
                       SELECT COUNT(*)::int AS total,
                              COUNT(*) FILTER (WHERE age_bucket='lt1')::int AS lt1,
                              COUNT(*) FILTER (WHERE age_bucket='1m')::int AS m1,
                              COUNT(*) FILTER (WHERE age_bucket='2m')::int AS m2,
                              COUNT(*) FILTER (WHERE age_bucket='3m')::int AS m3,
                              COUNT(*) FILTER (WHERE age_bucket='gt3')::int AS gt3,
                              COUNT(*) FILTER (WHERE status='fresh')::int AS fresh,
                              COUNT(*) FILTER (WHERE status='warning')::int AS warning,
                              COUNT(*) FILTER (WHERE status='expired')::int AS expired
                       FROM tagged ${baseSql}) c) AS counts,
                   (SELECT COUNT(*)::int FROM tagged ${listSql}) AS total,
                   (SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.rn), '[]'::json) FROM (
                       SELECT id, name, code, rate, unit, category, shop_id, shop_name, last_updated,
                              days_old, age_bucket, status, history_count,
                              ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rn
                       FROM tagged ${listSql}
                       ORDER BY ${orderBy}
                       LIMIT $${limIdx} OFFSET $${offIdx}) x) AS items`,
                params,
            );
            const row = out.rows[0] || {};

            res.json({
                validity_days: PRICE_VALIDITY_DAYS,
                warning_from_days: PRICE_WARNING_FROM_DAYS,
                total: row.total ?? 0,
                counts: row.counts || {},
                items: row.items || [],
            });
        } catch (err) {
            console.error("[material-price-history] validity error:", err);
            res.status(500).json({ message: "error" });
        }
    });

    // ---- full history of one material ---------------------------------
    app.get("/api/material-prices/:id/history", authMiddleware, async (req: Request, res: Response) => {
        try {
            await ensureMaterialPriceHistory();
            const id = String(req.params.id);
            const matRes = await query(
                `SELECT m.id::text AS id, m.name, m.code, m.rate::numeric AS rate, m.unit, s.name AS shop_name
                 FROM materials m LEFT JOIN shops s ON s.id = m.shop_id WHERE m.id::text = $1`,
                [id],
            );
            const histRes = await query(
                `SELECT id, previous_rate, new_rate, changed_by, changed_at, source, note, shop_id, shop_name
                 FROM material_price_history WHERE material_id = $1
                 ORDER BY changed_at DESC, id DESC`,
                [id],
            );
            res.json({ material: matRes.rows[0] || null, history: histRes.rows });
        } catch (err) {
            console.error("[material-price-history] history error:", err);
            res.status(500).json({ message: "error" });
        }
    });

    // ---- "rate reviewed and still valid" -> resets the 90 days ----------
    app.post(
        "/api/material-prices/:id/confirm",
        authMiddleware,
        requireRole("admin", "software_team", "purchase_team"),
        async (req: Request, res: Response) => {
            try {
                await ensureMaterialPriceHistory();
                const id = String(req.params.id);
                const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
                const r = await query(
                    `INSERT INTO material_price_history
                        (material_id, material_name, material_code, shop_id, shop_name, previous_rate, new_rate, changed_by, source, note)
                     SELECT m.id::text, m.name, m.code, m.shop_id::text, s.name, m.rate::numeric, m.rate::numeric, $2, 'confirmed', $3
                     FROM materials m LEFT JOIN shops s ON s.id = m.shop_id
                     WHERE m.id::text = $1
                     RETURNING id, changed_at`,
                    [id, userName(req), note],
                );
                if (!r.rows[0]) return res.status(404).json({ message: "Material not found" });
                res.json({ ok: true, ...r.rows[0] });
            } catch (err) {
                console.error("[material-price-history] confirm error:", err);
                res.status(500).json({ message: "error" });
            }
        },
    );
}
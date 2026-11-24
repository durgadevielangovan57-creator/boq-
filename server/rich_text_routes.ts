/**
 * RICH TEXT (bold + colour) FOR DESCRIPTIONS  —  isolated, additive module
 * --------------------------------------------------------------------------
 * Descriptions stay plain text everywhere (DB columns, BOM/BOQ item data,
 * PDF, Excel, search, sync ...). This module only adds ONE new table that
 * remembers "this exact description text is shown with this bold/colour":
 *
 *   rich_text_store ( text_key = sha256(normalised plain text), rich = tiny html )
 *
 * Because the formatting follows the text, it automatically travels with the
 * description from Manage Product -> BOM -> BOQ without touching any of the
 * routes that copy, clone, approve or save those records.
 *
 * Rules:
 *  - No existing route, table or column is modified.
 *  - Only <b>, <br> and <span style="color:#rrggbb"> are ever stored; anything
 *    else is stripped on the server (never trusts the browser).
 *  - The stored html must reproduce the same plain text, otherwise it is rejected.
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { query } from "./db/client";
import { authMiddleware } from "./middleware";

const MAX_TEXT = 20000;
const MAX_LOOKUP = 500;

export const normText = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
export const keyOf = (plain: string) => crypto.createHash("sha256").update(normText(plain)).digest("hex");

/**
 * Keep only <b>, </b>, <br>, <span style="color:#rrggbb">, </span>.
 * Everything else is dropped, and the kept tags are always balanced
 * (an unmatched closer is discarded, unclosed openers are closed at the end).
 */
export function sanitizeRich(html: string): string {
    const parts = String(html || "").split(/(<[^>]*>)/g);
    const open: ("b" | "span")[] = [];
    let out = "";
    for (const p of parts) {
        if (p.length > 1 && p.startsWith("<") && p.endsWith(">")) {
            if (/^<b>$/i.test(p)) { out += "<b>"; open.push("b"); }
            else if (/^<br\s*\/?>$/i.test(p)) out += "<br>";
            else if (/^<\/b>$/i.test(p)) { if (open[open.length - 1] === "b") { open.pop(); out += "</b>"; } }
            else if (/^<\/span>$/i.test(p)) { if (open[open.length - 1] === "span") { open.pop(); out += "</span>"; } }
            else {
                const m = /^<span style="color:(#[0-9a-f]{6})">$/i.exec(p);
                if (m) { out += `<span style="color:${m[1].toLowerCase()}">`; open.push("span"); }
            }
            continue;
        }
        // text: no raw angle brackets may survive
        out += p.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    while (open.length) out += `</${open.pop()}>`;
    return out;
}

/** Plain text a rich string stands for. */
export function richPlain(html: string): string {
    return String(html || "")
        .replace(/<br>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

export const hasFormatting = (html: string) => /<b>|<span style="color:/i.test(html || "");

async function ensureTable() {
    await query(`
    CREATE TABLE IF NOT EXISTS rich_text_store (
      text_key VARCHAR(64) PRIMARY KEY,
      rich TEXT NOT NULL,
      updated_by VARCHAR(100),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
}

export async function registerRichTextRoutes(app: Express): Promise<void> {
    await ensureTable().catch((err) => {
        console.error("[rich-text] Failed to ensure table (bold/colour feature will be inactive):", err?.message || err);
    });

    // Look up the formatting for a batch of description texts (same order back).
    app.post("/api/rich-text/lookup", authMiddleware, async (req: Request, res: Response) => {
        try {
            const texts: any[] = Array.isArray(req.body?.texts) ? req.body.texts : [];
            if (texts.length === 0) return res.json({ results: [] });
            if (texts.length > MAX_LOOKUP) return res.status(400).json({ message: `At most ${MAX_LOOKUP} texts per request` });

            const keys = texts.map((t) => (typeof t === "string" && normText(t) ? keyOf(t) : ""));
            const wanted = Array.from(new Set(keys.filter(Boolean)));
            const found = new Map<string, string>();
            if (wanted.length > 0) {
                const r = await query(`SELECT text_key, rich FROM rich_text_store WHERE text_key = ANY($1)`, [wanted]);
                for (const row of r.rows) found.set(row.text_key, row.rich);
            }
            res.json({ results: keys.map((k) => (k && found.has(k) ? found.get(k) : null)) });
        } catch (err: any) {
            console.error("[rich-text] lookup error:", err?.message || err);
            res.status(500).json({ message: "Failed to load formatting" });
        }
    });

    // Save (or, when there is no formatting any more, remove) the formatting of one description text.
    app.put("/api/rich-text", authMiddleware, async (req: Request, res: Response) => {
        try {
            const plain = typeof req.body?.plain === "string" ? req.body.plain : "";
            const richIn = typeof req.body?.rich === "string" ? req.body.rich : "";
            if (!normText(plain)) return res.status(400).json({ message: "plain is required" });
            if (plain.length > MAX_TEXT || richIn.length > MAX_TEXT * 4) return res.status(400).json({ message: "Text too long" });

            const key = keyOf(plain);
            const rich = sanitizeRich(richIn);

            if (!rich || !hasFormatting(rich)) {
                await query(`DELETE FROM rich_text_store WHERE text_key = $1`, [key]);
                return res.json({ saved: false, rich: null });
            }
            if (normText(richPlain(rich)) !== normText(plain)) {
                return res.status(400).json({ message: "Formatting does not match the text" });
            }
            const userObj = (req.user as any) || {};
            await query(
                `INSERT INTO rich_text_store (text_key, rich, updated_by) VALUES ($1, $2, $3)
         ON CONFLICT (text_key) DO UPDATE SET rich = EXCLUDED.rich, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
                [key, rich, String(userObj.id || "")],
            );
            res.json({ saved: true, rich });
        } catch (err: any) {
            console.error("[rich-text] save error:", err?.message || err);
            res.status(500).json({ message: "Failed to save formatting" });
        }
    });

    console.log("[rich-text] routes registered");
}
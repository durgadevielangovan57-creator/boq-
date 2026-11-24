/**
 * Bold + colour for description fields (new feature, purely additive).
 *
 * STORAGE MODEL — nothing existing changes:
 *   - The existing plain-text description field is left exactly as it is
 *     (so PDF, Excel, search, duplicate checks etc. keep working untouched).
 *   - The formatting lives in a SEPARATE new field (e.g. finalize_description_rich)
 *     holding a tiny, sanitised HTML string: only <b>, <span style="color:#rrggbb">, <br>.
 *   - The rich value is only trusted while its plain text still equals the plain
 *     field; if someone edits the plain text elsewhere, the formatting is
 *     ignored rather than shown out of date.
 */

const HEX = /^#[0-9a-f]{6}$/i;

const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Normalise "#abc", "rgb(1,2,3)" or a hex colour to "#rrggbb"; null if not a plain colour. */
function toHex(c: string | null | undefined): string | null {
    if (!c) return null;
    const v = c.trim().toLowerCase();
    if (HEX.test(v)) return v;
    const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
    if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
    const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(v);
    if (rgb) {
        const h = (n: string) => Math.min(255, Number(n)).toString(16).padStart(2, "0");
        return `#${h(rgb[1])}${h(rgb[2])}${h(rgb[3])}`;
    }
    return null;
}

const BLOCK = new Set(["DIV", "P", "LI"]);

/** Reduce any editor HTML to the allowed subset: <b>, <span style="color:#hex">, <br>. */
export function sanitizeRichHtml(html: string): string {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    let out = "";

    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            out += escapeHtml(node.nodeValue || "");
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        const tag = el.tagName;

        if (tag === "BR") { out += "<br>"; return; }
        if (tag === "SCRIPT" || tag === "STYLE") return;

        const block = BLOCK.has(tag);
        if (block && out !== "" && !out.endsWith("<br>")) out += "<br>";

        const weight = el.style?.fontWeight || "";
        const bold = tag === "B" || tag === "STRONG" || weight === "bold" || Number(weight) >= 600;
        const color = toHex(el.style?.color) || (tag === "FONT" ? toHex(el.getAttribute("color")) : null);

        if (color) out += `<span style="color:${color}">`;
        if (bold) out += "<b>";
        el.childNodes.forEach(walk);
        if (bold) out += "</b>";
        if (color) out += "</span>";
    };

    doc.body.childNodes.forEach(walk);
    return out.replace(/(<br>)+$/, "");
}

/** Plain text of a (sanitised) rich string, with <br> as newlines. */
export function richToPlain(html: string): string {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(
        `<body>${html.replace(/<br\s*\/?>/gi, "\n")}</body>`,
        "text/html",
    );
    return doc.body.textContent || "";
}

const squash = (s: string) => String(s || "").replace(/\s+/g, " ").trim();

/** Is the stored rich value still describing the current plain text? */
export function isRichInSync(rich: string | null | undefined, plain: string | null | undefined): boolean {
    if (!rich) return false;
    return squash(richToPlain(rich)) === squash(plain || "");
}

/** What to show: the rich html if it is in sync, otherwise null (use plain text). */
export function richOrNull(rich: string | null | undefined, plain: string | null | undefined): string | null {
    return isRichInSync(rich, plain) ? sanitizeRichHtml(rich as string) : null;
}

/** True when the html actually contains formatting (otherwise don't bother storing it). */
export const hasFormatting = (html: string) => /<b>|<span style="color:/i.test(html || "");
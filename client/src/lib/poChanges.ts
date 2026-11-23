// Works out what changed on a PO (added / removed / qty / rate) and which changes
// need a reason. Mirrors server/po_change_history.ts so both sides agree.

export type PoChangeType = "item_added" | "item_removed" | "qty_increased" | "qty_decreased" | "rate_changed";

export interface PoLine {
    key: string; // stable identity of the line while editing
    name: string;
    qty: number;
    rate: number;
}

export interface PoChange {
    type: PoChangeType;
    itemName: string;
    oldQty: number | null;
    newQty: number | null;
    oldRate: number | null;
    newRate: number | null;
}

const EPS = 0.005;
export const REASON_REQUIRED: PoChangeType[] = ["item_added", "item_removed", "qty_increased", "qty_decreased", "rate_changed"];

export const changeKey = (type: string, itemName: string) => `${type}|${String(itemName ?? "").trim().toLowerCase()}`;
export const needsReason = (c: PoChange) => REASON_REQUIRED.includes(c.type);

/** before / after are lines keyed by `key`; a key only in `after` = added, only in `before` = removed. */
export function diffPoLines(before: PoLine[], after: PoLine[]): PoChange[] {
    const out: PoChange[] = [];
    const old = new Map(before.map((b) => [b.key, b]));
    const seen = new Set<string>();
    for (const a of after) {
        const b = old.get(a.key);
        if (!b) {
            out.push({ type: "item_added", itemName: a.name, oldQty: null, newQty: a.qty, oldRate: null, newRate: a.rate });
            continue;
        }
        seen.add(a.key);
        if (a.qty > b.qty + EPS) out.push({ type: "qty_increased", itemName: a.name, oldQty: b.qty, newQty: a.qty, oldRate: b.rate, newRate: a.rate });
        else if (a.qty < b.qty - EPS) out.push({ type: "qty_decreased", itemName: a.name, oldQty: b.qty, newQty: a.qty, oldRate: b.rate, newRate: a.rate });
        if (Math.abs(a.rate - b.rate) > EPS) out.push({ type: "rate_changed", itemName: a.name, oldQty: b.qty, newQty: a.qty, oldRate: b.rate, newRate: a.rate });
    }
    for (const b of before) {
        if (!seen.has(b.key)) out.push({ type: "item_removed", itemName: b.name, oldQty: b.qty, newQty: null, oldRate: b.rate, newRate: null });
    }
    return out;
}

export const CHANGE_LABEL: Record<string, string> = {
    item_added: "New item added",
    item_removed: "Item removed",
    qty_increased: "Quantity increased",
    qty_decreased: "Quantity decreased",
    rate_changed: "Rate changed",
};

/** Gives every line a key: material id (or lower-cased name) + its n-th occurrence on the PO. */
export function keyLines<T>(rows: T[], get: (r: T) => { materialId?: unknown; name: string; qty: number; rate: number }): PoLine[] {
    const seen: Record<string, number> = {};
    return rows.map((r) => {
        const g = get(r);
        const base = g.materialId ? `id:${String(g.materialId)}` : `name:${String(g.name ?? "").trim().toLowerCase()}`;
        seen[base] = (seen[base] || 0) + 1;
        return { key: `${base}#${seen[base]}`, name: g.name, qty: g.qty, rate: g.rate };
    });
}
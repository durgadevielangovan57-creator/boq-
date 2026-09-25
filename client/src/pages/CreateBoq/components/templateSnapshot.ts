/**
 * "Save as template" — product snapshot helpers (Generate BOM / CreateBoq).
 *
 * Pure functions, no React and no network calls. They turn ONE product card
 * (a boq_items row) into the JSON stored in bom_templates.config, and read a
 * saved config back for display.
 *
 * Why this exists
 * ───────────────
 * A product card is not just its table_data. What the user sees is
 *   table_data  +  edits not yet auto-saved (editedFields)  +  live card state
 *   (e.g. the Project Target box). A faithful template has to capture all
 * three, otherwise applying it later gives back something different from what
 * was on screen.
 *
 * Everything here works on a deep copy — the live product is never mutated.
 */

export type TemplateSaveMode = "full" | "items";

/** State that only lives inside the product card component. */
export type TemplateLiveState = {
    /** The Project Target currently shown in the card (e.g. 40 for "40 Sqft"). */
    targetRequiredQty?: number | null;
    /** engine materialLines indexes the user has hidden with the trash icon (not yet submitted). */
    hiddenMaterialLineIdx?: number[];
    /** step11_items indexes the user has hidden with the trash icon (not yet submitted). */
    hiddenStep11Idx?: number[];
} | null | undefined;

const clone = (v: any): any => JSON.parse(JSON.stringify(v ?? {}));

// Same definition of "engine-based product" the card itself uses.
const isEngineProduct = (td: any): boolean =>
    !!(td && td.materialLines && td.targetRequiredQty !== undefined);

const isPendingDelete = (row: any): boolean =>
    row?.manualApproval?.status === "pending" && row?.manualApproval?.action === "delete";

/**
 * Build the template config for one product.
 *
 * mode "full"  — exact copy of the product as it looks right now: Project
 *                Target, every line item with its current qty / rate / unit /
 *                description, added manual items, lump-sum, remarks, HSN/SAC…
 * mode "items" — the same, except the Project Target goes back to the
 *                product's own basis quantity, so the template carries the
 *                line items but not this particular project's size.
 */
export function buildProductTemplateSnapshot(
    itemId: string,
    parsedTableData: any,
    editedFields: Record<string, any> | undefined,
    live?: TemplateLiveState,
    mode: TemplateSaveMode = "full",
): any {
    const td = clone(parsedTableData);
    const edits = editedFields || {};
    const engine = isEngineProduct(td);

    // 1) Product-level edits made on the card (lump sum, indicate, remarks, category…)
    const productEdits = edits[itemId];
    if (productEdits) {
        for (const [field, value] of Object.entries(productEdits)) {
            if (value !== undefined) td[field] = value;
        }
    }

    // 2) Project Target exactly as shown in the card right now (it is only written
    //    to the database when the box loses focus, so table_data can be behind it).
    const liveTarget = live?.targetRequiredQty;
    if (engine && liveTarget !== undefined && liveTarget !== null && Number.isFinite(Number(liveTarget)) && Number(liveTarget) >= 0) {
        td.targetRequiredQty = Number(liveTarget);
    }

    // 3) Engine material lines. Rows keep their stored baseQty — the on-screen qty is
    //    derived from it by computeBoq — so only the fields a user can actually change
    //    on these rows are applied (same mapping the server's save-edits uses).
    if (Array.isArray(td.materialLines)) {
        const hidden = new Set<number>(live?.hiddenMaterialLineIdx || []);
        td.materialLines = td.materialLines
            .map((line: any, idx: number) => {
                const out = { ...line };
                const e = edits[`${itemId}-engine-${idx}`];
                if (e) {
                    if (e.supply_rate !== undefined) out.supplyRate = Number(e.supply_rate);
                    else if (e.rate !== undefined) out.supplyRate = Number(e.rate);
                    if (e.install_rate !== undefined) out.installRate = Number(e.install_rate);
                    for (const f of ["category", "indicate", "rate_amendment_status", "original_rate", "po_use_amended_rate"]) {
                        if (e[f] !== undefined) out[f] = e[f];
                    }
                }
                return { out, idx };
            })
            // rows the user removed from view (hidden or waiting for deletion approval) are not part of the product
            .filter(({ out, idx }: any) => !hidden.has(idx) && !isPendingDelete(out))
            .map(({ out }: any) => {
                // an approval request belongs to the original product, not to a copy of it
                if (out.manualApproval?.status === "pending") delete out.manualApproval;
                return out;
            });
    }

    // 4) Manual / loose line items (step11_items): qty, rates, unit, description, category…
    if (Array.isArray(td.step11_items)) {
        const hidden = new Set<number>(live?.hiddenStep11Idx || []);
        td.step11_items = td.step11_items
            .map((it: any, idx: number) => {
                const out = { ...it };
                const e = { ...edits[`${itemId}-manual-${idx}`], ...(it?.itemKey ? edits[it.itemKey] : undefined) };
                for (const [field, value] of Object.entries(e)) {
                    if (value !== undefined) out[field] = value;
                }
                // the card reads qtyPerSqf before qty, so keep them in step when qty was edited
                if ((e as any).qty !== undefined && out.qtyPerSqf !== undefined) out.qtyPerSqf = Number((e as any).qty);
                return { out, idx };
            })
            .filter(({ out, idx }: any) => !hidden.has(idx) && !isPendingDelete(out))
            .map(({ out }: any) => {
                if (out.manualApproval?.status === "pending") delete out.manualApproval;
                return out;
            });
    }

    // 5) State that belongs to the original product's workflow, not to the product itself.
    delete td.is_finalized;

    if (mode === "items" && engine) {
        td.targetRequiredQty = Number(td.configBasis?.baseRequiredQty) || 1;
    }

    td.template_mode = mode === "full" ? "full_product" : "line_items";
    return td;
}

/** Small read-only summary of a template config, for the save dialog and the template list. */
export function summarizeTemplateConfig(config: any): {
    engine: boolean;
    target: number | null;
    unit: string;
    lineCount: number;
    mode: string | null;
} {
    let td: any = config;
    if (typeof td === "string") {
        try { td = JSON.parse(td); } catch { td = {}; }
    }
    td = td || {};
    const engine = isEngineProduct(td);
    const materialLines = Array.isArray(td.materialLines) ? td.materialLines : [];
    const step11 = Array.isArray(td.step11_items) ? td.step11_items : [];
    const lineCount = engine
        ? materialLines.length + step11.filter((it: any) => it?.manual).length
        : step11.length;
    return {
        engine,
        target: engine && Number.isFinite(Number(td.targetRequiredQty)) ? Number(td.targetRequiredQty) : null,
        unit: td.configBasis?.requiredUnitType || "Unit",
        lineCount,
        mode: td.template_mode || null,
    };
}
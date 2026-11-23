import { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CHANGE_LABEL, PoChange, changeKey, needsReason } from "@/lib/poChanges";

const fmt = (n: number | null) => (n == null ? "-" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 3 }));

function heading(c: PoChange) {
    switch (c.type) {
        case "item_added":
            return `You have added a new item: ${c.itemName} (Qty ${fmt(c.newQty)})`;
        case "item_removed":
            return `You have removed the item: ${c.itemName} (Qty ${fmt(c.oldQty)})`;
        case "qty_decreased":
            return `Quantity of ${c.itemName} reduced from ${fmt(c.oldQty)} to ${fmt(c.newQty)}`;
        case "rate_changed":
            return `Rate of ${c.itemName} changed from ₹${fmt(c.oldRate)} to ₹${fmt(c.newRate)}`;
        default:
            return `Quantity of ${c.itemName} increased from ${fmt(c.oldQty)} to ${fmt(c.newQty)}`;
    }
}
function placeholder(c: PoChange) {
    switch (c.type) {
        case "item_added":
            return "Why is this item being added?";
        case "item_removed":
            return "Why is this item being removed?";
        case "qty_decreased":
            return "Why is the quantity being reduced?";
        case "rate_changed":
            return "Why is the rate being changed?";
        default:
            return "Why is the quantity being increased?";
    }
}

/**
 * Asks for a reason ONLY for the changes that need one (new item, removed item, quantity
 * increase). Other changes (qty decrease, rate change) are listed for information.
 *
 *   const { askReasons, reasonDialog } = usePoChangeReasons();
 *   const reasons = await askReasons(changes);   // null = user cancelled; {} = nothing needed
 *   ...render {reasonDialog} somewhere in the page
 */
export function usePoChangeReasons() {
    const [changes, setChanges] = useState<PoChange[] | null>(null);
    const [values, setValues] = useState<Record<string, string>>({});
    const [sameForAll, setSameForAll] = useState(false);
    const [commonReason, setCommonReason] = useState("");
    const resolver = useRef<((v: Record<string, string> | null) => void) | null>(null);

    const askReasons = useCallback((all: PoChange[]) => {
        if (!all.some(needsReason)) return Promise.resolve<Record<string, string> | null>({});
        setValues({});
        setSameForAll(false);
        setCommonReason("");
        setChanges(all);
        return new Promise<Record<string, string> | null>((resolve) => {
            resolver.current = resolve;
        });
    }, []);

    const close = (result: Record<string, string> | null) => {
        setChanges(null);
        resolver.current?.(result);
        resolver.current = null;
    };

    const required = (changes || []).filter(needsReason);
    const info = (changes || []).filter((c) => !needsReason(c));
    const allFilled = sameForAll
        ? commonReason.trim().length > 0
        : required.every((c) => (values[changeKey(c.type, c.itemName)] || "").trim().length > 0);
    const buildResult = () =>
        Object.fromEntries(
            required.map((c) => {
                const k = changeKey(c.type, c.itemName);
                return [k, (sameForAll ? commonReason : values[k] || "").trim()];
            })
        );

    const reasonDialog = (
        <Dialog open={changes !== null} onOpenChange={(o) => { if (!o) close(null); }}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Reason for the changes</DialogTitle>
                    <DialogDescription>Please give a reason for each change below. It is saved in the PO history.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    {required.length > 1 && (
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                            <input type="checkbox" checked={sameForAll} onChange={(e) => setSameForAll(e.target.checked)} />
                            Use one reason for all changes
                        </label>
                    )}
                    {sameForAll && (
                        <Textarea
                            placeholder="Enter one reason - it will be saved for every change below"
                            value={commonReason}
                            onChange={(e) => setCommonReason(e.target.value)}
                            className="min-h-[80px]"
                        />
                    )}
                    {sameForAll && (
                        <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                            {required.map((c) => <li key={changeKey(c.type, c.itemName)}>{heading(c)}</li>)}
                        </ul>
                    )}
                    {!sameForAll && required.map((c) => {
                        const k = changeKey(c.type, c.itemName);
                        return (
                            <div key={k} className="space-y-1.5">
                                <p className="text-sm font-medium text-slate-800">{heading(c)}</p>
                                <Textarea
                                    placeholder={placeholder(c)}
                                    value={values[k] || ""}
                                    onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                                    className="min-h-[70px]"
                                />
                            </div>
                        );
                    })}
                    {info.length > 0 && (
                        <div className="rounded border bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                            <p className="font-semibold">Other changes (no reason needed)</p>
                            {info.map((c) => (
                                <p key={changeKey(c.type, c.itemName)}>
                                    {CHANGE_LABEL[c.type]}: {c.itemName}{" "}
                                    {c.type === "rate_changed" ? `(₹${fmt(c.oldRate)} → ₹${fmt(c.newRate)})` : `(${fmt(c.oldQty)} → ${fmt(c.newQty)})`}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => close(null)}>Cancel</Button>
                    <Button disabled={!allFilled} onClick={() => close(buildResult())}>
                        Confirm &amp; Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return { askReasons, reasonDialog };
}
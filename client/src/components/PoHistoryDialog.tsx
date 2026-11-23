import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import apiFetch from "@/lib/api";
import { CHANGE_LABEL } from "@/lib/poChanges";

interface Props {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    /** Show the history of a whole project... */
    projectId?: string | null;
    /** ...or of one PO (and its revisions). */
    poId?: string | null;
    title?: string;
}

const num = (v: any) => (v == null ? "-" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 3 }));
const COLOR: Record<string, string> = {
    item_added: "bg-green-50 text-green-700 border-green-200",
    item_removed: "bg-red-50 text-red-700 border-red-200",
    qty_increased: "bg-amber-50 text-amber-700 border-amber-200",
    qty_decreased: "bg-blue-50 text-blue-700 border-blue-200",
    rate_changed: "bg-purple-50 text-purple-700 border-purple-200",
};

export function PoHistoryDialog({ open, onOpenChange, projectId, poId, title }: Props) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        const url = poId ? `/api/purchase-orders/${poId}/change-history` : projectId ? `/api/projects/${projectId}/po-change-history` : null;
        if (!url) return;
        setLoading(true);
        setError("");
        apiFetch(url)
            .then(async (r) => {
                const d = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(d.message || "Failed to load history");
                setRows(d.history || []);
            })
            .catch((e) => setError(e.message || "Failed to load history"))
            .finally(() => setLoading(false));
    }, [open, projectId, poId]);

    const detail = (r: any) => {
        switch (r.change_type) {
            case "item_added":
                return `Added with Qty ${num(r.new_qty)} @ ₹${num(r.new_rate)}`;
            case "item_removed":
                return `Removed (was Qty ${num(r.old_qty)} @ ₹${num(r.old_rate)})`;
            case "rate_changed":
                return `Rate ₹${num(r.old_rate)} → ₹${num(r.new_rate)}`;
            default:
                return `Qty ${num(r.old_qty)} → ${num(r.new_qty)}`;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title || "PO Change History"}</DialogTitle>
                    <DialogDescription>Every item added, removed or changed after a PO was created, with the reason given.</DialogDescription>
                </DialogHeader>
                <div className="overflow-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : error ? (
                        <p className="text-sm text-red-600 py-6 text-center">{error}</p>
                    ) : rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-10 text-center">No changes recorded yet.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="p-2">Date</th>
                                    <th className="p-2">PO No.</th>
                                    <th className="p-2">Item</th>
                                    <th className="p-2">Change</th>
                                    <th className="p-2">Reason</th>
                                    <th className="p-2">By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-t align-top">
                                        <td className="p-2 whitespace-nowrap text-xs">{new Date(r.changed_at).toLocaleString("en-IN")}</td>
                                        <td className="p-2 whitespace-nowrap font-medium">{r.po_number}</td>
                                        <td className="p-2">{r.item_name}</td>
                                        <td className="p-2">
                                            <Badge variant="outline" className={`text-[10px] ${COLOR[r.change_type] || ""}`}>{CHANGE_LABEL[r.change_type] || r.change_type}</Badge>
                                            <div className="text-xs text-slate-600 mt-1">{detail(r)}</div>
                                        </td>
                                        <td className="p-2 text-xs max-w-[240px]">{r.reason || <span className="text-slate-400">-</span>}</td>
                                        <td className="p-2 text-xs whitespace-nowrap">{r.changed_by_name || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
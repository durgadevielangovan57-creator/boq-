import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Merge, AlertCircle, ChevronsUpDown, Check, Search } from "lucide-react";
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface MergePoItemsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    poIds: string[];
    onMerged: () => void;
}

interface Group {
    key: string;
    item: string;
    unit: string;
    totalQty: number;
    avgOriginalRate: number;
    inPoCount: number;
    lines: { poId: string; poNumber: string; vendorName: string; qty: number; rate: number }[];
    vendorRate?: number | null;
}

const money = (n: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function MergePoItemsDialog({ open, onOpenChange, poIds, onMerged }: MergePoItemsDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groups, setGroups] = useState<Group[]>([]);
    const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
    const [vendorId, setVendorId] = useState("");
    const [vendorOpen, setVendorOpen] = useState(false);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [manualRates, setManualRates] = useState<Record<string, string>>({});
    const [reason, setReason] = useState("");
    const [itemSearch, setItemSearch] = useState("");

    const previewRequest = async (vId?: string) => {
        const res = await apiFetch("/api/purchase-orders/merge-items/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ poIds, vendorId: vId || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Failed to load items.");
        return data.groups as Group[];
    };

    // Load items + vendor list when the dialog opens
    useEffect(() => {
        if (!open) return;
        setError(null);
        setChecked(new Set());
        setManualRates({});
        setReason("");
        setItemSearch("");
        setVendorId("");
        setLoading(true);
        (async () => {
            try {
                const [g, shopRes] = await Promise.all([previewRequest(), apiFetch("/api/shops")]);
                setGroups(g);
                if (shopRes.ok) {
                    const sd = await shopRes.json();
                    setShops((sd.shops || []).map((s: any) => ({ id: String(s.id), name: s.name })));
                }
            } catch (e: any) {
                setError(e?.message || "Failed to load items.");
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleVendorChange = async (v: string) => {
        setVendorId(v);
        setManualRates({});
        setLoading(true);
        try {
            setGroups(await previewRequest(v));
        } catch (e: any) {
            setError(e?.message || "Failed to load vendor rates.");
        } finally {
            setLoading(false);
        }
    };

    const effectiveRate = (g: Group): number | null => {
        const manual = manualRates[g.key];
        if (manual !== undefined && manual !== "") {
            const n = Number(manual);
            return Number.isFinite(n) && n >= 0 ? n : null;
        }
        if (g.vendorRate !== undefined && g.vendorRate !== null) return g.vendorRate;
        // Vendor has no price for this item -> keep the old PO rate.
        return g.avgOriginalRate;
    };

    const toggle = (key: string) =>
        setChecked((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });

    const filteredGroups = useMemo(() => {
        const q = itemSearch.trim().toLowerCase();
        if (!q) return groups;
        return groups.filter(
            (g) =>
                g.item.toLowerCase().includes(q) ||
                (g.unit || "").toLowerCase().includes(q) ||
                g.lines.some(
                    (l) =>
                        (l.vendorName || "").toLowerCase().includes(q) ||
                        (l.poNumber || "").toLowerCase().includes(q)
                )
        );
    }, [groups, itemSearch]);

    const allFilteredChecked = filteredGroups.length > 0 && filteredGroups.every((g) => checked.has(g.key));

    // Selects (or clears) every item currently visible in the list (respects the search filter)
    const toggleSelectAll = () =>
        setChecked((prev) => {
            const next = new Set(prev);
            if (allFilteredChecked) filteredGroups.forEach((g) => next.delete(g.key));
            else filteredGroups.forEach((g) => next.add(g.key));
            return next;
        });

    const selectedGroups = useMemo(() => groups.filter((g) => checked.has(g.key)), [groups, checked]);
    const anyMissingRate = selectedGroups.some((g) => effectiveRate(g) === null);
    const anyIncrease = selectedGroups.some((g) => {
        const r = effectiveRate(g);
        return r !== null && r > g.avgOriginalRate + 0.005;
    });
    const newTotal = selectedGroups.reduce((s, g) => s + g.totalQty * (effectiveRate(g) || 0), 0);

    const canSubmit =
        !!vendorId &&
        selectedGroups.length > 0 &&
        !anyMissingRate &&
        (!anyIncrease || reason.trim().length > 0) &&
        !submitting &&
        !loading;

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await apiFetch("/api/purchase-orders/merge-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    poIds,
                    vendorId,
                    reason: reason.trim() || undefined,
                    items: selectedGroups.map((g) => ({ key: g.key, rate: effectiveRate(g) })),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to merge items.");
            toast({
                title: "Items merged",
                description:
                    `Created ${data.purchaseOrder?.po_number}.` +
                    (data.removedPos?.length ? ` Emptied POs removed: ${data.removedPos.join(", ")}.` : ""),
            });
            onOpenChange(false);
            onMerged();
        } catch (e: any) {
            toast({ title: "Merge failed", description: e?.message || "Something went wrong.", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Merge className="h-5 w-5 text-indigo-600" />
                        Merge selected items into one PO
                    </DialogTitle>
                    <DialogDescription>
                        Tick only the items you want to order from one vendor. They move into a single new draft PO
                        (quantities of the same item are added together). All other items stay in their own POs.
                    </DialogDescription>
                </DialogHeader>

                {error ? (
                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                ) : (
                    <>
                        <div className="space-y-1.5">
                            <Label>Order these items from (vendor)</Label>
                            <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full sm:w-[360px] justify-between font-normal">
                                        <span className="truncate">
                                            {shops.find((s) => s.id === vendorId)?.name || "Select vendor"}
                                        </span>
                                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[360px] p-0 z-[100]" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search vendor..." />
                                        <CommandList className="max-h-[260px]">
                                            <CommandEmpty>No vendor found.</CommandEmpty>
                                            {shops.map((s) => (
                                                <CommandItem
                                                    key={s.id}
                                                    value={s.name}
                                                    onSelect={() => {
                                                        setVendorOpen(false);
                                                        handleVendorChange(s.id);
                                                    }}
                                                >
                                                    <Check className={`mr-2 h-4 w-4 ${vendorId === s.id ? "opacity-100" : "opacity-0"}`} />
                                                    {s.name}
                                                </CommandItem>
                                            ))}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={itemSearch}
                                    onChange={(e) => setItemSearch(e.target.value)}
                                    placeholder="Search materials..."
                                    className="h-9 pl-8"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={toggleSelectAll}
                                disabled={loading || filteredGroups.length === 0}
                            >
                                {allFilteredChecked ? "Deselect all" : "Select all"}
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto border rounded-md min-h-[200px]">
                            {loading ? (
                                <div className="flex items-center justify-center py-12 text-slate-500">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr className="text-left text-xs uppercase text-slate-500">
                                            <th className="p-2 w-10">
                                                <Checkbox
                                                    checked={allFilteredChecked}
                                                    onCheckedChange={toggleSelectAll}
                                                    disabled={filteredGroups.length === 0}
                                                    aria-label="Select all"
                                                />
                                            </th>
                                            <th className="p-2">Item</th>
                                            <th className="p-2">Currently in</th>
                                            <th className="p-2 text-right">Total qty</th>
                                            <th className="p-2 text-right">Old rate</th>
                                            <th className="p-2 text-right w-36">New rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGroups.map((g) => {
                                            const rate = effectiveRate(g);
                                            const missing = vendorId && g.vendorRate == null;
                                            const higher = rate !== null && rate > g.avgOriginalRate + 0.005;
                                            return (
                                                <tr key={g.key} className="border-t align-top">
                                                    <td className="p-2">
                                                        <Checkbox
                                                            checked={checked.has(g.key)}
                                                            onCheckedChange={() => toggle(g.key)}
                                                        />
                                                    </td>
                                                    <td className="p-2 font-medium">
                                                        {g.item}
                                                        {g.unit && <span className="text-xs text-slate-400 ml-1">({g.unit})</span>}
                                                        {g.inPoCount > 1 && (
                                                            <span className="ml-2 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-1.5 py-0.5">
                                                                in {g.inPoCount} POs
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-xs text-slate-600">
                                                        {g.lines.map((l, i) => (
                                                            <div key={i}>
                                                                {l.vendorName || l.poNumber}: {l.qty}
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td className="p-2 text-right">{g.totalQty}</td>
                                                    <td className="p-2 text-right">₹{money(g.avgOriginalRate)}</td>
                                                    <td className="p-2 text-right">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            disabled={!vendorId}
                                                            className={`h-8 text-right ${higher ? "border-amber-400" : ""}`}
                                                            placeholder={missing ? `${money(g.avgOriginalRate)} (old)` : vendorId ? "" : "—"}
                                                            value={
                                                                manualRates[g.key] !== undefined
                                                                    ? manualRates[g.key]
                                                                    : g.vendorRate != null
                                                                        ? String(g.vendorRate)
                                                                        : ""
                                                            }
                                                            onChange={(e) =>
                                                                setManualRates((p) => ({ ...p, [g.key]: e.target.value }))
                                                            }
                                                        />
                                                        {missing && (
                                                            <div className="text-[10px] text-amber-600 mt-0.5">
                                                                Not in vendor's list · old rate used
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredGroups.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-6 text-center text-sm text-slate-500">
                                                    No materials match "{itemSearch}".
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {anyIncrease && (
                            <div className="space-y-1.5">
                                <Label>Reason for higher rate (required)</Label>
                                <Input
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g. Best available vendor for bulk quantity"
                                />
                            </div>
                        )}
                    </>
                )}

                <DialogFooter className="items-center gap-2 sm:justify-between">
                    <div className="text-sm text-slate-600">
                        {selectedGroups.length > 0 && (
                            <>
                                {selectedGroups.length} item(s) · New PO total ₹{money(newTotal)} (before GST)
                            </>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Create merged PO
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
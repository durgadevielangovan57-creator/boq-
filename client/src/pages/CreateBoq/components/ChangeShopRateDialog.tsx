import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Store, ChevronsUpDown, Check } from "lucide-react";
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { fuzzySearch, cn } from "@/lib/utils";

interface Shop {
    id: string;
    name: string;
    location?: string;
    city?: string;
}

interface ChangeShopRateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    materialId: string; // current approved materials.id for this line (previous_material_id)
    materialName: string;
    currentShopName?: string;
    currentRate: number;
    unit?: string;
    boqItemId: string;
    boqVersionId?: string | null;
    onSubmitted?: () => void;
}

/**
 * NEW, isolated feature: lets a user request a different shop + rate for a
 * single material already on a Generate BOM item. This is intentionally
 * separate from the existing "Amend Rate" workflow — it always goes through
 * a Material Request (material_submissions) on the Materials Approval page,
 * and never edits the BOM item directly.
 */
export function ChangeShopRateDialog({
    open,
    onOpenChange,
    materialId,
    materialName,
    currentShopName,
    currentRate,
    unit,
    boqItemId,
    boqVersionId,
    onSubmitted,
}: ChangeShopRateDialogProps) {
    const { toast } = useToast();
    const [step, setStep] = useState<"select" | "confirm">("select");
    const [shops, setShops] = useState<Shop[]>([]);
    const [loadingShops, setLoadingShops] = useState(false);
    const [shopPickerOpen, setShopPickerOpen] = useState(false);
    const [shopQuery, setShopQuery] = useState("");
    const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
    const [newRate, setNewRate] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) return;
        // reset state each time the dialog is opened for a (possibly different) material
        setStep("select");
        setSelectedShop(null);
        setShopQuery("");
        setNewRate("");
        setLoadingShops(true);
        apiFetch("/api/shops")
            .then((r) => (r.ok ? r.json() : { shops: [] }))
            .then((d) => setShops(d.shops || []))
            .catch(() => setShops([]))
            .finally(() => setLoadingShops(false));
    }, [open, materialId]);

    const filteredShops = useMemo(() => {
        const q = shopQuery.trim().toLowerCase();
        if (!q) return shops;
        return shops.filter((s) => fuzzySearch(q, [s.name, s.location || "", s.city || ""]));
    }, [shops, shopQuery]);

    const parsedRate = Number(newRate);
    const canProceed = !!selectedShop && newRate.trim() !== "" && Number.isFinite(parsedRate) && parsedRate >= 0;

    const handleSubmit = async () => {
        if (!selectedShop || !canProceed) return;
        setSubmitting(true);
        try {
            const res = await apiFetch("/api/material-submissions/bom-shop-rate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    previous_material_id: materialId,
                    new_shop_id: selectedShop.id,
                    new_rate: parsedRate,
                    boq_item_id: boqItemId,
                    boq_version_id: boqVersionId || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast({ title: "Could not submit", description: data?.message || "Please try again.", variant: "destructive" });
                return;
            }
            toast({
                title: "Submitted for approval",
                description: `Shop & rate change for "${materialName}" sent to Materials Approval.`,
            });
            onOpenChange(false);
            onSubmitted?.();
        } catch {
            toast({ title: "Error", description: "Failed to submit shop/rate change request.", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                {step === "select" ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Change Shop &amp; Rate</DialogTitle>
                            <DialogDescription>{materialName}</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 border border-slate-200 rounded-md p-3">
                                <div>
                                    <div className="text-slate-500 text-xs">Current Shop</div>
                                    <div className="font-semibold">{currentShopName || "-"}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 text-xs">Current Rate</div>
                                    <div className="font-semibold">₹{Number(currentRate || 0).toLocaleString()}{unit ? ` / ${unit}` : ""}</div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>New Shop</Label>
                                <Popover open={shopPickerOpen} onOpenChange={setShopPickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                                            {selectedShop ? (
                                                <span className="flex items-center gap-2"><Store className="h-3.5 w-3.5 text-slate-500" />{selectedShop.name}</span>
                                            ) : (
                                                <span className="text-slate-500">Search shop...</span>
                                            )}
                                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent style={{ width: "var(--radix-popover-trigger-width)" }} className="p-0" align="start" side="bottom">
                                        <Command shouldFilter={false}>
                                            <CommandInput placeholder="Search shop..." value={shopQuery} onValueChange={setShopQuery} />
                                            <CommandList className="max-h-[200px]">
                                                {loadingShops ? (
                                                    <div className="flex items-center justify-center py-4 text-sm text-slate-500">
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading shops...
                                                    </div>
                                                ) : (
                                                    <>
                                                        <CommandEmpty>No shops found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {filteredShops.map((s) => (
                                                                <CommandItem
                                                                    key={s.id}
                                                                    value={s.id}
                                                                    onSelect={() => { setSelectedShop(s); setShopPickerOpen(false); }}
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedShop?.id === s.id ? "opacity-100" : "opacity-0")} />
                                                                    <div className="flex flex-col">
                                                                        <span>{s.name}</span>
                                                                        {(s.city || s.location) && (
                                                                            <span className="text-xs text-slate-500">{s.city || s.location}</span>
                                                                        )}
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </>
                                                )}
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-1.5">
                                <Label>New Rate {unit ? `(per ${unit})` : ""}</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="Enter new rate"
                                    value={newRate}
                                    onChange={(e) => setNewRate(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button disabled={!canProceed} onClick={() => setStep("confirm")}>Save</Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Confirm Shop &amp; Rate Change</DialogTitle>
                            <DialogDescription>{materialName}</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-2 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-md border border-slate-200 p-3">
                                    <div className="text-xs text-slate-500 mb-1">Current</div>
                                    <div className="font-semibold">{currentShopName || "-"}</div>
                                    <div className="text-slate-600">₹{Number(currentRate || 0).toLocaleString()}</div>
                                </div>
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                                    <div className="text-xs text-emerald-700 mb-1">Requested</div>
                                    <div className="font-semibold">{selectedShop?.name}</div>
                                    <div className="text-emerald-800">₹{Number(parsedRate || 0).toLocaleString()}</div>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500">
                                Source: <span className="font-medium">Generate BOM</span>
                            </div>
                            <p className="text-sm text-slate-600">
                                Do you want to submit this shop and rate change for approval? The BOM will keep using
                                the current shop and rate until an admin approves this request.
                            </p>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep("select")} disabled={submitting}>Back</Button>
                            <Button onClick={handleSubmit} disabled={submitting}>
                                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit for Approval"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default ChangeShopRateDialog;
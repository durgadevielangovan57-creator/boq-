import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Store, Search, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type QuoteMaterial = { materialId: string | null; name: string; unit: string; quantity: number; rate: number };
type ShopGroup = { shopName: string; materials: QuoteMaterial[]; materialCount: number; total: number };

interface GenerateQuoteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shopGroups: ShopGroup[];
    projectId?: string | null;
    projectName?: string;
    versionId?: string | null;
    versionLabel?: string;
}

const formatCurrency = (n: number) =>
    `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * NEW, isolated feature: "Generate Quote" button on Generate BOM opens this
 * dialog (same shape as the existing shop/material selection dialog on
 * Generate PO) so the user can pick which shops/vendors to generate a
 * vendor-wise quote for. Confirming creates one quote per shop with the
 * current Sale Rate prefilled, via /api/fb/quotes/from-bom.
 */
export function GenerateQuoteDialog({ open, onOpenChange, shopGroups, projectId, projectName, versionId, versionLabel }: GenerateQuoteDialogProps) {
    const { toast } = useToast();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const [results, setResults] = useState<{ shopName: string; quoteId: string; quoteNumber: string; link: string; materialCount: number; total: number }[] | null>(null);

    useEffect(() => {
        if (open) {
            setSelected(new Set(shopGroups.map((s) => s.shopName)));
            setSearch("");
            setResults(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const toggle = (shopName: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(shopName)) next.delete(shopName); else next.add(shopName);
            return next;
        });
    };

    const filtered = search.trim()
        ? shopGroups.filter((s) => s.shopName.toLowerCase().includes(search.trim().toLowerCase()))
        : shopGroups;

    const grandTotal = shopGroups.filter((s) => selected.has(s.shopName)).reduce((sum, s) => sum + s.total, 0);

    const handleConfirm = async () => {
        const chosen = shopGroups.filter((s) => selected.has(s.shopName));
        if (chosen.length === 0) {
            toast({ title: "Select at least one shop", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const res = await apiFetch("/api/fb/quotes/from-bom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId, projectName, versionId, versionLabel,
                    shops: chosen.map((s) => ({ shopName: s.shopName, materials: s.materials })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Failed to generate quotes");
            setResults(data.quotes || []);
            toast({ title: "Quotes generated", description: `${data.quotes?.length || 0} vendor quote(s) created. Find them in Quotes.` });
        } catch (err: any) {
            toast({ title: "Error", description: err?.message || "Failed to generate quotes", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const copyLink = (link: string) => {
        const full = `${window.location.origin}${link}`;
        navigator.clipboard?.writeText(full);
        toast({ title: "Link copied", description: full });
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Generate Quote</DialogTitle>
                    <DialogDescription>
                        {results
                            ? "Vendor-wise quotes have been generated. Copy each link to send to the vendor."
                            : "Select the shops/vendors you want to generate a quote for. The current Sale Rate will be prefilled — you don't need to re-enter rates."}
                    </DialogDescription>
                </DialogHeader>

                {results ? (
                    <div className="space-y-2 py-2">
                        {results.map((r) => (
                            <div key={r.quoteId} className="flex items-center gap-3 p-3 rounded-md border bg-green-50 border-green-200">
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-gray-800 truncate">{r.shopName}</div>
                                    <div className="text-[11px] text-gray-500">{r.quoteNumber} • {r.materialCount} materials • {formatCurrency(r.total)}</div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => copyLink(r.link)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy Link</Button>
                                <Button size="sm" variant="ghost" onClick={() => window.open(r.link, "_blank")}><ExternalLink className="h-3.5 w-3.5" /></Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3 py-2">
                        <div className="relative">
                            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shops..." className="pl-8 h-9 text-sm" />
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase">
                            <span>{filtered.length} shop(s) found</span>
                            <span>{selected.size} selected • {formatCurrency(grandTotal)}</span>
                        </div>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                            {filtered.length === 0 && (
                                <p className="text-sm text-gray-500 py-6 text-center">No shops match your BOM materials.</p>
                            )}
                            {filtered.map((shop) => {
                                const checked = selected.has(shop.shopName);
                                return (
                                    <label key={shop.shopName} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${checked ? "bg-purple-50 border-purple-200" : "hover:bg-gray-50"}`}>
                                        <Checkbox checked={checked} onCheckedChange={() => toggle(shop.shopName)} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-gray-800 truncate">{shop.shopName}</div>
                                            <div className="text-[11px] text-gray-500">{shop.materialCount} material(s)</div>
                                        </div>
                                        <div className="text-sm font-bold text-gray-700 shrink-0">{formatCurrency(shop.total)}</div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {results ? (
                        <Button onClick={() => onOpenChange(false)}>Done</Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                            <Button onClick={handleConfirm} disabled={saving || selected.size === 0} className="bg-purple-600 hover:bg-purple-700">
                                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Confirm
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
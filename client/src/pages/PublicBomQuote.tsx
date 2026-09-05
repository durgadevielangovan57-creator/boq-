import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, ReceiptText, Store, Lock } from "lucide-react";
import apiFetch from "@/lib/api";

type QuoteItem = {
    id: string;
    item_name: string;
    unit: string;
    quantity: string | number;
    original_rate: string | number;
    vendor_rate: string | number;
    rate_changed: boolean;
};

const num = (v: any) => Number(v) || 0;
const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Fully public route (no login, no sidebar): {app}/quote/bom/:token
// The vendor sees only their shop's materials for this BOM, with the current
// Sale Rate prefilled. They can edit a rate (auto-saved + highlighted), then
// use "Check & Submit" to review a before/after summary and finalize.
export default function PublicBomQuote() {
    const { token } = useParams<{ token: string }>();
    const [quote, setQuote] = useState<any>(null);
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savingId, setSavingId] = useState<string | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [submittedBy, setSubmittedBy] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [draftRates, setDraftRates] = useState<Record<string, string>>({});

    const load = () => {
        setLoading(true);
        apiFetch(`/api/fb/public/quotes/bom/${token}`)
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((d) => {
                setQuote(d.quote);
                setItems(d.items || []);
                setSubmittedBy(d.quote?.submitted_by || d.quote?.bom_shop_name || "");
                const dr: Record<string, string> = {};
                (d.items || []).forEach((it: QuoteItem) => { dr[it.id] = String(it.vendor_rate ?? it.original_rate ?? ""); });
                setDraftRates(dr);
            })
            .catch(() => setError("This quote link is invalid or has expired."))
            .finally(() => setLoading(false));
    };

    useEffect(load, [token]);

    const isSubmitted = quote?.status === "Submitted";

    const saveRate = async (item: QuoteItem, newValue: string) => {
        if (isSubmitted) return;
        const newRate = Number(newValue);
        if (!newValue.trim() || isNaN(newRate) || newRate < 0) return;
        if (newRate === num(item.vendor_rate)) return;
        setSavingId(item.id);
        try {
            const res = await apiFetch(`/api/fb/public/quotes/bom/${token}/save-rate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemId: item.id, vendorRate: newRate, changedBy: submittedBy || quote?.bom_shop_name }),
            });
            if (!res.ok) throw new Error();
            setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, vendor_rate: newRate, rate_changed: Math.abs(newRate - num(item.original_rate)) > 0.0001 } : it));
            setQuote((q: any) => q ? { ...q, status: q.status === "Submitted" ? q.status : "Vendor Updated" } : q);
        } catch {
            setError("Failed to save that rate change. Please try again.");
        } finally {
            setSavingId(null);
        }
    };

    const totals = useMemo(() => {
        let before = 0, after = 0, changedCount = 0;
        items.forEach((it) => {
            const qty = num(it.quantity);
            before += qty * num(it.original_rate);
            after += qty * num(it.vendor_rate);
            if (it.rate_changed) changedCount++;
        });
        return { before, after, changedCount };
    }, [items]);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await apiFetch(`/api/fb/public/quotes/bom/${token}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submittedBy: submittedBy.trim() || quote?.bom_shop_name }),
            });
            if (!res.ok) throw new Error();
            setReviewOpen(false);
            load();
        } catch {
            setError("Failed to submit. Please check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }
    if (error && !quote) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6"><p className="text-sm text-muted-foreground">{error}</p></div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-6">
            <div className="max-w-3xl mx-auto space-y-4">
                <Card>
                    <CardHeader className="text-center border-b pb-4">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                            <ReceiptText className="h-5 w-5" />
                            <span className="text-xs uppercase tracking-wide">Vendor Quote</span>
                        </div>
                        <CardTitle className="text-xl flex items-center justify-center gap-2"><Store className="h-5 w-5" /> {quote?.bom_shop_name}</CardTitle>
                        <CardDescription>
                            {quote?.bom_project_name}{quote?.bom_version_label ? ` • ${quote.bom_version_label}` : ""} • {quote?.quote_number}
                        </CardDescription>
                        <div className="flex justify-center pt-2">
                            <Badge variant={isSubmitted ? "default" : "secondary"}>{quote?.status}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-1.5">
                        <Label>Your Shop / Company Name</Label>
                        <Input value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)} placeholder="Enter your shop name" disabled={isSubmitted} />
                        <p className="text-xs text-muted-foreground pt-1">Review the materials and rates below. The Sale Rate is prefilled — edit a rate only if you want to propose a different price.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((it) => (
                                    <TableRow key={it.id} className={it.rate_changed ? "bg-amber-50" : ""}>
                                        <TableCell className="font-medium">
                                            {it.item_name}
                                            {it.rate_changed && <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-700">Rate changed</Badge>}
                                        </TableCell>
                                        <TableCell>{it.unit || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            {isSubmitted ? (
                                                money(num(it.vendor_rate))
                                            ) : (
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    className={`h-8 w-24 text-right ml-auto ${it.rate_changed ? "border-amber-400 bg-amber-50" : ""}`}
                                                    value={draftRates[it.id] ?? ""}
                                                    onChange={(e) => setDraftRates((prev) => ({ ...prev, [it.id]: e.target.value }))}
                                                    onBlur={(e) => saveRate(it, e.target.value)}
                                                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                                    disabled={savingId === it.id}
                                                />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="flex justify-end pt-3 text-sm font-bold">
                            Total: {money(totals.after)}
                        </div>
                    </CardContent>
                </Card>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                {isSubmitted ? (
                    <Card>
                        <CardContent className="py-6 text-center space-y-2">
                            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                            <p className="font-semibold">Quote Submitted</p>
                            <p className="text-sm text-muted-foreground">Thank you. This quote can no longer be edited.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Button className="w-full" size="lg" onClick={() => setReviewOpen(true)} disabled={items.length === 0}>
                        <Lock className="h-4 w-4 mr-2" /> Check &amp; Submit
                    </Button>
                )}
            </div>

            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Review Before Submitting</DialogTitle>
                        <DialogDescription>Once submitted, this quote can no longer be edited.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm max-h-[300px] overflow-y-auto">
                        {items.map((it) => (
                            <div key={it.id} className="flex items-center justify-between border-b py-1.5">
                                <span className="truncate pr-2">{it.item_name}</span>
                                <span className={it.rate_changed ? "text-amber-700 font-semibold" : "text-muted-foreground"}>
                                    {money(num(it.original_rate))} {it.rate_changed ? `→ ${money(num(it.vendor_rate))}` : "(unchanged)"}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm pt-2 border-t">
                        <div><p className="text-xs text-muted-foreground">Changed</p><p className="font-bold">{totals.changedCount}</p></div>
                        <div><p className="text-xs text-muted-foreground">Total Before</p><p className="font-bold">{money(totals.before)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Total After</p><p className="font-bold">{money(totals.after)}</p></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={submitting}>Back</Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Confirm &amp; Submit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
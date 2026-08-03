import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Send, Loader2, ReceiptText } from "lucide-react";
import apiFetch from "@/lib/api";

// Fully public route (no login, no sidebar) - generic link (not tied to a vendor).
// Whoever opens it types in their own shop name, fills rates, and submits.
export default function PublicQuoteFillOpen() {
    const { token } = useParams<{ token: string }>();
    const [quote, setQuote] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [shopName, setShopName] = useState("");
    const [rates, setRates] = useState<Record<string, { rate: string; remarks: string }>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const load = () => {
        setLoading(true);
        apiFetch(`/api/fb/public/quotes/open/${token}`)
            .then((r) => {
                if (!r.ok) throw new Error("invalid");
                return r.json();
            })
            .then((d) => {
                setQuote(d.quote);
                setItems(d.items || []);
                const r: Record<string, { rate: string; remarks: string }> = {};
                (d.items || []).forEach((it: any) => {
                    r[it.id] = { rate: "", remarks: "" };
                });
                setRates(r);
            })
            .catch(() => setError("This link is invalid or has expired."))
            .finally(() => setLoading(false));
    };

    useEffect(load, [token]);

    const setRate = (itemId: string, patch: any) => setRates((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));

    const submit = async () => {
        if (!shopName.trim()) {
            setError("Please enter your shop name before submitting.");
            return;
        }
        const missing = items.some((it) => {
            const rate = rates[it.id]?.rate;
            return rate === undefined || rate === null || String(rate).trim() === "" || isNaN(Number(rate));
        });
        if (missing) {
            setError("Please enter a valid rate for every item before submitting.");
            return;
        }
        setError("");
        setSaving(true);
        try {
            const responses = items.map((it) => ({ itemId: it.id, rate: rates[it.id]?.rate || null, remarks: rates[it.id]?.remarks || "" }));
            const res = await apiFetch(`/api/fb/public/quotes/open/${token}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shopName: shopName.trim(), responses }),
            });
            if (!res.ok) throw new Error();
            setSubmitted(true);
        } catch {
            setError("Failed to submit. Please check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error && !quote) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <p className="text-sm text-muted-foreground">{error}</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <Card className="max-w-md w-full text-center">
                    <CardContent className="pt-10 pb-10 space-y-3">
                        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                        <h2 className="text-lg font-semibold">Quote Submitted</h2>
                        <p className="text-sm text-muted-foreground">Thank you, {shopName}. Your rates have been recorded.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-6">
            <div className="max-w-2xl mx-auto space-y-4">
                <Card>
                    <CardHeader className="text-center border-b pb-4">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                            <ReceiptText className="h-5 w-5" />
                            <span className="text-xs uppercase tracking-wide">Quote Request</span>
                        </div>
                        <CardTitle className="text-xl">{quote?.title}</CardTitle>
                        {quote?.description && <CardDescription>{quote.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="pt-4 space-y-1.5">
                        <Label>Your Shop / Company Name *</Label>
                        <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Enter your shop name" />
                    </CardContent>
                </Card>

                {items.map((it, idx) => (
                    <Card key={it.id}>
                        <CardContent className="pt-6 space-y-3">
                            <div>
                                <p className="text-xs text-muted-foreground">Item {idx + 1}</p>
                                <p className="font-semibold">{it.item_name}</p>
                                {(it.description || it.spec) && <p className="text-sm text-muted-foreground">{it.description || it.spec}</p>}
                                <p className="text-xs text-muted-foreground mt-1">Qty: {it.quantity} {it.uom}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Your Rate *</label>
                                    <Input type="number" inputMode="decimal" value={rates[it.id]?.rate ?? ""} onChange={(e) => setRate(it.id, { rate: e.target.value })} onWheel={(e) => (e.target as HTMLInputElement).blur()} placeholder="0.00" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Remarks</label>
                                    <Input value={rates[it.id]?.remarks ?? ""} onChange={(e) => setRate(it.id, { remarks: e.target.value })} placeholder="Optional" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <Button className="w-full" size="lg" onClick={submit} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Submit Quote
                </Button>
            </div>
        </div>
    );
}
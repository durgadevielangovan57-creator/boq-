import { useState, useEffect } from "react";
import { SupplierLayout } from "@/components/layout/SupplierLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReceiptText, ArrowLeft, Save, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import "../tenders-glass.css";

function QuoteFillView({ quoteId, onBack }: { quoteId: string; onBack: () => void }) {
    const { toast } = useToast();
    const [quote, setQuote] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [recipient, setRecipient] = useState<any>(null);
    const [rates, setRates] = useState<Record<string, { rate: string; remarks: string }>>({});
    const [saving, setSaving] = useState(false);

    const load = () => {
        apiFetch(`/api/fb/vendor/quotes/${quoteId}`)
            .then((r) => r.json())
            .then((d) => {
                setQuote(d.quote);
                setItems(d.items || []);
                setRecipient(d.recipient);
                const r: Record<string, { rate: string; remarks: string }> = {};
                (d.items || []).forEach((it: any) => {
                    const existing = (d.myResponses || []).find((x: any) => x.item_id === it.id);
                    r[it.id] = { rate: existing?.rate ?? "", remarks: existing?.remarks ?? "" };
                });
                setRates(r);
            })
            .catch(() => { });
    };

    useEffect(load, [quoteId]);

    const isSubmitted = recipient?.status === "Submitted";

    const setRate = (itemId: string, patch: any) => setRates((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));

    const save = async (submit: boolean) => {
        if (submit) {
            const missing = items.some((it) => {
                const rate = rates[it.id]?.rate;
                return rate === undefined || rate === null || String(rate).trim() === "" || isNaN(Number(rate));
            });
            if (missing) {
                toast({ title: "Missing rates", description: "Please enter a rate for every item before submitting.", variant: "destructive" });
                return;
            }
        }
        setSaving(true);
        try {
            const responses = items.map((it) => ({ itemId: it.id, rate: rates[it.id]?.rate || null, remarks: rates[it.id]?.remarks || "" }));
            const res = await apiFetch(`/api/fb/vendor/quotes/${quoteId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ responses, submit }),
            });
            if (!res.ok) throw new Error();
            toast({ title: submit ? "Quote submitted" : "Draft saved" });
            load();
        } catch {
            toast({ title: "Error", description: "Failed to save", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (!quote) return <p className="text-sm text-muted-foreground p-6">Loading...</p>;

    return (
        <Card className="tg-card tg-animate-in">
            <CardHeader className="flex flex-row items-start justify-between border-b pb-4">
                <div>
                    <CardTitle className="text-xl">{quote.title}</CardTitle>
                    <CardDescription>{quote.description}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="overflow-x-auto border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead>Spec</TableHead>
                                <TableHead>UOM</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Your Rate</TableHead>
                                <TableHead>Remarks</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((it) => (
                                <TableRow key={it.id}>
                                    <TableCell className="font-medium">{it.item_name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{it.description || it.spec || "—"}</TableCell>
                                    <TableCell>{it.uom || "—"}</TableCell>
                                    <TableCell>{it.quantity}</TableCell>
                                    <TableCell className="min-w-[120px]">
                                        <Input
                                            type="number"
                                            value={rates[it.id]?.rate ?? ""}
                                            onChange={(e) => setRate(it.id, { rate: e.target.value })}
                                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            disabled={isSubmitted}
                                            placeholder="Rate"
                                        />
                                    </TableCell>
                                    <TableCell className="min-w-[140px]">
                                        <Input
                                            value={rates[it.id]?.remarks ?? ""}
                                            onChange={(e) => setRate(it.id, { remarks: e.target.value })}
                                            disabled={isSubmitted}
                                            placeholder="Optional"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {!isSubmitted ? (
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" disabled={saving} onClick={() => save(false)}><Save className="w-4 h-4 mr-2" /> Save Draft</Button>
                        <Button disabled={saving} onClick={() => save(true)}><Send className="w-4 h-4 mr-2" /> Submit Quote</Button>
                    </div>
                ) : (
                    <Badge>Submitted</Badge>
                )}
            </CardContent>
        </Card>
    );
}

export default function SupplierQuoteFill() {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        apiFetch("/api/fb/vendor/quotes").then((r) => r.json()).then((d) => setQuotes(d.quotes || [])).catch(() => { }).finally(() => setLoading(false));
    }, []);

    return (
        <SupplierLayout>
            <div className="p-6 space-y-6 tg-page">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><ReceiptText className="h-6 w-6" /> Quotes</h1>
                    <p className="text-muted-foreground text-sm">Quotes sent to you — fill in your rates and submit.</p>
                </div>

                {activeId ? (
                    <QuoteFillView quoteId={activeId} onBack={() => setActiveId(null)} />
                ) : (
                    <Card className="tg-card">
                        <CardContent className="pt-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Quote #</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                                    ) : quotes.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No quotes yet.</TableCell></TableRow>
                                    ) : (
                                        quotes.map((q) => (
                                            <TableRow key={q.id}>
                                                <TableCell className="font-medium">{q.quote_number}</TableCell>
                                                <TableCell>{q.title}</TableCell>
                                                <TableCell><Badge variant={q.my_status === "Submitted" ? "default" : "secondary"}>{q.my_status}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" onClick={() => setActiveId(q.id)}>{q.my_status === "Submitted" ? "View" : "Fill Rates"}</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </SupplierLayout>
    );
}
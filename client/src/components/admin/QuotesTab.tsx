import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Plus, Trash2, Send, BarChart3, ArrowLeft, Search as SearchIcon, Upload, FileSpreadsheet,
    Download, Link as LinkIcon, Copy, Loader2, FolderKanban, Users, Package,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { MaterialPickerDialog, PickedMaterial } from "@/components/admin/MaterialPickerDialog";

function emptyItem() {
    return { itemName: "", description: "", uom: "", quantity: 1, spec: "" };
}

// ------------------------------------------------------------------
// Standard Quote Creation (manual items, material picker, Excel import)
// ------------------------------------------------------------------
function CreateQuoteDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
    const { toast } = useToast();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [validUntil, setValidUntil] = useState("");
    const [items, setItems] = useState<any[]>([emptyItem()]);
    const [saving, setSaving] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerForRow, setPickerForRow] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setTitle("");
            setDescription("");
            setValidUntil("");
            setItems([emptyItem()]);
        }
    }, [open]);

    const setItem = (idx: number, patch: any) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    const addItem = () => setItems((prev) => [...prev, emptyItem()]);
    const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

    const openPickerForRow = (idx: number) => {
        setPickerForRow(idx);
        setPickerOpen(true);
    };

    const onMaterialPicked = (m: PickedMaterial) => {
        if (pickerForRow === null) return;
        setItem(pickerForRow, { itemName: m.name, uom: m.unit || "", spec: m.description || m.category || "" });
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const wb = XLSX.read(data, { type: "binary" });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                const norm = (obj: any, keys: string[]) => {
                    for (const k of Object.keys(obj)) {
                        if (keys.includes(k.trim().toLowerCase())) return obj[k];
                    }
                    return "";
                };
                const imported = rows.map((row) => ({
                    itemName: norm(row, ["item", "item name", "material", "name"]),
                    description: norm(row, ["description"]),
                    spec: norm(row, ["spec", "specification"]),
                    uom: norm(row, ["uom", "unit"]),
                    quantity: Number(norm(row, ["qty", "quantity"])) || 1,
                })).filter((it) => it.itemName);
                if (imported.length === 0) {
                    toast({ title: "Nothing imported", description: "Couldn't find any rows with an Item Name column.", variant: "destructive" });
                    return;
                }
                setItems((prev) => {
                    const cleaned = prev.filter((p) => p.itemName.trim());
                    return [...cleaned, ...imported];
                });
                toast({ title: "Imported", description: `${imported.length} item(s) added from file.` });
            } catch {
                toast({ title: "Error", description: "Failed to read the file. Use .xlsx or .csv with Item Name/UOM/Quantity columns.", variant: "destructive" });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsBinaryString(file);
    };

    const create = async () => {
        if (!title.trim() || items.some((i) => !i.itemName.trim())) {
            toast({ title: "Missing info", description: "Title and every item name are required.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const res = await apiFetch("/api/fb/quotes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description, validUntil: validUntil || null, items }),
            });
            if (!res.ok) throw new Error();
            toast({ title: "Quote created" });
            onOpenChange(false);
            onCreated();
        } catch {
            toast({ title: "Error", description: "Failed to create quote", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>New Quote</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Title</Label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cement & Steel Rate Quote" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Valid Until</Label>
                                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes for the vendor" />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Items — vendor will only fill in the Rate</Label>
                                <div>
                                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="h-3.5 w-3.5 mr-1" /> Import from Excel
                                    </Button>
                                </div>
                            </div>
                            <div className="overflow-x-auto border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead>Spec</TableHead>
                                            <TableHead>UOM</TableHead>
                                            <TableHead>Quantity</TableHead>
                                            <TableHead className="w-10" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((it, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="min-w-[200px]">
                                                    <div className="flex items-center gap-1">
                                                        <Input value={it.itemName} onChange={(e) => setItem(idx, { itemName: e.target.value })} placeholder="Item name" />
                                                        <Button type="button" variant="outline" size="icon" className="shrink-0" title="Pick from Materials Master" onClick={() => openPickerForRow(idx)}>
                                                            <SearchIcon className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="min-w-[160px]"><Input value={it.spec} onChange={(e) => setItem(idx, { spec: e.target.value })} placeholder="Specification" /></TableCell>
                                                <TableCell className="min-w-[100px]"><Input value={it.uom} onChange={(e) => setItem(idx, { uom: e.target.value })} placeholder="e.g. Kg" /></TableCell>
                                                <TableCell className="min-w-[100px]"><Input type="number" value={it.quantity} onChange={(e) => setItem(idx, { quantity: e.target.value })} /></TableCell>
                                                <TableCell>
                                                    {items.length > 1 && (
                                                        <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
                            <p className="text-xs text-muted-foreground">Tip: click the search icon next to an item to pick it straight from the Materials Master (auto-fills unit &amp; spec).</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={create} disabled={saving}>Create Quote</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <MaterialPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={onMaterialPicked} />
        </>
    );
}

// ------------------------------------------------------------------
// Project Comparison Quote (2nd quote type): pick up to 4 projects,
// pick vendors, pick materials (searchable), create + send in one go.
// ------------------------------------------------------------------
function ProjectComparisonQuoteDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
    const { toast } = useToast();
    const [title, setTitle] = useState("");
    const [projects, setProjects] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
    const [materials, setMaterials] = useState<(PickedMaterial & { quantity: number })[]>([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resultLinks, setResultLinks] = useState<{ vendorId: string; vendorName: string; link: string }[] | null>(null);

    useEffect(() => {
        if (!open) return;
        setTitle("");
        setSelectedProjects([]);
        setSelectedVendors([]);
        setMaterials([]);
        setResultLinks(null);
        apiFetch("/api/fb/projects").then((r) => r.json()).then((d) => setProjects(d.projects || [])).catch(() => { });
        apiFetch("/api/fb/vendors").then((r) => r.json()).then((d) => setVendors(d.vendors || [])).catch(() => { });
    }, [open]);

    const toggleProject = (id: string) => {
        setSelectedProjects((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            if (prev.length >= 4) {
                toast({ title: "Limit reached", description: "You can select up to 4 projects at a time.", variant: "destructive" });
                return prev;
            }
            return [...prev, id];
        });
    };

    const toggleVendor = (id: string) => setSelectedVendors((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const onMaterialsPicked = (items: PickedMaterial[]) => {
        setMaterials((prev) => [...prev, ...items.map((m) => ({ ...m, quantity: 1 }))]);
    };

    const setMaterialQty = (idx: number, qty: number) => setMaterials((prev) => prev.map((m, i) => (i === idx ? { ...m, quantity: qty } : m)));
    const removeMaterial = (idx: number) => setMaterials((prev) => prev.filter((_, i) => i !== idx));

    const createAndSend = async () => {
        if (!title.trim() || selectedProjects.length === 0 || selectedVendors.length === 0 || materials.length === 0) {
            toast({ title: "Missing info", description: "Title, at least one project, one vendor, and one material are required.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const projectNames = projects.filter((p) => selectedProjects.includes(p.id)).map((p) => p.name);
            const createRes = await apiFetch("/api/fb/quotes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description: `Project comparison quote for: ${projectNames.join(", ")}`,
                    quoteKind: "project_comparison",
                    projectIds: selectedProjects,
                    items: materials.map((m) => ({ itemName: m.name, uom: m.unit, spec: m.description || m.category, quantity: m.quantity })),
                }),
            });
            if (!createRes.ok) throw new Error();
            const { quote } = await createRes.json();

            const sendRes = await apiFetch(`/api/fb/quotes/${quote.id}/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vendorIds: selectedVendors }),
            });
            if (!sendRes.ok) throw new Error();
            const { links } = await sendRes.json();

            const built = Object.entries(links as Record<string, string>).map(([vendorId, token]) => {
                const v = vendors.find((x) => x.id === vendorId);
                return { vendorId, vendorName: v?.fullName || v?.username || vendorId, link: `${window.location.origin}/q/${token}` };
            });
            setResultLinks(built);
            toast({ title: "Quote created & sent", description: `Sent to ${selectedVendors.length} vendor(s).` });
            onCreated();
        } catch {
            toast({ title: "Error", description: "Failed to create/send this quote", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Project Comparison Quote</DialogTitle>
                </DialogHeader>

                {resultLinks ? (
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">Share these links with each vendor — no login needed, works on mobile, just fill &amp; submit.</p>
                        {resultLinks.map((l) => (
                            <div key={l.vendorId} className="flex items-center justify-between border rounded-md p-2">
                                <div>
                                    <p className="text-sm font-medium">{l.vendorName}</p>
                                    <p className="text-xs text-muted-foreground break-all">{l.link}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(l.link); toast({ title: "Copied" }); }}>
                                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                                </Button>
                            </div>
                        ))}
                        <DialogFooter>
                            <Button onClick={() => onOpenChange(false)}>Done</Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label>Quote Title</Label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 Steel Comparison" />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold flex items-center gap-1.5"><FolderKanban className="h-4 w-4" /> Select Projects (up to 4)</Label>
                                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border rounded-md p-2">
                                    {projects.map((p) => (
                                        <label key={p.id} className="flex items-center gap-2 text-sm border rounded-md p-2 cursor-pointer">
                                            <Checkbox checked={selectedProjects.includes(p.id)} onCheckedChange={() => toggleProject(p.id)} />
                                            <span className="flex-1">{p.name} {p.client ? <span className="text-muted-foreground">({p.client})</span> : ""}</span>
                                            {p.has_final_bom && <Badge variant="secondary" className="text-[10px]">Final BOM</Badge>}
                                        </label>
                                    ))}
                                    {projects.length === 0 && <p className="text-xs text-muted-foreground col-span-2 text-center py-4">No projects found.</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold flex items-center gap-1.5"><Users className="h-4 w-4" /> Select Vendors</Label>
                                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border rounded-md p-2">
                                    {vendors.map((v) => (
                                        <label key={v.id} className="flex items-center gap-2 text-sm border rounded-md p-2 cursor-pointer">
                                            <Checkbox checked={selectedVendors.includes(v.id)} onCheckedChange={() => toggleVendor(v.id)} />
                                            <span>{v.fullName || v.username} {v.companyName ? <span className="text-muted-foreground">({v.companyName})</span> : ""}</span>
                                        </label>
                                    ))}
                                    {vendors.length === 0 && <p className="text-xs text-muted-foreground col-span-2 text-center py-4">No vendors found.</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold flex items-center gap-1.5"><Package className="h-4 w-4" /> Select Materials</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                                        <SearchIcon className="h-3.5 w-3.5 mr-1" /> Search &amp; Add Materials
                                    </Button>
                                </div>
                                {materials.length > 0 && (
                                    <div className="overflow-x-auto border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Material</TableHead>
                                                    <TableHead>Unit</TableHead>
                                                    <TableHead>Qty</TableHead>
                                                    <TableHead className="w-10" />
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {materials.map((m, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium">{m.name}</TableCell>
                                                        <TableCell>{m.unit || "—"}</TableCell>
                                                        <TableCell className="w-24">
                                                            <Input type="number" value={m.quantity} onChange={(e) => setMaterialQty(idx, Number(e.target.value))} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" onClick={() => removeMaterial(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={createAndSend} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                                Create &amp; Send
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
            <MaterialPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} multiple onPickMultiple={onMaterialsPicked} />
        </Dialog>
    );
}

function SendQuoteDialog({ quote, open, onOpenChange, onSent }: { quote: any; open: boolean; onOpenChange: (o: boolean) => void; onSent: () => void }) {
    const { toast } = useToast();
    const [vendors, setVendors] = useState<any[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [resultLinks, setResultLinks] = useState<{ vendorId: string; vendorName: string; link: string }[] | null>(null);

    useEffect(() => {
        if (open) {
            apiFetch("/api/fb/vendors").then((r) => r.json()).then((d) => setVendors(d.vendors || [])).catch(() => { });
            setSelected([]);
            setResultLinks(null);
        }
    }, [open]);

    const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const send = async () => {
        if (selected.length === 0) {
            toast({ title: "Select at least one vendor", variant: "destructive" });
            return;
        }
        const res = await apiFetch(`/api/fb/quotes/${quote.id}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendorIds: selected }),
        });
        if (res.ok) {
            const { links } = await res.json();
            const built = Object.entries(links as Record<string, string>).map(([vendorId, token]) => {
                const v = vendors.find((x) => x.id === vendorId);
                return { vendorId, vendorName: v?.fullName || v?.username || vendorId, link: `${window.location.origin}/q/${token}` };
            });
            setResultLinks(built);
            toast({ title: "Quote sent", description: `Sent to ${selected.length} vendor(s).` });
            onSent();
        } else {
            toast({ title: "Error", description: "Failed to send quote", variant: "destructive" });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Send Quote to Vendors</DialogTitle></DialogHeader>
                {resultLinks ? (
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">Share these links — no login needed, works on mobile.</p>
                        {resultLinks.map((l) => (
                            <div key={l.vendorId} className="flex items-center justify-between border rounded-md p-2">
                                <div>
                                    <p className="text-sm font-medium">{l.vendorName}</p>
                                    <p className="text-xs text-muted-foreground break-all">{l.link}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(l.link); toast({ title: "Copied" }); }}>
                                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                                </Button>
                            </div>
                        ))}
                        <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2 py-2">
                            {vendors.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No vendors found.</p>
                            ) : (
                                vendors.map((v) => (
                                    <div key={v.id} className="flex items-center gap-2 border rounded-md p-2">
                                        <Checkbox checked={selected.includes(v.id)} onCheckedChange={() => toggle(v.id)} />
                                        <div>
                                            <p className="text-sm font-medium">{v.fullName || v.username}</p>
                                            {v.companyName && <p className="text-xs text-muted-foreground">{v.companyName}</p>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={send}><Send className="h-4 w-4 mr-1" /> Send</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function QuoteComparisonView({ quoteId, onBack }: { quoteId: string; onBack: () => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [responses, setResponses] = useState<any[]>([]);
    const [quote, setQuote] = useState<any>(null);
    const [recipients, setRecipients] = useState<any[]>([]);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        apiFetch(`/api/fb/quotes/${quoteId}`).then((r) => r.json()).then((d) => { setQuote(d.quote); setRecipients(d.recipients || []); });
        apiFetch(`/api/fb/quotes/${quoteId}/comparison`).then((r) => r.json()).then((d) => { setItems(d.items || []); setResponses(d.responses || []); });
    }, [quoteId]);

    const vendorIds = Array.from(new Set(responses.map((r) => r.vendor_id)));
    const vendorLabel = (vid: string) => {
        const r = responses.find((x) => x.vendor_id === vid);
        return r?.full_name || r?.username || vid;
    };

    const downloadExcel = () => {
        const rows = items.map((it) => {
            const row: Record<string, any> = { Item: it.item_name, Qty: it.quantity, UOM: it.uom };
            vendorIds.forEach((vid) => {
                const r = responses.find((x) => x.item_id === it.id && x.vendor_id === vid);
                row[vendorLabel(vid)] = r?.rate ?? "";
            });
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Comparison");
        XLSX.writeFile(wb, `${quote?.title || "Quote"}-Comparison.xlsx`);
    };

    const downloadPdf = () => {
        const el = document.getElementById("quote-comparison-content");
        if (!el) return;
        setDownloading(true);
        html2pdf()
            .set({
                margin: 10,
                filename: `${quote?.title || "Quote"}-Comparison.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: "mm", format: "a4", orientation: "landscape" as const },
            })
            .from(el)
            .save()
            .then(() => setDownloading(false))
            .catch(() => setDownloading(false));
    };

    return (
        <Card className="tg-card">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Rate Comparison — {quote?.title}</CardTitle>
                    <CardDescription>Compare rates submitted by each vendor for this quote.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={downloadExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
                    <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloading}>
                        {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} PDF
                    </Button>
                    <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                </div>
            </CardHeader>
            <CardContent>
                {recipients.some((r) => r.token) && (
                    <div className="mb-4 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">Shareable links sent to vendors:</p>
                        {recipients.filter((r) => r.token).map((r) => (
                            <div key={r.id} className="flex items-center gap-2 text-xs">
                                <LinkIcon className="h-3 w-3 text-muted-foreground" />
                                <span>{r.full_name || r.username}:</span>
                                <code className="bg-muted px-1 rounded">{`${window.location.origin}/q/${r.token}`}</code>
                                <Button
                                    variant="ghost" size="icon" className="h-5 w-5"
                                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/q/${r.token}`)}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
                <div id="quote-comparison-content" className="bg-white">
                    {vendorIds.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No vendor has responded yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Qty</TableHead>
                                        {vendorIds.map((vid) => (<TableHead key={vid}>{vendorLabel(vid)}</TableHead>))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((it) => (
                                        <TableRow key={it.id}>
                                            <TableCell className="font-medium">{it.item_name}</TableCell>
                                            <TableCell>{it.quantity} {it.uom}</TableCell>
                                            {vendorIds.map((vid) => {
                                                const r = responses.find((x) => x.item_id === it.id && x.vendor_id === vid);
                                                return <TableCell key={vid}>{r?.rate != null ? `₹${r.rate} (₹${r.amount})` : "—"}</TableCell>;
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Drop this in as a tab anywhere (e.g. inside Form Builder) - no page/Layout wrapper of its own.
export function QuotesTab() {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [projectQuoteOpen, setProjectQuoteOpen] = useState(false);
    const [sendTarget, setSendTarget] = useState<any>(null);
    const [comparisonId, setComparisonId] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        apiFetch("/api/fb/quotes").then((r) => r.json()).then((d) => setQuotes(d.quotes || [])).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(load, []);

    const remove = async (id: string) => {
        if (!confirm("Delete this quote?")) return;
        await apiFetch(`/api/fb/quotes/${id}`, { method: "DELETE" });
        load();
    };

    if (comparisonId) {
        return <QuoteComparisonView quoteId={comparisonId} onBack={() => setComparisonId(null)} />;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setProjectQuoteOpen(true)}>
                    <FolderKanban className="h-4 w-4 mr-1" /> Project Comparison Quote
                </Button>
                <Button className="tg-create-btn" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Quote</Button>
            </div>

            <Card className="tg-card">
                <CardHeader>
                    <CardTitle>All Quotes</CardTitle>
                    <CardDescription>Build a quote with your items, send it to vendors, and let them simply fill in their rates.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Quote #</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Sent / Submitted</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                            ) : quotes.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No quotes yet.</TableCell></TableRow>
                            ) : (
                                quotes.map((q) => (
                                    <TableRow key={q.id}>
                                        <TableCell className="font-medium">{q.quote_number}</TableCell>
                                        <TableCell>{q.title}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {q.quote_kind === "project_comparison" ? "Project Comparison" : "Standard"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell><Badge variant={q.status === "Draft" ? "secondary" : "default"}>{q.status}</Badge></TableCell>
                                        <TableCell>{q.recipient_count || 0} / {q.submitted_count || 0}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="outline" size="sm" onClick={() => setSendTarget(q)}><Send className="h-3.5 w-3.5 mr-1" /> Send</Button>
                                            <Button variant="outline" size="sm" onClick={() => setComparisonId(q.id)}><BarChart3 className="h-3.5 w-3.5 mr-1" /> Compare</Button>
                                            <Button variant="ghost" size="icon" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <CreateQuoteDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
            <ProjectComparisonQuoteDialog open={projectQuoteOpen} onOpenChange={setProjectQuoteOpen} onCreated={load} />
            {sendTarget && <SendQuoteDialog quote={sendTarget} open={!!sendTarget} onOpenChange={(o) => !o && setSendTarget(null)} onSent={load} />}
        </div>
    );
}
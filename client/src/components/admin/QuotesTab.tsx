import { useState, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
    Download, Link as LinkIcon, Copy, Loader2, FolderKanban, Users, Package, Save, Check, ChevronsUpDown, X
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { MaterialPickerDialog, PickedMaterial } from "./MaterialPickerDialog";

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
// Project Comparison Quote (2nd quote type - fully separate from the
// standard quote flow above, nothing here touches it):
//
// Select up to 4 projects at once (side by side) -> for each project,
// only the shops actually sourced in its FINALIZED BOM version are
// listed -> pick a shop -> only that shop's materials from that BOM
// are listed (searchable) -> pick materials -> Create & Send, which
// auto-generates a no-login public link per vendor.
// ------------------------------------------------------------------
type BomShop = { key: string; shopId: string | null; shopName: string; itemCount: number; vendorId: string | null; vendorName: string | null; vendorCompany: string | null };
type BomMaterial = { materialId: string | null; name: string; unit: string; spec: string; quantity: number };

function ProjectComparisonQuoteDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
    const { toast } = useToast();
    const [title, setTitle] = useState("");
    const [projects, setProjects] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]); // fallback / manual "send to" list
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [resultLinks, setResultLinks] = useState<{ vendorId: string; vendorName: string; link: string }[] | null>(null);

    // projectId -> { loading, hasFinalBom, shops }
    const [bomByProject, setBomByProject] = useState<Record<string, { loading: boolean; hasFinalBom: boolean; shops: BomShop[] }>>({});
    // projectId -> [shopKey, ...] selected shops for that project
    const [selectedShops, setSelectedShops] = useState<Record<string, string[]>>({});
    // `${projectId}::${shopKey}` -> { loading, materials }
    const [materialsByShop, setMaterialsByShop] = useState<Record<string, { loading: boolean; materials: BomMaterial[] }>>({});
    // `${projectId}::${shopKey}` -> Set of picked material keys (materialId || name)
    const [pickedByShop, setPickedByShop] = useState<Record<string, Set<string>>>({});
    // `${projectId}::${shopKey}::${materialKey}` -> quantity override
    const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
    // `${projectId}::${shopKey}` -> search text
    const [searchByShop, setSearchByShop] = useState<Record<string, string>>({});

    const fk = (projectId: string, shopKey: string) => `${projectId}::${shopKey}`;

    useEffect(() => {
        if (!open) return;
        setTitle("");
        setSelectedProjects([]);
        setSelectedVendors([]);
        setBomByProject({});
        setSelectedShops({});
        setMaterialsByShop({});
        setPickedByShop({});
        setQtyOverrides({});
        setSearchByShop({});
        setResultLinks(null);
        apiFetch("/api/fb/projects").then((r) => r.json()).then((d) => setProjects(d.projects || [])).catch(() => { });
        apiFetch("/api/fb/vendors").then((r) => r.json()).then((d) => setVendors(d.vendors || [])).catch(() => { });
    }, [open]);

    const loadShopsForProject = (projectId: string) => {
        setBomByProject((prev) => ({ ...prev, [projectId]: { loading: true, hasFinalBom: false, shops: [] } }));
        apiFetch(`/api/fb/projects/${projectId}/bom-shops`)
            .then((r) => r.json())
            .then((d) => setBomByProject((prev) => ({ ...prev, [projectId]: { loading: false, hasFinalBom: !!d.hasFinalBom, shops: d.shops || [] } })))
            .catch(() => setBomByProject((prev) => ({ ...prev, [projectId]: { loading: false, hasFinalBom: false, shops: [] } })));
    };

    const toggleProject = (id: string) => {
        setSelectedProjects((prev) => {
            if (prev.includes(id)) {
                setSelectedShops((sp) => { const n = { ...sp }; delete n[id]; return n; });
                return prev.filter((x) => x !== id);
            }
            if (prev.length >= 4) {
                toast({ title: "Limit reached", description: "You can select up to 4 projects at a time.", variant: "destructive" });
                return prev;
            }
            if (!bomByProject[id]) loadShopsForProject(id);
            return [...prev, id];
        });
    };

    const toggleShop = (projectId: string, shop: BomShop) => {
        setSelectedShops((prev) => {
            const cur = prev[projectId] || [];
            const next = cur.includes(shop.key) ? cur.filter((x) => x !== shop.key) : [...cur, shop.key];
            return { ...prev, [projectId]: next };
        });
        const key = fk(projectId, shop.key);
        const alreadyLoaded = materialsByShop[key]?.materials?.length > 0;
        if (!alreadyLoaded) {
            setMaterialsByShop((prev) => ({ ...prev, [key]: { loading: true, materials: [] } }));
            apiFetch(`/api/fb/projects/${projectId}/bom-materials?shop=${encodeURIComponent(shop.key)}`)
                .then((r) => r.json())
                .then((d) => setMaterialsByShop((prev) => ({ ...prev, [key]: { loading: false, materials: d.materials || [] } })))
                .catch(() => setMaterialsByShop((prev) => ({ ...prev, [key]: { loading: false, materials: [] } })));
        }
        // If this shop's owner has a real vendor login, pre-select them to send to (still editable below).
        if (shop.vendorId) setSelectedVendors((prev) => (prev.includes(shop.vendorId!) ? prev : [...prev, shop.vendorId!]));
    };

    const toggleMaterial = (projectId: string, shopKey: string, materialKey: string) => {
        const key = fk(projectId, shopKey);
        setPickedByShop((prev) => {
            const set = new Set(prev[key] || []);
            if (set.has(materialKey)) set.delete(materialKey); else set.add(materialKey);
            return { ...prev, [key]: set };
        });
    };

    const toggleVendor = (id: string) => setSelectedVendors((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    // Flatten everything picked, across all 4 project columns, into quote line items.
    const buildItems = () => {
        const items: { itemName: string; uom: string; spec: string; quantity: number; description: string }[] = [];
        for (const projectId of selectedProjects) {
            const project = projects.find((p) => p.id === projectId);
            for (const shopKey of selectedShops[projectId] || []) {
                const key = fk(projectId, shopKey);
                const shop = (bomByProject[projectId]?.shops || []).find((s) => s.key === shopKey);
                const mats = materialsByShop[key]?.materials || [];
                const picked = pickedByShop[key] || new Set<string>();
                mats.forEach((m) => {
                    const mKey = m.materialId || m.name;
                    if (!picked.has(mKey)) return;
                    const qtyKey = `${key}::${mKey}`;
                    items.push({
                        itemName: m.name,
                        uom: m.unit || "",
                        spec: m.spec || "",
                        quantity: qtyOverrides[qtyKey] ?? m.quantity ?? 1,
                        description: `${project?.name || "Project"} • ${shop?.shopName || "Shop"}`,
                    });
                });
            }
        }
        return items;
    };

    const totalPicked = selectedProjects.reduce((sum, pid) => sum + (selectedShops[pid] || []).reduce((s2, sk) => s2 + (pickedByShop[fk(pid, sk)]?.size || 0), 0), 0);

    const createQuote = async () => {
        if (!title.trim() || selectedProjects.length === 0) {
            return toast({ title: "Validation Error", description: "Title and at least 1 project are required.", variant: "destructive" });
        }
        const items = buildItems();
        if (items.length === 0) {
            return toast({ title: "Validation Error", description: "Select at least 1 material.", variant: "destructive" });
        }
        setSaving(true);
        try {
            const createRes = await apiFetch("/api/fb/quotes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description: `Project comparison quote`,
                    quoteKind: "project_comparison",
                    projectIds: selectedProjects,
                    items,
                }),
            });
            if (!createRes.ok) throw new Error();

            toast({ title: "Quote created", description: `Project comparison quote created successfully.` });
            onCreated();
            onOpenChange(false);
        } catch {
            toast({ title: "Error", description: "Failed to create this quote", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-screen h-screen max-w-none max-h-none flex flex-col overflow-hidden m-0 rounded-none">
                <DialogHeader>
                    <DialogTitle>Project Comparison Quote</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-2">
                            <div className="space-y-1.5">
                                <Label>Quote Title</Label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 Steel Comparison" />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold flex items-center gap-1.5"><FolderKanban className="h-4 w-4" /> Select Projects (up to 4)</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between font-normal">
                                            {selectedProjects.length > 0 ? `${selectedProjects.length} project(s) selected` : "Select projects..."}
                                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search projects..." />
                                            <CommandList>
                                                <CommandEmpty>No project found.</CommandEmpty>
                                                <CommandGroup>
                                                    {projects.map((p) => (
                                                        <CommandItem
                                                            key={p.id}
                                                            onSelect={() => toggleProject(p.id)}
                                                        >
                                                            <Check className={`mr-2 h-4 w-4 ${selectedProjects.includes(p.id) ? "opacity-100" : "opacity-0"}`} />
                                                            <span className="flex-1 truncate">{p.name} {p.client ? <span className="text-muted-foreground">({p.client})</span> : ""}</span>
                                                            {p.has_final_bom && <Badge variant="secondary" className="text-[10px] ml-2">Final BOM</Badge>}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {selectedProjects.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {selectedProjects.map(id => {
                                            const p = projects.find(x => x.id === id);
                                            return p ? (
                                                <Badge key={id} variant="secondary" className="text-sm py-1 px-2 flex items-center gap-1 bg-secondary/40">
                                                    {p.name}
                                                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => toggleProject(id)} />
                                                </Badge>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>

                            {selectedProjects.length > 0 && (
                                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                                    {/* Top Section: Available Shops */}
                                    <div className="space-y-2 shrink-0">
                                        <Label className="text-sm font-semibold flex items-center gap-1.5"><FolderKanban className="h-4 w-4" /> Available Shops from Selected Projects</Label>
                                        <div className="flex flex-wrap gap-4 border rounded-md p-3 bg-secondary/5 max-h-[160px] overflow-y-auto">
                                            {selectedProjects.map((projectId) => {
                                                const project = projects.find((p) => p.id === projectId);
                                                const bom = bomByProject[projectId];
                                                if (!bom) return null;
                                                return (
                                                    <div key={projectId} className="space-y-1.5 min-w-[200px] flex-1 max-w-[300px]">
                                                        <p className="text-xs font-semibold text-muted-foreground truncate" title={project?.name}>{project?.name}</p>
                                                        {bom.loading ? (
                                                            <p className="text-xs">Loading...</p>
                                                        ) : !bom.hasFinalBom ? (
                                                            <p className="text-[11px] text-muted-foreground">No finalized BOM.</p>
                                                        ) : bom.shops.length === 0 ? (
                                                            <p className="text-[11px] text-muted-foreground">No shops.</p>
                                                        ) : (
                                                            <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto pr-1">
                                                                {bom.shops.map(shop => {
                                                                    const isChecked = (selectedShops[projectId] || []).includes(shop.key);
                                                                    return (
                                                                        <label key={shop.key} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-secondary/20 p-1 rounded">
                                                                            <Checkbox checked={isChecked} onCheckedChange={() => toggleShop(projectId, shop)} />
                                                                            <span className="truncate flex-1" title={shop.shopName}>{shop.vendorName ? `${shop.vendorName} ` : ""}({shop.shopName})</span>
                                                                            <Badge variant="outline" className="text-[9px] shrink-0 bg-background">{shop.itemCount}</Badge>
                                                                        </label>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Bottom Section: Selected Shops Grid */}
                                    <div className="space-y-2 flex-1 flex flex-col min-h-0">
                                        <div className="flex items-center justify-between shrink-0">
                                            <Label className="text-sm font-semibold flex items-center gap-1.5"><Package className="h-4 w-4" /> Selected Shops &amp; Materials to Compare</Label>
                                            <p className="text-xs text-muted-foreground">{totalPicked} material line(s) selected.</p>
                                        </div>
                                        <div className="grid gap-3 flex-1 overflow-y-auto items-start grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-4 px-1">
                                            {selectedProjects.flatMap(projectId => {
                                                const project = projects.find(p => p.id === projectId);
                                                const bom = bomByProject[projectId];
                                                if (!bom || !bom.shops) return [];
                                                
                                                return bom.shops.filter(shop => (selectedShops[projectId] || []).includes(shop.key)).map(shop => {
                                                    const key = fk(projectId, shop.key);
                                                    const matState = materialsByShop[key];
                                                    const search = (searchByShop[key] || "").toLowerCase();
                                                    const filteredMats = (matState?.materials || []).filter((m) => !search || m.name.toLowerCase().includes(search));
                                                    const picked = pickedByShop[key] || new Set<string>();
                                                    
                                                    return (
                                                        <div key={key} className="border rounded-md p-2 space-y-2 flex flex-col bg-card shadow-sm h-[400px]">
                                                            <div className="flex flex-col space-y-1 border-b pb-2 shrink-0">
                                                                <p className="text-[10px] font-semibold text-muted-foreground truncate uppercase tracking-wider" title={project?.name}>{project?.name}</p>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-bold truncate flex-1 pr-2" title={shop.shopName}>
                                                                        {shop.vendorName ? `${shop.vendorName} ` : ""}({shop.shopName})
                                                                    </span>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => toggleShop(projectId, shop)}>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div className="relative shrink-0">
                                                                <SearchIcon className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                                <Input
                                                                    className="h-8 pl-7 text-xs bg-secondary/10"
                                                                    placeholder="Search materials…"
                                                                    value={searchByShop[key] || ""}
                                                                    onChange={(e) => setSearchByShop((prev) => ({ ...prev, [key]: e.target.value }))}
                                                                />
                                                            </div>
                                                            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                                                                {matState?.loading ? (
                                                                    <div className="flex items-center justify-center h-20">
                                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                                    </div>
                                                                ) : filteredMats.length === 0 ? (
                                                                    <p className="text-xs text-muted-foreground text-center py-4">No materials found.</p>
                                                                ) : (
                                                                    filteredMats.map((m) => {
                                                                        const mKey = m.materialId || m.name;
                                                                        const qtyKey = `${key}::${mKey}`;
                                                                        const isPicked = picked.has(mKey);
                                                                        return (
                                                                            <label key={mKey} className={`flex items-start gap-2 text-xs p-1.5 rounded-md cursor-pointer border transition-colors ${isPicked ? 'bg-primary/5 border-primary/30' : 'hover:bg-secondary/20 border-transparent'}`}>
                                                                                <Checkbox className="mt-0.5" checked={isPicked} onCheckedChange={() => toggleMaterial(projectId, shop.key, mKey)} />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="truncate font-medium text-[11px]" title={m.name}>{m.name}</p>
                                                                                    <p className="text-[10px] text-muted-foreground truncate" title={m.spec}>{m.spec || "No spec"} • {m.unit || "—"}</p>
                                                                                </div>
                                                                                {isPicked && (
                                                                                    <Input
                                                                                        type="number"
                                                                                        className="h-6 w-16 text-[11px] px-1 bg-background shrink-0 text-center"
                                                                                        value={qtyOverrides[qtyKey] ?? m.quantity}
                                                                                        onChange={(e) => setQtyOverrides((prev) => ({ ...prev, [qtyKey]: Number(e.target.value) }))}
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                    />
                                                                                )}
                                                                            </label>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })}
                                            {totalPicked === 0 && selectedProjects.length > 0 && Object.keys(selectedShops).length === 0 && (
                                                <div className="col-span-full text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
                                                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm">Select shops from the available list above to view their materials.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter className="mt-4 shrink-0">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={createQuote} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                Create Quote
                            </Button>
                        </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SendQuoteDialog({ quote, open, onOpenChange, onSent }: { quote: any; open: boolean; onOpenChange: (o: boolean) => void; onSent: () => void }) {
    const { toast } = useToast();
    const [vendors, setVendors] = useState<any[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [existingLinks, setExistingLinks] = useState<{ vendorId: string; vendorName: string; link: string }[]>([]);
    const [loading, setLoading] = useState(false);

    const buildLink = (token: string) => `${window.location.origin}/q/${token}`;

    const load = () => {
        setLoading(true);
        Promise.all([
            apiFetch("/api/fb/vendors").then((r) => r.json()),
            apiFetch(`/api/fb/quotes/${quote.id}`).then((r) => r.json()),
        ])
            .then(([vendorsRes, quoteRes]) => {
                setVendors(vendorsRes.vendors || []);
                const links = (quoteRes.recipients || [])
                    .filter((r: any) => !!r.token)
                    .map((r: any) => ({
                        vendorId: r.vendor_id,
                        vendorName: r.full_name || r.username || r.vendor_id,
                        link: buildLink(r.token),
                    }));
                setExistingLinks(links);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (open) {
            setSelected([]);
            load();
        }
    }, [open, quote?.id]);

    // Don't re-offer vendors that already have a link - keep the checkbox list for new recipients only.
    const alreadySentIds = new Set(existingLinks.map((l) => l.vendorId));
    const availableVendors = vendors.filter((v) => !alreadySentIds.has(v.id));

    const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const copyLink = (link: string) => {
        navigator.clipboard.writeText(link);
        toast({ title: "Copied" });
    };

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
            toast({ title: "Quote sent", description: `Sent to ${selected.length} vendor(s).` });
            setSelected([]);
            load(); // reload so the newly sent vendors show up with a Copy button too
            onSent();
        } else {
            toast({ title: "Error", description: "Failed to send quote", variant: "destructive" });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Send Quote to Vendors</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    {existingLinks.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Already sent — copy &amp; share anytime</Label>
                            <div className="space-y-2">
                                {existingLinks.map((l) => (
                                    <div key={l.vendorId} className="flex items-center justify-between border rounded-md p-2">
                                        <div>
                                            <p className="text-sm font-medium">{l.vendorName}</p>
                                            <p className="text-xs text-muted-foreground break-all">{l.link}</p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => copyLink(l.link)}>
                                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">{existingLinks.length > 0 ? "Send to more vendors" : "Select vendors"}</Label>
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : availableVendors.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{existingLinks.length > 0 ? "Sent to every vendor already." : "No vendors found."}</p>
                        ) : (
                            availableVendors.map((v) => (
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
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    {availableVendors.length > 0 && (
                        <Button onClick={send}><Send className="h-4 w-4 mr-1" /> Send</Button>
                    )}
                </DialogFooter>
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
    const pdfRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        apiFetch(`/api/fb/quotes/${quoteId}`).then((r) => r.json()).then((d) => { setQuote(d.quote); setRecipients(d.recipients || []); });
        apiFetch(`/api/fb/quotes/${quoteId}/comparison`).then((r) => r.json()).then((d) => { setItems(d.items || []); setResponses(d.responses || []); });
    }, [quoteId]);

    const vendorIds = Array.from(new Set(responses.map((r) => r.vendor_id)));
    const vendorLabel = (vid: string) => {
        const r = responses.find((x) => x.vendor_id === vid);
        return r?.full_name || r?.username || vid;
    };

    // Lowest rate per item, so the PDF/screen can flag the best price for each row.
    const lowestVendorForItem = (itemId: string): string | null => {
        let best: { vid: string; rate: number } | null = null;
        for (const vid of vendorIds) {
            const r = responses.find((x) => x.item_id === itemId && x.vendor_id === vid);
            if (r?.rate == null) continue;
            const rate = Number(r.rate);
            if (!best || rate < best.rate) best = { vid, rate };
        }
        return best?.vid ?? null;
    };

    const downloadExcel = () => {
        const rows = items.map((it) => {
            const row: Record<string, any> = { Item: it.item_name, Qty: it.quantity, UOM: it.uom };
            vendorIds.forEach((vid) => {
                const r = responses.find((x) => x.item_id === it.id && x.vendor_id === vid);
                const vName = vendorLabel(vid);
                row[`${vName} - Rate`] = r?.rate ?? "";
                row[`${vName} - Amount`] = r?.amount ?? "";
            });
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Comparison");
        XLSX.writeFile(wb, `${quote?.title || "Quote"}-Comparison.xlsx`);
    };

    const downloadPdf = () => {
        const el = pdfRef.current;
        if (!el) return;
        setDownloading(true);
        const orientation: "landscape" | "portrait" = vendorIds.length > 2 ? "landscape" : "portrait";
        const pdfOptions: any = {
            margin: [10, 8, 10, 8],
            filename: `${quote?.title || "Quote"}-Comparison.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
            jsPDF: { unit: "mm", format: "a4", orientation },
            pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        };
        html2pdf()
            .set(pdfOptions)
            .from(el)
            .save()
            .then(() => setDownloading(false))
            .catch(() => setDownloading(false));
    };

    // Plain inline-styled table used ONLY for PDF export. html2canvas can't reliably render
    // Tailwind's shadcn table classes (modern oklch colors, border utilities), which is what
    // was causing the missing borders / misaligned columns in the exported PDF. Keeping this
    // fully inline-styled with explicit borders guarantees a clean, print-correct output.
    const pdfTable = (
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
            <div ref={pdfRef} style={{ width: vendorIds.length > 4 ? "1500px" : "1100px", background: "#ffffff", padding: "24px", fontFamily: "Arial, Helvetica, sans-serif", color: "#111827" }}>
                <div style={{ textAlign: "center", marginBottom: "18px", borderBottom: "2px solid #1e293b", paddingBottom: "12px" }}>
                <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>{quote?.title || "Quote"}</div>
                <div style={{ fontSize: "11px", color: "#555555" }}>
                    Quote # {quote?.quote_number || "—"} &nbsp;•&nbsp; Rate Comparison Sheet &nbsp;•&nbsp; Generated {new Date().toLocaleDateString()}
                </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", tableLayout: "fixed" }}>
                <thead>
                    <tr>
                        <th rowSpan={2} style={{ ...pdfThStyle, textAlign: "left", width: "26%" }}>Item</th>
                        <th rowSpan={2} style={{ ...pdfThStyle, textAlign: "center", width: "10%" }}>Qty</th>
                        {vendorIds.map((vid) => (
                            <th key={vid} colSpan={2} style={{ ...pdfThStyle, textAlign: "center" }}>{vendorLabel(vid)}</th>
                        ))}
                    </tr>
                    <tr>
                        {vendorIds.map((vid) => [
                            <th key={`${vid}-rate`} style={{ ...pdfThStyle, textAlign: "center", fontSize: "10px", background: "#334155" }}>Rate</th>,
                            <th key={`${vid}-amt`} style={{ ...pdfThStyle, textAlign: "center", fontSize: "10px", background: "#334155" }}>Amount</th>
                        ])}
                    </tr>
                </thead>
                <tbody>
                    {items.map((it, idx) => {
                        const best = lowestVendorForItem(it.id);
                        return (
                            <tr key={it.id} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                                <td style={{ ...pdfTdStyle, textAlign: "left", fontWeight: 600 }}>{it.item_name}</td>
                                <td style={{ ...pdfTdStyle, textAlign: "center" }}>{it.quantity} {it.uom}</td>
                                {vendorIds.map((vid) => {
                                    const r = responses.find((x) => x.item_id === it.id && x.vendor_id === vid);
                                    const isBest = best === vid && r?.rate != null;
                                    const baseStyle = {
                                        ...pdfTdStyle,
                                        textAlign: "center" as const,
                                        fontWeight: isBest ? 700 : 400,
                                        background: isBest ? "#bbf7d0" : "transparent",
                                        color: isBest ? "#14532d" : "inherit",
                                    };
                                    return [
                                        <td key={`${vid}-rate`} style={baseStyle}>{r?.rate != null ? `₹${r.rate}` : "—"}</td>,
                                        <td key={`${vid}-amt`} style={baseStyle}>{r?.amount != null ? `₹${r.amount}` : "—"}</td>
                                    ];
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div style={{ marginTop: "14px", fontSize: "10px", color: "#6b7280" }}>
                Highlighted cell = lowest rate for that item. Values shown as Rate (Total Amount).
            </div>
        </div>
        </div>
    );

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
                        <div className="overflow-x-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-100 hover:bg-slate-100">
                                        <TableHead rowSpan={2} className="border-r font-semibold text-slate-900 border-b">Item</TableHead>
                                        <TableHead rowSpan={2} className="border-r font-semibold text-slate-900 text-center border-b">Qty</TableHead>
                                        {vendorIds.map((vid, i) => (
                                            <TableHead key={vid} colSpan={2} className={`font-semibold text-slate-900 text-center border-b ${i < vendorIds.length - 1 ? "border-r" : ""}`}>{vendorLabel(vid)}</TableHead>
                                        ))}
                                    </TableRow>
                                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                                        {vendorIds.map((vid, i) => [
                                            <TableHead key={`${vid}-rate`} className="font-semibold text-slate-600 text-center text-xs border-r border-b">Rate</TableHead>,
                                            <TableHead key={`${vid}-amt`} className={`font-semibold text-slate-600 text-center text-xs border-b ${i < vendorIds.length - 1 ? "border-r" : ""}`}>Amount</TableHead>
                                        ])}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((it) => {
                                        const best = lowestVendorForItem(it.id);
                                        return (
                                            <TableRow key={it.id}>
                                                <TableCell className="font-medium border-r">{it.item_name}</TableCell>
                                                <TableCell className="border-r text-center">{it.quantity} {it.uom}</TableCell>
                                                {vendorIds.map((vid, i) => {
                                                    const r = responses.find((x) => x.item_id === it.id && x.vendor_id === vid);
                                                    const isBest = best === vid && r?.rate != null;
                                                    const isLast = i === vendorIds.length - 1;
                                                    return [
                                                        <TableCell key={`${vid}-rate`} className={`text-center border-r ${isBest ? "bg-green-200 text-green-900 font-bold" : ""}`}>
                                                            {r?.rate != null ? `₹${r.rate}` : "—"}
                                                        </TableCell>,
                                                        <TableCell key={`${vid}-amt`} className={`text-center ${isLast ? "" : "border-r"} ${isBest ? "bg-green-200 text-green-900 font-bold" : ""}`}>
                                                            {r?.amount != null ? `₹${r.amount}` : "—"}
                                                        </TableCell>
                                                    ];
                                                })}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
                {vendorIds.length > 0 && createPortal(pdfTable, document.body)}
            </CardContent>
        </Card>
    );
}

const pdfThStyle: CSSProperties = {
    border: "1px solid #334155",
    padding: "8px 10px",
    background: "#1e293b",
    color: "#ffffff",
    fontWeight: 700,
};

const pdfTdStyle: CSSProperties = {
    border: "1px solid #cbd5e1",
    padding: "7px 10px",
};

// Drop this in as a tab anywhere (e.g. inside Form Builder) - no page/Layout wrapper of its own.
export function QuotesTab() {
    const { toast } = useToast();
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

    const copyLink = async (id: string) => {
        try {
            const res = await apiFetch(`/api/fb/quotes/${id}/open-link`, { method: "POST" });
            if (!res.ok) throw new Error();
            const { token } = await res.json();
            const link = `${window.location.origin}/q/open/${token}`;
            await navigator.clipboard.writeText(link);
            toast({ title: "Link copied", description: "Share it with any vendor — they'll enter their shop name and submit rates." });
            load();
        } catch {
            toast({ title: "Error", description: "Failed to create/copy link", variant: "destructive" });
        }
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
                                            <Button variant="outline" size="sm" onClick={() => copyLink(q.id)}><LinkIcon className="h-3.5 w-3.5 mr-1" /> Copy Link</Button>
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
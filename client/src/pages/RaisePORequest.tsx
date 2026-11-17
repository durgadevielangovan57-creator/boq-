import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Send, Search, Package, ChevronRight, ChevronLeft, Store, Info, FileText, Building2, Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { useLocation } from "wouter";
import { useData } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import ProcurementTabBar from "@/components/ProcurementTabBar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Material {
    id: string;
    name: string;
    categoryId?: string;
    subcategoryId?: string;
    unit?: string;
    shop_id?: string;
    rate?: number | string;
    code?: string;
    category?: string | null;
    subcategory?: string | null;
    brandName?: string | null;
    modelNumber?: string | null;
    technicalspecification?: string | null;
}

interface Vendor {
    id: string;
    name: string;
    location?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstno?: string;
    contactnumber?: string;
    terms_and_conditions?: string;
    zoho_contact_id?: string | null;
}

const COMMON_UNITS = ["Nos", "SqFt", "SqMt", "Rmt", "Rft", "Mtr", "Kg", "Ton", "Ltr", "Set", "Pcs", "Box", "Bag", "Lot", "LS", "Cft", "Pkt", "Roll", "Drum"];
const GST_RATES = [0, 5, 12, 18, 28];
const PAYMENT_TERMS_OPTIONS = [
    "Due on Receipt",
    "Net 15 Days",
    "Net 30 Days",
    "Net 45 Days",
    "Net 60 Days",
    "50% Advance, 50% on Delivery",
    "100% Advance",
    "Against Delivery",
    "Custom Terms",
];

function numberToIndianWords(num: number): string {
    const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const rounded = Math.round(num);
    if (rounded === 0) return "Zero Rupees Only";
    const inWords = (n: number): string => {
        let str = "";
        if (n > 99) { str += a[Math.floor(n / 100)] + "Hundred "; n %= 100; }
        if (n > 19) { str += b[Math.floor(n / 10)] + " " + a[n % 10]; } else if (n > 0) { str += a[n]; }
        return str;
    };
    const crore = Math.floor(rounded / 10000000);
    let rem = rounded % 10000000;
    const lakh = Math.floor(rem / 100000);
    rem %= 100000;
    const thousand = Math.floor(rem / 1000);
    rem %= 1000;
    let res = "";
    if (crore > 0) res += inWords(crore) + "Crore ";
    if (lakh > 0) res += inWords(lakh) + "Lakh ";
    if (thousand > 0) res += inWords(thousand) + "Thousand ";
    if (rem > 0) res += inWords(rem);
    return res.trim() + " Rupees Only";
}

interface Shop {
    id: string;
    name: string;
    location?: string;
    gstNo?: string;
}

interface RequestItem {
    material_id: string;
    item: string;
    category: string;
    subcategory: string;
    unit: string;
    qty: number | "";
    rate: number | "";
    remarks: string;
    shop_id: string;
    // Create-PO-style extra line fields (optional)
    hsn?: string;
    discountPercent?: number | "";
    gstPercentage?: number;
}

export default function RaisePORequest() {
    const { user } = useData();
    const { toast } = useToast();
    const [, setLocation] = useLocation();

    const [projectName, setProjectName] = useState("");
    const [department, setDepartment] = useState<string>(user?.department || "");
    const [items, setItems] = useState<RequestItem[]>([
        { material_id: "", item: "", category: "", subcategory: "", unit: "", qty: "", rate: "", remarks: "", shop_id: "" }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Material picker
    const [pickerOpenForIndex, setPickerOpenForIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        setDepartment(user?.department || "");
    }, [user]);

    const { data: materialsData, isLoading: isLoadingMaterials } = useQuery({
        queryKey: ['/api/materials'],
        queryFn: async () => {
            const res = await apiFetch('/api/materials');
            if (!res.ok) throw new Error("Failed to load materials");
            return res.json();
        }
    });

    const { data: shopsData } = useQuery({
        queryKey: ['/api/shops'],
        queryFn: async () => {
            const res = await apiFetch('/api/shops');
            if (!res.ok) throw new Error("Failed to load shops");
            return res.json();
        }
    });

    const { data: projectsData } = useQuery({
        queryKey: ['/api/boq-projects'],
        queryFn: async () => {
            const res = await apiFetch('/api/boq-projects');
            if (!res.ok) throw new Error('Failed to load projects');
            return res.json();
        }
    });

    const projects = projectsData?.projects || [];
    const materials: Material[] = materialsData?.materials || [];
    const shops: Shop[] = shopsData?.shops || [];

    const getShopName = (shopId: string | undefined | null): string => {
        if (!shopId) return "No Vendor";
        return shops.find(s => s.id === shopId)?.name || shopId;
    };

    // Count distinct vendors in current items
    const vendorGroups = useMemo(() => {
        const groups: Record<string, RequestItem[]> = {};
        for (const item of items) {
            if (!item.item) continue;
            const key = item.shop_id || "no_vendor";
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        }
        return groups;
    }, [items]);

    const distinctVendorCount = Object.keys(vendorGroups).length;

    // ---- Material picker: category / subcategory filters + fast multi-word search ----
    const [pickerCategory, setPickerCategory] = useState<string>("");
    const [pickerSubcategory, setPickerSubcategory] = useState<string>("");
    const [pickerVisibleCount, setPickerVisibleCount] = useState<number>(100);
    const pickerListRef = useRef<HTMLDivElement | null>(null);
    // Typing stays instant; the heavy filtering runs on the deferred value
    const deferredSearchQuery = useDeferredValue(searchQuery);

    // Search index: lower-cased text for every material, built once per catalog / vendor load
    const materialIndex = useMemo(() => {
        return materials.map((m) => {
            const name = (m.name || "").toLowerCase();
            const category = (m.category || m.categoryId || "").trim();
            const subcategory = (m.subcategory || m.subcategoryId || "").trim();
            const shopName = m.shop_id ? getShopName(m.shop_id) : "";
            const hay = `${name} ${m.code || ""} ${category} ${subcategory} ${m.unit || ""} ${shopName} ${m.brandName || ""} ${m.modelNumber || ""} ${m.technicalspecification || ""}`.toLowerCase();
            return { m, name, hay, cat: category.toLowerCase(), sub: subcategory.toLowerCase() };
        });
    }, [materials, shops]);

    // Dropdown options (with counts)
    const pickerCategories = useMemo(() => {
        const map = new Map<string, { name: string; count: number }>();
        for (const e of materialIndex) {
            if (!e.cat) continue;
            const cur = map.get(e.cat);
            if (cur) cur.count += 1;
            else map.set(e.cat, { name: (e.m.category || e.m.categoryId || "").trim(), count: 1 });
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [materialIndex]);

    const pickerSubcategories = useMemo(() => {
        const cat = pickerCategory.toLowerCase();
        const map = new Map<string, { name: string; count: number }>();
        for (const e of materialIndex) {
            if (!e.sub) continue;
            if (cat && e.cat !== cat) continue;
            const cur = map.get(e.sub);
            if (cur) cur.count += 1;
            else map.set(e.sub, { name: (e.m.subcategory || e.m.subcategoryId || "").trim(), count: 1 });
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [materialIndex, pickerCategory]);

    // Filtered materials for picker: every typed word must match (any order), best matches first
    const filteredMaterials = useMemo(() => {
        const tokens = deferredSearchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const cat = pickerCategory.toLowerCase();
        const sub = pickerSubcategory.toLowerCase();
        if (tokens.length === 0 && !cat && !sub) return materials;

        const phrase = tokens.join(" ");
        const hits: { m: Material; score: number }[] = [];
        for (const e of materialIndex) {
            if (cat && e.cat !== cat) continue;
            if (sub && e.sub !== sub) continue;
            let ok = true;
            for (const t of tokens) {
                if (!e.hay.includes(t)) { ok = false; break; }
            }
            if (!ok) continue;
            let score = 3;
            if (tokens.length > 0) {
                if (e.name === phrase) score = 0;
                else if (e.name.startsWith(phrase)) score = 1;
                else if (e.name.includes(phrase)) score = 2;
            }
            hits.push({ m: e.m, score });
        }
        if (tokens.length > 0) hits.sort((a, b) => a.score - b.score); // stable: keeps original order within a score
        return hits.map((h) => h.m);
    }, [materials, materialIndex, deferredSearchQuery, pickerCategory, pickerSubcategory]);

    // Group by vendor/category for display — only the rows currently shown are rendered
    const groupedMaterials = useMemo(() => {
        const groups: Record<string, Material[]> = {};
        for (const m of filteredMaterials.slice(0, pickerVisibleCount)) {
            const key = m.shop_id ? getShopName(m.shop_id) : "No Vendor";
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        }
        return groups;
    }, [filteredMaterials, pickerVisibleCount, shops]);

    // New search / filter → back to the first page and top of the list
    useEffect(() => {
        setPickerVisibleCount(100);
        if (pickerListRef.current) pickerListRef.current.scrollTop = 0;
    }, [deferredSearchQuery, pickerCategory, pickerSubcategory, pickerOpenForIndex]);

    // Filters start clear every time the picker is opened
    useEffect(() => {
        if (pickerOpenForIndex === null) {
            setPickerCategory("");
            setPickerSubcategory("");
        }
    }, [pickerOpenForIndex]);

    const handleAddItem = () => {
        setItems([...items, { material_id: "", item: "", category: "", subcategory: "", unit: "", qty: "", rate: "", remarks: "", shop_id: "" }]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length > 1) setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof RequestItem, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const handleSelectMaterial = (index: number, mat: Material) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            material_id: mat.id,
            item: mat.name,
            category: mat.categoryId || "",
            subcategory: mat.subcategoryId || "",
            unit: mat.unit || "",
            rate: (mat.rate !== undefined && mat.rate !== null && mat.rate !== "") ? Number(mat.rate) : "",
        };
        setItems(newItems);
        setPickerOpenForIndex(null);
        setSearchQuery("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!projectName.trim()) {
            return toast({ title: "Validation Error", description: "Please enter a project name", variant: "destructive" });
        }

        const validItems = items.filter(i => i.item && i.qty && Number(i.qty) > 0);
        if (validItems.length === 0) {
            return toast({ title: "Validation Error", description: "Please add at least one item with a valid quantity > 0", variant: "destructive" });
        }

        const matchedProject = projects.find((p: any) => (p.name || '').toLowerCase() === projectName.trim().toLowerCase());

        // Group items by vendor (shop_id)
        const byVendor: Record<string, RequestItem[]> = {};
        for (const item of validItems) {
            const key = item.shop_id || "no_vendor";
            if (!byVendor[key]) byVendor[key] = [];
            byVendor[key].push(item);
        }

        const vendorKeys = Object.keys(byVendor);

        setIsSubmitting(true);
        try {
            // Create one PO Request per vendor group
            const promises = vendorKeys.map(vendorKey =>
                apiFetch("/api/po-requests", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        projectId: matchedProject?.id || `manual:${projectName.trim()}`,
                        projectName: projectName.trim(),
                        employeeId: user?.employeeCode || undefined,
                        department: department || user?.department || undefined,
                        items: byVendor[vendorKey]
                    }),
                })
            );

            const results = await Promise.all(promises);
            const failed = results.filter(r => !r.ok);

            if (failed.length > 0) {
                throw new Error(`${failed.length} request(s) failed to submit.`);
            }

            if (vendorKeys.length > 1) {
                toast({
                    title: "Requests Submitted!",
                    description: `Created ${vendorKeys.length} separate PO Requests — one per vendor.`,
                });
            } else {
                toast({ title: "Success", description: "PO Request submitted for approval." });
            }

            setLocation("/my-po-requests");
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "An unexpected error occurred", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ===== Create-Purchase-Order-style form (vendor, project mapping, terms, totals) =====
    const [vendorId, setVendorId] = useState<string>("");
    const [projectId, setProjectId] = useState<string>("");
    const [referenceNumber, setReferenceNumber] = useState<string>("");
    const [paymentTerms, setPaymentTerms] = useState<string>("Net 30 Days");
    const [requestDate, setRequestDate] = useState<string>(new Date().toISOString().split("T")[0]);
    const [deliveryDate, setDeliveryDate] = useState<string>("");
    const [deliveryAddress, setDeliveryAddress] = useState<string>("");
    const [notes, setNotes] = useState<string>("Please deliver items to the site with standard delivery challan and invoice copy.");
    const [termsAndConditions, setTermsAndConditions] = useState<string>(
        "1. Material must match specifications and quality standards.\n2. Invoice and DC copy must accompany delivery.\n3. Damaged goods will be rejected immediately.\n4. Payment will be released as per agreed payment terms."
    );
    const [vendorComboboxOpen, setVendorComboboxOpen] = useState(false);
    const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);

    const { data: vendorsData } = useQuery({
        queryKey: ['/api/manual-purchase-orders/vendors'],
        queryFn: async () => {
            const res = await apiFetch('/api/manual-purchase-orders/vendors');
            if (!res.ok) throw new Error("Failed to load vendors");
            return res.json();
        }
    });
    const { data: mapProjectsData } = useQuery({
        queryKey: ['/api/manual-purchase-orders/projects'],
        queryFn: async () => {
            const res = await apiFetch('/api/manual-purchase-orders/projects');
            if (!res.ok) throw new Error("Failed to load projects");
            return res.json();
        }
    });
    const vendors: Vendor[] = vendorsData?.vendors || [];
    const mapProjects: any[] = mapProjectsData?.projects || [];
    const selectedVendor = vendors.find((v) => v.id === vendorId);
    const selectedMapProject = mapProjects.find((p) => p.id === projectId);

    const handleProjectSelect = (id: string) => {
        setProjectId(id);
        const proj = mapProjects.find((p) => p.id === id);
        if (!proj) return;
        setProjectName(proj.name || "");
        if (!deliveryAddress) {
            let addr = proj.name;
            if (proj.location) addr += `\n${proj.location}`;
            if (proj.client) addr += `\nClient: ${proj.client}`;
            setDeliveryAddress(addr);
        }
    };

    const handleVendorSelect = (id: string) => {
        setVendorId(id);
        const v = vendors.find((x) => x.id === id);
        if (v?.terms_and_conditions) setTermsAndConditions(v.terms_and_conditions);
    };

    // When a vendor is chosen at the top, every line belongs to that vendor (so it submits as one request for that vendor)
    useEffect(() => {
        if (!vendorId) return;
        setItems((prev) => (prev.some((i) => i.shop_id !== vendorId) ? prev.map((i) => ({ ...i, shop_id: vendorId })) : prev));
    }, [vendorId, items]);

    // Auto-fill HSN for catalog materials when the catalog provides it
    useEffect(() => {
        if (materials.length === 0) return;
        setItems((prev) => {
            let changed = false;
            const next = prev.map((row) => {
                if (row.hsn || !row.material_id) return row;
                const mat: any = materials.find((m) => m.id === row.material_id);
                const hsn = mat?.hsn_code || mat?.hsn_sac_code || "";
                if (!hsn) return row;
                changed = true;
                return { ...row, hsn };
            });
            return changed ? next : prev;
        });
    }, [materials, items]);

    const calculation = useMemo(() => {
        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;
        const rowCalculations = items.map((row) => {
            const base = (Number(row.qty) || 0) * (Number(row.rate) || 0);
            const disc = base * ((Number(row.discountPercent) || 0) / 100);
            const taxable = base - disc;
            const gst = row.gstPercentage === undefined ? 18 : row.gstPercentage;
            const taxAmt = taxable * (gst / 100);
            subtotal += taxable;
            totalDiscount += disc;
            totalTax += taxAmt;
            return { taxable, taxAmt, total: taxable + taxAmt };
        });
        const grandTotal = subtotal + totalTax;
        return { rowCalculations, subtotal, totalDiscount, totalTax, grandTotal, words: numberToIndianWords(grandTotal) };
    }, [items]);

    const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <Layout>
            <div className="space-y-6 pb-20">
                <ProcurementTabBar active="raise-po-request" />

                {/* Top Header & Action Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setLocation("/my-po-requests")}
                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Back to My Requests
                            </Button>
                            <span className="text-slate-300">/</span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                                New PO Request
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                Raise PO Request
                            </h1>
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 capitalize font-medium text-xs">
                                Status: Draft
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Submit a Purchase Order request for approval by management.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="submit"
                            form="raise-po-request-form"
                            size="sm"
                            disabled={isSubmitting}
                            className="h-9 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {distinctVendorCount > 1 ? `Submit ${distinctVendorCount} Requests` : "Submit for Approval"}
                        </Button>
                    </div>
                </div>

                {/* Auto-split info banner */}
                {distinctVendorCount > 1 && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span className="text-blue-800">
                            You have materials from <strong>{distinctVendorCount} different vendors</strong>.
                            On submit, this will automatically be split into <strong>{distinctVendorCount} separate Annexures</strong> — one per vendor.
                        </span>
                    </div>
                )}

                <form id="raise-po-request-form" onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Vendor & Project Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Card: Vendor Information */}
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-primary" />
                                        <CardTitle className="text-base font-semibold">Vendor Information</CardTitle>
                                    </div>
                                    {selectedVendor?.zoho_contact_id && (
                                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                            Zoho Contact Linked
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700">
                                        Vendor / Supplier Name
                                    </Label>
                                    <Popover open={vendorComboboxOpen} onOpenChange={setVendorComboboxOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={vendorComboboxOpen}
                                                className="mt-1 w-full justify-between h-9 bg-white font-normal hover:bg-slate-50 border-input px-3"
                                            >
                                                <span className="truncate">
                                                    {selectedVendor ? (
                                                        <span className="font-medium text-slate-900">
                                                            {selectedVendor.name}
                                                            {selectedVendor.city ? ` (${selectedVendor.city})` : ""}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">Select vendor / shop...</span>
                                                    )}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0 z-50 shadow-lg border border-slate-200" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search vendor by name, city..." className="h-9" />
                                                <CommandList className="max-h-64 overflow-y-auto">
                                                    <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No vendor found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {vendors.map((v) => (
                                                            <CommandItem
                                                                key={v.id}
                                                                value={`${v.name} ${v.city || ""} ${v.location || ""}`}
                                                                onSelect={() => {
                                                                    handleVendorSelect(v.id);
                                                                    setVendorComboboxOpen(false);
                                                                }}
                                                                className="cursor-pointer py-2 px-3"
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4 shrink-0",
                                                                        vendorId === v.id ? "opacity-100 text-primary" : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-medium text-sm text-slate-900 truncate">{v.name}</span>
                                                                    {(v.city || v.location) && (
                                                                        <span className="text-xs text-muted-foreground truncate">
                                                                            {[v.city, v.state].filter(Boolean).join(", ")}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Selected Vendor Info Card */}
                                {selectedVendor ? (
                                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2 text-xs">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm">{selectedVendor.name}</p>
                                                <p className="text-slate-600 mt-0.5">
                                                    {selectedVendor.location || selectedVendor.city || "No address on file"}
                                                    {selectedVendor.state ? `, ${selectedVendor.state}` : ""}
                                                    {selectedVendor.pincode ? ` - ${selectedVendor.pincode}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                                            <div>
                                                <span className="text-muted-foreground">GSTIN:</span>{" "}
                                                <span className="font-mono font-medium text-slate-800">
                                                    {selectedVendor.gstno || "Unregistered / N/A"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Phone:</span>{" "}
                                                <span className="text-slate-800">
                                                    {selectedVendor.contactnumber || "N/A"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                                        Please select a vendor to view details
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Right Card: Request Reference & Project Details */}
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <CardTitle className="text-base font-semibold">Order Details & Project Mapping</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-700">
                                            Purchase Order #
                                        </Label>
                                        <Input
                                            value=""
                                            disabled
                                            placeholder="Assigned after approval"
                                            className="mt-1 h-9 font-mono bg-slate-50"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-700">
                                            Reference # / Quote #
                                        </Label>
                                        <Input
                                            value={referenceNumber}
                                            onChange={(e) => setReferenceNumber(e.target.value)}
                                            placeholder="Optional quotation or ref #"
                                            className="mt-1 h-9"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-700">
                                            Map Project <span className="text-red-500">*</span>
                                        </Label>
                                        <Popover open={projectComboboxOpen} onOpenChange={setProjectComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={projectComboboxOpen}
                                                    className="mt-1 w-full justify-between h-9 bg-white font-normal hover:bg-slate-50 border-input px-3"
                                                >
                                                    <span className="truncate">
                                                        {selectedMapProject ? (
                                                            <span className="font-medium text-slate-900">
                                                                {selectedMapProject.name}
                                                                {selectedMapProject.client ? ` (${selectedMapProject.client})` : ""}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">Select project...</span>
                                                        )}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0 z-50 shadow-lg border border-slate-200" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search project by name, client..." className="h-9" />
                                                    <CommandList className="max-h-64 overflow-y-auto">
                                                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No project found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {mapProjects.map((p) => (
                                                                <CommandItem
                                                                    key={p.id}
                                                                    value={`${p.name} ${p.client || ""} ${p.location || ""}`}
                                                                    onSelect={() => {
                                                                        handleProjectSelect(p.id);
                                                                        setProjectComboboxOpen(false);
                                                                    }}
                                                                    className="cursor-pointer py-2 px-3"
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4 shrink-0",
                                                                            projectId === p.id ? "opacity-100 text-primary" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="font-medium text-sm text-slate-900 truncate">{p.name}</span>
                                                                        {p.client && (
                                                                            <span className="text-xs text-muted-foreground truncate">
                                                                                Client: {p.client}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-700">
                                            Payment Terms
                                        </Label>
                                        <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                                            <SelectTrigger className="mt-1 h-9 bg-white">
                                                <SelectValue placeholder="Payment terms..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PAYMENT_TERMS_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt} value={opt}>
                                                        {opt}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-700">
                                            PO Date
                                        </Label>
                                        <Input
                                            type="date"
                                            value={requestDate}
                                            onChange={(e) => setRequestDate(e.target.value)}
                                            className="mt-1 h-9"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-700">
                                            Expected Delivery Date
                                        </Label>
                                        <Input
                                            type="date"
                                            value={deliveryDate}
                                            onChange={(e) => setDeliveryDate(e.target.value)}
                                            className="mt-1 h-9"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-700">Requester Name</Label>
                                        <Input value={user?.fullName || user?.username || ""} disabled className="mt-1 h-9 bg-slate-50" />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-700">Department</Label>
                                        <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Enter department" className="mt-1 h-9" />
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs font-semibold text-slate-700">
                                        Delivery / Site Address
                                    </Label>
                                    <Textarea
                                        rows={2}
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                        placeholder="Site address, contact person name and phone number for delivery..."
                                        className="mt-1 text-xs"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Section 2: Items Table */}
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-semibold">Items & Materials</CardTitle>
                                <CardDescription className="text-xs">
                                    Add products or materials with quantity, rate, discount, and GST rate.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        // Use the last row if it is still empty, otherwise add a new row for the catalog pick
                                        if (!items[items.length - 1]?.item) {
                                            setPickerOpenForIndex(items.length - 1);
                                        } else {
                                            handleAddItem();
                                            setPickerOpenForIndex(items.length);
                                        }
                                        setSearchQuery("");
                                    }}
                                    className="h-8 gap-1.5 text-xs bg-white"
                                >
                                    <Package className="h-3.5 w-3.5 text-primary" />
                                    Add from Catalog
                                </Button>
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={handleAddItem}
                                    className="h-8 gap-1.5 text-xs bg-primary"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Row
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table className="min-w-[950px]">
                                    <TableHeader className="bg-slate-50/80 text-xs">
                                        <TableRow>
                                            <TableHead className="w-10 text-center">#</TableHead>
                                            <TableHead className="min-w-[220px]">Item Details</TableHead>
                                            <TableHead className="w-24">HSN/SAC</TableHead>
                                            <TableHead className="w-24">Qty</TableHead>
                                            <TableHead className="w-24">Unit</TableHead>
                                            <TableHead className="w-28 text-right">Rate (₹)</TableHead>
                                            <TableHead className="w-24 text-right">Disc %</TableHead>
                                            <TableHead className="w-24">GST %</TableHead>
                                            <TableHead className="w-32 text-right">Amount (₹)</TableHead>
                                            <TableHead className="w-12 text-center"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item, index) => {
                                            const calc = calculation.rowCalculations[index];
                                            return (
                                                <TableRow key={index} className="hover:bg-slate-50/60">
                                                    <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                        {index + 1}
                                                    </TableCell>
                                                    <TableCell className="space-y-1.5 py-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Input
                                                                value={item.item}
                                                                onChange={(e) => {
                                                                    const v = e.target.value;
                                                                    setItems((prev) => {
                                                                        const next = [...prev];
                                                                        next[index] = { ...next[index], item: v, material_id: "" };
                                                                        return next;
                                                                    });
                                                                }}
                                                                placeholder="Item / Material name *"
                                                                className="h-8 text-xs font-medium"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => { setPickerOpenForIndex(index); setSearchQuery(""); }}
                                                                title="Search catalog"
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary flex-shrink-0"
                                                            >
                                                                <Search className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                        <Input
                                                            value={item.remarks}
                                                            onChange={(e) => handleItemChange(index, "remarks", e.target.value)}
                                                            placeholder="Description or specification (optional)"
                                                            className="h-7 text-[11px] text-muted-foreground"
                                                        />
                                                        {item.shop_id && (
                                                            <div className="flex items-center gap-1">
                                                                <Store className="h-3 w-3 text-slate-400" />
                                                                <span className="text-[10px] text-slate-500">{getShopName(item.shop_id)}</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Input
                                                            value={item.hsn || ""}
                                                            onChange={(e) => handleItemChange(index, "hsn", e.target.value)}
                                                            placeholder="HSN"
                                                            className="h-8 text-xs font-mono"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Input
                                                            type="number"
                                                            min="0.01"
                                                            step="0.01"
                                                            value={item.qty}
                                                            onChange={(e) => handleItemChange(index, "qty", e.target.value)}
                                                            placeholder="1"
                                                            required
                                                            className="h-8 text-xs font-mono"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Select
                                                            value={item.unit || ""}
                                                            onValueChange={(val) => handleItemChange(index, "unit", val)}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs bg-white">
                                                                <SelectValue placeholder="Unit" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {Array.from(new Set([...COMMON_UNITS, item.unit].filter(Boolean))).map((u) => (
                                                                    <SelectItem key={u} value={u}>
                                                                        {u}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.rate}
                                                            onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                                                            placeholder="0.00"
                                                            className="h-8 text-xs font-mono text-right"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="any"
                                                            value={item.discountPercent === undefined ? "" : item.discountPercent}
                                                            onChange={(e) => handleItemChange(index, "discountPercent", e.target.value === "" ? "" : parseFloat(e.target.value))}
                                                            placeholder="0%"
                                                            className="h-8 text-xs font-mono text-right"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Select
                                                            value={String(item.gstPercentage === undefined ? 18 : item.gstPercentage)}
                                                            onValueChange={(val) => handleItemChange(index, "gstPercentage", parseInt(val, 10))}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs bg-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {GST_RATES.map((rate) => (
                                                                    <SelectItem key={rate} value={String(rate)}>
                                                                        {rate}%
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-right py-2 font-mono text-xs font-semibold text-slate-800">
                                                        ₹{money(calc?.total || 0)}
                                                        <div className="text-[10px] font-normal text-muted-foreground">
                                                            Tax: ₹{(calc?.taxAmt || 0).toFixed(2)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center py-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={items.length === 1}
                                                            onClick={() => handleRemoveItem(index)}
                                                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAddItem}
                                    className="h-8 text-xs text-primary gap-1"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Another Line
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    {items.length} line item{items.length === 1 ? "" : "s"}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Section 3: Notes & Financial Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Notes & Terms (7 cols) */}
                        <div className="lg:col-span-7 space-y-4">
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="pb-2 border-b border-slate-100">
                                    <CardTitle className="text-sm font-semibold">Vendor Notes & Instructions</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-3">
                                    <Textarea
                                        rows={3}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Enter instructions, notes for the vendor, delivery timing, contact person..."
                                        className="text-xs"
                                    />
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="pb-2 border-b border-slate-100">
                                    <CardTitle className="text-sm font-semibold">Terms & Conditions</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-3">
                                    <Textarea
                                        rows={4}
                                        value={termsAndConditions}
                                        onChange={(e) => setTermsAndConditions(e.target.value)}
                                        placeholder="Enter standard purchase terms, warranty, quality expectations..."
                                        className="text-xs font-mono"
                                    />
                                </CardContent>
                            </Card>

                            {/* Vendor split preview */}
                            {distinctVendorCount > 0 && (
                                <Card className="border-slate-200 shadow-sm">
                                    <CardHeader className="pb-2 border-b border-slate-100">
                                        <CardTitle className="text-sm font-semibold">Will be submitted as</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-3">
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(vendorGroups).map(([shopId, groupItems]) => (
                                                <div key={shopId} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs">
                                                    <Store className="h-3 w-3 text-blue-500" />
                                                    <span className="font-medium text-slate-700">{getShopName(shopId === "no_vendor" ? null : shopId)}</span>
                                                    <Badge variant="secondary" className="h-4 text-[10px] px-1 ml-0.5">{groupItems.length} item{groupItems.length !== 1 ? 's' : ''}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Summary Card (5 cols) */}
                        <div className="lg:col-span-5">
                            <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-slate-50/70">
                                <CardHeader className="pb-3 border-b border-slate-100">
                                    <CardTitle className="text-base font-semibold">Order Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600">Sub Total (Taxable):</span>
                                        <span className="font-mono font-medium text-slate-800">
                                            ₹{money(calculation.subtotal)}
                                        </span>
                                    </div>

                                    {calculation.totalDiscount > 0 && (
                                        <div className="flex justify-between items-center text-sm text-emerald-600">
                                            <span>Total Discount:</span>
                                            <span className="font-mono">
                                                -₹{money(calculation.totalDiscount)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600">Total GST / Taxes:</span>
                                        <span className="font-mono font-medium text-slate-800">
                                            +₹{money(calculation.totalTax)}
                                        </span>
                                    </div>

                                    <div className="border-t border-slate-200 pt-3 pb-1 flex justify-between items-baseline">
                                        <span className="text-base font-bold text-slate-900">Grand Total:</span>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold font-mono text-primary">
                                                ₹{money(calculation.grandTotal)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-2.5 bg-slate-100/70 rounded-md text-[11px] text-slate-600 italic">
                                        <span className="font-semibold text-slate-700 not-italic">In Words: </span>
                                        {calculation.words}
                                    </div>

                                    <div className="pt-3 space-y-2">
                                        <Button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                                        >
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                            {distinctVendorCount > 1 ? `Submit ${distinctVendorCount} Requests` : "Submit for Approval"}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => setLocation("/")}
                                            className="w-full h-10 font-semibold"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </form>
            </div>

            {/* Material Picker Dialog */}
            <Dialog
                open={pickerOpenForIndex !== null}
                onOpenChange={(open) => { if (!open) { setPickerOpenForIndex(null); setSearchQuery(""); } }}
            >
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Package className="h-5 w-5 text-blue-600" />
                            Select Material
                        </DialogTitle>
                        <div className="relative mt-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                autoFocus
                                className="pl-9 h-10 bg-slate-50 border-slate-200 focus:bg-white"
                                placeholder="Search by name, category, vendor…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                            <Select
                                value={pickerCategory || "__all__"}
                                onValueChange={(v) => {
                                    setPickerCategory(v === "__all__" ? "" : v);
                                    setPickerSubcategory("");
                                }}
                            >
                                <SelectTrigger className="h-9 text-xs bg-white">
                                    <SelectValue placeholder="All categories" />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                    <SelectItem value="__all__">All categories</SelectItem>
                                    {pickerCategories.map((c) => (
                                        <SelectItem key={c.name} value={c.name}>
                                            {c.name} ({c.count})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={pickerSubcategory || "__all__"}
                                onValueChange={(v) => setPickerSubcategory(v === "__all__" ? "" : v)}
                            >
                                <SelectTrigger className="h-9 text-xs bg-white">
                                    <SelectValue placeholder="All subcategories" />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                    <SelectItem value="__all__">All subcategories</SelectItem>
                                    {pickerSubcategories.map((c) => (
                                        <SelectItem key={c.name} value={c.name}>
                                            {c.name} ({c.count})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </DialogHeader>

                    <div
                        ref={pickerListRef}
                        className="overflow-y-auto flex-1 px-4 py-3"
                        onScroll={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
                                setPickerVisibleCount((c) => (c < filteredMaterials.length ? c + 100 : c));
                            }
                        }}
                    >
                        {isLoadingMaterials ? (
                            <div className="flex items-center justify-center py-12 text-slate-400">
                                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading materials...
                            </div>
                        ) : filteredMaterials.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No materials found</p>
                            </div>
                        ) : (
                            <>
                                {Object.entries(groupedMaterials).map(([vendorName, mats]) => (
                                    <div key={vendorName} className="mb-5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 px-1 flex items-center gap-1.5">
                                            <Store className="h-3 w-3" /> {vendorName}
                                        </p>
                                        <div className="space-y-1">
                                            {mats.map((mat) => (
                                                <button
                                                    key={mat.id}
                                                    type="button"
                                                    onClick={() => pickerOpenForIndex !== null && handleSelectMaterial(pickerOpenForIndex, mat)}
                                                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between group border border-transparent hover:border-blue-100"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-7 w-7 rounded-md bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0">
                                                            <Package className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-800 group-hover:text-blue-700">{mat.name}</p>
                                                            {mat.unit && <p className="text-[10px] text-slate-400">Unit: {mat.unit}</p>}
                                                            {mat.category && <p className="text-[10px] text-slate-400">{mat.category}{mat.subcategory ? ` › ${mat.subcategory}` : ""}</p>}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {filteredMaterials.length > pickerVisibleCount && (
                                    <div className="py-2 text-center">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => setPickerVisibleCount((c) => c + 100)}
                                        >
                                            Show more ({filteredMaterials.length - pickerVisibleCount} remaining)
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="px-6 py-3 border-t bg-slate-50/50 shrink-0 flex justify-between items-center">
                        <p className="text-xs text-slate-400">{filteredMaterials.length} material{filteredMaterials.length !== 1 ? 's' : ''} found</p>
                        <Button variant="outline" size="sm" onClick={() => { setPickerOpenForIndex(null); setSearchQuery(""); }}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}
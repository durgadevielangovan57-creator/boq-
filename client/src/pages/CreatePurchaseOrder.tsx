import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import ProcurementTabBar from "@/components/ProcurementTabBar";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import {
    Plus,
    Trash2,
    Search,
    ChevronLeft,
    Eye,
    Save,
    Send,
    UploadCloud,
    Building2,
    Calendar,
    FileText,
    IndianRupee,
    Printer,
    CheckCircle2,
    AlertCircle,
    Package,
    Loader2,
    Check,
    ChevronsUpDown,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Project {
    id: string;
    name: string;
    client?: string;
    location?: string;
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
    phonecountrycode?: string;
    terms_and_conditions?: string;
    zoho_contact_id?: string | null;
}

interface Material {
    id: string;
    name: string;
    unit?: string;
    rate?: string | number;
    supply_rate?: string | number;
    technicalspecification?: string;
    hsn_code?: string;
    hsn_sac_code?: string;
    code?: string;
}

interface POItem {
    id: string;
    materialId?: string | null;
    item: string;
    description: string;
    hsnCode: string;
    sacCode: string;
    qty: number;
    unit: string;
    rate: number;
    discountPercent: number;
    gstPercentage: number;
}

const COMMON_UNITS = [
    "Nos",
    "SqFt",
    "SqMt",
    "Rmt",
    "Rft",
    "Mtr",
    "Kg",
    "Ton",
    "Ltr",
    "Set",
    "Pcs",
    "Box",
    "Bag",
    "Lot",
    "LS",
    "Cft",
    "Pkt",
    "Roll",
    "Drum",
];

function normalizeUnit(rawUnit?: string | null): string {
    if (!rawUnit) return "Nos";
    const u = rawUnit.trim().toLowerCase();
    if (u === "nos" || u === "numbers" || u === "no" || u === "unit" || u === "units") return "Nos";
    if (u === "sqft" || u === "square feet" || u === "sq.ft" || u === "sq ft" || u === "sq.feet") return "SqFt";
    if (u === "sqmt" || u === "square meter" || u === "sqm" || u === "sq.m" || u === "sq.meter") return "SqMt";
    if (u === "rmt" || u === "running meter" || u === "rmtr" || u === "running metre") return "Rmt";
    if (u === "rft" || u === "running feet" || u === "r.ft" || u === "ft" || u === "feet") return "Rft";
    if (u === "mtr" || u === "meter" || u === "meters" || u === "m" || u === "metre") return "Mtr";
    if (u === "kg" || u === "kgs" || u === "kilogram") return "Kg";
    if (u === "ltr" || u === "litre" || u === "liter" || u === "litres" || u === "l") return "Ltr";
    if (u === "ton" || u === "tonne" || u === "tons") return "Ton";
    if (u === "set" || u === "sets") return "Set";
    if (u === "pcs" || u === "piece" || u === "pieces") return "Pcs";
    if (u === "box" || u === "boxes") return "Box";
    if (u === "bag" || u === "bags") return "Bag";
    if (u === "lot") return "Lot";
    if (u === "ls") return "LS";
    if (u === "cft") return "Cft";
    if (u === "pkt" || u === "1 pkt" || u === "packet") return "Pkt";
    if (u === "roll" || u === "rolls") return "Roll";
    if (u === "drum") return "Drum";
    return rawUnit.charAt(0).toUpperCase() + rawUnit.slice(1);
}

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
    const a = [
        "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ",
        "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ",
        "Seventeen ", "Eighteen ", "Nineteen "
    ];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const rounded = Math.round(num);
    if (rounded === 0) return "Zero Rupees Only";

    function inWords(n: number): string {
        let str = "";
        if (n > 99) {
            str += a[Math.floor(n / 100)] + "Hundred ";
            n %= 100;
        }
        if (n > 19) {
            str += b[Math.floor(n / 10)] + " " + a[n % 10];
        } else if (n > 0) {
            str += a[n];
        }
        return str;
    }

    let crore = Math.floor(rounded / 10000000);
    let rem = rounded % 10000000;
    let lakh = Math.floor(rem / 100000);
    rem %= 100000;
    let thousand = Math.floor(rem / 1000);
    rem %= 1000;
    let hundred = rem;

    let res = "";
    if (crore > 0) res += inWords(crore) + "Crore ";
    if (lakh > 0) res += inWords(lakh) + "Lakh ";
    if (thousand > 0) res += inWords(thousand) + "Thousand ";
    if (hundred > 0) res += inWords(hundred);

    return res.trim() + " Rupees Only";
}

export default function CreatePurchaseOrder() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [matchEdit, paramsEdit] = useRoute("/purchase-orders/edit/:id");
    const editPoId = matchEdit ? paramsEdit?.id : null;

    // Loading states
    const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isSyncingZoho, setIsSyncingZoho] = useState<boolean>(false);

    // Master data
    const [projects, setProjects] = useState<Project[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);

    // Form fields
    const [poNumber, setPoNumber] = useState<string>("");
    const [referenceNumber, setReferenceNumber] = useState<string>("");
    const [projectId, setProjectId] = useState<string>("");
    const [vendorId, setVendorId] = useState<string>("");
    const [status, setStatus] = useState<string>("draft");
    const [poDate, setPoDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );
    const [deliveryDate, setDeliveryDate] = useState<string>("");
    const [paymentTerms, setPaymentTerms] = useState<string>("Net 30 Days");
    const [deliveryAddress, setDeliveryAddress] = useState<string>("");
    const [notes, setNotes] = useState<string>(
        "Please deliver items to the site with standard delivery challan and invoice copy."
    );
    const [termsAndConditions, setTermsAndConditions] = useState<string>(
        "1. Material must match specifications and quality standards.\n2. Invoice and DC copy must accompany delivery.\n3. Damaged goods will be rejected immediately.\n4. Payment will be released as per agreed payment terms."
    );

    // Line items
    const [items, setItems] = useState<POItem[]>([
        {
            id: `item-${Date.now()}-1`,
            materialId: null,
            item: "",
            description: "",
            hsnCode: "",
            sacCode: "",
            qty: 1,
            unit: "Nos",
            rate: 0,
            discountPercent: 0,
            gstPercentage: 18,
        },
    ]);

    // Material catalog modal state
    const [catalogModalOpen, setCatalogModalOpen] = useState<boolean>(false);
    const [catalogSearch, setCatalogSearch] = useState<string>("");
    const [catalogActiveItemIdx, setCatalogActiveItemIdx] = useState<number | null>(null);
    const [isSearchingCatalog, setIsSearchingCatalog] = useState<boolean>(false);

    // Vendor and Project combobox state
    const [vendorComboboxOpen, setVendorComboboxOpen] = useState<boolean>(false);
    const [projectComboboxOpen, setProjectComboboxOpen] = useState<boolean>(false);

    // Preview modal state
    const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);

    // Load initial reference data
    useEffect(() => {
        let isMounted = true;
        async function fetchInitData() {
            try {
                setIsLoadingInitial(true);
                const [projRes, vendRes, nextPoRes, matRes] = await Promise.all([
                    apiFetch("/api/manual-purchase-orders/projects"),
                    apiFetch("/api/manual-purchase-orders/vendors"),
                    apiFetch("/api/manual-purchase-orders/next-number"),
                    apiFetch("/api/manual-purchase-orders/materials"),
                ]);

                if (!isMounted) return;

                if (projRes.ok) {
                    const data = await projRes.json();
                    const fetchedProjects = data.projects || [];
                    setProjects(fetchedProjects);

                    // If projectId or returnProjectId was passed in URL query and creating new PO, auto-select it
                    if (!editPoId) {
                        const searchParams = new URLSearchParams(window.location.search);
                        const qProjId = searchParams.get("projectId") || searchParams.get("returnProjectId");
                        if (qProjId) {
                            setProjectId(qProjId);
                            const matchedProj = fetchedProjects.find((p: any) => p.id === qProjId);
                            if (matchedProj) {
                                let addr = matchedProj.name;
                                if (matchedProj.location) addr += `\n${matchedProj.location}`;
                                if (matchedProj.client) addr += `\nClient: ${matchedProj.client}`;
                                setDeliveryAddress(addr);
                            }
                        }
                    }
                }
                if (vendRes.ok) {
                    const data = await vendRes.json();
                    setVendors(data.vendors || []);
                }
                if (matRes.ok) {
                    const data = await matRes.json();
                    setMaterials(data.materials || []);
                }
                if (nextPoRes.ok && !editPoId) {
                    const data = await nextPoRes.json();
                    if (data.poNumber) {
                        setPoNumber(data.poNumber);
                    }
                }

                // If editing existing PO, fetch its data
                if (editPoId) {
                    const editRes = await apiFetch(`/api/manual-purchase-orders/${editPoId}`);
                    if (editRes.ok) {
                        const editData = await editRes.json();
                        const po = editData.purchaseOrder;
                        const existingItems = editData.items || [];

                        if (po.source !== "manual") {
                            toast({
                                title: "Editing Not Allowed",
                                description: "Only manually created purchase orders can be edited.",
                                variant: "destructive",
                            });
                            setLocation(`/purchase-orders/${editPoId}`);
                            return;
                        }

                        if (po.status?.toLowerCase() === "approved") {
                            toast({
                                title: "Editing Not Allowed",
                                description: "Approved purchase orders cannot be edited.",
                                variant: "destructive",
                            });
                            setLocation(`/purchase-orders/${editPoId}`);
                            return;
                        }

                        setPoNumber(po.po_number || "");
                        setReferenceNumber(po.reference_number || "");
                        setProjectId(po.project_id || "");
                        setVendorId(po.vendor_id || "");
                        if (po.status) {
                            setStatus(po.status.toLowerCase());
                        }
                        if (po.po_date) {
                            setPoDate(new Date(po.po_date).toISOString().split("T")[0]);
                        }
                        if (po.delivery_date) {
                            setDeliveryDate(new Date(po.delivery_date).toISOString().split("T")[0]);
                        }
                        setPaymentTerms(po.payment_terms || "Net 30 Days");
                        setDeliveryAddress(po.delivery_address || po.shipping_address || "");
                        setNotes(po.notes || po.comments || "");
                        if (po.terms_and_conditions) {
                            setTermsAndConditions(po.terms_and_conditions);
                        }

                        if (existingItems.length > 0) {
                            setItems(
                                existingItems.map((itm: any, idx: number) => ({
                                    id: `item-${idx}-${Date.now()}`,
                                    materialId: itm.material_id || null,
                                    item: itm.item || "",
                                    description: itm.description || "",
                                    hsnCode: itm.hsn_code || "",
                                    sacCode: itm.sac_code || "",
                                    qty: Number(itm.qty) || 0,
                                    unit: normalizeUnit(itm.unit),
                                    rate: Number(itm.rate) || 0,
                                    discountPercent: Number(itm.discount_percent) || 0,
                                    gstPercentage: itm.gst_percentage !== null && itm.gst_percentage !== undefined ? Number(itm.gst_percentage) : 18,
                                }))
                            );
                        }
                    }
                }
            } catch (err: any) {
                console.error("Init data load failed:", err);
                toast({
                    title: "Failed to load reference data",
                    description: err?.message || "Please refresh the page",
                    variant: "destructive",
                });
            } finally {
                if (isMounted) setIsLoadingInitial(false);
            }
        }

        fetchInitData();
        return () => {
            isMounted = false;
        };
    }, [editPoId]);

    // When project changes, update delivery address if currently empty
    const handleProjectSelect = (projId: string) => {
        setProjectId(projId);
        const selectedProj = projects.find((p) => p.id === projId);
        if (selectedProj && !deliveryAddress) {
            let addr = selectedProj.name;
            if (selectedProj.location) addr += `\n${selectedProj.location}`;
            if (selectedProj.client) addr += `\nClient: ${selectedProj.client}`;
            setDeliveryAddress(addr);
        }
    };

    // When vendor changes, update default terms if available
    const handleVendorSelect = (vendId: string) => {
        setVendorId(vendId);
        const selectedVendor = vendors.find((v) => v.id === vendId);
        if (selectedVendor?.terms_and_conditions) {
            setTermsAndConditions(selectedVendor.terms_and_conditions);
        }
    };

    // Item row operations
    const handleAddItemRow = () => {
        setItems((prev) => [
            ...prev,
            {
                id: `item-${Date.now()}-${prev.length + 1}`,
                materialId: null,
                item: "",
                description: "",
                hsnCode: "",
                sacCode: "",
                qty: 1,
                unit: "Nos",
                rate: 0,
                discountPercent: 0,
                gstPercentage: 18,
            },
        ]);
    };

    const handleRemoveItemRow = (index: number) => {
        if (items.length === 1) {
            toast({
                title: "Cannot delete",
                description: "Purchase Order must have at least one line item.",
                variant: "destructive",
            });
            return;
        }
        setItems((prev) => prev.filter((_, idx) => idx !== index));
    };

    // Auto-resolve HSN and normalized Unit for items when materials are loaded or changed
    useEffect(() => {
        if (materials.length === 0) return;
        setItems((prevItems) => {
            let hasChanged = false;
            const updated = prevItems.map((row) => {
                if (!row.item || !row.item.trim()) return row;

                const cleanRowName = row.item.trim().toLowerCase();
                const matchedMat = materials.find(
                    (m) =>
                        m.name.trim().toLowerCase() === cleanRowName ||
                        cleanRowName.includes(m.name.trim().toLowerCase()) ||
                        m.name.trim().toLowerCase().includes(cleanRowName)
                );

                const currentNormUnit = normalizeUnit(row.unit);
                const resolvedUnit = matchedMat?.unit ? normalizeUnit(matchedMat.unit) : currentNormUnit;
                const resolvedHsn = !row.hsnCode && matchedMat?.hsn_code ? matchedMat.hsn_code : row.hsnCode;
                const resolvedRate = (!row.rate || row.rate === 0) && matchedMat?.rate ? Number(matchedMat.rate) : row.rate;
                const resolvedDesc = !row.description && matchedMat?.technicalspecification ? matchedMat.technicalspecification : row.description;

                if (
                    resolvedHsn !== row.hsnCode ||
                    resolvedUnit !== row.unit ||
                    resolvedRate !== row.rate ||
                    resolvedDesc !== row.description ||
                    (!row.materialId && matchedMat?.id)
                ) {
                    hasChanged = true;
                    return {
                        ...row,
                        hsnCode: resolvedHsn,
                        unit: resolvedUnit,
                        rate: resolvedRate,
                        description: resolvedDesc,
                        materialId: row.materialId || matchedMat?.id || null,
                    };
                }
                return row;
            });
            return hasChanged ? updated : prevItems;
        });
    }, [materials]);

    const handleItemFieldChange = (
        index: number,
        field: keyof POItem,
        value: any
    ) => {
        setItems((prev) => {
            const next = [...prev];
            const updatedRow = { ...next[index], [field]: value };

            // If user types an item name, check if it matches a catalog material and auto-fill HSN/unit/rate
            if (field === "item" && typeof value === "string" && value.trim()) {
                const cleanName = value.trim().toLowerCase();
                const matched = materials.find(
                    (m) =>
                        m.name.trim().toLowerCase() === cleanName ||
                        cleanName.includes(m.name.trim().toLowerCase())
                );
                if (matched) {
                    if (!updatedRow.hsnCode && matched.hsn_code) {
                        updatedRow.hsnCode = matched.hsn_code;
                    }
                    if ((!updatedRow.unit || updatedRow.unit === "Nos") && matched.unit) {
                        updatedRow.unit = normalizeUnit(matched.unit);
                    }
                    if ((!updatedRow.rate || updatedRow.rate === 0) && matched.rate) {
                        updatedRow.rate = Number(matched.rate);
                    }
                    if (!updatedRow.description && matched.technicalspecification) {
                        updatedRow.description = matched.technicalspecification;
                    }
                    updatedRow.materialId = matched.id;
                }
            }

            next[index] = updatedRow;
            return next;
        });
    };

    // Debounced server search when typing 2+ chars
    useEffect(() => {
        if (!catalogModalOpen) return;
        const q = catalogSearch.trim();
        if (q.length < 2) return;

        const timer = setTimeout(async () => {
            try {
                setIsSearchingCatalog(true);
                const res = await apiFetch(`/api/manual-purchase-orders/materials?q=${encodeURIComponent(q)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.materials)) {
                        setMaterials(data.materials);
                    }
                }
            } catch (err) {
                console.error("Catalog server search failed", err);
            } finally {
                setIsSearchingCatalog(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [catalogSearch, catalogModalOpen]);

    // Material search in catalog modal
    const openCatalogModal = async (targetIdx?: number) => {
        setCatalogActiveItemIdx(targetIdx !== undefined ? targetIdx : null);
        setCatalogModalOpen(true);
        if (materials.length === 0) {
            try {
                setIsSearchingCatalog(true);
                const res = await apiFetch("/api/manual-purchase-orders/materials");
                if (res.ok) {
                    const data = await res.json();
                    setMaterials(data.materials || []);
                }
            } catch (err) {
                console.error("Failed to load materials catalog", err);
            } finally {
                setIsSearchingCatalog(false);
            }
        }
    };

    const handleSelectMaterial = (mat: Material) => {
        const rate = Number(mat.rate ?? mat.supply_rate) || 0;
        const hsn = (mat.hsn_code || mat.hsn_sac_code || "").trim();
        const unit = normalizeUnit(mat.unit);
        const desc = mat.technicalspecification || "";

        if (catalogActiveItemIdx !== null && items[catalogActiveItemIdx]) {
            // Replace existing row
            setItems((prev) => {
                const next = [...prev];
                next[catalogActiveItemIdx] = {
                    ...next[catalogActiveItemIdx],
                    materialId: mat.id,
                    item: mat.name,
                    description: desc,
                    hsnCode: hsn,
                    unit: unit,
                    rate: rate,
                };
                return next;
            });
        } else {
            // Add as a new row
            setItems((prev) => [
                ...prev,
                {
                    id: `item-${Date.now()}-${prev.length + 1}`,
                    materialId: mat.id,
                    item: mat.name,
                    description: desc,
                    hsnCode: hsn,
                    sacCode: "",
                    qty: 1,
                    unit: unit,
                    rate: rate,
                    discountPercent: 0,
                    gstPercentage: 18,
                },
            ]);
        }
        setCatalogModalOpen(false);
    };

    // Filter materials for catalog modal
    const filteredMaterials = useMemo(() => {
        if (!catalogSearch.trim()) return materials;
        const q = catalogSearch.toLowerCase();
        return materials.filter(
            (m) =>
                m.name?.toLowerCase().includes(q) ||
                m.technicalspecification?.toLowerCase().includes(q) ||
                m.hsn_code?.toLowerCase().includes(q) ||
                m.hsn_sac_code?.toLowerCase().includes(q) ||
                m.code?.toLowerCase().includes(q)
        );
    }, [materials, catalogSearch]);

    // Financial Calculations (Zoho Books logic)
    const calculation = useMemo(() => {
        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        const rowCalculations = items.map((item) => {
            const qty = Number(item.qty) || 0;
            const rate = Number(item.rate) || 0;
            const discPercent = Number(item.discountPercent) || 0;
            const gstPercent = Number(item.gstPercentage) || 0;

            const gross = qty * rate;
            const discountAmt = gross * (discPercent / 100);
            const taxable = gross - discountAmt;
            const taxAmt = taxable * (gstPercent / 100);
            const total = taxable + taxAmt;

            subtotal += taxable;
            totalDiscount += discountAmt;
            totalTax += taxAmt;

            return {
                gross,
                discountAmt,
                taxable,
                taxAmt,
                total,
            };
        });

        const grandTotal = subtotal + totalTax;

        return {
            rowCalculations,
            subtotal,
            totalDiscount,
            totalTax,
            grandTotal,
            words: numberToIndianWords(grandTotal),
        };
    }, [items]);

    const selectedVendor = vendors.find((v) => v.id === vendorId);
    const selectedProject = projects.find((p) => p.id === projectId);

    // Save PO logic
    const handleSave = async (opts: { status?: string; sendToZoho?: boolean } = {}) => {
        if (!poNumber.trim()) {
            toast({
                title: "Validation Error",
                description: "PO Number is required.",
                variant: "destructive",
            });
            return;
        }
        if (!projectId) {
            toast({
                title: "Validation Error",
                description: "Please select a Project.",
                variant: "destructive",
            });
            return;
        }
        if (!vendorId) {
            toast({
                title: "Validation Error",
                description: "Please select a Vendor.",
                variant: "destructive",
            });
            return;
        }

        // Validate items
        const invalidItem = items.find((itm) => !itm.item.trim() || Number(itm.qty) <= 0);
        if (invalidItem) {
            toast({
                title: "Validation Error",
                description: "Every line item must have an Item Name and Quantity > 0.",
                variant: "destructive",
            });
            return;
        }

        const payload = {
            poNumber: poNumber.trim(),
            referenceNumber: referenceNumber.trim() || null,
            projectId,
            projectName: selectedProject?.name || null,
            vendorId,
            vendorName: selectedVendor?.name || null,
            status: editPoId ? (status || "draft") : "draft",
            poDate,
            deliveryDate: deliveryDate || null,
            paymentTerms,
            deliveryAddress,
            notes,
            items: items.map((itm) => ({
                materialId: itm.materialId || null,
                item: itm.item,
                description: itm.description || null,
                hsnCode: itm.hsnCode || null,
                sacCode: itm.sacCode || null,
                qty: Number(itm.qty) || 0,
                unit: itm.unit || "Nos",
                rate: Number(itm.rate) || 0,
                discountPercent: Number(itm.discountPercent) || 0,
                gstPercentage: Number(itm.gstPercentage) || 0,
            })),
        };

        try {
            if (opts.sendToZoho) {
                setIsSyncingZoho(true);
            } else {
                setIsSaving(true);
            }

            const url = editPoId
                ? `/api/manual-purchase-orders/${editPoId}`
                : "/api/manual-purchase-orders";
            const method = editPoId ? "PUT" : "POST";

            const res = await apiFetch(url, {
                method,
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || "Failed to save Purchase Order.");
            }

            const savedData = await res.json();
            const savedPoId = editPoId || savedData.purchaseOrder?.id;

            toast({
                title: "Success",
                description: editPoId
                    ? "Purchase Order updated successfully."
                    : "Purchase Order created successfully.",
            });

            // If user chose to sync directly to Zoho Books
            if (opts.sendToZoho && savedPoId) {
                try {
                    const syncRes = await apiFetch(
                        `/api/zoho-books/purchase-orders/${savedPoId}/sync`,
                        { method: "POST" }
                    );
                    const syncData = await syncRes.json();
                    if (syncRes.ok) {
                        toast({
                            title: "Zoho Books Synced",
                            description: `PO ${poNumber} synced to Zoho Books! (Zoho ID: ${syncData.zohoPurchaseOrderId})`,
                        });
                    } else {
                        toast({
                            title: "Zoho Sync Warning",
                            description:
                                syncData.message ||
                                "PO was saved locally, but Zoho Books sync failed. You can retry from the PO list.",
                            variant: "destructive",
                        });
                    }
                } catch (syncErr: any) {
                    toast({
                        title: "Zoho Sync Notice",
                        description:
                            syncErr?.message ||
                            "PO saved. Zoho Books sync encountered an issue. You can retry anytime.",
                    });
                }
            }

            // Redirect back to the Annexures page for the selected project
            const searchParams = new URLSearchParams(window.location.search);
            const returnProjectId = searchParams.get("returnProjectId") || searchParams.get("projectId") || projectId;
            if (returnProjectId) {
                setLocation(`/purchase-orders?projectId=${returnProjectId}`);
            } else {
                setLocation("/purchase-orders");
            }
        } catch (err: any) {
            console.error("Save PO error:", err);
            toast({
                title: "Error",
                description: err?.message || "Failed to save Purchase Order",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
            setIsSyncingZoho(false);
        }
    };

    // Print & PDF Export for Preview
    const handleDownloadPdf = () => {
        try {
            const doc = new jsPDF({ orientation: "portrait" });
            const pageWidth = doc.internal.pageSize.getWidth();
            const marginX = 14;

            // Brand Header
            doc.setFontSize(20);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 41, 59);
            doc.text("PURCHASE ORDER", marginX, 22);

            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text("CTINT PROCUREMENT & PROJECT INTERIORS", marginX, 28);

            // Right side PO info
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.text(`PO Number: ${poNumber}`, pageWidth - marginX, 20, { align: "right" });
            doc.text(`Date: ${poDate}`, pageWidth - marginX, 26, { align: "right" });
            if (deliveryDate) {
                doc.text(`Delivery Date: ${deliveryDate}`, pageWidth - marginX, 32, { align: "right" });
            }
            doc.text(`Payment Terms: ${paymentTerms}`, pageWidth - marginX, 38, { align: "right" });

            doc.setDrawColor(226, 232, 240);
            doc.line(marginX, 44, pageWidth - marginX, 44);

            // Vendor & Delivery boxes
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(71, 85, 105);
            doc.text("VENDOR DETAILS:", marginX, 52);
            doc.text("DELIVER TO / SITE DETAILS:", pageWidth / 2 + 5, 52);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(30, 41, 59);
            // Vendor details
            let vendorY = 58;
            doc.text(selectedVendor?.name || "N/A", marginX, vendorY);
            if (selectedVendor?.gstno) {
                vendorY += 5;
                doc.text(`GSTIN: ${selectedVendor.gstno}`, marginX, vendorY);
            }
            if (selectedVendor?.contactnumber) {
                vendorY += 5;
                doc.text(`Phone: ${selectedVendor.contactnumber}`, marginX, vendorY);
            }
            if (selectedVendor?.city || selectedVendor?.state) {
                vendorY += 5;
                doc.text(`${selectedVendor.city || ""}, ${selectedVendor.state || ""}`, marginX, vendorY);
            }

            // Project / Delivery details
            let projY = 58;
            doc.text(`Project: ${selectedProject?.name || "N/A"}`, pageWidth / 2 + 5, projY);
            if (selectedProject?.client) {
                projY += 5;
                doc.text(`Client: ${selectedProject.client}`, pageWidth / 2 + 5, projY);
            }
            if (deliveryAddress) {
                projY += 5;
                const splitAddr = doc.splitTextToSize(deliveryAddress, 80);
                doc.text(splitAddr, pageWidth / 2 + 5, projY);
            }

            const tableStartY = Math.max(vendorY, projY) + 12;

            // Items Table
            const headers = [
                ["#", "Item & Description", "HSN/SAC", "Qty", "Unit", "Rate (Rs)", "Disc %", "GST %", "Total (Rs)"]
            ];
            const body = items.map((itm, idx) => {
                const calc = calculation.rowCalculations[idx];
                return [
                    idx + 1,
                    `${itm.item}${itm.description ? `\n${itm.description}` : ""}`,
                    itm.hsnCode || "-",
                    itm.qty,
                    itm.unit,
                    itm.rate.toFixed(2),
                    itm.discountPercent > 0 ? `${itm.discountPercent}%` : "-",
                    `${itm.gstPercentage}%`,
                    calc.total.toFixed(2),
                ];
            });

            autoTable(doc, {
                head: headers,
                body: body,
                startY: tableStartY,
                margin: { left: marginX, right: marginX },
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            const finalY = (doc as any).lastAutoTable.finalY + 10;

            // Summary box on right
            const summaryX = pageWidth - marginX - 70;
            doc.setFontSize(9);
            doc.text(`Sub Total: Rs. ${calculation.subtotal.toFixed(2)}`, summaryX, finalY);
            doc.text(`Total Tax: Rs. ${calculation.totalTax.toFixed(2)}`, summaryX, finalY + 6);
            doc.setFont("helvetica", "bold");
            doc.text(`Grand Total: Rs. ${calculation.grandTotal.toFixed(2)}`, summaryX, finalY + 14);

            // Words on left
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(`Amount in Words: ${calculation.words}`, marginX, finalY + 6, { maxWidth: summaryX - marginX - 5 });

            // Terms
            if (termsAndConditions) {
                const termsY = finalY + 26;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.text("Terms and Conditions:", marginX, termsY);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                const splitTerms = doc.splitTextToSize(termsAndConditions, pageWidth - 2 * marginX);
                doc.text(splitTerms, marginX, termsY + 5);
            }

            doc.save(`${poNumber || "Purchase_Order"}.pdf`);
            toast({ title: "PDF Exported", description: "Purchase Order downloaded successfully." });
        } catch (e: any) {
            console.error("PDF export error", e);
            toast({ title: "Export Error", description: "Failed to generate PDF.", variant: "destructive" });
        }
    };

    if (isLoadingInitial) {
        return (
            <Layout>
                <div className="space-y-6">
                    <ProcurementTabBar active="purchase-orders" />
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground font-medium">Loading Purchase Order form...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6 pb-20">
                <ProcurementTabBar active="purchase-orders" />

                {/* Top Header & Action Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    const searchParams = new URLSearchParams(window.location.search);
                                    const returnProjectId = searchParams.get("returnProjectId") || searchParams.get("projectId") || projectId;
                                    if (returnProjectId) {
                                        setLocation(`/purchase-orders?projectId=${returnProjectId}`);
                                    } else {
                                        setLocation("/purchase-orders");
                                    }
                                }}
                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Back to Annexures
                            </Button>
                            <span className="text-slate-300">/</span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                                {editPoId ? "Edit Purchase Order" : "New Purchase Order"}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                {editPoId ? `Edit ${poNumber}` : "Create Purchase Order"}
                            </h1>
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 capitalize font-medium text-xs">
                                Status: {editPoId ? status : "Draft"}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Generate standard purchase orders, assign vendors, line items, and sync directly to Zoho Books.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewModalOpen(true)}
                            className="h-9 gap-1.5"
                        >
                            <Eye className="h-4 w-4" />
                            Preview PO
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSave({ status: "draft" })}
                            disabled={isSaving || isSyncingZoho}
                            className="h-9 gap-1.5"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Draft
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSave({ status: "approved", sendToZoho: true })}
                            disabled={isSaving || isSyncingZoho}
                            className="h-9 gap-1.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400"
                        >
                            {isSyncingZoho ? (
                                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                            ) : (
                                <UploadCloud className="h-4 w-4 text-emerald-600" />
                            )}
                            Save & Sync to Zoho
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => handleSave({ status: status || "draft" })}
                            disabled={isSaving || isSyncingZoho}
                            className="h-9 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {editPoId ? "Update Purchase Order" : "Generate Purchase Order"}
                        </Button>
                    </div>
                </div>

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
                                    Vendor / Supplier Name <span className="text-red-500">*</span>
                                </Label>
                                <Popover open={vendorComboboxOpen} onOpenChange={setVendorComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
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

                    {/* Right Card: PO Reference & Project Details */}
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
                                        Purchase Order # <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        value={poNumber}
                                        onChange={(e) => setPoNumber(e.target.value)}
                                        placeholder="PO-1001"
                                        className="mt-1 h-9 font-mono"
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
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={projectComboboxOpen}
                                                className="mt-1 w-full justify-between h-9 bg-white font-normal hover:bg-slate-50 border-input px-3"
                                            >
                                                <span className="truncate">
                                                    {selectedProject ? (
                                                        <span className="font-medium text-slate-900">
                                                            {selectedProject.name}
                                                            {selectedProject.client ? ` (${selectedProject.client})` : ""}
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
                                                        {projects.map((p) => (
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
                                        value={poDate}
                                        onChange={(e) => setPoDate(e.target.value)}
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

                {/* Section 2: Items Table (Zoho Books Style) */}
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
                                variant="outline"
                                size="sm"
                                onClick={() => openCatalogModal()}
                                className="h-8 gap-1.5 text-xs bg-white"
                            >
                                <Package className="h-3.5 w-3.5 text-primary" />
                                Add from Catalog
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleAddItemRow}
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
                                    {items.map((item, idx) => {
                                        const calc = calculation.rowCalculations[idx];
                                        return (
                                            <TableRow key={item.id} className="hover:bg-slate-50/60">
                                                <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                    {idx + 1}
                                                </TableCell>
                                                <TableCell className="space-y-1.5 py-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <Input
                                                            value={item.item}
                                                            onChange={(e) =>
                                                                handleItemFieldChange(idx, "item", e.target.value)
                                                            }
                                                            placeholder="Item / Material name *"
                                                            className="h-8 text-xs font-medium"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openCatalogModal(idx)}
                                                            title="Search catalog"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary flex-shrink-0"
                                                        >
                                                            <Search className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                    <Input
                                                        value={item.description}
                                                        onChange={(e) =>
                                                            handleItemFieldChange(idx, "description", e.target.value)
                                                        }
                                                        placeholder="Description or specification (optional)"
                                                        className="h-7 text-[11px] text-muted-foreground"
                                                    />
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Input
                                                        value={item.hsnCode}
                                                        onChange={(e) =>
                                                            handleItemFieldChange(idx, "hsnCode", e.target.value)
                                                        }
                                                        placeholder="HSN"
                                                        className="h-8 text-xs font-mono"
                                                    />
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Input
                                                        type="number"
                                                        step="any"
                                                        min="0"
                                                        value={item.qty === 0 ? "" : item.qty}
                                                        onChange={(e) =>
                                                            handleItemFieldChange(
                                                                idx,
                                                                "qty",
                                                                e.target.value === "" ? 0 : parseFloat(e.target.value)
                                                            )
                                                        }
                                                        placeholder="1"
                                                        className="h-8 text-xs font-mono"
                                                    />
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Select
                                                        value={item.unit || "Nos"}
                                                        onValueChange={(val) => handleItemFieldChange(idx, "unit", val)}
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
                                                        step="any"
                                                        min="0"
                                                        value={item.rate === 0 ? "" : item.rate}
                                                        onChange={(e) =>
                                                            handleItemFieldChange(
                                                                idx,
                                                                "rate",
                                                                e.target.value === "" ? 0 : parseFloat(e.target.value)
                                                            )
                                                        }
                                                        placeholder="0.00"
                                                        className="h-8 text-xs font-mono text-right"
                                                    />
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Input
                                                        type="number"
                                                        step="any"
                                                        min="0"
                                                        max="100"
                                                        value={item.discountPercent === 0 ? "" : item.discountPercent}
                                                        onChange={(e) =>
                                                            handleItemFieldChange(
                                                                idx,
                                                                "discountPercent",
                                                                e.target.value === "" ? 0 : parseFloat(e.target.value)
                                                            )
                                                        }
                                                        placeholder="0%"
                                                        className="h-8 text-xs font-mono text-right"
                                                    />
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Select
                                                        value={String(item.gstPercentage)}
                                                        onValueChange={(val) =>
                                                            handleItemFieldChange(idx, "gstPercentage", parseInt(val, 10))
                                                        }
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
                                                    ₹{calc?.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                                                    <div className="text-[10px] font-normal text-muted-foreground">
                                                        Tax: ₹{calc?.taxAmt?.toFixed(2) || "0.00"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center py-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveItemRow(idx)}
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
                                onClick={handleAddItemRow}
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

                {/* Section 3: Notes & Financial Summary (Zoho Books Style) */}
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
                                        ₹{calculation.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {calculation.totalDiscount > 0 && (
                                    <div className="flex justify-between items-center text-sm text-emerald-600">
                                        <span>Total Discount:</span>
                                        <span className="font-mono">
                                            -₹{calculation.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600">Total GST / Taxes:</span>
                                    <span className="font-mono font-medium text-slate-800">
                                        +₹{calculation.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div className="border-t border-slate-200 pt-3 pb-1 flex justify-between items-baseline">
                                    <span className="text-base font-bold text-slate-900">Grand Total:</span>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold font-mono text-primary">
                                            ₹{calculation.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-2.5 bg-slate-100/70 rounded-md text-[11px] text-slate-600 italic">
                                    <span className="font-semibold text-slate-700 not-italic">In Words: </span>
                                    {calculation.words}
                                </div>

                                <div className="pt-3 space-y-2">
                                    <Button
                                        onClick={() => handleSave({ status: status || "draft" })}
                                        disabled={isSaving || isSyncingZoho}
                                        className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                        )}
                                        {editPoId ? "Update Purchase Order" : "Generate Purchase Order"}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={() => handleSave({ status: "approved", sendToZoho: true })}
                                        disabled={isSaving || isSyncingZoho}
                                        className="w-full h-10 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                                    >
                                        {isSyncingZoho ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2 text-emerald-600" />
                                        ) : (
                                            <UploadCloud className="h-4 w-4 mr-2 text-emerald-600" />
                                        )}
                                        Save & Move to Zoho Books
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Material Catalog Selection Dialog */}
            <Dialog open={catalogModalOpen} onOpenChange={setCatalogModalOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-5 pb-3 border-b">
                        <DialogTitle className="text-lg font-bold">Select Material from Catalog</DialogTitle>
                        <DialogDescription className="text-xs">
                            Search and select a material to auto-fill description, HSN code, unit, and standard rate.
                        </DialogDescription>
                        <div className="pt-2 relative">
                            <Search className="absolute left-3 top-5 h-4 w-4 text-muted-foreground" />
                            <Input
                                autoFocus
                                value={catalogSearch}
                                onChange={(e) => setCatalogSearch(e.target.value)}
                                placeholder="Search by name, spec, or HSN code..."
                                className="pl-9 h-9"
                            />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1.5">
                            <span>{filteredMaterials.length} material{filteredMaterials.length === 1 ? "" : "s"} available</span>
                            {isSearchingCatalog && (
                                <span className="flex items-center gap-1 text-primary">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                                </span>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto max-h-[60vh] min-h-[300px] p-4 divide-y divide-slate-100">
                        {filteredMaterials.length === 0 ? (
                            <div className="py-12 text-center text-sm text-muted-foreground">
                                {isSearchingCatalog ? "Searching catalog..." : "No materials match your search."}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredMaterials.map((mat) => (
                                    <div
                                        key={mat.id}
                                        onClick={() => handleSelectMaterial(mat)}
                                        className="py-2.5 px-3 hover:bg-slate-50 cursor-pointer rounded-md flex items-center justify-between transition-colors"
                                    >
                                        <div className="min-w-0 pr-4">
                                            <p className="font-medium text-sm text-slate-900 truncate">
                                                {mat.name}
                                            </p>
                                            {mat.technicalspecification && (
                                                <p className="text-xs text-muted-foreground truncate max-w-md">
                                                    {mat.technicalspecification}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                                                {(mat.hsn_code || mat.hsn_sac_code) && (
                                                    <span>HSN: <span className="font-mono">{mat.hsn_code || mat.hsn_sac_code}</span></span>
                                                )}
                                                <span>Unit: {mat.unit || "Nos"}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <span className="font-mono text-sm font-semibold text-slate-800">
                                                ₹{Number(mat.rate ?? mat.supply_rate ?? 0).toFixed(2)}
                                            </span>
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-primary block mt-1">
                                                Select
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter className="p-3 border-t bg-slate-50">
                        <Button variant="outline" size="sm" onClick={() => setCatalogModalOpen(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Professional PO Preview Modal */}
            <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-slate-50">
                        <div>
                            <DialogTitle className="text-base font-bold">Purchase Order Preview</DialogTitle>
                            <DialogDescription className="text-xs">
                                Formatted document view for {poNumber || "PO-DRAFT"}
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.print()}
                                className="h-8 gap-1.5 text-xs"
                            >
                                <Printer className="h-3.5 w-3.5" />
                                Print
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleDownloadPdf}
                                className="h-8 gap-1.5 text-xs bg-primary"
                            >
                                <FileText className="h-3.5 w-3.5" />
                                Download PDF
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto max-h-[75vh] p-6 bg-slate-100/50">
                        <div
                            id="preview-po-document"
                            className="bg-white p-8 max-w-3xl mx-auto shadow-sm border border-slate-200 rounded-lg text-slate-800 text-xs space-y-6"
                        >
                            {/* Document Header */}
                            <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight text-slate-900">PURCHASE ORDER</h2>
                                    <p className="font-semibold text-primary mt-1 text-sm">CTINT INTERIORS</p>
                                    <p className="text-slate-500 text-[11px]">Procurement & Supply Chain Division</p>
                                </div>
                                <div className="text-right space-y-1">
                                    <div className="text-sm font-bold font-mono text-slate-900">
                                        PO #: {poNumber || "PO-PENDING"}
                                    </div>
                                    {referenceNumber && (
                                        <div className="text-slate-500">Ref #: {referenceNumber}</div>
                                    )}
                                    <div className="text-slate-600">Date: {poDate}</div>
                                    {deliveryDate && (
                                        <div className="text-slate-600">Expected Delivery: {deliveryDate}</div>
                                    )}
                                    <div className="text-slate-600">Payment: {paymentTerms}</div>
                                </div>
                            </div>

                            {/* Vendor & Delivery 2-box row */}
                            <div className="grid grid-cols-2 gap-6 bg-slate-50/70 p-4 rounded-md border border-slate-200/70">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                        Vendor Details
                                    </p>
                                    <p className="font-bold text-slate-900 text-sm">
                                        {selectedVendor?.name || "Vendor Not Selected"}
                                    </p>
                                    <p className="text-slate-600 mt-1 whitespace-pre-line">
                                        {selectedVendor?.location || selectedVendor?.city || "Address not provided"}
                                        {selectedVendor?.state ? `, ${selectedVendor.state}` : ""}
                                        {selectedVendor?.pincode ? ` - ${selectedVendor.pincode}` : ""}
                                    </p>
                                    {selectedVendor?.gstno && (
                                        <p className="mt-1 font-mono text-[11px] text-slate-700">
                                            <span className="font-semibold text-slate-500">GSTIN:</span> {selectedVendor.gstno}
                                        </p>
                                    )}
                                    {selectedVendor?.contactnumber && (
                                        <p className="text-slate-600">
                                            <span className="font-semibold text-slate-500">Ph:</span> {selectedVendor.contactnumber}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                        Deliver To / Project Site
                                    </p>
                                    <p className="font-bold text-slate-900 text-sm">
                                        {selectedProject?.name || "Project Not Selected"}
                                    </p>
                                    {selectedProject?.client && (
                                        <p className="text-slate-600 mt-0.5">Client: {selectedProject.client}</p>
                                    )}
                                    <p className="text-slate-600 mt-1 whitespace-pre-line">
                                        {deliveryAddress || selectedProject?.location || "Site delivery address not specified"}
                                    </p>
                                </div>
                            </div>

                            {/* Item Table */}
                            <div className="border border-slate-200 rounded-md overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-800 text-white font-semibold">
                                        <tr>
                                            <th className="py-2 px-3 text-center w-8">#</th>
                                            <th className="py-2 px-3">Item & Description</th>
                                            <th className="py-2 px-3 text-center">HSN/SAC</th>
                                            <th className="py-2 px-3 text-right">Qty</th>
                                            <th className="py-2 px-3">Unit</th>
                                            <th className="py-2 px-3 text-right">Rate</th>
                                            <th className="py-2 px-3 text-right">Disc%</th>
                                            <th className="py-2 px-3 text-right">GST%</th>
                                            <th className="py-2 px-3 text-right">Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {items.map((itm, i) => {
                                            const calc = calculation.rowCalculations[i];
                                            return (
                                                <tr key={itm.id} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                                                    <td className="py-2 px-3 text-center font-mono text-slate-500">{i + 1}</td>
                                                    <td className="py-2 px-3">
                                                        <div className="font-semibold text-slate-900">{itm.item || "Untitled Item"}</div>
                                                        {itm.description && (
                                                            <div className="text-[11px] text-slate-500">{itm.description}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-mono text-slate-600">{itm.hsnCode || "-"}</td>
                                                    <td className="py-2 px-3 text-right font-mono font-medium">{itm.qty}</td>
                                                    <td className="py-2 px-3 text-slate-600">{itm.unit}</td>
                                                    <td className="py-2 px-3 text-right font-mono">{itm.rate.toFixed(2)}</td>
                                                    <td className="py-2 px-3 text-right font-mono">{itm.discountPercent > 0 ? `${itm.discountPercent}%` : "-"}</td>
                                                    <td className="py-2 px-3 text-right font-mono">{itm.gstPercentage}%</td>
                                                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                                        {calc?.total?.toFixed(2) || "0.00"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Summary Totals */}
                            <div className="flex justify-end">
                                <div className="w-72 space-y-2 border-t border-slate-200 pt-3">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Sub Total:</span>
                                        <span className="font-mono">₹{calculation.subtotal.toFixed(2)}</span>
                                    </div>
                                    {calculation.totalDiscount > 0 && (
                                        <div className="flex justify-between text-emerald-600">
                                            <span>Discount:</span>
                                            <span className="font-mono">-₹{calculation.totalDiscount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-slate-600">
                                        <span>Total GST:</span>
                                        <span className="font-mono">+₹{calculation.totalTax.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                                        <span>Grand Total:</span>
                                        <span className="font-mono text-primary text-base">
                                            ₹{calculation.grandTotal.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Words */}
                            <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200/60">
                                <span className="font-semibold text-slate-700">Total in Words: </span>
                                {calculation.words}
                            </div>

                            {/* Notes & Terms */}
                            {notes && (
                                <div className="space-y-1">
                                    <p className="font-semibold text-slate-700 text-xs">Notes / Instructions:</p>
                                    <p className="text-slate-600 text-[11px] whitespace-pre-line">{notes}</p>
                                </div>
                            )}

                            {termsAndConditions && (
                                <div className="space-y-1 border-t border-slate-200 pt-3">
                                    <p className="font-semibold text-slate-700 text-xs">Terms & Conditions:</p>
                                    <p className="text-slate-500 text-[10px] whitespace-pre-line font-mono leading-relaxed">
                                        {termsAndConditions}
                                    </p>
                                </div>
                            )}

                            {/* Signatures */}
                            <div className="pt-10 flex justify-between items-end border-t border-slate-200 text-xs">
                                <div className="text-center">
                                    <div className="w-40 border-b border-slate-300 pb-1 text-slate-400">Accepted By</div>
                                    <p className="mt-1 text-slate-600 text-[11px]">Vendor Signature & Stamp</p>
                                </div>
                                <div className="text-center">
                                    <div className="w-40 border-b border-slate-300 pb-1 text-slate-400">Authorized Signature</div>
                                    <p className="mt-1 text-slate-600 text-[11px]">For CTINT INTERIORS</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}

import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    FileDown,
    FileSpreadsheet,
    Search,
    Plus,
    Filter,
    FileText,
    Calendar,
    Building2,
    IndianRupee,
    ChevronRight,
    Loader2,
    CheckCircle2,
    Clock,
    XCircle,
    Truck,
    Trash2,
    UploadCloud,
    AlertCircle,
    PlusCircle,
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import ProcurementTabBar from "@/components/ProcurementTabBar";

interface PurchaseOrder {
    id: string;
    po_number: string;
    project_id: string;
    vendor_id: string;
    status: string;
    total_amount: string;
    created_at: string;
    project_name?: string;
    vendor_name?: string;
    version_number?: string;
    version_id?: string;
    is_current_final_version?: boolean;
    materials_list?: string;
    zoho_purchase_order_id?: string | null;
    zoho_sync_status?: "not_synced" | "syncing" | "synced" | "failed" | null;
    zoho_synced_at?: string | null;
    zoho_sync_error?: string | null;
}

interface Project {
    id: string;
    name: string;
}

export default function PurchaseOrders() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem("po_search_query") || "");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [projectFilter, setProjectFilter] = useState<string>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get("projectId") || "all";
    });
    const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get("projectId") || "";
    });
    const [projectSearch, setProjectSearch] = useState<string>("");
    const [deletingPo, setDeletingPo] = useState<PurchaseOrder | null>(null);

    // Bulk Delete State
    const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(new Set());
    const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    // Bulk Move to Delivery Tracker State
    const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
    const [isMovingBulk, setIsMovingBulk] = useState(false);

    // PDF Export State
    const [isPdfExportDialogOpen, setIsPdfExportDialogOpen] = useState(false);
    const [selectedPdfExportCols, setSelectedPdfExportCols] = useState<string[]>([]);
    const [exportingPo, setExportingPo] = useState<PurchaseOrder | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const handleDownloadPdfOpenDialog = (po: PurchaseOrder, e: React.MouseEvent) => {
        e.stopPropagation();
        setExportingPo(po);

        const potentialPdfCols = ["S.No", "Item Details", "Unit", "HSN", "SAC", "Original Qty", "Ordered Qty", "Balance Qty", "Tax %", "Rate", "Amount"];
        const defaultPdfSelection = ["S.No", "Item Details", "Unit", "HSN", "SAC", "Original Qty", "Ordered Qty", "Balance Qty", "Tax %", "Rate", "Amount"];

        try {
            const saved = localStorage.getItem('po_pdf_export_cols');
            if (saved) {
                const parsed: string[] = JSON.parse(saved);
                const valid = parsed.filter(c => potentialPdfCols.includes(c));
                setSelectedPdfExportCols(valid.length > 0 ? valid : defaultPdfSelection);
            } else {
                setSelectedPdfExportCols(defaultPdfSelection);
            }
        } catch {
            setSelectedPdfExportCols(defaultPdfSelection);
        }
        setIsPdfExportDialogOpen(true);
    };

    const handleDownloadPdf = async () => {
        if (!exportingPo) return;
        setIsGeneratingPdf(true);

        try {
            localStorage.setItem('po_pdf_export_cols', JSON.stringify(selectedPdfExportCols));

            // Fetch PO Detail for items
            const res = await apiFetch(`/api/purchase-orders/${exportingPo.id}`);
            if (!res.ok) throw new Error("Failed to fetch PO details");
            const data = await res.json();
            const poDetail = data.purchaseOrder;
            const poItems = data.items || [];

            const doc = new jsPDF({ orientation: "portrait" });
            const pageWidth = doc.internal.pageSize.getWidth();
            const marginX = 10;

            // Header Section
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("PURCHASE ORDER", pageWidth / 2, 20, { align: "center" });

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`PO Number: ${poDetail.po_number}`, marginX, 35);
            doc.text(`Date: ${new Date(poDetail.created_at).toLocaleDateString()}`, marginX, 40);
            doc.text(`Project: ${poDetail.project_name || "N/A"}`, marginX, 45);
            doc.text(`Vendor: ${poDetail.vendor_name || "N/A"}`, marginX, 50);

            // Table Section
            const headers = selectedPdfExportCols;
            const body = poItems.map((item: any, idx: number) => {
                const row: any[] = [];
                if (selectedPdfExportCols.includes("S.No")) row.push(idx + 1);
                if (selectedPdfExportCols.includes("Item")) row.push(item.item || "N/A");
                if (selectedPdfExportCols.includes("Description")) row.push(item.description || "N/A");
                if (selectedPdfExportCols.includes("HSN/SAC")) row.push(item.hsn_code || item.sac_code || "N/A");
                if (selectedPdfExportCols.includes("Unit")) row.push(item.unit || "N/A");
                if (selectedPdfExportCols.includes("Qty")) row.push(parseFloat(item.qty).toFixed(2));
                if (selectedPdfExportCols.includes("Rate")) row.push(parseFloat(item.rate).toFixed(2));
                if (selectedPdfExportCols.includes("Total")) row.push(parseFloat(item.amount).toFixed(2));
                return row;
            });

            autoTable(doc, {
                head: [headers],
                body: body,
                startY: 60,
                margin: { left: marginX, right: marginX },
                styles: { fontSize: 9 },
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                foot: [[
                    ...Array(headers.length - 2).fill(""),
                    "Total Amount",
                    `INR ${parseFloat(poDetail.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                ]],
                footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
            });

            doc.save(`PO_${poDetail.po_number}.pdf`);
            setIsPdfExportDialogOpen(false);
            toast({ title: "Success", description: "PDF generated successfully" });
        } catch (error) {
            console.error("PDF Export Error:", error);
            toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const [downloadingExcelId, setDownloadingExcelId] = useState<string | null>(null);

    const handleDownloadExcel = async (po: PurchaseOrder, e: React.MouseEvent) => {
        e.stopPropagation();
        setDownloadingExcelId(po.id);
        try {
            // Fetch PO Detail for items — same source of truth used by the PDF export.
            const res = await apiFetch(`/api/purchase-orders/${po.id}`);
            if (!res.ok) throw new Error("Failed to fetch PO details");
            const data = await res.json();
            const poDetail = data.purchaseOrder;
            const poItems = data.items || [];

            const headerRows: any[][] = [
                ["PURCHASE ORDER"],
                [],
                ["PO Number", poDetail.po_number],
                ["Date", new Date(poDetail.created_at).toLocaleDateString()],
                ["Project", poDetail.project_name || "N/A"],
                ["Vendor", poDetail.vendor_name || "N/A"],
                [],
            ];

            const tableHeader = ["S.No", "Item", "Unit", "HSN/SAC", "Qty", "Rate", "Amount"];
            const tableRows = poItems.map((item: any, idx: number) => [
                idx + 1,
                item.item || "N/A",
                item.unit || "N/A",
                item.hsn_code || item.sac_code || "N/A",
                parseFloat(item.qty || 0),
                parseFloat(item.rate || 0),
                parseFloat(item.amount || 0),
            ]);

            const footerRow = [
                "", "", "", "", "", "Total Amount",
                parseFloat(poDetail.total_amount || 0),
            ];

            const sheetData = [...headerRows, tableHeader, ...tableRows, footerRow];
            const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
            worksheet["!cols"] = [
                { wch: 6 }, { wch: 35 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Order");
            XLSX.writeFile(workbook, `PO_${poDetail.po_number}.xlsx`);

            toast({ title: "Success", description: "Excel file generated successfully" });
        } catch (error) {
            console.error("Excel Export Error:", error);
            toast({ title: "Error", description: "Failed to generate Excel file", variant: "destructive" });
        } finally {
            setDownloadingExcelId(null);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [poRes, projectRes] = await Promise.all([
                apiFetch("/api/purchase-orders"),
                apiFetch("/api/boq-projects")
            ]);

            if (poRes.ok && projectRes.ok) {
                const poData = await poRes.json();
                const projectData = await projectRes.json();
                const allPOs: PurchaseOrder[] = poData.purchaseOrders || [];
                setPurchaseOrders(allPOs.filter(po => po.is_current_final_version !== false));
                setProjects(projectData.projects || []);
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load Annexures.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const [movingPoId, setMovingPoId] = useState<string | null>(null);

    const handleMoveToDeliveryTracker = async (po: PurchaseOrder, e: React.MouseEvent) => {
        e.stopPropagation();
        setMovingPoId(po.id);
        try {
            const res = await apiFetch(`/api/purchase-orders/${po.id}/move-to-delivery-tracker`, {
                method: "POST",
            });
            if (res.ok) {
                toast({
                    title: "Moved to Delivery Tracker",
                    description: `${po.po_number} is now tracked under ${po.project_name || "its project"}.`,
                });
                setLocation(`/delivery-tracker?projectId=${po.project_id}`);
            } else {
                const data = await res.json().catch(() => ({}));
                toast({
                    title: "Error",
                    description: data.message || "Failed to move Annexure to Delivery Tracker.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to move Annexure to Delivery Tracker.",
                variant: "destructive",
            });
        } finally {
            setMovingPoId(null);
        }
    };

    // ===== Move to Zoho Books (additive; does not affect Annexure flow) =====
    const [zohoSyncingId, setZohoSyncingId] = useState<string | null>(null);
    const [zohoConfirmPo, setZohoConfirmPo] = useState<PurchaseOrder | null>(null);
    const [zohoResultPo, setZohoResultPo] = useState<{
        po: PurchaseOrder;
        success: boolean;
        message: string;
        zohoPurchaseOrderId?: string;
        syncedAt?: string;
    } | null>(null);

    // Manual vendor mapping fallback (used when automatic matching can't
    // safely resolve a vendor - ambiguous or not found in Zoho Books).
    const [zohoMappingPo, setZohoMappingPo] = useState<PurchaseOrder | null>(null);
    const [zohoMappingCandidates, setZohoMappingCandidates] = useState<{ id: string; name: string }[]>([]);
    const [zohoMappingSearch, setZohoMappingSearch] = useState("");
    const [zohoMappingSearchResults, setZohoMappingSearchResults] = useState<{ id: string; name: string }[]>([]);
    const [zohoMappingSearching, setZohoMappingSearching] = useState(false);
    const [zohoMappingSavingId, setZohoMappingSavingId] = useState<string | null>(null);

    // Manual material mapping fallback (used when automatic matching can't
    // safely resolve a material - ambiguous or not found in Zoho Books).
    // Also offers creating a brand-new Zoho Books item when it genuinely
    // doesn't exist yet.
    const [zohoMaterialMappingPo, setZohoMaterialMappingPo] = useState<PurchaseOrder | null>(null);
    const [zohoMaterialMappingMaterialId, setZohoMaterialMappingMaterialId] = useState<string | null>(null);
    const [zohoMaterialMappingMaterialName, setZohoMaterialMappingMaterialName] = useState<string>("");
    const [zohoMaterialMappingMaterialRate, setZohoMaterialMappingMaterialRate] = useState<number>(0);
    const [zohoMaterialMappingCandidates, setZohoMaterialMappingCandidates] = useState<{ id: string; name: string }[]>([]);
    const [zohoMaterialMappingSearch, setZohoMaterialMappingSearch] = useState("");
    const [zohoMaterialMappingSearchResults, setZohoMaterialMappingSearchResults] = useState<{ id: string; name: string }[]>([]);
    const [zohoMaterialMappingSearching, setZohoMaterialMappingSearching] = useState(false);
    const [zohoMaterialMappingSavingId, setZohoMaterialMappingSavingId] = useState<string | null>(null);
    const [zohoMaterialCreating, setZohoMaterialCreating] = useState(false);
    const [zohoMaterialCreateName, setZohoMaterialCreateName] = useState("");
    const [zohoMaterialCreateRate, setZohoMaterialCreateRate] = useState("");

    // One-time "set a default tax" flow - fires when a material's Zoho Books
    // item has no tax of its own and no org-level default is configured yet.
    // Zoho Books GST (India) organizations reject any PO line item without
    // a Tax/Tax Exemption/Reverse Charge declared. Setting this once here
    // fixes every future material that's missing its own tax, instead of
    // hitting this dialog over and over for each one.
    const [zohoTaxSetupPo, setZohoTaxSetupPo] = useState<PurchaseOrder | null>(null);
    const [zohoTaxSetupMaterialName, setZohoTaxSetupMaterialName] = useState("");
    const [zohoTaxes, setZohoTaxes] = useState<{ id: string; name: string }[]>([]);
    const [zohoTaxesLoading, setZohoTaxesLoading] = useState(false);
    const [zohoTaxesError, setZohoTaxesError] = useState<string | null>(null);
    const [zohoTaxSavingId, setZohoTaxSavingId] = useState<string | null>(null);

    const openZohoConfirm = (po: PurchaseOrder, e: React.MouseEvent) => {
        e.stopPropagation();
        setZohoConfirmPo(po);
    };

    const runZohoSync = async (po: PurchaseOrder) => {
        setZohoSyncingId(po.id);
        try {
            const res = await apiFetch(`/api/zoho-books/purchase-orders/${po.id}/sync`, {
                method: "POST",
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                setPurchaseOrders((prev) =>
                    prev.map((p) =>
                        p.id === po.id
                            ? {
                                ...p,
                                zoho_sync_status: "synced",
                                zoho_purchase_order_id: data.zohoPurchaseOrderId,
                                zoho_synced_at: data.zohoSyncedAt,
                                zoho_sync_error: null,
                            }
                            : p
                    )
                );
                setZohoResultPo({
                    po,
                    success: true,
                    message: data.alreadySynced
                        ? "This Purchase Order was already synced to Zoho Books."
                        : "Purchase Order successfully moved to Zoho Books.",
                    zohoPurchaseOrderId: data.zohoPurchaseOrderId,
                    syncedAt: data.zohoSyncedAt,
                });
            } else {
                const message = data.message || "Something went wrong while syncing to Zoho Books.";
                setPurchaseOrders((prev) =>
                    prev.map((p) =>
                        p.id === po.id ? { ...p, zoho_sync_status: "failed", zoho_sync_error: message } : p
                    )
                );
                if (data.taxSetupRequired) {
                    // No tax available for this material and no org-level
                    // default configured yet - offer a one-time picker
                    // instead of a dead-end error (and instead of hitting
                    // this same wall again for the next untaxed material).
                    setZohoTaxSetupPo(po);
                    setZohoTaxSetupMaterialName(data.materialName || "this material");
                    fetchZohoTaxes();
                } else if (data.zohoMappingRequired && data.mappingType === "material") {
                    // Material mapping couldn't be resolved automatically - offer
                    // manual mapping or creating a new Zoho Books item instead of
                    // just showing a dead-end error.
                    setZohoMaterialMappingPo(po);
                    setZohoMaterialMappingMaterialId(data.materialId || null);
                    setZohoMaterialMappingMaterialName(data.materialName || "this material");
                    setZohoMaterialMappingMaterialRate(Number(data.materialRate) || 0);
                    setZohoMaterialMappingCandidates(Array.isArray(data.candidates) ? data.candidates : []);
                    setZohoMaterialMappingSearch("");
                    setZohoMaterialMappingSearchResults([]);
                    setZohoMaterialCreateName(data.materialName || "");
                    setZohoMaterialCreateRate(data.materialRate ? String(data.materialRate) : "");
                } else if (data.zohoMappingRequired) {
                    // Vendor mapping couldn't be resolved automatically - offer
                    // manual mapping instead of just showing a dead-end error.
                    setZohoMappingPo(po);
                    setZohoMappingCandidates(Array.isArray(data.candidates) ? data.candidates : []);
                    setZohoMappingSearch("");
                    setZohoMappingSearchResults([]);
                } else {
                    setZohoResultPo({ po, success: false, message });
                }
            }
        } catch (error) {
            const message = "Network error while syncing to Zoho Books. Please retry.";
            setPurchaseOrders((prev) =>
                prev.map((p) =>
                    p.id === po.id ? { ...p, zoho_sync_status: "failed", zoho_sync_error: message } : p
                )
            );
            setZohoResultPo({ po, success: false, message });
        } finally {
            setZohoSyncingId(null);
        }
    };

    const handleSendToZohoBooks = async () => {
        const po = zohoConfirmPo;
        if (!po) return;
        setZohoConfirmPo(null);
        await runZohoSync(po);
    };

    const zohoMappingSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleZohoMappingSearchChange = (value: string) => {
        setZohoMappingSearch(value);
        if (zohoMappingSearchTimer.current) clearTimeout(zohoMappingSearchTimer.current);
        if (value.trim().length < 2) {
            setZohoMappingSearchResults([]);
            return;
        }
        zohoMappingSearchTimer.current = setTimeout(async () => {
            setZohoMappingSearching(true);
            try {
                const res = await apiFetch(`/api/zoho-books/vendors/search?q=${encodeURIComponent(value.trim())}`);
                const data = await res.json().catch(() => ({}));
                setZohoMappingSearchResults(res.ok && Array.isArray(data.vendors) ? data.vendors : []);
            } catch {
                setZohoMappingSearchResults([]);
            } finally {
                setZohoMappingSearching(false);
            }
        }, 350);
    };

    const handleSelectZohoVendorMapping = async (vendor: { id: string; name: string }) => {
        const po = zohoMappingPo;
        if (!po) return;
        setZohoMappingSavingId(vendor.id);
        try {
            const res = await apiFetch(`/api/zoho-books/purchase-orders/${po.id}/map-vendor`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ zohoContactId: vendor.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast({
                    title: "Vendor mapped",
                    description: `"${po.vendor_name || "Vendor"}" mapped to "${vendor.name}" in Zoho Books.`,
                });
                setZohoMappingPo(null);
                setZohoMappingCandidates([]);
                setZohoMappingSearchResults([]);
                await runZohoSync(po);
            } else {
                toast({
                    title: "Could not save mapping",
                    description: data.message || "Please try again.",
                    variant: "destructive",
                });
            }
        } catch {
            toast({
                title: "Network error",
                description: "Could not save vendor mapping. Please try again.",
                variant: "destructive",
            });
        } finally {
            setZohoMappingSavingId(null);
        }
    };

    const zohoMaterialMappingSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleZohoMaterialMappingSearchChange = (value: string) => {
        setZohoMaterialMappingSearch(value);
        if (zohoMaterialMappingSearchTimer.current) clearTimeout(zohoMaterialMappingSearchTimer.current);
        if (value.trim().length < 2) {
            setZohoMaterialMappingSearchResults([]);
            return;
        }
        zohoMaterialMappingSearchTimer.current = setTimeout(async () => {
            setZohoMaterialMappingSearching(true);
            try {
                const res = await apiFetch(`/api/zoho-books/items/search?q=${encodeURIComponent(value.trim())}`);
                const data = await res.json().catch(() => ({}));
                setZohoMaterialMappingSearchResults(res.ok && Array.isArray(data.items) ? data.items : []);
            } catch {
                setZohoMaterialMappingSearchResults([]);
            } finally {
                setZohoMaterialMappingSearching(false);
            }
        }, 350);
    };

    const closeZohoMaterialMappingDialog = () => {
        setZohoMaterialMappingPo(null);
        setZohoMaterialMappingMaterialId(null);
        setZohoMaterialMappingMaterialName("");
        setZohoMaterialMappingMaterialRate(0);
        setZohoMaterialMappingCandidates([]);
        setZohoMaterialMappingSearch("");
        setZohoMaterialMappingSearchResults([]);
        setZohoMaterialCreateName("");
        setZohoMaterialCreateRate("");
    };

    const handleSelectZohoItemMapping = async (item: { id: string; name: string }) => {
        const po = zohoMaterialMappingPo;
        const materialId = zohoMaterialMappingMaterialId;
        if (!po || !materialId) return;
        setZohoMaterialMappingSavingId(item.id);
        try {
            const res = await apiFetch(`/api/zoho-books/purchase-orders/${po.id}/map-material`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ materialId, zohoItemId: item.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast({
                    title: "Material mapped",
                    description: `"${zohoMaterialMappingMaterialName}" mapped to "${item.name}" in Zoho Books.`,
                });
                closeZohoMaterialMappingDialog();
                await runZohoSync(po);
            } else {
                toast({
                    title: "Could not save mapping",
                    description: data.message || "Please try again.",
                    variant: "destructive",
                });
            }
        } catch {
            toast({
                title: "Network error",
                description: "Could not save material mapping. Please try again.",
                variant: "destructive",
            });
        } finally {
            setZohoMaterialMappingSavingId(null);
        }
    };

    const handleCreateZohoMaterial = async () => {
        const po = zohoMaterialMappingPo;
        const materialId = zohoMaterialMappingMaterialId;
        if (!po || !materialId) return;
        const name = zohoMaterialCreateName.trim();
        if (!name) {
            toast({ title: "Item name required", description: "Please enter a name for the new item.", variant: "destructive" });
            return;
        }
        const rate = Number(zohoMaterialCreateRate);
        setZohoMaterialCreating(true);
        try {
            const res = await apiFetch(`/api/zoho-books/purchase-orders/${po.id}/create-material`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ materialId, name, rate: Number.isFinite(rate) ? rate : 0 }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast({
                    title: "Item created in Zoho Books",
                    description: `"${name}" was created and mapped to "${zohoMaterialMappingMaterialName}".`,
                });
                closeZohoMaterialMappingDialog();
                await runZohoSync(po);
            } else {
                toast({
                    title: "Could not create item",
                    description: data.message || "Please try again.",
                    variant: "destructive",
                });
            }
        } catch {
            toast({
                title: "Network error",
                description: "Could not create the item in Zoho Books. Please try again.",
                variant: "destructive",
            });
        } finally {
            setZohoMaterialCreating(false);
        }
    };

    const fetchZohoTaxes = async () => {
        setZohoTaxesLoading(true);
        setZohoTaxesError(null);
        try {
            const res = await apiFetch(`/api/zoho-books/taxes`);
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setZohoTaxes(Array.isArray(data.taxes) ? data.taxes : []);
            } else {
                setZohoTaxes([]);
                setZohoTaxesError(data.message || "Could not load taxes from Zoho Books.");
            }
        } catch {
            setZohoTaxes([]);
            setZohoTaxesError("Network error while loading taxes from Zoho Books.");
        } finally {
            setZohoTaxesLoading(false);
        }
    };

    const closeZohoTaxSetupDialog = () => {
        setZohoTaxSetupPo(null);
        setZohoTaxSetupMaterialName("");
        setZohoTaxes([]);
        setZohoTaxesError(null);
    };

    const handleSaveDefaultTax = async (tax: { id: string; name: string }) => {
        const po = zohoTaxSetupPo;
        if (!po) return;
        setZohoTaxSavingId(tax.id);
        try {
            const res = await apiFetch(`/api/zoho-books/settings/default-tax`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taxId: tax.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast({
                    title: "Default tax set",
                    description: `"${tax.name}" will be used automatically for any material without its own tax in Zoho Books.`,
                });
                closeZohoTaxSetupDialog();
                await runZohoSync(po);
            } else {
                toast({
                    title: "Could not save default tax",
                    description: data.message || "Please try again.",
                    variant: "destructive",
                });
            }
        } catch {
            toast({
                title: "Network error",
                description: "Could not save the default tax. Please try again.",
                variant: "destructive",
            });
        } finally {
            setZohoTaxSavingId(null);
        }
    };

    const handleDelete = async () => {
        if (!deletingPo) return;
        try {
            const res = await apiFetch(`/api/purchase-orders/${deletingPo.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast({
                    title: "Deleted",
                    description: `Annexure ${deletingPo.po_number} has been deleted.`,
                });
                setPurchaseOrders((prev) => prev.filter((po) => po.id !== deletingPo.id));
            } else {
                const data = await res.json();
                toast({
                    title: "Error",
                    description: data.message || "Failed to delete Annexure.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete Annexure.",
                variant: "destructive",
            });
        } finally {
            setDeletingPo(null);
        }
    };

    const toggleSelectAll = () => {
        if (selectedPoIds.size === filteredPOs.length && filteredPOs.length > 0) {
            setSelectedPoIds(new Set());
        } else {
            setSelectedPoIds(new Set(filteredPOs.map((po) => po.id)));
        }
    };

    const toggleSelectPo = (id: string, e?: React.ChangeEvent) => {
        if (e) e.stopPropagation();
        setSelectedPoIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleBulkDelete = async () => {
        setIsDeletingBulk(true);
        try {
            const promises = Array.from(selectedPoIds).map(id =>
                apiFetch(`/api/purchase-orders/${id}`, { method: "DELETE" })
            );
            await Promise.all(promises);

            toast({
                title: "Deleted",
                description: `Successfully deleted ${selectedPoIds.size} Annexures.`,
            });

            setPurchaseOrders((prev) => prev.filter((po) => !selectedPoIds.has(po.id)));
            setSelectedPoIds(new Set());
            setShowBulkDeleteDialog(false);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete some Annexures.",
                variant: "destructive",
            });
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const [isBulkExportingExcel, setIsBulkExportingExcel] = useState(false);

    const handleBulkDownloadExcel = () => {
        if (selectedPoIds.size === 0) return;
        setIsBulkExportingExcel(true);
        try {
            const selectedPOs = purchaseOrders.filter((po) => selectedPoIds.has(po.id));

            const tableHeader = ["Project", "Vendor", "Amount"];
            const tableRows = selectedPOs.map((po) => [
                po.project_name || "N/A",
                po.vendor_name || "N/A",
                parseFloat(po.total_amount || "0"),
            ]);

            const totalAmount = selectedPOs.reduce(
                (sum, po) => sum + parseFloat(po.total_amount || "0"),
                0
            );
            const footerRow = ["", "Total", totalAmount];

            const sheetData = [tableHeader, ...tableRows, footerRow];
            const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
            worksheet["!cols"] = [{ wch: 32 }, { wch: 32 }, { wch: 18 }];

            const lastRowIdx = sheetData.length - 1; // footer row index
            const thinBorder = {
                top: { style: "thin", color: { rgb: "B0B0B0" } },
                bottom: { style: "thin", color: { rgb: "B0B0B0" } },
                left: { style: "thin", color: { rgb: "B0B0B0" } },
                right: { style: "thin", color: { rgb: "B0B0B0" } },
            };

            for (let r = 0; r < sheetData.length; r++) {
                for (let c = 0; c < tableHeader.length; c++) {
                    const addr = XLSX.utils.encode_cell({ r, c });
                    if (!worksheet[addr]) continue;

                    if (r === 0) {
                        // Header row — bold white text on a blue fill, centered
                        worksheet[addr].s = {
                            font: { bold: true, color: { rgb: "FFFFFF" } },
                            fill: { patternType: "solid", fgColor: { rgb: "2980B9" } },
                            alignment: { horizontal: "center", vertical: "center" },
                            border: thinBorder,
                        };
                    } else if (r === lastRowIdx) {
                        // Footer / total row — bold with light grey fill
                        worksheet[addr].s = {
                            font: { bold: true },
                            fill: { patternType: "solid", fgColor: { rgb: "F0F0F0" } },
                            alignment: {
                                horizontal: c === 2 ? "right" : (c === 1 ? "right" : "left"),
                                vertical: "center",
                            },
                            border: thinBorder,
                            numFmt: c === 2 ? "#,##0.00" : undefined,
                        };
                    } else {
                        // Data rows — bordered, amount column right-aligned & currency formatted
                        worksheet[addr].s = {
                            alignment: {
                                horizontal: c === 2 ? "right" : "left",
                                vertical: "center",
                            },
                            border: thinBorder,
                            numFmt: c === 2 ? "#,##0.00" : undefined,
                        };
                    }
                }
            }

            worksheet["!rows"] = sheetData.map((_, idx) => (idx === 0 ? { hpt: 20 } : { hpt: 18 }));

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Annexures");

            const filename = `Annexures_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(workbook, filename, { cellStyles: true });

            toast({
                title: "Success",
                description: `Exported ${selectedPOs.length} Annexure${selectedPOs.length > 1 ? "s" : ""} to Excel.`,
            });
        } catch (error) {
            console.error("Bulk Excel Export Error:", error);
            toast({
                title: "Error",
                description: "Failed to export selected Annexures.",
                variant: "destructive",
            });
        } finally {
            setIsBulkExportingExcel(false);
        }
    };

    const handleBulkMoveToDeliveryTracker = async () => {
        setIsMovingBulk(true);
        let successCount = 0;
        let failCount = 0;
        try {
            const results = await Promise.allSettled(
                Array.from(selectedPoIds).map(id =>
                    apiFetch(`/api/purchase-orders/${id}/move-to-delivery-tracker`, { method: "POST" })
                        .then(res => {
                            if (!res.ok) throw new Error("Failed");
                            return res;
                        })
                )
            );
            successCount = results.filter(r => r.status === "fulfilled").length;
            failCount = results.filter(r => r.status === "rejected").length;

            if (successCount > 0) {
                toast({
                    title: "Moved to Delivery Tracker",
                    description: `${successCount} Annexure${successCount > 1 ? "s" : ""} moved successfully.${failCount > 0 ? ` ${failCount} failed.` : ""}`,
                });
            }
            if (failCount > 0 && successCount === 0) {
                toast({
                    title: "Error",
                    description: "Failed to move Annexures to Delivery Tracker.",
                    variant: "destructive",
                });
            }

            setSelectedPoIds(new Set());
            setShowBulkMoveDialog(false);
            fetchData();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to move Annexures to Delivery Tracker.",
                variant: "destructive",
            });
        } finally {
            setIsMovingBulk(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case "draft":
                return (
                    <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                        <Clock size={12} className="mr-1" /> Draft
                    </Badge>
                );
            case "pending_approval":
                return (
                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                        <Clock size={12} className="mr-1" /> Pending
                    </Badge>
                );
            case "approved":
                return (
                    <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                        <CheckCircle2 size={12} className="mr-1" /> Approved
                    </Badge>
                );
            case "rejected":
                return (
                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                        <XCircle size={12} className="mr-1" /> Rejected
                    </Badge>
                );
            case "ordered":
                return (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200">
                        <FileText size={12} className="mr-1" /> Ordered
                    </Badge>
                );
            case "delivered":
                return (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                        <Truck size={12} className="mr-1" /> Delivered
                    </Badge>
                );
            case "revised":
                return (
                    <Badge variant="outline" className="bg-slate-900 text-white border-slate-900 font-bold px-3">
                        REVISED
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (baseNumber: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(baseNumber)) newSet.delete(baseNumber);
            else newSet.add(baseNumber);
            return newSet;
        });
    };

    const getBasePoNumber = (poNumber: string) => {
        return poNumber.replace(/-(R\d+|Deferred\d+)$/, "");
    };

    const filteredProjects = projects.filter((project) =>
        project.name.toLowerCase().includes(projectSearch.toLowerCase())
    );

    const handleSelectProject = (projectId: string) => {
        setSelectedProjectId(projectId);
        setProjectFilter(projectId);
    };

    const handleBackToProjects = () => {
        setSelectedProjectId("");
        setProjectFilter("all");
        setLocation("/purchase-orders");
    };

    const filteredPOs = purchaseOrders.filter((po) => {
        const matchesSearch =
            po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (po.project_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (po.vendor_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (po.materials_list || "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "all" || po.status === statusFilter;
        const matchesProject = projectFilter === "all" || po.project_id === projectFilter;

        return matchesSearch && matchesStatus && matchesProject;
    });

    // Grouping Logic
    const groupedPOs: Record<string, PurchaseOrder[]> = {};
    filteredPOs.forEach(po => {
        const base = getBasePoNumber(po.po_number);
        if (!groupedPOs[base]) groupedPOs[base] = [];
        groupedPOs[base].push(po);
    });

    // Sort POs within each group by creation date (newest first)
    Object.keys(groupedPOs).forEach(base => {
        groupedPOs[base].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    // Get the representative PO for each group (the newest one or best matching status)
    const sortedGroupBases = Object.keys(groupedPOs).sort((a, b) => {
        const dateA = new Date(groupedPOs[a][0].created_at).getTime();
        const dateB = new Date(groupedPOs[b][0].created_at).getTime();
        return dateB - dateA;
    });

    if (loading) {
        return (
            <Layout>
                <div className="space-y-6">
                    <ProcurementTabBar active="purchase-orders" />
                    <div className="flex flex-col items-center justify-center min-h-[60vh]">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground">Loading Annexures...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    const projectPOTotals = purchaseOrders.reduce<Record<string, number>>((acc, po) => {
        acc[po.project_id] = (acc[po.project_id] || 0) + 1;
        return acc;
    }, {});

    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    const showProjectList = selectedProjectId === "" && projects.length > 0;

    return (
        <Layout>
            <div className="space-y-6">
                <ProcurementTabBar active="purchase-orders" />
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Annexures</h1>
                        <p className="text-muted-foreground">Manage and track your procurement orders.</p>
                    </div>
                    <div className="flex gap-2">
                        {user?.role === 'admin' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLocation("/admin/rate-reduction-history")}
                                className="h-9"
                            >
                                Rate Reduction History
                            </Button>
                        )}
                        {selectedProjectId !== "" && (
                            <Button variant="ghost" size="sm" onClick={handleBackToProjects} className="h-9">
                                <ChevronRight className="h-4 w-4 rotate-180" />
                                Back to Projects
                            </Button>
                        )}
                    </div>
                </div>

                {showProjectList && (
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold">Select a Project</h2>
                                    <p className="text-muted-foreground">View Annexures grouped by project.</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => { setSelectedProjectId("all"); setProjectFilter("all"); }} className="h-9">
                                    View All Annexures
                                </Button>
                            </div>
                            <div className="mt-4 relative max-w-md">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search projects..."
                                    className="pl-9 h-9"
                                    value={projectSearch}
                                    onChange={(e) => setProjectSearch(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredProjects.length === 0 ? (
                                <div className="py-12 text-center text-sm text-muted-foreground">
                                    {projects.length === 0 ? "No projects available." : "No matching projects found."}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredProjects.map((project) => (
                                        <button
                                            key={project.id}
                                            type="button"
                                            onClick={() => handleSelectProject(project.id)}
                                            className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-primary/80 hover:bg-slate-50"
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 truncate">{project.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {projectPOTotals[project.id] || 0} Annexure{(projectPOTotals[project.id] || 0) === 1 ? "" : "s"}
                                                    </p>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-400" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {(!showProjectList || (selectedProjectId as string) === "all") && (
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex flex-wrap gap-4 items-center justify-between">
                                <div className="flex flex-1 min-w-[300px] gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by Annexure No., project, vendor, or material..."
                                            className="pl-9 h-9"
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                sessionStorage.setItem("po_search_query", e.target.value);
                                            }}
                                        />
                                    </div>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-[180px] h-9">
                                            <Filter className="h-4 w-4 mr-2" />
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses</SelectItem>
                                            <SelectItem value="draft">Draft</SelectItem>
                                            <SelectItem value="pending_approval">Pending Approval</SelectItem>
                                            <SelectItem value="approved">Approved</SelectItem>
                                            <SelectItem value="ordered">Ordered</SelectItem>
                                            <SelectItem value="delivered">Delivered</SelectItem>
                                            <SelectItem value="rejected">Rejected</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={projectFilter} onValueChange={setProjectFilter}>
                                        <SelectTrigger className="w-[200px] h-9">
                                            <Building2 className="h-4 w-4 mr-2" />
                                            <SelectValue placeholder="Project" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px] overflow-y-auto">
                                            <SelectItem value="all">All Projects</SelectItem>
                                            {projects.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedPoIds.size > 0 && (
                                        <>
                                            <Button
                                                onClick={handleBulkDownloadExcel}
                                                size="icon"
                                                className="h-9 w-9 ml-2 relative bg-green-600 hover:bg-green-700 text-white"
                                                disabled={isBulkExportingExcel}
                                                title={`Download Excel (${selectedPoIds.size})`}
                                            >
                                                {isBulkExportingExcel ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <FileSpreadsheet className="h-4 w-4" />
                                                )}
                                                <span className="absolute -top-1.5 -right-1.5 bg-white text-green-700 text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center border border-green-600">
                                                    {selectedPoIds.size}
                                                </span>
                                            </Button>
                                            <Button
                                                onClick={() => setShowBulkMoveDialog(true)}
                                                size="icon"
                                                className="h-9 w-9 ml-2 relative bg-indigo-600 hover:bg-indigo-700 text-white"
                                                disabled={isMovingBulk}
                                                title={`Move to Delivery (${selectedPoIds.size})`}
                                            >
                                                <Truck className="h-4 w-4" />
                                                <span className="absolute -top-1.5 -right-1.5 bg-white text-indigo-700 text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center border border-indigo-600">
                                                    {selectedPoIds.size}
                                                </span>
                                            </Button>
                                            {user?.role !== 'purchase_team' && (
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => setShowBulkDeleteDialog(true)}
                                                    size="icon"
                                                    className="h-9 w-9 ml-2 relative"
                                                    title={`Delete Selected (${selectedPoIds.size})`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="absolute -top-1.5 -right-1.5 bg-white text-red-700 text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center border border-red-600">
                                                        {selectedPoIds.size}
                                                    </span>
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border border-slate-200 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-12 text-center border-r">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 align-middle"
                                                    checked={filteredPOs.length > 0 && selectedPoIds.size === filteredPOs.length}
                                                    onChange={toggleSelectAll}
                                                />
                                            </TableHead>
                                            <TableHead className="w-6"></TableHead>
                                            <TableHead className="font-bold">Annexure No.</TableHead>
                                            <TableHead className="font-bold">Project</TableHead>
                                            <TableHead className="font-bold">Version</TableHead>
                                            <TableHead className="font-bold">Vendor</TableHead>
                                            <TableHead className="font-bold text-right">Amount</TableHead>
                                            <TableHead className="font-bold">Status</TableHead>
                                            <TableHead className="font-bold">Date</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedGroupBases.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                                                    No Annexures found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            sortedGroupBases.map((base) => {
                                                const group = groupedPOs[base];
                                                let mainPo = group.find(p => p.po_number === base || p.po_number.endsWith("-R0"));
                                                if (!mainPo) {
                                                    mainPo = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
                                                }

                                                const subPos = group.filter(p => p.id !== mainPo!.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                                                const isExpanded = expandedGroups.has(base);
                                                const hasMultiple = group.length > 1;

                                                return (
                                                    <React.Fragment key={mainPo!.id}>
                                                        <TableRow className="hover:bg-slate-50/50 cursor-pointer group" onClick={() => setLocation(`/purchase-orders/${mainPo!.id}`)}>
                                                            <TableCell className="text-center border-r" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-gray-300 align-middle"
                                                                    checked={selectedPoIds.has(mainPo!.id)}
                                                                    onChange={(e) => toggleSelectPo(mainPo!.id, e)}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="p-0 text-center" onClick={(e) => { e.stopPropagation(); if (hasMultiple) toggleGroup(base, e); }}>
                                                                {hasMultiple && (
                                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-100">
                                                                        <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-bold text-primary flex items-center gap-2">
                                                                {mainPo!.po_number}
                                                                {hasMultiple && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{group.length}</Badge>}
                                                            </TableCell>
                                                            <TableCell className="font-medium">{mainPo!.project_name || "N/A"}</TableCell>
                                                            <TableCell>
                                                                {mainPo!.version_number !== null && mainPo!.version_number !== undefined ? (
                                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold">
                                                                        V{mainPo!.version_number}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-muted-foreground italic text-xs">N/A</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>{mainPo!.vendor_name || "N/A"}</TableCell>
                                                            <TableCell className="text-right font-bold text-green-700">
                                                                ₹{parseFloat(mainPo!.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </TableCell>
                                                            <TableCell>{getStatusBadge(mainPo!.status)}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {new Date(mainPo!.created_at).toLocaleDateString()}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {user?.role !== 'purchase_team' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setDeletingPo(mainPo!);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                                                                        onClick={(e) => handleMoveToDeliveryTracker(mainPo!, e)}
                                                                        disabled={movingPoId === mainPo!.id}
                                                                        title="Send to Delivery Tracker"
                                                                    >
                                                                        {movingPoId === mainPo!.id ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <Truck className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                                        onClick={(e) => handleDownloadPdfOpenDialog(mainPo!, e)}
                                                                        disabled={user?.role === 'purchase_team' && mainPo!.status !== 'approved'}
                                                                    >
                                                                        <FileDown className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                                                                        onClick={(e) => handleDownloadExcel(mainPo!, e)}
                                                                        disabled={(user?.role === 'purchase_team' && mainPo!.status !== 'approved') || downloadingExcelId === mainPo!.id}
                                                                        title="Download Excel"
                                                                    >
                                                                        {downloadingExcelId === mainPo!.id ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <FileSpreadsheet className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                    {mainPo!.zoho_sync_status === "synced" ? (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setZohoResultPo({
                                                                                    po: mainPo!,
                                                                                    success: true,
                                                                                    message: "Purchase Order successfully moved to Zoho Books.",
                                                                                    zohoPurchaseOrderId: mainPo!.zoho_purchase_order_id!,
                                                                                    syncedAt: mainPo!.zoho_synced_at!
                                                                                });
                                                                            }}
                                                                            title="View Zoho Books Sync Details"
                                                                        >
                                                                            <CheckCircle2 className="h-4 w-4" />
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className={`h-8 w-8 p-0 ${mainPo!.zoho_sync_status === "failed" ? "text-red-600 hover:text-red-800 hover:bg-red-50" : "text-orange-600 hover:text-orange-800 hover:bg-orange-50"}`}
                                                                            onClick={(e) => openZohoConfirm(mainPo!, e)}
                                                                            disabled={(user?.role === 'purchase_team' && !['approved', 'ordered', 'delivered'].includes(mainPo!.status)) || zohoSyncingId === mainPo!.id}
                                                                            title={mainPo!.zoho_sync_status === "failed" ? "Retry Zoho Sync" : "Move to Zoho Books"}
                                                                        >
                                                                            {zohoSyncingId === mainPo!.id ? (
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                            ) : mainPo!.zoho_sync_status === "failed" ? (
                                                                                <AlertCircle className="h-4 w-4" />
                                                                            ) : (
                                                                                <UploadCloud className="h-4 w-4" />
                                                                            )}
                                                                        </Button>
                                                                    )}
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>

                                                        {isExpanded && subPos.map((subPo) => (
                                                            <TableRow key={subPo.id} className="bg-slate-50/50 hover:bg-slate-100/50 cursor-pointer border-l-4 border-l-slate-200" onClick={() => setLocation(`/purchase-orders/${subPo.id}`)}>
                                                                <TableCell className="text-center border-r" onClick={(e) => e.stopPropagation()}>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 rounded border-gray-300 align-middle ml-2"
                                                                        checked={selectedPoIds.has(subPo.id)}
                                                                        onChange={(e) => toggleSelectPo(subPo.id, e)}
                                                                    />
                                                                </TableCell>
                                                                <TableCell></TableCell>
                                                                <TableCell className="pl-8 text-sm text-slate-600 font-medium italic">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                                                                        {subPo.po_number}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-slate-500">{subPo.project_name || "N/A"}</TableCell>
                                                                <TableCell>
                                                                    {subPo.version_number !== null && subPo.version_number !== undefined ? (
                                                                        <Badge variant="outline" className="bg-blue-50/50 text-blue-600 border-blue-100 text-[10px] h-5">
                                                                            V{subPo.version_number}
                                                                        </Badge>
                                                                    ) : "-"}
                                                                </TableCell>
                                                                <TableCell className="text-sm text-slate-500">{subPo.vendor_name || "N/A"}</TableCell>
                                                                <TableCell className="text-right text-sm font-medium text-slate-600">
                                                                    ₹{parseFloat(subPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </TableCell>
                                                                <TableCell>{getStatusBadge(subPo.status)}</TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">
                                                                    {new Date(subPo.created_at).toLocaleDateString()}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {user?.role !== 'purchase_team' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 text-red-400 hover:text-red-700"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setDeletingPo(subPo);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-indigo-500 hover:text-indigo-700"
                                                                        onClick={(e) => handleMoveToDeliveryTracker(subPo, e)}
                                                                        disabled={movingPoId === subPo.id}
                                                                        title="Send to Delivery Tracker"
                                                                    >
                                                                        {movingPoId === subPo.id ? (
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Truck className="h-3.5 w-3.5" />
                                                                        )}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700"
                                                                        onClick={(e) => handleDownloadPdfOpenDialog(subPo, e)}
                                                                        disabled={user?.role === 'purchase_team' && subPo.status !== 'approved'}
                                                                    >
                                                                        <FileDown className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-green-500 hover:text-green-700"
                                                                        onClick={(e) => handleDownloadExcel(subPo, e)}
                                                                        disabled={(user?.role === 'purchase_team' && subPo.status !== 'approved') || downloadingExcelId === subPo.id}
                                                                        title="Download Excel"
                                                                    >
                                                                        {downloadingExcelId === subPo.id ? (
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        ) : (
                                                                            <FileSpreadsheet className="h-3.5 w-3.5" />
                                                                        )}
                                                                    </Button>
                                                                    {subPo.zoho_sync_status === "synced" ? (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setZohoResultPo({
                                                                                    po: subPo,
                                                                                    success: true,
                                                                                    message: "Purchase Order successfully moved to Zoho Books.",
                                                                                    zohoPurchaseOrderId: subPo.zoho_purchase_order_id!,
                                                                                    syncedAt: subPo.zoho_synced_at!
                                                                                });
                                                                            }}
                                                                            title="View Zoho Books Sync Details"
                                                                        >
                                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className={`h-7 w-7 p-0 ${subPo.zoho_sync_status === "failed" ? "text-red-500 hover:text-red-700" : "text-orange-500 hover:text-orange-700"}`}
                                                                            onClick={(e) => openZohoConfirm(subPo, e)}
                                                                            disabled={(user?.role === 'purchase_team' && !['approved', 'ordered', 'delivered'].includes(subPo.status)) || zohoSyncingId === subPo.id}
                                                                            title={subPo.zoho_sync_status === "failed" ? "Retry Zoho Sync" : "Move to Zoho Books"}
                                                                        >
                                                                            {zohoSyncingId === subPo.id ? (
                                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            ) : subPo.zoho_sync_status === "failed" ? (
                                                                                <AlertCircle className="h-3.5 w-3.5" />
                                                                            ) : (
                                                                                <UploadCloud className="h-3.5 w-3.5" />
                                                                            )}
                                                                        </Button>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deletingPo} onOpenChange={(open) => { if (!open) setDeletingPo(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Annexure</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete Annexure No. <strong>{deletingPo?.po_number}</strong>? This will permanently remove the purchase order and all its items. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={handleDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Delete Confirmation Dialog */}
            <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Multiple Annexures</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{selectedPoIds.size}</strong> Annexures? This will permanently remove the orders and all their associated items. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingBulk}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={handleBulkDelete}
                            disabled={isDeletingBulk}
                        >
                            {isDeletingBulk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Delete {selectedPoIds.size} Orders
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Move to Delivery Tracker Confirmation Dialog */}
            <AlertDialog open={showBulkMoveDialog} onOpenChange={setShowBulkMoveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-indigo-600" />
                            Move to Delivery Tracker
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to move <strong>{selectedPoIds.size}</strong> selected Annexure{selectedPoIds.size > 1 ? "s" : ""} to the Delivery Tracker? They will appear in the tracker grouped by project.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isMovingBulk}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={handleBulkMoveToDeliveryTracker}
                            disabled={isMovingBulk}
                        >
                            {isMovingBulk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
                            Move {selectedPoIds.size} Annexure{selectedPoIds.size > 1 ? "s" : ""}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Move to Zoho Books - Confirmation Dialog */}
            <AlertDialog open={!!zohoConfirmPo} onOpenChange={(open) => !open && setZohoConfirmPo(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <UploadCloud className="h-5 w-5 text-orange-600" />
                            Move Purchase Order to Zoho Books?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm">
                                <div><span className="font-medium text-foreground">PO Number:</span> {zohoConfirmPo?.po_number}</div>
                                <div><span className="font-medium text-foreground">Vendor:</span> {zohoConfirmPo?.vendor_name || "N/A"}</div>
                                <div><span className="font-medium text-foreground">Total:</span> ₹{zohoConfirmPo ? parseFloat(zohoConfirmPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ""}</div>
                                <p className="pt-1">The Purchase Order will be created in your connected Zoho Books organization.</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={handleSendToZohoBooks}
                        >
                            <UploadCloud className="h-4 w-4 mr-2" />
                            Send to Zoho Books
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Move to Zoho Books - Result Dialog */}
            <AlertDialog open={!!zohoResultPo} onOpenChange={(open) => !open && setZohoResultPo(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            {zohoResultPo?.success ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-red-600" />
                            )}
                            {zohoResultPo?.success ? "Synced to Zoho Books" : "Sync Failed"}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm">
                                <p>{zohoResultPo?.message}</p>
                                {zohoResultPo?.success && (
                                    <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 space-y-1">
                                        <div><span className="font-medium text-foreground">BOQ PO:</span> {zohoResultPo.po.po_number}</div>
                                        <div><span className="font-medium text-foreground">Zoho PO:</span> {zohoResultPo.zohoPurchaseOrderId}</div>
                                        {zohoResultPo.syncedAt && (
                                            <div><span className="font-medium text-foreground">Synced:</span> {new Date(zohoResultPo.syncedAt).toLocaleString()}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        {!zohoResultPo?.success && zohoResultPo && (
                            <AlertDialogAction
                                className="bg-orange-600 hover:bg-orange-700 text-white"
                                onClick={() => {
                                    const po = zohoResultPo.po;
                                    setZohoResultPo(null);
                                    setZohoConfirmPo(po);
                                }}
                            >
                                Retry Zoho Sync
                            </AlertDialogAction>
                        )}
                        <AlertDialogCancel onClick={() => setZohoResultPo(null)}>Close</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Move to Zoho Books - Manual Vendor Mapping (fallback when automatic
                matching can't safely resolve the vendor: ambiguous or not found) */}
            <Dialog
                open={!!zohoMappingPo}
                onOpenChange={(open) => {
                    if (!open) {
                        setZohoMappingPo(null);
                        setZohoMappingCandidates([]);
                        setZohoMappingSearchResults([]);
                        setZohoMappingSearch("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Vendor mapping required</DialogTitle>
                        <DialogDescription>
                            Select the correct Zoho Books vendor for{" "}
                            <span className="font-medium text-foreground">
                                "{zohoMappingPo?.vendor_name || "this vendor"}"
                            </span>
                            . This mapping is saved and reused automatically on future syncs.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        {zohoMappingCandidates.length > 0 && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                    Multiple possible matches were found - pick the right one:
                                </Label>
                                <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                                    {zohoMappingCandidates.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            disabled={zohoMappingSavingId === c.id}
                                            onClick={() => handleSelectZohoVendorMapping(c)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between disabled:opacity-60"
                                        >
                                            <span>{c.name}</span>
                                            {zohoMappingSavingId === c.id && (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                                {zohoMappingCandidates.length > 0
                                    ? "Or search for a different vendor by name:"
                                    : "Search Zoho Books vendors by name:"}
                            </Label>
                            <Input
                                placeholder="Type at least 2 characters..."
                                value={zohoMappingSearch}
                                onChange={(e) => handleZohoMappingSearchChange(e.target.value)}
                            />
                            <div className="rounded-md border divide-y max-h-48 overflow-y-auto min-h-[2.5rem]">
                                {zohoMappingSearching ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
                                    </div>
                                ) : zohoMappingSearchResults.length > 0 ? (
                                    zohoMappingSearchResults.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            disabled={zohoMappingSavingId === v.id}
                                            onClick={() => handleSelectZohoVendorMapping(v)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between disabled:opacity-60"
                                        >
                                            <span>{v.name}</span>
                                            {zohoMappingSavingId === v.id && (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            )}
                                        </button>
                                    ))
                                ) : zohoMappingSearch.trim().length >= 2 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">No vendors found.</div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setZohoMappingPo(null)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Move to Zoho Books - Manual Material Mapping (fallback when automatic
                matching can't safely resolve the material: ambiguous or not found).
                Also offers creating a brand-new Zoho Books item on the spot when it
                genuinely doesn't exist there yet. */}
            <Dialog
                open={!!zohoMaterialMappingPo}
                onOpenChange={(open) => {
                    if (!open) closeZohoMaterialMappingDialog();
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Material mapping required</DialogTitle>
                        <DialogDescription>
                            Select the correct Zoho Books item for{" "}
                            <span className="font-medium text-foreground">
                                "{zohoMaterialMappingMaterialName || "this material"}"
                            </span>
                            , or create it as a new item if it doesn't exist in Zoho Books yet. This is
                            saved so future Purchase Orders for this material sync automatically.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        {zohoMaterialMappingCandidates.length > 0 && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                    Multiple possible matches were found - pick the right one:
                                </Label>
                                <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                                    {zohoMaterialMappingCandidates.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            disabled={zohoMaterialMappingSavingId === c.id}
                                            onClick={() => handleSelectZohoItemMapping(c)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between disabled:opacity-60"
                                        >
                                            <span>{c.name}</span>
                                            {zohoMaterialMappingSavingId === c.id && (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                                {zohoMaterialMappingCandidates.length > 0
                                    ? "Or search for a different item by name:"
                                    : "Search Zoho Books items by name:"}
                            </Label>
                            <Input
                                placeholder="Type at least 2 characters..."
                                value={zohoMaterialMappingSearch}
                                onChange={(e) => handleZohoMaterialMappingSearchChange(e.target.value)}
                            />
                            <div className="rounded-md border divide-y max-h-48 overflow-y-auto min-h-[2.5rem]">
                                {zohoMaterialMappingSearching ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
                                    </div>
                                ) : zohoMaterialMappingSearchResults.length > 0 ? (
                                    zohoMaterialMappingSearchResults.map((it) => (
                                        <button
                                            key={it.id}
                                            type="button"
                                            disabled={zohoMaterialMappingSavingId === it.id}
                                            onClick={() => handleSelectZohoItemMapping(it)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between disabled:opacity-60"
                                        >
                                            <span>{it.name}</span>
                                            {zohoMaterialMappingSavingId === it.id && (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            )}
                                        </button>
                                    ))
                                ) : zohoMaterialMappingSearch.trim().length >= 2 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">No items found.</div>
                                ) : null}
                            </div>
                        </div>

                        <div className="relative py-1">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-background px-2 text-muted-foreground">
                                    Not in Zoho Books yet?
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2 rounded-md border p-3">
                            <Label className="text-xs text-muted-foreground">
                                Create it as a new item in Zoho Books:
                            </Label>
                            <Input
                                placeholder="Item name"
                                value={zohoMaterialCreateName}
                                onChange={(e) => setZohoMaterialCreateName(e.target.value)}
                                disabled={zohoMaterialCreating}
                            />
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Rate"
                                value={zohoMaterialCreateRate}
                                onChange={(e) => setZohoMaterialCreateRate(e.target.value)}
                                disabled={zohoMaterialCreating}
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                className="w-full"
                                onClick={handleCreateZohoMaterial}
                                disabled={zohoMaterialCreating || !zohoMaterialCreateName.trim()}
                            >
                                {zohoMaterialCreating ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                )}
                                Create new item &amp; map
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeZohoMaterialMappingDialog}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Move to Zoho Books - Tax Setup Required (fires once, the first
                time a material has no tax of its own and no org-level
                default is configured; saving a default here fixes every
                future material missing a tax, not just this one). */}
            <Dialog
                open={!!zohoTaxSetupPo}
                onOpenChange={(open) => {
                    if (!open) closeZohoTaxSetupDialog();
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tax setup required</DialogTitle>
                        <DialogDescription>
                            Material{" "}
                            <span className="font-medium text-foreground">
                                "{zohoTaxSetupMaterialName || "this material"}"
                            </span>{" "}
                            has no tax configured in Zoho Books, and this integration doesn't have a default
                            tax set yet. Zoho Books requires a Tax, Tax Exemption, or Reverse Charge on every
                            Purchase Order line item. Pick a default tax below - it's saved once and used
                            automatically for any material without its own tax from now on.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Choose a default tax:</Label>
                        <div className="rounded-md border divide-y max-h-56 overflow-y-auto min-h-[2.5rem]">
                            {zohoTaxesLoading ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading taxes...
                                </div>
                            ) : zohoTaxesError ? (
                                <div className="px-3 py-2 text-sm text-red-600">{zohoTaxesError}</div>
                            ) : zohoTaxes.length > 0 ? (
                                zohoTaxes.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        disabled={zohoTaxSavingId === t.id}
                                        onClick={() => handleSaveDefaultTax(t)}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between disabled:opacity-60"
                                    >
                                        <span>{t.name}</span>
                                        {zohoTaxSavingId === t.id && (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                    No taxes found in Zoho Books. Create one under Settings &gt; Taxes first.
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeZohoTaxSetupDialog}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PDF Export Selection Dialog */}
            <Dialog open={isPdfExportDialogOpen} onOpenChange={setIsPdfExportDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileDown className="h-5 w-5 text-blue-600" />
                            PDF Export Options
                        </DialogTitle>
                        <DialogDescription>
                            Select the columns you want to include in the generated PDF for <strong>{exportingPo?.po_number}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <Label className="text-sm font-semibold mb-3 block">Columns to Display</Label>
                        <ScrollArea className="h-[200px] pr-4 border rounded-md p-3">
                            <div className="space-y-3">
                                {["S.No", "Item", "Description", "HSN/SAC", "Unit", "Qty", "Rate", "Total"].map((col) => (
                                    <div key={col} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`col-${col}`}
                                            checked={selectedPdfExportCols.includes(col)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedPdfExportCols(prev => [...prev, col]);
                                                } else {
                                                    setSelectedPdfExportCols(prev => prev.filter(c => c !== col));
                                                }
                                            }}
                                        />
                                        <Label
                                            htmlFor={`col-${col}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {col}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="flex justify-between sm:justify-between items-center bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-lg border-t mt-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPdfExportCols(["S.No", "Item", "Description", "HSN/SAC", "Unit", "Qty", "Rate", "Total"])}>
                            Reset Defaults
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsPdfExportDialogOpen(false)} disabled={isGeneratingPdf}>
                                Cancel
                            </Button>
                            <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf || selectedPdfExportCols.length === 0} className="bg-blue-600 hover:bg-blue-700">
                                {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                                Download PDF
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}
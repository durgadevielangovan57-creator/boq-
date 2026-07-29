import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import { Search } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Truck,
    Package,
    Building2,
    ChevronRight,
    ChevronDown,
    Loader2,
    CheckCircle2,
    Circle,
    Clock,
    ExternalLink,
    AlertTriangle,
    FileDown,
    Boxes,
} from "lucide-react";
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DeliveryProject {
    id: string;
    name: string;
    po_count: number;
    overdue_count: number;
    completed_count: number;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    project_id: string;
    project_name?: string;
    vendor_id: string;
    vendor_name?: string;
    status: string;
    total_amount: string;
    client_delivery_date: string | null;
    po_status: string | null;
    payment_status: string | null;
    comparison_status: string | null;
    delivery_status: string | null;
    dc_number: string | null;
    dc_date: string | null;
    created_at: string;
    total_materials?: number;
    delivered_materials?: number;
}

interface PoItem {
    id: string;
    po_id: string;
    item_name: string;
    description?: string;
    unit?: string;
    qty: string | number;
    is_delivered: boolean;
    delivered_at?: string | null;
}

const PO_STATUS_OPTIONS = [
    { value: "pending", label: "Pending", className: "bg-slate-100 text-slate-600 border-slate-200" },
    { value: "processing", label: "Processing", className: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "ready", label: "Ready", className: "bg-violet-50 text-violet-700 border-violet-200" },
    { value: "completed", label: "Completed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

const PAYMENT_OPTIONS = [
    { value: "pending", label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "partial", label: "Partial", className: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "paid", label: "Paid", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

const COMPARISON_OPTIONS = [
    { value: "pending", label: "Pending Review", className: "bg-slate-100 text-slate-600 border-slate-200" },
    { value: "matched", label: "Matched", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { value: "mismatch", label: "Mismatch", className: "bg-red-50 text-red-700 border-red-200" },
];

function optionMeta(options: typeof PAYMENT_OPTIONS, value?: string | null) {
    return options.find((o) => o.value === (value || "pending")) || options[0];
}

function StatusDropdownBadge({
    value,
    options,
    onChange,
    disabled,
}: {
    value: string | null | undefined;
    options: typeof PAYMENT_OPTIONS;
    onChange: (val: string) => void;
    disabled?: boolean;
}) {
    const meta = optionMeta(options, value);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" onClick={(e) => e.stopPropagation()} disabled={disabled}>
                    <Badge variant="outline" className={`${meta.className} cursor-pointer hover:opacity-80 transition`}>
                        {meta.label}
                        <ChevronDown className="h-3 w-3 ml-1" />
                    </Badge>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                {options.map((o) => (
                    <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)}>
                        <Badge variant="outline" className={`${o.className} mr-2`}>{o.label}</Badge>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function getPoStatusBadge(status: string) {
    switch ((status || "").toLowerCase()) {
        case "draft":
            return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">Draft</Badge>;
        case "pending_approval":
            return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Pending</Badge>;
        case "approved":
            return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Approved</Badge>;
        case "rejected":
            return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Rejected</Badge>;
        case "ordered":
            return <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200">Ordered</Badge>;
        case "delivered":
            return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">Delivered</Badge>;
        default:
            return <Badge variant="outline">{status || "N/A"}</Badge>;
    }
}

function getDeliveryStatusBadge(po: PurchaseOrder, isOverdue: boolean) {
    if (po.status === 'draft') {
        return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">Draft</Badge>;
    }
    if (po.status === 'rejected') {
        return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Rejected</Badge>;
    }

    if (isOverdue) {
        return (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 font-bold">
                <AlertTriangle size={12} className="mr-1" /> Overdue
            </Badge>
        );
    }
    switch ((po.delivery_status || "pending").toLowerCase()) {
        case "completed":
            return (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                    <CheckCircle2 size={12} className="mr-1" /> Delivered
                </Badge>
            );
        case "partial":
            return (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Clock size={12} className="mr-1" /> Partial
                </Badge>
            );
        default:
            return (
                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                    <Clock size={12} className="mr-1" /> Pending
                </Badge>
            );
    }
}

function isDateOverdue(dateStr: string | null | undefined, deliveryStatus: string | null | undefined) {
    if (!dateStr) return false;
    if ((deliveryStatus || "").toLowerCase() === "completed") return false;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
}

export default function DeliveryTracker() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const [projects, setProjects] = useState<DeliveryProject[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [projectSearch, setProjectSearch] = useState("");

    const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get("projectId") || "";
    });

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Materials checklist (per PO), keyed by PO id
    const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
    const [itemsByPo, setItemsByPo] = useState<Record<string, PoItem[]>>({});
    const [loadingItemsFor, setLoadingItemsFor] = useState<string | null>(null);
    const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

    // Delivery confirmation dialog (manual DC capture, kept from the original flow)
    const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [dcNumber, setDcNumber] = useState("");
    const [dcDate, setDcDate] = useState(new Date().toISOString().split("T")[0]);

    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            fetchOrders(selectedProjectId);
        } else {
            setOrders([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedProjectId]);

    const fetchProjects = async () => {
        try {
            setLoadingProjects(true);
            const res = await apiFetch("/api/delivery-tracker/projects");
            if (res.ok) {
                const data = await res.json();
                setProjects(data.projects || []);
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to load Delivery Tracker projects.", variant: "destructive" });
        } finally {
            setLoadingProjects(false);
        }
    };

    const fetchOrders = async (projectId: string) => {
        try {
            setLoadingOrders(true);
            const res = await apiFetch(`/api/delivery-tracker/purchase-orders?projectId=${projectId}`);
            if (res.ok) {
                const data = await res.json();
                setOrders(data.purchaseOrders || []);
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to load delivery data.", variant: "destructive" });
        } finally {
            setLoadingOrders(false);
        }
    };

    const handleSelectProject = (projectId: string) => {
        setSelectedProjectId(projectId);
        setExpandedPoId(null);
        const url = new URL(window.location.href);
        url.searchParams.set("projectId", projectId);
        window.history.replaceState({}, "", url.toString());
    };

    const handleBackToProjects = () => {
        setSelectedProjectId("");
        setExpandedPoId(null);
        const url = new URL(window.location.href);
        url.searchParams.delete("projectId");
        window.history.replaceState({}, "", url.toString());
        fetchProjects();
    };

    const patchOrder = async (id: string, body: Record<string, any>) => {
        setUpdatingId(id);
        try {
            const res = await apiFetch(`/api/delivery-tracker/purchase-orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const data = await res.json();
                setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...data.purchaseOrder } : o)));
            } else {
                toast({ title: "Error", description: "Failed to save the change.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to save the change.", variant: "destructive" });
        } finally {
            setUpdatingId(null);
        }
    };

    const handleClientDeliveryDateChange = (id: string, date: string) => {
        patchOrder(id, { client_delivery_date: date }).then(() => {
            toast({ title: "Saved", description: "Client delivery date updated." });
        });
    };

    const handlePoStatusChange = (id: string, value: string) => {
        patchOrder(id, { po_status: value });
    };

    const handlePaymentStatusChange = (id: string, value: string) => {
        patchOrder(id, { payment_status: value });
    };

    const handleComparisonChange = (id: string, value: string) => {
        patchOrder(id, { comparison_status: value });
    };

    const handleMarkDeliveredClick = (id: string) => {
        setSelectedOrderId(id);
        setIsConfirmingDelivery(true);
        setDcNumber("");
        setDcDate(new Date().toISOString().split("T")[0]);
    };

    const handleConfirmDelivery = async () => {
        if (!selectedOrderId) return;
        if (!dcNumber) {
            toast({ title: "Required", description: "DC Number is mandatory for delivery.", variant: "destructive" });
            return;
        }
        setUpdatingId(selectedOrderId);
        try {
            const res = await apiFetch(`/api/purchase-orders/${selectedOrderId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "delivered", dc_number: dcNumber, dc_date: dcDate }),
            });
            if (res.ok) {
                toast({ title: "Success", description: "Order marked as delivered with DC." });
                setIsConfirmingDelivery(false);
                
                // Update local cache so materials instantly show as delivered if expanded
                setItemsByPo(prev => {
                    const currentItems = prev[selectedOrderId!];
                    if (currentItems) {
                        return {
                            ...prev,
                            [selectedOrderId!]: currentItems.map(item => ({ ...item, is_delivered: true }))
                        };
                    }
                    return prev;
                });
                
                fetchOrders(selectedProjectId);
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        } finally {
            setUpdatingId(null);
            setSelectedOrderId(null);
        }
    };

    const toggleExpandPo = async (po: PurchaseOrder) => {
        const willExpand = expandedPoId !== po.id;
        setExpandedPoId(willExpand ? po.id : null);
        if (willExpand && !itemsByPo[po.id]) {
            setLoadingItemsFor(po.id);
            try {
                const res = await apiFetch(`/api/delivery-tracker/purchase-orders/${po.id}/materials`);
                if (res.ok) {
                    const data = await res.json();
                    setItemsByPo((prev) => ({ ...prev, [po.id]: data.materials || [] }));
                }
            } catch (error) {
                toast({ title: "Error", description: "Failed to load materials for this shop.", variant: "destructive" });
            } finally {
                setLoadingItemsFor(null);
            }
        }
    };

    const handleToggleMaterial = async (poId: string, item: PoItem) => {
        setTogglingItemId(item.id);
        try {
            const res = await apiFetch(`/api/delivery-tracker/materials/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_delivered: !item.is_delivered }),
            });
            if (res.ok) {
                const data = await res.json();
                setItemsByPo((prev) => ({
                    ...prev,
                    [poId]: (prev[poId] || []).map((it) => (it.id === item.id ? data.material : it)),
                }));
                setOrders((prev) =>
                    prev.map((o) =>
                        o.id === poId
                            ? {
                                ...o,
                                status: data.purchaseOrder.status,
                                delivery_status: data.purchaseOrder.delivery_status,
                                total_materials: data.totalMaterials,
                                delivered_materials: data.deliveredMaterials,
                            }
                            : o
                    )
                );
                if (data.purchaseOrder.delivery_status === "completed") {
                    toast({ title: "Shop completed", description: "All materials delivered — status set to Completed." });
                }
            } else {
                toast({ title: "Error", description: "Failed to update material status.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to update material status.", variant: "destructive" });
        } finally {
            setTogglingItemId(null);
        }
    };

    const filteredProjects = projects.filter((p) => p.name?.toLowerCase().includes(projectSearch.toLowerCase()));
    const selectedProject = projects.find((p) => p.id === selectedProjectId);

    const stats = useMemo(() => {
        const total = orders.length;
        const overdue = orders.filter((o) => isDateOverdue(o.client_delivery_date, o.delivery_status)).length;
        const completed = orders.filter((o) => (o.delivery_status || "pending") === "completed").length;
        const inProgress = total - completed;
        return { total, overdue, completed, inProgress };
    }, [orders]);

    const handleDownloadProjectPdf = async () => {
        if (!selectedProject || orders.length === 0) return;
        setIsGeneratingPdf(true);
        try {
            // Ensure materials are loaded for every PO before exporting
            const missing = orders.filter((o) => !itemsByPo[o.id]);
            let mergedItems = itemsByPo;
            if (missing.length > 0) {
                const results = await Promise.all(
                    missing.map((o) => apiFetch(`/api/purchase-orders/${o.id}`).then((r) => (r.ok ? r.json() : null)))
                );
                const next = { ...itemsByPo };
                missing.forEach((o, idx) => {
                    if (results[idx]) next[o.id] = results[idx].items || [];
                });
                mergedItems = next;
                setItemsByPo(next);
            }

            const doc = new jsPDF({ orientation: "portrait" });
            const pageWidth = doc.internal.pageSize.getWidth();
            const marginX = 10;

            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text("DELIVERY TRACKER REPORT", pageWidth / 2, 16, { align: "center" });

            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.text(`Project: ${selectedProject.name}`, marginX, 26);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, marginX, 32);

            const summaryBody = orders.map((o) => {
                const overdue = isDateOverdue(o.client_delivery_date, o.delivery_status);
                return [
                    o.po_number,
                    o.vendor_name || "N/A",
                    o.client_delivery_date ? new Date(o.client_delivery_date).toLocaleDateString() : "-",
                    o.status,
                    (o.po_status || "pending").toUpperCase(),
                    (o.comparison_status || "pending").toUpperCase(),
                    (o.payment_status || "pending").toUpperCase(),
                    overdue ? "OVERDUE" : (o.delivery_status || "pending").toUpperCase(),
                ];
            });

            autoTable(doc, {
                head: [["PO Number", "Shop / Vendor", "Client Delivery Date", "Status", "PO Status", "Comparison", "Payment", "Delivery Status"]],
                body: summaryBody,
                startY: 38,
                margin: { left: marginX, right: marginX },
                styles: { fontSize: 7.5, lineWidth: 0.2, lineColor: [180, 180, 180] },
                headStyles: { fillColor: [79, 70, 229], textColor: 255, lineWidth: 0.2, lineColor: [120, 120, 120] },
                theme: "grid",
            });

            let cursorY = (doc as any).lastAutoTable.finalY + 8;

            orders.forEach((po) => {
                const items = mergedItems[po.id] || [];
                if (items.length === 0) return;

                if (cursorY > 260) {
                    doc.addPage();
                    cursorY = 16;
                }

                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text(`${po.po_number} \u2014 ${po.vendor_name || "N/A"} (Materials)`, marginX, cursorY);
                cursorY += 4;

                const materialBody = items.map((it, idx) => [
                    idx + 1,
                    it.item_name,
                    it.unit || "-",
                    it.qty !== null && it.qty !== undefined ? parseFloat(String(it.qty)).toFixed(2) : "-",
                    it.is_delivered ? "Delivered" : "Pending",
                ]);

                autoTable(doc, {
                    head: [["#", "Material", "Unit", "Qty", "Status"]],
                    body: materialBody,
                    startY: cursorY,
                    margin: { left: marginX, right: marginX },
                    styles: { fontSize: 8, lineWidth: 0.2, lineColor: [180, 180, 180] },
                    headStyles: { fillColor: [30, 41, 59], textColor: 255, lineWidth: 0.2, lineColor: [120, 120, 120] },
                    theme: "grid",
                });

                cursorY = (doc as any).lastAutoTable.finalY + 8;
            });

            doc.save(`Delivery_Tracker_${selectedProject.name.replace(/\s+/g, "_")}.pdf`);
            toast({ title: "Success", description: "Delivery Tracker PDF generated." });
        } catch (error) {
            console.error("Delivery Tracker PDF export error:", error);
            toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // ---------------- PROJECT SELECTION VIEW ----------------
    if (!selectedProjectId) {
        return (
            <Layout>
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                            <Truck className="h-8 w-8 text-indigo-600" />
                            Delivery Tracker
                        </h1>
                        <p className="text-muted-foreground">Select a project to view Annexures moved to the Delivery Tracker.</p>
                    </div>

                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <div>
                                <h2 className="text-xl font-semibold">Select a Project</h2>
                                <p className="text-muted-foreground">Only projects with Annexures sent to the tracker appear here.</p>
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
                            {loadingProjects ? (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                                    <p className="text-muted-foreground text-sm">Loading projects...</p>
                                </div>
                            ) : filteredProjects.length === 0 ? (
                                <div className="py-16 text-center text-sm text-muted-foreground italic">
                                    No projects yet. Use the <Truck className="h-4 w-4 inline mx-1 text-indigo-600" /> icon on an
                                    Annexure in Purchase Orders to send it here.
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
                                                        {project.po_count} Annexure{project.po_count === 1 ? "" : "s"} ·{" "}
                                                        {project.completed_count} completed
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {project.overdue_count > 0 && (
                                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 font-bold">
                                                            <AlertTriangle size={12} className="mr-1" />
                                                            {project.overdue_count} Overdue
                                                        </Badge>
                                                    )}
                                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </Layout>
        );
    }

    // ---------------- PROJECT DELIVERY TABLE VIEW ----------------
    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Truck className="h-7 w-7 text-indigo-600" />
                            Delivery Tracker
                        </h1>
                        <p className="text-muted-foreground flex items-center gap-2 mt-1">
                            <Building2 className="h-4 w-4" />
                            <span className="font-semibold text-slate-800 text-lg">{selectedProject?.name || "Project"}</span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={handleBackToProjects} className="h-9">
                            <ChevronRight className="h-4 w-4 rotate-180" />
                            Back to Projects
                        </Button>
                        <Button
                            size="sm"
                            className="h-9 bg-indigo-600 hover:bg-indigo-700"
                            onClick={handleDownloadProjectPdf}
                            disabled={isGeneratingPdf || orders.length === 0}
                        >
                            {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                            Download PDF
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-indigo-50 border-indigo-100">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-indigo-600">Total Annexures</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-indigo-900">{stats.total}</div></CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-100">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-blue-600">In Progress</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-blue-900">{stats.inProgress}</div></CardContent>
                    </Card>
                    <Card className="bg-emerald-50 border-emerald-100">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-emerald-600">Completed</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-emerald-900">{stats.completed}</div></CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-100">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-red-600">Overdue</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-red-900">{stats.overdue}</div></CardContent>
                    </Card>
                </div>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Package className="h-5 w-5 text-slate-500" />
                            Annexures in Delivery Tracker
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loadingOrders ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                                <p className="text-muted-foreground text-sm">Loading delivery data...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[40px]"></TableHead>
                                            <TableHead className="font-bold whitespace-nowrap min-w-[200px]">PO Number / Shop</TableHead>
                                            <TableHead className="font-bold whitespace-nowrap min-w-[180px]">Client Delivery Date</TableHead>
                                            <TableHead className="font-bold text-center">Comparison</TableHead>
                                            <TableHead className="font-bold text-center">PO Status</TableHead>
                                            <TableHead className="font-bold text-center">Payment Status</TableHead>
                                            <TableHead className="font-bold text-center">Delivery Status</TableHead>
                                            <TableHead className="font-bold text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orders.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground italic">
                                                    No Annexures moved to Delivery Tracker for this project yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            orders.map((po) => {
                                                const overdue = isDateOverdue(po.client_delivery_date, po.delivery_status);
                                                const isExpanded = expandedPoId === po.id;
                                                const items = itemsByPo[po.id] || [];
                                                const total = po.total_materials ?? items.length;
                                                const delivered = po.delivered_materials ?? items.filter((i) => i.is_delivered).length;
                                                return (
                                                    <React.Fragment key={po.id}>
                                                        <TableRow
                                                            className={`hover:bg-slate-50/50 cursor-pointer ${(po.delivery_status || "pending") === "delivered" ? "bg-emerald-50/40" : ""}`}
                                                            onClick={() => toggleExpandPo(po)}
                                                        >
                                                            <TableCell className="p-0 text-center">
                                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-100">
                                                                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                                </Button>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="font-bold text-primary">{po.po_number}</div>
                                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                                                    <Building2 className="h-3 w-3" /> {po.vendor_name || "N/A"}
                                                                </div>
                                                                {total > 0 && (
                                                                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                                                                        <Boxes className="h-3 w-3" /> {delivered}/{total} materials delivered
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="date"
                                                                        defaultValue={po.client_delivery_date ? po.client_delivery_date.split("T")[0] : ""}
                                                                        className={`h-8 w-36 text-xs ${overdue ? "border-red-400 text-red-700 font-semibold" : ""}`}
                                                                        onChange={(e) => handleClientDeliveryDateChange(po.id, e.target.value)}
                                                                        disabled={updatingId === po.id}
                                                                    />
                                                                    {updatingId === po.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                                                                </div>
                                                                {overdue && (
                                                                    <div className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                                                                        <AlertTriangle className="h-3 w-3" /> OVERDUE
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                                <StatusDropdownBadge
                                                                    value={po.comparison_status}
                                                                    options={COMPARISON_OPTIONS}
                                                                    onChange={(v) => handleComparisonChange(po.id, v)}
                                                                    disabled={updatingId === po.id}
                                                                />
                                                            </TableCell>
                                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                                <StatusDropdownBadge
                                                                    value={po.po_status}
                                                                    options={PO_STATUS_OPTIONS}
                                                                    onChange={(v) => handlePoStatusChange(po.id, v)}
                                                                    disabled={updatingId === po.id}
                                                                />
                                                            </TableCell>
                                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                                <StatusDropdownBadge
                                                                    value={po.payment_status}
                                                                    options={PAYMENT_OPTIONS}
                                                                    onChange={(v) => handlePaymentStatusChange(po.id, v)}
                                                                    disabled={updatingId === po.id}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-center">{getDeliveryStatusBadge(po, overdue)}</TableCell>
                                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex justify-end gap-2">
                                                                    <Button variant="outline" size="sm" onClick={() => setLocation(`/purchase-orders/${po.id}?mode=delivery`)}>
                                                                        <ExternalLink className="h-4 w-4 mr-1" /> Details
                                                                    </Button>
                                                                    {po.status !== "delivered" && (
                                                                        <Button
                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                            size="sm"
                                                                            onClick={() => handleMarkDeliveredClick(po.id)}
                                                                            disabled={updatingId === po.id}
                                                                        >
                                                                            <CheckCircle2 className="h-4 w-4 mr-1" /> Delivered
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>

                                                        {isExpanded && (
                                                            <TableRow className="bg-slate-50/70">
                                                                <TableCell></TableCell>
                                                                <TableCell colSpan={8} className="py-4">
                                                                    {loadingItemsFor === po.id ? (
                                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                                                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading materials...
                                                                        </div>
                                                                    ) : items.length === 0 ? (
                                                                        <div className="text-sm text-muted-foreground italic py-2">No materials found for this Annexure.</div>
                                                                    ) : (
                                                                        <div className="rounded-lg border border-slate-200 bg-white divide-y">
                                                                            {items.map((it) => (
                                                                                <div
                                                                                    key={it.id}
                                                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition"
                                                                                >
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleToggleMaterial(po.id, it)}
                                                                                        disabled={togglingItemId === it.id}
                                                                                        className="shrink-0"
                                                                                        title={it.is_delivered ? "Mark as pending" : "Mark as delivered"}
                                                                                    >
                                                                                        {togglingItemId === it.id ? (
                                                                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                                                        ) : it.is_delivered ? (
                                                                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                                                        ) : (
                                                                                            <Circle className="h-5 w-5 text-slate-300 hover:text-slate-400" />
                                                                                        )}
                                                                                    </button>
                                                                                    <div className="min-w-0 flex-1">
                                                                                        <p className={`text-sm font-medium truncate ${it.is_delivered ? "line-through text-slate-400" : "text-slate-800"}`}>
                                                                                            {it.item_name}
                                                                                        </p>
                                                                                        {it.description && (
                                                                                            <p className="text-xs text-muted-foreground truncate">{it.description}</p>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="text-xs text-slate-500 shrink-0">
                                                                                        {it.qty !== null && it.qty !== undefined ? parseFloat(String(it.qty)).toFixed(2) : ""} {it.unit || ""}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Delivery Confirmation Dialog */}
            <Dialog open={isConfirmingDelivery} onOpenChange={setIsConfirmingDelivery}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="h-5 w-5" />
                            Confirm Delivery
                        </DialogTitle>
                        <DialogDescription>
                            Please enter the Delivery Challan (DC) details provided at the site.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label htmlFor="dc_number" className="text-sm font-medium">DC Number <span className="text-red-500">*</span></label>
                            <Input
                                id="dc_number"
                                placeholder="Enter DC Number (e.g. DC-2024-001)"
                                value={dcNumber}
                                onChange={(e) => setDcNumber(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="dc_date" className="text-sm font-medium">DC Date</label>
                            <Input
                                id="dc_date"
                                type="date"
                                value={dcDate}
                                onChange={(e) => setDcDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsConfirmingDelivery(false)}>Cancel</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirmDelivery} disabled={!dcNumber || updatingId !== null}>
                            {updatingId !== null ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                            Confirm & Mark Delivered
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}
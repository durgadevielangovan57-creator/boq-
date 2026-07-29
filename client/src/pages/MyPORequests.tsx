import React, { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ChevronDown, ChevronUp, Search, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import apiFetch from "@/lib/api";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import html2pdf from "html2pdf.js";
import { useToast } from "@/hooks/use-toast";

export default function MyPORequests() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['/api/po-requests', { view: 'my' }],
        queryFn: async () => {
            const res = await apiFetch('/api/po-requests?view=my');
            if (!res.ok) throw new Error("Failed to load requests");
            return res.json();
        }
    });

    const { data: requestItemsData } = useQuery({
        queryKey: ['/api/po-requests', expandedId],
        queryFn: async () => {
            if (!expandedId) return null;
            const res = await apiFetch(`/api/po-requests/${expandedId}`);
            if (!res.ok) throw new Error("Failed to load request items");
            return res.json();
        },
        enabled: !!expandedId
    });

    const requests = data?.poRequests || [];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending_approval':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending Approval</Badge>;
            case 'approved':
                return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>;
            case 'rejected':
                return <Badge variant="destructive">Rejected</Badge>;
            case 'po_generated':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Annexure Generated</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const handleDownloadPDF = async (reqId: string) => {
        setIsDownloading(reqId);
        try {
            // First ensure we have the expanded data for this request if it's not the current one
            let itemsToUse = requestItemsData;
            if (expandedId !== reqId) {
                const res = await apiFetch(`/api/po-requests/${reqId}`);
                if (!res.ok) throw new Error("Failed to load request items for PDF");
                itemsToUse = await res.json();
            }

            if (!itemsToUse) throw new Error("No items data found");

            // We'll create a temporary element for PDF generation similar to PORequestDetail
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            container.id = "temp-pdf-container";

            // Add basic styles to the container to ensure it looks right in PDF
            const styles = `
                .pdf-content { font-family: 'Inter', sans-serif; padding: 40px; background: white; color: #1e293b; width: 800px; }
                .pdf-header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
                .pdf-logo { font-size: 24px; font-weight: bold; }
                .pdf-title { font-size: 24px; font-weight: 900; text-align: right; }
                .pdf-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-top: 20px; }
                .pdf-label { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
                .pdf-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                .pdf-table th { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; font-size: 10px; text-align: left; }
                .pdf-table td { border: 1px solid #e2e8f0; padding: 10px; font-size: 11px; }
                .pdf-footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            `;
            const styleElement = document.createElement('style');
            styleElement.innerHTML = styles;
            container.appendChild(styleElement);

            const poRequest = itemsToUse.poRequest;
            const items = itemsToUse.items;

            // Calculations
            const subTotal = items.reduce((sum: number, i: any) => sum + (parseFloat(i.qty) * (parseFloat(i.rate) || 0)), 0);
            const sgst = subTotal * 0.09;
            const cgst = subTotal * 0.09;
            const total = subTotal + sgst + cgst;
            const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            container.innerHTML += `
                <div class="pdf-content" style="padding: 40px; background: white; color: #1e293b; width: 750px;">
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
                        <div style="display: flex; gap: 20px;">
                            <img src="/logo.png" style="height: 60px; width: auto;" />
                            <div style="font-size: 11px; line-height: 1.4;">
                                <strong style="font-size: 14px; color: #0f172a;">Concept Trunk Interiors</strong><br/>
                                12/36A, Indira Nagar, Medavakkam<br/>
                                Chennai, Tamil Nadu 600100<br/>
                                <span style="font-size: 9px; color: #64748b;">GSTIN 33ASOPS5560M1Z1</span>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">ANNEXURE</div>
                            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                                No. <strong>Anx-${poRequest.id.slice(0, 4).toUpperCase()}-${poRequest.id.slice(4, 8).toUpperCase()}</strong>
                            </div>
                            <div style="font-size: 11px; margin-top: 8px;">
                                <span style="color: #64748b; text-transform: uppercase; font-weight: 600; margin-right: 8px;">Date:</span>
                                <span style="font-weight: 700;">${format(new Date(poRequest.created_at), "dd/MM/yyyy")}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Info Grid -->
                    <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-top: 30px;">
                        <div>
                            <div style="font-size: 9px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Bill From</div>
                            <div style="font-size: 12px;">
                                <strong style="color: #0f172a; font-size: 13px;">${items[0]?.shop_name || "NOT ASSIGNED"}</strong><br/>
                                <span style="color: #475569;">${items[0]?.shop_location || "N/A"}</span><br/>
                                <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 4px;">
                                    GSTIN: ${items[0]?.shop_gstin || "N/A"}
                                </div>
                            </div>
                            <div style="margin-top: 15px;">
                                <span style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Project:</span>
                                <span style="font-size: 11px; font-weight: 700; color: #0f172a; margin-left: 8px; text-transform: uppercase;">${poRequest.project_name || '—'}</span>
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 9px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Deliver To</div>
                            <div style="font-size: 11px; color: #475569; font-style: italic; background: #f8fafc; padding: 12px; border-radius: 4px; border-left: 3px solid #e2e8f0; line-height: 1.5;">
                                ${poRequest.deliver_to || "Standard project site delivery or as specified in Annexure."}
                            </div>
                        </div>
                    </div>

                    <!-- Items Table -->
                    <table style="width: 100%; border-collapse: collapse; margin-top: 30px; border: 1px solid #e2e8f0;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="padding: 10px; border: 1px solid #e2e8f0; font-size: 9px; text-align: center; color: #475569; width: 30px;">#</th>
                                <th style="padding: 10px; border: 1px solid #e2e8f0; font-size: 9px; text-align: left; color: #475569;">Item Details</th>
                                <th style="padding: 10px; border: 1px solid #e2e8f0; font-size: 9px; text-align: center; color: #475569; width: 60px;">Unit</th>
                                <th style="padding: 10px; border: 1px solid #e2e8f0; font-size: 9px; text-align: right; color: #475569; width: 60px;">Qty</th>
                                <th style="padding: 10px; border: 1px solid #e2e8f0; font-size: 9px; text-align: right; color: #475569; width: 80px;">Rate</th>
                                <th style="padding: 10px; border: 1px solid #e2e8f0; font-size: 9px; text-align: right; color: #475569; width: 100px;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item: any, idx: number) => `
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 10px; text-align: center; color: #94a3b8;">${idx + 1}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0;">
                                        <div style="font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase;">${item.item}</div>
                                        ${item.remarks ? `<div style="font-size: 9px; color: #64748b; margin-top: 2px;">${item.remarks}</div>` : ''}
                                    </td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 10px; text-align: center; color: #475569;">${item.unit}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: 600;">${parseFloat(item.qty).toFixed(2)}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 10px; text-align: right;">₹${parseFloat(item.rate || '0').toFixed(2)}</td>
                                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: 700; color: #0f172a;">₹${(parseFloat(item.qty) * (parseFloat(item.rate) || 0)).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <!-- Totals Section -->
                    <div style="display: flex; justify-content: flex-end; margin-top: 25px;">
                        <div style="width: 250px;">
                            <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
                                <span style="color: #64748b;">Sub Total</span>
                                <span style="font-weight: 600;">${fmt(subTotal)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
                                <span style="color: #64748b;">SGST (9%)</span>
                                <span>${fmt(sgst)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
                                <span style="color: #64748b;">CGST (9%)</span>
                                <span>${fmt(cgst)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; padding: 12px 10px; background: #f1f5f9; margin-top: 10px; border-radius: 4px; color: #0f172a;">
                                <span>Total Amount</span>
                                <span>${fmt(total)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Footer / Signature -->
                    <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                            <div style="font-size: 9px; color: #94a3b8;">
                                Generated on ${format(new Date(), "PPpp")}<br/>
                                This is a computer generated document.
                            </div>
                            <div style="text-align: right;">
                                <div style="height: 40px;"></div>
                                <div style="font-size: 11px; font-weight: 700; border-top: 1px solid #0f172a; padding-top: 5px; width: 180px;">Authorized Signature</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(container);

            const opt = {
                margin: 0,
                filename: `PO_Request_${poRequest.id.slice(0, 4)}.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
            };

            const pdfElement = container.querySelector('.pdf-content');
            if (pdfElement) {
                await html2pdf().set(opt).from(pdfElement as HTMLElement).save();
            }
            
            document.body.removeChild(container);
            toast({ title: "Success", description: "Request downloaded successfully" });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
        } finally {
            setIsDownloading(null);
        }
    };

    return (
        <Layout>
            <div className="container mx-auto p-4 md:p-6 max-w-[1200px]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My PO Requests</h1>
                        <p className="text-muted-foreground mt-1">
                            Track the status of Purchase Order requests you have raised.
                        </p>
                    </div>
                    <Button onClick={() => setLocation('/raise-po-request')} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Raise New Request
                    </Button>
                </div>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Recent Requests</CardTitle>
                        <CardDescription>A list of all your submitted Annexure requests.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                                <p>You haven't raised any Annexure requests yet.</p>
                                <Button onClick={() => setLocation('/raise-po-request')} variant="link" className="mt-2 text-indigo-600">
                                    Raise your first request
                                </Button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="w-[50px]"></TableHead>
                                            <TableHead className="font-semibold">Project Name</TableHead>
                                            <TableHead className="font-semibold">Department</TableHead>
                                            <TableHead className="font-semibold text-center">Status</TableHead>
                                            <TableHead className="font-semibold text-center">Date Requested</TableHead>
                                            <TableHead className="font-semibold text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {requests.map((req: any) => (
                                            <React.Fragment key={req.id}>
                                                <TableRow className="hover:bg-slate-50 transition-colors">
                                                    <TableCell className="text-center p-2">
                                                        <Button variant="ghost" size="icon" onClick={() => toggleExpand(req.id)} className="h-8 w-8 rounded-full hover:bg-slate-200">
                                                            {expandedId === req.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="font-medium text-slate-900">{req.project_name}</TableCell>
                                                    <TableCell className="text-slate-600">{req.department || 'N/A'}</TableCell>
                                                    <TableCell className="text-center">{getStatusBadge(req.status)}</TableCell>
                                                    <TableCell className="text-center text-sm text-slate-500">
                                                        {format(new Date(req.created_at), "MMM d, yyyy")}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setLocation(`/po-requests/${req.id}`)}
                                                                className="h-8 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                                            >
                                                                <Search className="h-3.5 w-3.5 mr-1.5" />
                                                                View
                                                            </Button>
                                                            {(req.status === 'approved' || req.status === 'po_generated') && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleDownloadPDF(req.id)}
                                                                    disabled={isDownloading === req.id}
                                                                    className="h-8 text-xs bg-slate-800 text-white hover:bg-slate-700"
                                                                >
                                                                    {isDownloading === req.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                                                                    PDF
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {expandedId === req.id && (
                                                    <TableRow className="bg-slate-50 border-b border-slate-200">
                                                        <TableCell colSpan={6} className="p-4 md:p-6 shadow-inner">
                                                            <div className="bg-white rounded-lg border border-slate-200 p-4 relative">
                                                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400 rounded-l-lg"></div>
                                                                <h4 className="font-semibold mb-3 text-slate-800 flex items-center gap-2">
                                                                    <Search className="h-4 w-4 text-indigo-500" /> Requested Items
                                                                </h4>
                                                                {!requestItemsData || requestItemsData.poRequest?.id !== req.id ? (
                                                                    <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                                                                ) : (
                                                                    <div className="space-y-4">
                                                                        <div className="border border-slate-100 rounded overflow-hidden">
                                                                            <Table>
                                                                                <TableHeader className="bg-slate-50">
                                                                                    <TableRow>
                                                                                        <TableHead className="text-xs">Item Description</TableHead>
                                                                                        <TableHead className="text-xs">Category</TableHead>
                                                                                        <TableHead className="text-xs text-center">Unit</TableHead>
                                                                                        <TableHead className="text-xs text-right">Qty</TableHead>
                                                                                        <TableHead className="text-xs text-right">Rate (₹)</TableHead>
                                                                                        <TableHead className="text-xs text-right">Amount (₹)</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {requestItemsData.items.map((item: any, idx: number) => (
                                                                                        <TableRow key={idx}>
                                                                                            <TableCell className="font-medium text-sm">{item.item}</TableCell>
                                                                                            <TableCell className="text-sm text-slate-600">{item.category || '-'}</TableCell>
                                                                                            <TableCell className="text-sm text-slate-600 text-center">{item.unit}</TableCell>
                                                                                            <TableCell className="text-sm font-semibold text-right">{item.qty}</TableCell>
                                                                                            <TableCell className="text-sm text-right">
                                                                                                {item.rate ? `₹${parseFloat(item.rate).toFixed(2)}` : '—'}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-sm font-bold text-right">
                                                                                                {item.rate ? `₹${(parseFloat(item.qty) * parseFloat(item.rate)).toFixed(2)}` : '—'}
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                        
                                                                        <div className="flex justify-end pr-4">
                                                                            <div className="w-64 space-y-1">
                                                                                {(() => {
                                                                                    const subTotal = requestItemsData.items.reduce((sum: number, i: any) => sum + (parseFloat(i.qty) * (parseFloat(i.rate) || 0)), 0);
                                                                                    const sgst = subTotal * 0.09;
                                                                                    const cgst = subTotal * 0.09;
                                                                                    const total = subTotal + sgst + cgst;
                                                                                    const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                                                                                    return (
                                                                                        <>
                                                                                            <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                                                                                                <span className="text-slate-500">Sub Total</span>
                                                                                                <span className="font-medium">{fmt(subTotal)}</span>
                                                                                            </div>
                                                                                            <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                                                                                                <span className="text-slate-500">SGST (9%)</span>
                                                                                                <span>{fmt(sgst)}</span>
                                                                                            </div>
                                                                                            <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                                                                                                <span className="text-slate-500">CGST (9%)</span>
                                                                                                <span>{fmt(cgst)}</span>
                                                                                            </div>
                                                                                            <div className="flex justify-between text-base font-bold py-2 text-indigo-700 bg-indigo-50 px-2 rounded mt-2">
                                                                                                <span>Total Amount</span>
                                                                                                <span>{fmt(total)}</span>
                                                                                            </div>
                                                                                        </>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}

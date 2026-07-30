import { useState, useEffect } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import html2pdf from "html2pdf.js";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Printer, Loader2 } from "lucide-react";
import apiFetch from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ReportRenderer } from "@/components/formbuilder/ReportRenderer";
import { ReportContext } from "@/lib/reportSchema";

export default function PrintSummarySheet() {
    const { linkId } = useParams<{ linkId: string }>();
    const search = useSearch();
    const [, setLocation] = useLocation();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin" || user?.role === "software_team" || user?.role === "purchase_team";

    const params = new URLSearchParams(search);
    const [vendorId, setVendorId] = useState(params.get("vendorId") || (isAdmin ? "" : user?.id || ""));

    const [link, setLink] = useState<any>(null);
    const [context, setContext] = useState<ReportContext | null>(null);
    const [vendors, setVendors] = useState<any[]>([]);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        apiFetch(`/api/fb/tender-links/${linkId}`).then((r) => r.json()).then((d) => setLink(d.form)).catch(() => { });
    }, [linkId]);

    useEffect(() => {
        if (isAdmin) {
            apiFetch(`/api/fb/vendors`).then((r) => r.json()).then((d) => setVendors(d.vendors || [])).catch(() => { });
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!link) return;
        const qs = vendorId ? `?vendorId=${vendorId}` : "";
        apiFetch(`/api/fb/tenders/${link.tender_id}/report-context${qs}`)
            .then((r) => r.json())
            .then(setContext)
            .catch(() => { });
    }, [link, vendorId]);

    const downloadPdf = () => {
        const el = document.getElementById("summary-sheet-print-content");
        if (!el) return;
        setDownloading(true);
        html2pdf()
            .set({
                margin: 10,
                filename: `${link?.name || "Summary-Sheet"}.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
            })
            .from(el)
            .save()
            .then(() => setDownloading(false))
            .catch(() => setDownloading(false));
    };

    if (!link) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-200">
            <style dangerouslySetInnerHTML={{
                __html: `
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
          }
        `,
            }} />
            <div className="no-print bg-white border-b p-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <Button variant="ghost" size="sm" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <Select value={vendorId} onValueChange={setVendorId}>
                            <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Sample data (no vendor)" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Sample data (no vendor)</SelectItem>
                                {vendors.map((v) => (
                                    <SelectItem key={v.id} value={v.id}>{v.fullName || v.username}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
                    <Button size="sm" onClick={downloadPdf} disabled={downloading}>
                        {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                        {downloading ? "Generating..." : "Download PDF"}
                    </Button>
                </div>
            </div>
            <div className="py-8">
                <ReportRenderer id="summary-sheet-print-content" schema={link.schema} context={context || undefined} />
            </div>
        </div>
    );
}
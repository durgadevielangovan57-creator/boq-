import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, LayoutTemplate, Trash2, Users, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { useLocation } from "wouter";
import { FormRenderer } from "@/components/formbuilder/FormRenderer";

export function TenderFormsDialog({ tender, open, onOpenChange }: { tender: any; open: boolean; onOpenChange: (o: boolean) => void }) {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [attached, setAttached] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [category, setCategory] = useState<"FORM" | "SUMMARY_SHEET">("FORM");
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [visibleToVendor, setVisibleToVendor] = useState(true);
    const [loading, setLoading] = useState(false);

    const [submissionsFor, setSubmissionsFor] = useState<any>(null);
    const [submissions, setSubmissions] = useState<any[]>([]);

    const loadAttached = () => {
        if (!tender) return;
        apiFetch(`/api/fb/tenders/${tender.id}/forms`)
            .then((r) => r.json())
            .then((d) => setAttached(d.forms || []))
            .catch(() => { });
    };

    useEffect(() => {
        if (open && tender) loadAttached();
    }, [open, tender?.id]);

    useEffect(() => {
        apiFetch(`/api/fb/templates?category=${category}`)
            .then((r) => r.json())
            .then((d) => setTemplates(d.templates || []))
            .catch(() => { });
        setSelectedTemplateId("");
    }, [category, open]);

    const attach = async () => {
        if (!selectedTemplateId) {
            toast({ title: "Pick a template first", variant: "destructive" });
            return;
        }
        setLoading(true);
        try {
            const res = await apiFetch(`/api/fb/tenders/${tender.id}/forms`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ templateId: selectedTemplateId, visibleToVendor }),
            });
            if (!res.ok) throw new Error();
            toast({ title: "Attached", description: "The template is now attached to this tender." });
            setSelectedTemplateId("");
            loadAttached();
        } catch {
            toast({ title: "Error", description: "Failed to attach template", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const toggleVisibility = async (link: any, next: boolean) => {
        await apiFetch(`/api/fb/tender-links/${link.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visibleToVendor: next }),
        });
        loadAttached();
    };

    const removeLink = async (id: string) => {
        if (!confirm("Remove this form from the tender?")) return;
        await apiFetch(`/api/fb/tender-links/${id}`, { method: "DELETE" });
        loadAttached();
    };

    const viewSubmissions = async (link: any) => {
        setSubmissionsFor(link);
        const res = await apiFetch(`/api/fb/tender-links/${link.id}/submissions`);
        const data = await res.json();
        setSubmissions(data.submissions || []);
    };

    if (!tender) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Forms &amp; Summary Sheets — {tender.tender_number}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-2">
                        <div className="border rounded-md p-4 space-y-3">
                            <Label className="text-sm font-semibold">Attach a Template</Label>
                            <Tabs value={category} onValueChange={(v) => setCategory(v as any)}>
                                <TabsList>
                                    <TabsTrigger value="FORM" className="flex gap-1"><LayoutTemplate className="h-4 w-4" /> Form</TabsTrigger>
                                    <TabsTrigger value="SUMMARY_SHEET" className="flex gap-1"><FileSpreadsheet className="h-4 w-4" /> Summary Sheet</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <div className="flex items-center gap-2">
                                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                    <SelectTrigger className="flex-1"><SelectValue placeholder="Choose a saved template..." /></SelectTrigger>
                                    <SelectContent>
                                        {templates.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                                    <Switch checked={visibleToVendor} onCheckedChange={setVisibleToVendor} />
                                    <span className="text-muted-foreground">Visible to Vendor</span>
                                </div>
                                <Button onClick={attach} disabled={loading}>Attach</Button>
                            </div>
                            {templates.length === 0 && (
                                <p className="text-xs text-muted-foreground">No {category === "FORM" ? "form" : "summary sheet"} templates yet — create one from Form Builder first.</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Attached to this Tender</Label>
                            {attached.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nothing attached yet.</p>
                            ) : (
                                attached.map((link) => (
                                    <div key={link.id} className="flex items-center justify-between border rounded-md p-3">
                                        <div>
                                            <p className="font-medium text-sm flex items-center gap-2">
                                                {link.name}
                                                <Badge variant="secondary" className="text-xs">{link.category === "FORM" ? "Form" : "Summary Sheet"}</Badge>
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {link.category === "FORM" ? `${link.submission_count || 0} vendor submission(s)` : "Print-ready summary report"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 text-xs">
                                                <Switch checked={link.visible_to_vendor} onCheckedChange={(c) => toggleVisibility(link, c)} />
                                                <span className="text-muted-foreground">Vendor visible</span>
                                            </div>
                                            {link.category === "FORM" ? (
                                                <Button variant="outline" size="sm" onClick={() => viewSubmissions(link)}>
                                                    <Users className="h-4 w-4 mr-1" /> Submissions
                                                </Button>
                                            ) : (
                                                <Button variant="outline" size="sm" onClick={() => setLocation(`/admin/summary-print/${link.id}`)}>
                                                    <FileDown className="h-4 w-4 mr-1" /> View / Export PDF
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" onClick={() => removeLink(link.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Submissions viewer */}
            <Dialog open={!!submissionsFor} onOpenChange={(o) => !o && setSubmissionsFor(null)}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Submissions — {submissionsFor?.name}</DialogTitle>
                    </DialogHeader>
                    {submissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">No vendor has submitted this yet.</p>
                    ) : (
                        <div className="space-y-6">
                            {submissions.map((s) => (
                                <div key={s.id} className="border rounded-md p-4">
                                    <p className="font-semibold text-sm mb-2">
                                        {s.full_name || s.username} {s.company_name ? `(${s.company_name})` : ""}
                                        <Badge className="ml-2" variant={s.status === "Submitted" ? "default" : "secondary"}>{s.status}</Badge>
                                    </p>
                                    {submissionsFor && <FormRenderer schema={submissionsFor.schema} data={s.data || {}} readOnly />}
                                </div>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSubmissionsFor(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
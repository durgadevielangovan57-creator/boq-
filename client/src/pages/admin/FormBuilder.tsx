import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, LayoutTemplate, FileSpreadsheet, Copy, Trash2, Pencil, Eye, ReceiptText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { SchemaBuilder } from "@/components/formbuilder/SchemaBuilder";
import { FormRenderer } from "@/components/formbuilder/FormRenderer";
import { ReportDesigner } from "@/components/formbuilder/ReportDesigner";
import { ReportRenderer } from "@/components/formbuilder/ReportRenderer";
import { QuotesTab } from "@/components/admin/QuotesTab";
import { FormSchema, emptySchema } from "@/lib/formSchema";
import { ReportSchema, emptyReportSchema } from "@/lib/reportSchema";
import "../tenders-glass.css";

function FormTemplateManager() {
    const { toast } = useToast();
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refresh, setRefresh] = useState(0);

    const [editorOpen, setEditorOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [schema, setSchema] = useState<FormSchema>(emptySchema());
    const [previewTemplate, setPreviewTemplate] = useState<any>(null);
    const [previewData, setPreviewData] = useState({});

    const load = () => {
        setLoading(true);
        apiFetch(`/api/fb/templates?category=FORM`)
            .then((res) => res.json())
            .then((data) => setTemplates(data.templates || []))
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    };

    useEffect(load, [refresh]);

    const openNew = () => {
        setEditing(null);
        setName("");
        setDesc("");
        setSchema(emptySchema());
        setEditorOpen(true);
    };

    const openEdit = (t: any) => {
        setEditing(t);
        setName(t.name);
        setDesc(t.description || "");
        setSchema(t.schema || emptySchema());
        setEditorOpen(true);
    };

    const save = async () => {
        if (!name.trim()) {
            toast({ title: "Name required", variant: "destructive" });
            return;
        }
        try {
            const body = JSON.stringify({ category: "FORM", name, description: desc, schema });
            const res = editing
                ? await apiFetch(`/api/fb/templates/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body })
                : await apiFetch(`/api/fb/templates`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
            if (!res.ok) throw new Error();
            toast({ title: "Saved", description: "Form template saved." });
            setEditorOpen(false);
            setRefresh((r) => r + 1);
        } catch {
            toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
        }
    };

    const remove = async (id: string) => {
        if (!confirm("Delete this template?")) return;
        await apiFetch(`/api/fb/templates/${id}`, { method: "DELETE" });
        setRefresh((r) => r + 1);
    };

    const duplicate = async (id: string) => {
        await apiFetch(`/api/fb/templates/${id}/duplicate`, { method: "POST" });
        setRefresh((r) => r + 1);
    };

    const openPreview = (t: any) => {
        setPreviewTemplate(t);
        setPreviewData({});
        setPreviewOpen(true);
    };

    return (
        <Card className="tg-card">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Form Templates</CardTitle>
                    <CardDescription>Custom fields, rows and columns admins can attach when creating a tender (e.g. vendor eligibility forms, technical bid forms).</CardDescription>
                </div>
                <Button className="tg-create-btn" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Form Template</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Sections</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                        ) : templates.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No templates yet. Create one to reuse across tenders.</TableCell></TableRow>
                        ) : (
                            templates.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">{t.name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{t.description || "—"}</TableCell>
                                    <TableCell>{(t.schema?.sections || []).length}</TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => openPreview(t)}><Eye className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => duplicate(t.id)}><Copy className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            {/* Editor Dialog */}
            <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit" : "New"} Form Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Name</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vendor Compliance Form" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Description</Label>
                                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
                            </div>
                        </div>
                        <SchemaBuilder schema={schema} onChange={setSchema} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
                        <Button onClick={save}>Save Template</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
                    </DialogHeader>
                    {previewTemplate && (
                        <FormRenderer schema={previewTemplate.schema} data={previewData} onChange={setPreviewData} />
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function SummarySheetManager() {
    const { toast } = useToast();
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refresh, setRefresh] = useState(0);

    const [editorOpen, setEditorOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [schema, setSchema] = useState<ReportSchema>(emptyReportSchema());
    const [previewTemplate, setPreviewTemplate] = useState<any>(null);

    const load = () => {
        setLoading(true);
        apiFetch(`/api/fb/templates?category=SUMMARY_SHEET`)
            .then((res) => res.json())
            .then((data) => setTemplates(data.templates || []))
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    };

    useEffect(load, [refresh]);

    const openNew = () => {
        setEditing(null);
        setName("");
        setDesc("");
        setSchema(emptyReportSchema());
        setEditorOpen(true);
    };

    const openEdit = (t: any) => {
        setEditing(t);
        setName(t.name);
        setDesc(t.description || "");
        setSchema(t.schema || emptyReportSchema());
        setEditorOpen(true);
    };

    const save = async () => {
        if (!name.trim()) {
            toast({ title: "Name required", variant: "destructive" });
            return;
        }
        try {
            const body = JSON.stringify({ category: "SUMMARY_SHEET", name, description: desc, schema });
            const res = editing
                ? await apiFetch(`/api/fb/templates/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body })
                : await apiFetch(`/api/fb/templates`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
            if (!res.ok) throw new Error();
            toast({ title: "Saved", description: "Summary sheet saved." });
            setEditorOpen(false);
            setRefresh((r) => r + 1);
        } catch {
            toast({ title: "Error", description: "Failed to save summary sheet", variant: "destructive" });
        }
    };

    const remove = async (id: string) => {
        if (!confirm("Delete this summary sheet?")) return;
        await apiFetch(`/api/fb/templates/${id}`, { method: "DELETE" });
        setRefresh((r) => r + 1);
    };

    const duplicate = async (id: string) => {
        await apiFetch(`/api/fb/templates/${id}/duplicate`, { method: "POST" });
        setRefresh((r) => r + 1);
    };

    return (
        <Card className="tg-card">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Summary Sheets</CardTitle>
                    <CardDescription>
                        A print-style report you design once - with text, logo, tables and signatures bound to live tender/vendor data - then attach and export as PDF from any tender.
                    </CardDescription>
                </div>
                <Button className="tg-create-btn" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Summary Sheet</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                        ) : templates.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No summary sheets yet.</TableCell></TableRow>
                        ) : (
                            templates.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">{t.name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{t.description || "—"}</TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setPreviewTemplate(t); setPreviewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => duplicate(t.id)}><Copy className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            {/* Editor Dialog */}
            <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                <DialogContent className="sm:max-w-[1100px] max-h-[88vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit" : "New"} Summary Sheet</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Name</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tender Summary" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Description</Label>
                                    <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
                                </div>
                            </div>
                            <ReportDesigner schema={schema} onChange={setSchema} />
                        </div>
                        <div className="hidden lg:block">
                            <Label className="text-xs text-muted-foreground mb-2 block">Live Preview (sample data)</Label>
                            <div className="border rounded-md overflow-y-auto max-h-[70vh] bg-gray-100 p-4">
                                <ReportRenderer schema={schema} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
                        <Button onClick={save}>Save Summary Sheet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
                    </DialogHeader>
                    {previewTemplate && (
                        <div className="border rounded-md bg-gray-100 p-4">
                            <ReportRenderer schema={previewTemplate.schema} />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

export default function AdminFormBuilder() {
    return (
        <Layout>
            <div className="p-6 space-y-6 tg-page">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutTemplate className="h-6 w-6" /> Form Builder</h1>
                    <p className="text-muted-foreground text-sm">Build custom forms, summary sheets, and quotes once, then reuse them across your tenders.</p>
                </div>

                <Tabs defaultValue="forms">
                    <TabsList>
                        <TabsTrigger value="forms" className="flex gap-2"><LayoutTemplate className="h-4 w-4" /> Form Templates</TabsTrigger>
                        <TabsTrigger value="summary" className="flex gap-2"><FileSpreadsheet className="h-4 w-4" /> Summary Sheets</TabsTrigger>
                        <TabsTrigger value="quotes" className="flex gap-2"><ReceiptText className="h-4 w-4" /> Quotes</TabsTrigger>
                    </TabsList>
                    <TabsContent value="forms" className="mt-4">
                        <FormTemplateManager />
                    </TabsContent>
                    <TabsContent value="summary" className="mt-4">
                        <SummarySheetManager />
                    </TabsContent>
                    <TabsContent value="quotes" className="mt-4">
                        <QuotesTab />
                    </TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
}
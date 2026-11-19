import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Eye, Download, Trash2, FileText, FileSpreadsheet, File as FileIcon } from "lucide-react";
import apiFetch from "@/lib/api";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

// Project documents (quotes, drawings, invoices ...). Upload, view and download only.
// Talks only to the new /api/projects/:id/documents endpoints.

const CATEGORIES = ["Quote", "Drawing", "Invoice", "Contract", "Other"] as const;
const ACCEPT = ".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg";
const MAX_MB = 10;

type Doc = {
    id: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | string | null;
    category: string;
    description: string | null;
    uploaded_by_name: string | null;
    version_label?: string | null;
    can_delete?: boolean;
    created_at: string;
};

const fmtSize = (b: number | string | null) => {
    const n = Number(b || 0);
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
};

const iconFor = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf" || ext === "doc" || ext === "docx") return <FileText className="h-4 w-4 text-red-500" />;
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
    return <FileIcon className="h-4 w-4 text-slate-500" />;
};

export default function ProjectDocumentsDialog({
    projectId,
    projectName,
    versionLabel,
    open,
    onOpenChange,
}: {
    projectId: string | null;
    projectName?: string;
    versionLabel?: string | null; // BOM version open at upload time (info only)
    open: boolean;
    onOpenChange: (o: boolean) => void;
}) {
    const { toast } = useToast();
    const fileRef = useRef<HTMLInputElement>(null);
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [category, setCategory] = useState<string>("Quote");
    const [description, setDescription] = useState("");
    const [file, setFile] = useState<File | null>(null);
    // In-app preview (shown in a second dialog, no new tab)
    const [preview, setPreview] = useState<null | {
        doc: Doc;
        kind: "pdf" | "image" | "sheet";
        url?: string;
        sheets?: { name: string; rows: any[][]; truncated: boolean }[];
    }>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [activeSheet, setActiveSheet] = useState(0);

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/documents`);
            if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to load");
            const data = await res.json();
            setDocs(data.documents || []);
        } catch (e: any) {
            toast({ title: "Could not load documents", description: e?.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [projectId, toast]);

    useEffect(() => { if (open) load(); }, [open, load]);

    const handleUpload = async () => {
        if (!projectId || !file) return;
        if (file.size > MAX_MB * 1024 * 1024) {
            toast({ title: "File too large", description: `Max ${MAX_MB} MB`, variant: "destructive" });
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("category", category);
            fd.append("description", description.trim());
            if (versionLabel) fd.append("versionLabel", versionLabel);
            const token = typeof localStorage !== "undefined" ? localStorage.getItem("authToken") : null;
            const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/+$/, "") || "/api";
            const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/documents`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Upload failed");
            toast({ title: "Uploaded", description: file.name });
            setFile(null);
            setDescription("");
            if (fileRef.current) fileRef.current.value = "";
            load();
        } catch (e: any) {
            toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const deleteDoc = async (d: Doc) => {
        if (!projectId) return;
        if (!window.confirm(`Delete "${d.file_name}"? This cannot be undone.`)) return;
        try {
            const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/documents/${d.id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Delete failed");
            toast({ title: "Deleted", description: d.file_name });
            load();
        } catch (e: any) {
            toast({ title: "Could not delete", description: e?.message, variant: "destructive" });
        }
    };

    const closePreview = () => {
        if (preview?.url) URL.revokeObjectURL(preview.url);
        setPreview(null);
    };

    const openDoc = async (d: Doc, mode: "view" | "download") => {
        if (!projectId) return;
        const ext = d.file_name.split(".").pop()?.toLowerCase() || "";
        try {
            if (mode === "view") {
                const isPdf = ext === "pdf";
                const isImage = ["png", "jpg", "jpeg"].includes(ext);
                const isSheet = ["xlsx", "xls", "csv"].includes(ext);
                if (!isPdf && !isImage && !isSheet) {
                    toast({ title: "Preview not available", description: "Word files can't be previewed here. Please use Download." });
                    return;
                }
                setPreviewLoading(true);
                const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/documents/${d.id}/file`);
                if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Could not open file");
                const type = res.headers.get("Content-Type") || "application/octet-stream";
                if (isSheet) {
                    const wb = XLSX.read(await res.arrayBuffer(), { type: "array" });
                    const MAX_ROWS = 500;
                    const sheets = wb.SheetNames.map((name) => {
                        const all = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: "" });
                        return { name, rows: all.slice(0, MAX_ROWS), truncated: all.length > MAX_ROWS };
                    });
                    setActiveSheet(0);
                    setPreview({ doc: d, kind: "sheet", sheets });
                } else {
                    const url = URL.createObjectURL(new Blob([await res.blob()], { type }));
                    setPreview({ doc: d, kind: isPdf ? "pdf" : "image", url });
                }
            } else {
                const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/documents/${d.id}/url?mode=download`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.url) throw new Error(data?.message || "Could not open file");
                window.open(data.url, "_blank", "noopener");
            }
        } catch (e: any) {
            toast({ title: "Could not open file", description: e?.message, variant: "destructive" });
        } finally {
            setPreviewLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-black">Project Documents</DialogTitle>
                    <DialogDescription>
                        {projectName ? `${projectName} — ` : ""}Upload quotes and other files for this project. Anyone with BOM access to the project can view and download them.
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-2">
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm font-medium"
                        >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description (optional)"
                            maxLength={500}
                            className="h-9"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileRef}
                            type="file"
                            accept={ACCEPT}
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="text-xs flex-1 min-w-0"
                        />
                        <Button size="sm" onClick={handleUpload} disabled={!file || uploading || !projectId} className="font-bold gap-1">
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                        </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">PDF, Excel, CSV, Word, PNG, JPG · max {MAX_MB} MB</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                ) : docs.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-8">No documents uploaded for this project yet.</p>
                ) : (
                    <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30 text-left text-[11px] uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2">File</th>
                                    <th className="px-3 py-2">Category</th>
                                    <th className="px-3 py-2">Version</th>
                                    <th className="px-3 py-2">Uploaded</th>
                                    <th className="px-3 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docs.map((d) => (
                                    <tr key={d.id} className="border-t">
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                {iconFor(d.file_name)}
                                                <div className="min-w-0">
                                                    <p className="font-semibold truncate max-w-[260px]" title={d.file_name}>{d.file_name}</p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {fmtSize(d.size_bytes)}{d.description ? ` · ${d.description}` : ""}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2"><Badge variant="outline" className="font-bold">{d.category}</Badge></td>
                                        <td className="px-3 py-2 text-xs font-semibold">{d.version_label || "-"}</td>
                                        <td className="px-3 py-2 text-[11px] text-muted-foreground">
                                            {d.uploaded_by_name || "-"}<br />{new Date(d.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" title="View" aria-label="View" onClick={() => openDoc(d, "view")}><Eye className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Download" aria-label="Download" onClick={() => openDoc(d, "download")}><Download className="h-4 w-4" /></Button>
                                            {d.can_delete && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" title="Delete" aria-label="Delete" onClick={() => deleteDoc(d)}><Trash2 className="h-4 w-4" /></Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </DialogContent>

            {/* In-app preview */}
            <Dialog open={!!preview || previewLoading} onOpenChange={(o) => { if (!o) closePreview(); }}>
                <DialogContent className="max-w-5xl w-[95vw] h-[88vh] flex flex-col">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="font-black truncate pr-8">{preview?.doc.file_name || "Opening..."}</DialogTitle>
                        <DialogDescription className="sr-only">Document preview</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-auto rounded-lg border bg-slate-50">
                        {previewLoading && !preview && (
                            <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                        )}
                        {preview?.kind === "pdf" && <iframe title="preview" src={preview.url} className="w-full h-full bg-white" />}
                        {preview?.kind === "image" && (
                            <div className="h-full flex items-center justify-center p-2"><img src={preview.url} alt={preview.doc.file_name} className="max-w-full max-h-full object-contain" /></div>
                        )}
                        {preview?.kind === "sheet" && preview.sheets && (
                            <div className="flex flex-col h-full">
                                {preview.sheets.length > 1 && (
                                    <div className="flex gap-1 p-2 border-b bg-white overflow-x-auto shrink-0">
                                        {preview.sheets.map((sh, i) => (
                                            <Button key={sh.name} size="sm" variant={i === activeSheet ? "default" : "outline"} className="h-7 text-xs" onClick={() => setActiveSheet(i)}>{sh.name}</Button>
                                        ))}
                                    </div>
                                )}
                                <div className="flex-1 overflow-auto bg-white">
                                    <table className="text-xs border-collapse">
                                        <tbody>
                                            {preview.sheets[activeSheet]?.rows.map((row, ri) => (
                                                <tr key={ri} className={ri === 0 ? "bg-slate-100 font-bold" : ""}>
                                                    {row.map((cell, ci) => (
                                                        <td key={ci} className="border px-2 py-1 whitespace-nowrap">{String(cell ?? "")}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {preview.sheets[activeSheet]?.truncated && (
                                        <p className="text-[11px] text-muted-foreground p-2">Showing the first 500 rows. Download the file to see everything.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    {preview && (
                        <div className="shrink-0 flex justify-end">
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => openDoc(preview.doc, "download")}><Download className="h-4 w-4" />Download</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
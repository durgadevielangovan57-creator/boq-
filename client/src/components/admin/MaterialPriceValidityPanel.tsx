import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { format, addDays } from "date-fns";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, History, Loader2, Pencil, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, getJSON } from "@/lib/api";
import { useData } from "@/lib/store";

/**
 * Material Price Validity (90 days) + full price history.
 * Completely independent of the existing Materials / Shops lists: it only reads
 * /api/material-prices/* and saves a new rate through the existing
 * PUT /api/materials/:id (so existing behaviour / notifications are unchanged).
 */

type AgeKey = "" | "lt1" | "1m" | "2m" | "3m" | "gt3";
type StatusKey = "fresh" | "warning" | "expired";

interface PriceRow {
    id: string;
    name: string;
    code: string | null;
    rate: string | number | null;
    unit: string | null;
    category: string | null;
    shop_id: string | null;
    shop_name: string | null;
    last_updated: string;
    days_old: number;
    age_bucket: Exclude<AgeKey, "">;
    status: StatusKey;
    history_count: number;
}

interface HistoryRow {
    id: string;
    previous_rate: string | number | null;
    new_rate: string | number | null;
    changed_by: string | null;
    changed_at: string;
    source: string;
    note: string | null;
    shop_name: string | null;
}

const VALIDITY_DAYS = 90;
const PAGE_SIZE = 25;

const AGE_FILTERS: { key: AgeKey; label: string; countKey: string }[] = [
    { key: "", label: "All", countKey: "total" },
    { key: "lt1", label: "Less than 1 Month", countKey: "lt1" },
    { key: "1m", label: "1 Month Old", countKey: "m1" },
    { key: "2m", label: "2 Months Old", countKey: "m2" },
    { key: "3m", label: "3 Months Old", countKey: "m3" },
    { key: "gt3", label: "More than 3 Months (90+ Days)", countKey: "gt3" },
];

const STATUS_STYLE: Record<StatusKey, { label: string; row: string; badge: string; icon: ReactNode }> = {
    fresh: {
        label: "Valid",
        row: "",
        badge: "bg-green-100 text-green-800 border-green-200",
        icon: <CheckCircle2 className="h-3 w-3" />,
    },
    warning: {
        label: "Expiring soon",
        row: "bg-amber-50 border-l-4 border-l-amber-400",
        badge: "bg-amber-100 text-amber-800 border-amber-300",
        icon: <Clock className="h-3 w-3" />,
    },
    expired: {
        label: "Review needed",
        row: "bg-red-50 border-l-4 border-l-red-500",
        badge: "bg-red-100 text-red-800 border-red-300",
        icon: <AlertTriangle className="h-3 w-3" />,
    },
};

const inr = (v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const safeDate = (v: string, pattern: string) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : format(d, pattern);
};

export function MaterialPriceValidityPanel({ canEdit = false }: { canEdit?: boolean }) {
    const { toast } = useToast();
    const { refreshMaterials } = useData();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<PriceRow[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [total, setTotal] = useState(0);
    const [age, setAge] = useState<AgeKey>("");
    const [status, setStatus] = useState<"" | StatusKey>("");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [sort, setSort] = useState<"oldest" | "newest" | "name">("oldest");
    const [page, setPage] = useState(0);

    // update-rate dialog
    const [editRow, setEditRow] = useState<PriceRow | null>(null);
    const [newRate, setNewRate] = useState("");
    const [saving, setSaving] = useState(false);

    // history dialog
    const [histRow, setHistRow] = useState<PriceRow | null>(null);
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [histLoading, setHistLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(0);
    }, [age, status, debouncedSearch, sort]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams();
            if (debouncedSearch) qs.set("search", debouncedSearch);
            if (age) qs.set("age", age);
            if (status) qs.set("status", status);
            qs.set("sort", sort);
            qs.set("limit", String(PAGE_SIZE));
            qs.set("offset", String(page * PAGE_SIZE));
            const data: any = await getJSON(`/api/material-prices/validity?${qs.toString()}`);
            setItems(Array.isArray(data?.items) ? data.items : []);
            setCounts(data?.counts || {});
            setTotal(Number(data?.total) || 0);
        } catch (e: any) {
            toast({ title: "Could not load price validity", description: e?.message || "Please try again", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, age, status, sort, page, toast]);

    // Only fetch once the panel is opened, so the dashboard itself costs nothing extra.
    useEffect(() => {
        if (open) load();
    }, [open, load]);

    const openEdit = (row: PriceRow) => {
        setEditRow(row);
        setNewRate(row.rate === null || row.rate === undefined ? "" : String(Number(row.rate)));
    };

    const openHistory = async (row: PriceRow) => {
        setHistRow(row);
        setHistory([]);
        setHistLoading(true);
        try {
            const data: any = await getJSON(`/api/material-prices/${row.id}/history`);
            setHistory(Array.isArray(data?.history) ? data.history : []);
        } catch (e: any) {
            toast({ title: "Could not load price history", description: e?.message || "Please try again", variant: "destructive" });
        } finally {
            setHistLoading(false);
        }
    };

    const saveRate = async () => {
        if (!editRow) return;
        const rate = Number(newRate);
        if (newRate.trim() === "" || Number.isNaN(rate) || rate < 0) {
            toast({ title: "Enter a valid rate", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const unchanged = Math.abs(rate - Number(editRow.rate || 0)) < 0.005;
            const res = unchanged
                ? await apiFetch(`/api/material-prices/${editRow.id}/confirm`, { method: "POST", body: JSON.stringify({}) })
                : await apiFetch(`/api/materials/${editRow.id}`, { method: "PUT", body: JSON.stringify({ rate }) });
            if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Save failed");
            toast({
                title: unchanged ? "Rate confirmed" : "Rate updated",
                description: `${editRow.name}: 90-day validity restarted.`,
            });
            setEditRow(null);
            // A rate change must reach the shared catalog used by Manage Product Step 2.
            if (!unchanged) refreshMaterials();
            await load();
        } catch (e: any) {
            toast({ title: "Could not update rate", description: e?.message || "Please try again", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const needReview = (counts.expired || 0) + (counts.warning || 0);

    const newRateNum = Number(newRate);
    const editUnchanged = useMemo(
        () => !!editRow && newRate.trim() !== "" && !Number.isNaN(newRateNum) && Math.abs(newRateNum - Number(editRow.rate || 0)) < 0.005,
        [editRow, newRate, newRateNum],
    );

    return (
        <Card id="material-price-validity-section" className="p-4 scroll-mt-24">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 text-left"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-5 w-5 text-indigo-700" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight">Material Price Validity (90 days)</p>
                        <p className="text-xs text-muted-foreground truncate">
                            Track how old each material rate is and review the price history
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {(counts.expired || 0) > 0 && (
                        <Badge className="bg-red-100 text-red-800 border border-red-300 hover:bg-red-100">{counts.expired} need review</Badge>
                    )}
                    {(counts.warning || 0) > 0 && (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">{counts.warning} expiring</Badge>
                    )}
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
            </button>

            {open && (
                <div className="mt-4 space-y-3">
                    {/* legend */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-green-500" /> Valid (0–74 days)</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Expiring soon (75–90 days)</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Older than 90 days – review &amp; update</span>
                    </div>

                    {/* age filters */}
                    <div className="flex flex-wrap gap-2">
                        {AGE_FILTERS.map((f) => (
                            <button
                                key={f.key || "all"}
                                type="button"
                                onClick={() => setAge(f.key)}
                                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${age === f.key
                                    ? f.key === "gt3"
                                        ? "bg-red-600 text-white border-red-600"
                                        : "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white hover:bg-slate-50 text-slate-700"
                                    }`}
                            >
                                {f.label}
                                <span className="ml-1.5 opacity-80">({counts[f.countKey] ?? 0})</span>
                            </button>
                        ))}
                    </div>

                    {/* search / status / sort */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search material, code, shop or category..."
                            className="h-9 max-w-sm"
                        />
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            className="h-9 rounded-md border bg-white px-2 text-sm"
                        >
                            <option value="">All statuses</option>
                            <option value="fresh">Valid</option>
                            <option value="warning">Expiring soon</option>
                            <option value="expired">Review needed</option>
                        </select>
                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as any)}
                            className="h-9 rounded-md border bg-white px-2 text-sm"
                        >
                            <option value="oldest">Oldest price first</option>
                            <option value="newest">Newest price first</option>
                            <option value="name">Name A–Z</option>
                        </select>
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>

                    {/* table */}
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-600">
                                <tr>
                                    <th className="text-left px-3 py-2 font-semibold">Material</th>
                                    <th className="text-left px-3 py-2 font-semibold">Shop / Vendor</th>
                                    <th className="text-right px-3 py-2 font-semibold">Current Rate</th>
                                    <th className="text-left px-3 py-2 font-semibold">Last Updated</th>
                                    <th className="text-right px-3 py-2 font-semibold">Days Since</th>
                                    <th className="text-left px-3 py-2 font-semibold">Valid Until</th>
                                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                                    <th className="text-right px-3 py-2 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={8} className="text-center text-muted-foreground py-8">
                                            No materials match these filters.
                                        </td>
                                    </tr>
                                )}
                                {items.map((r) => {
                                    const st = STATUS_STYLE[r.status] || STATUS_STYLE.fresh;
                                    const validUntil = addDays(new Date(r.last_updated), VALIDITY_DAYS);
                                    return (
                                        <tr key={r.id} className={`border-t ${st.row}`}>
                                            <td className="px-3 py-2">
                                                <div className="font-medium leading-tight">{r.name}</div>
                                                <div className="text-xs text-muted-foreground">{[r.code, r.category].filter(Boolean).join(" • ")}</div>
                                            </td>
                                            <td className="px-3 py-2">{r.shop_name || <span className="text-muted-foreground">Unassigned</span>}</td>
                                            <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                                                {inr(r.rate)}
                                                {r.unit ? <span className="text-xs font-normal text-muted-foreground"> / {r.unit}</span> : null}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">{safeDate(r.last_updated, "dd MMM yyyy, hh:mm a")}</td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                                                {r.days_old} {r.days_old === 1 ? "day" : "days"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {Number.isNaN(validUntil.getTime()) ? "—" : format(validUntil, "dd MMM yyyy")}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${st.badge}`}>
                                                    {st.icon} {st.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex justify-end gap-1.5">
                                                    {canEdit && (
                                                        <Button
                                                            size="sm"
                                                            variant={r.status === "expired" ? "default" : "outline"}
                                                            className={`h-7 px-2 text-xs ${r.status === "expired" ? "bg-red-600 hover:bg-red-700" : ""}`}
                                                            onClick={() => openEdit(r)}
                                                        >
                                                            <Pencil className="h-3 w-3 mr-1" /> Update Rate
                                                        </Button>
                                                    )}
                                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openHistory(r)}>
                                                        <History className="h-3 w-3 mr-1" /> History{r.history_count > 0 ? ` (${r.history_count})` : ""}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* pagination */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            {total === 0 ? "0 materials" : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total} materials`}
                            {needReview > 0 && ` • ${needReview} need attention`}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-7" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                                Previous
                            </Button>
                            <span>
                                Page {page + 1} / {totalPages}
                            </span>
                            <Button size="sm" variant="outline" className="h-7" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Update rate dialog */}
            <Dialog open={!!editRow} onOpenChange={(o) => !o && !saving && setEditRow(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Update Rate</DialogTitle>
                        <DialogDescription>
                            {editRow?.name}
                            {editRow?.shop_name ? ` — ${editRow.shop_name}` : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="text-sm">
                            Current rate: <span className="font-semibold">{inr(editRow?.rate)}</span>
                            {editRow ? (
                                <span className="text-muted-foreground"> (last updated {editRow.days_old} days ago)</span>
                            ) : null}
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600">New rate (₹)</label>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={newRate}
                                onChange={(e) => setNewRate(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && !saving && saveRate()}
                            />
                        </div>
                        {editUnchanged ? (
                            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
                                Same as the current rate — saving will mark this rate as reviewed and restart its 90-day validity.
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                The previous rate stays in the price history. The 90-day validity restarts when you save.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditRow(null)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={saveRate} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            {editUnchanged ? "Confirm Rate Is Valid" : "Save New Rate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History dialog */}
            <Dialog open={!!histRow} onOpenChange={(o) => !o && setHistRow(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Price History</DialogTitle>
                        <DialogDescription>
                            {histRow?.name}
                            {histRow?.shop_name ? ` — ${histRow.shop_name}` : ""} • current rate {inr(histRow?.rate)}
                        </DialogDescription>
                    </DialogHeader>
                    {histLoading ? (
                        <div className="py-10 flex justify-center">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : history.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No price history recorded yet.</p>
                    ) : (
                        <div className="border rounded-lg overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-600">
                                    <tr>
                                        <th className="text-left px-3 py-2">Date &amp; Time</th>
                                        <th className="text-left px-3 py-2">Change</th>
                                        <th className="text-left px-3 py-2">Type</th>
                                        <th className="text-left px-3 py-2">Updated By</th>
                                        <th className="text-left px-3 py-2">Shop / Vendor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((h, idx) => {
                                        const prev = h.previous_rate === null || h.previous_rate === undefined ? null : Number(h.previous_rate);
                                        const next = h.new_rate === null || h.new_rate === undefined ? null : Number(h.new_rate);
                                        const diff = prev !== null && next !== null ? next - prev : null;
                                        const typeLabel =
                                            h.source === "confirmed" ? "Reviewed – unchanged" : h.source === "updated" ? "Rate updated" : "Original rate";
                                        return (
                                            <tr key={h.id} className={`border-t ${idx === 0 ? "bg-indigo-50/50" : ""}`}>
                                                <td className="px-3 py-2 whitespace-nowrap">{safeDate(h.changed_at, "dd MMM yyyy, hh:mm a")}</td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    {prev === null ? (
                                                        <span className="font-semibold">{inr(next)}</span>
                                                    ) : (
                                                        <span>
                                                            {inr(prev)} <span className="text-muted-foreground">→</span> <span className="font-semibold">{inr(next)}</span>
                                                        </span>
                                                    )}
                                                    {diff !== null && Math.abs(diff) >= 0.005 && (
                                                        <span className={`ml-2 inline-flex items-center text-xs ${diff > 0 ? "text-red-600" : "text-green-600"}`}>
                                                            {diff > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                                                            {diff > 0 ? "+" : "−"}₹{Math.abs(diff).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                                            {prev ? ` (${((Math.abs(diff) / prev) * 100).toFixed(1)}%)` : ""}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">{typeLabel}</td>
                                                <td className="px-3 py-2">{h.changed_by || <span className="text-muted-foreground">System</span>}</td>
                                                <td className="px-3 py-2">{h.shop_name || "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}

export default MaterialPriceValidityPanel;
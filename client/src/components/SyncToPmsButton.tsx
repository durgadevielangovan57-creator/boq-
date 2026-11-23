import { useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, ChevronsUpDown, Loader2, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";

/**
 * "Sync to PMS" — self-contained button + dialog.
 * Shown only for a FINAL version and only when the server has PMS configured.
 *   BOM version -> tasks under key step "Procurement"
 *   BOQ version -> tasks under key step "Execution"
 * Every task: start = today, end = today + 7 days (same for the key step).
 */
type Props = {
    versionId?: string | null;
    boqProjectId?: string | null;
    isFinal?: boolean;
    type: "bom" | "boq";
};

type Employee = { id: string; name: string; empCode: string; department: string; designation: string };
type PmsProject = { id: string; title: string; projectCode: string };

const ALL = "__all__";

type Option = { value: string; label: string; hint?: string };

/**
 * Dropdown with an always-visible search box.
 * The list opens INLINE (inside the dialog, pushing content down) instead of in a
 * floating popover, so it can never be hidden behind / clipped by the dialog and
 * the search box is always shown and focusable.
 */
function DropdownPanel({
    open, onToggle, triggerLabel, isPlaceholder, q, setQ, searchPlaceholder, children,
}: {
    open: boolean; onToggle: () => void; triggerLabel: string; isPlaceholder: boolean;
    q: string; setQ: (v: string) => void; searchPlaceholder: string; children: React.ReactNode;
}) {
    return (
        <div className="w-full min-w-0 overflow-hidden rounded-md border bg-white">
            <button type="button" onClick={onToggle} aria-expanded={open}
                className="flex h-10 w-full items-center justify-between px-3 text-left text-sm">
                <span className={isPlaceholder ? "min-w-0 truncate text-slate-500" : "min-w-0 truncate"}>{triggerLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>
            {open && (
                <div className="border-t">
                    <div className="flex items-center gap-2 border-b px-3">
                        <Search className="h-4 w-4 text-slate-400 shrink-0" />
                        <input
                            autoFocus
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="h-9 w-full bg-transparent text-sm outline-none"
                        />
                    </div>
                    {/* stopPropagation: lets the mouse wheel scroll this list inside the dialog */}
                    <div className="max-h-48 overflow-y-auto overflow-x-hidden" onWheel={(e) => e.stopPropagation()}>
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}

function filterOptions(options: Option[], q: string) {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => `${o.label} ${o.hint || ""}`.toLowerCase().includes(needle));
}

/** Single-select dropdown with a search box. */
function SearchableSelect({
    value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: Option[]; placeholder: string }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const selected = options.find((o) => o.value === value);
    const shown = useMemo(() => filterOptions(options, q), [options, q]);

    return (
        <DropdownPanel
            open={open}
            onToggle={() => { setOpen((v) => !v); setQ(""); }}
            triggerLabel={selected ? selected.label : placeholder}
            isPlaceholder={!selected}
            q={q} setQ={setQ} searchPlaceholder="Search…"
        >
            {shown.length === 0 && <div className="px-3 py-3 text-xs text-slate-500">No results</div>}
            {shown.map((o) => (
                <button
                    type="button"
                    key={o.value}
                    onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                    className="flex w-full min-w-0 items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100"
                >
                    <Check className={`h-4 w-4 shrink-0 ${o.value === value ? "opacity-100" : "opacity-0"}`} />
                    <span className="min-w-0 truncate">{o.label}</span>
                    {o.hint && <span className="ml-auto pl-2 text-[11px] text-slate-400 shrink-0">{o.hint}</span>}
                </button>
            ))}
        </DropdownPanel>
    );
}

/** Multi-select dropdown (tick several) with a search box. Stays open while ticking. */
function MultiSelect({
    values, onChange, options, placeholder,
}: { values: string[]; onChange: (v: string[]) => void; options: Option[]; placeholder: string }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const shown = useMemo(() => filterOptions(options, q), [options, q]);
    const selectedOpts = options.filter((o) => values.includes(o.value));
    const label =
        selectedOpts.length === 0
            ? placeholder
            : selectedOpts.length <= 2
                ? selectedOpts.map((o) => o.label).join(", ")
                : `${selectedOpts.length} assignees selected`;

    const toggle = (id: string) =>
        onChange(values.includes(id) ? values.filter((x) => x !== id) : [...values, id]);

    return (
        <DropdownPanel
            open={open}
            onToggle={() => { setOpen((v) => !v); setQ(""); }}
            triggerLabel={label}
            isPlaceholder={selectedOpts.length === 0}
            q={q} setQ={setQ} searchPlaceholder="Search assignees…"
        >
            {shown.length === 0 && <div className="px-3 py-3 text-xs text-slate-500">No employees found</div>}
            {shown.map((o) => {
                const checked = values.includes(o.value);
                return (
                    <label key={o.value} className="flex min-w-0 items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-100">
                        <input
                            type="checkbox"
                            className="h-4 w-4 accent-indigo-600"
                            checked={checked}
                            onChange={() => toggle(o.value)}
                        />
                        <span className="min-w-0 truncate">{o.label}</span>
                        {o.hint && <span className="ml-auto pl-2 text-[11px] text-slate-400 shrink-0">{o.hint}</span>}
                    </label>
                );
            })}
            {values.length > 0 && (
                <button type="button" onClick={() => onChange([])}
                    className="w-full border-t px-3 py-1.5 text-left text-xs text-indigo-600 hover:bg-slate-50">
                    Clear selection
                </button>
            )}
        </DropdownPanel>
    );
}

export default function SyncToPmsButton({ versionId, boqProjectId, isFinal, type }: Props) {
    const { toast } = useToast();
    const [enabled, setEnabled] = useState(false);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const [departments, setDepartments] = useState<string[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [projects, setProjects] = useState<PmsProject[]>([]);
    const [matchedBy, setMatchedBy] = useState<"saved" | "name" | null>(null);

    const [department, setDepartment] = useState<string>(ALL);
    const [pmsProjectId, setPmsProjectId] = useState<string>("");
    const [assignerId, setAssignerId] = useState<string>("");
    const [taskOwnerId, setTaskOwnerId] = useState<string>("");
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

    type PreviewPart = { type: "bom" | "boq"; keyStep: string; versionNumber: number; total: number; newCount: number; skipCount: number };
    const [preview, setPreview] = useState<{ total: number; newCount: number; skipCount: number; keyStep: string; parts?: PreviewPart[] } | null>(null);
    // null = unknown yet; true = everything from this version is already in PMS
    const [synced, setSynced] = useState<boolean | null>(null);
    const [error, setError] = useState<string>("");
    const [progress, setProgress] = useState<{ done: number; failed: number; total: number } | null>(null);

    const keyStepName = type === "bom" ? "Procurement" : "Execution";

    // Is the feature switched on server-side? (checked once)
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const r = await apiFetch("/api/pms-sync/config");
                if (r.ok) {
                    const d = await r.json();
                    if (alive) setEnabled(!!d.enabled);
                }
            } catch {
                /* feature simply stays hidden */
            }
        })();
        return () => { alive = false; };
    }, []);

    const refreshStatus = async () => {
        if (!enabled || !isFinal || !versionId) return;
        try {
            const r = await apiFetch(`/api/pms-sync/status?versionId=${encodeURIComponent(versionId)}`);
            if (r.ok) {
                const d = await r.json();
                setSynced(!!d.synced);
            }
        } catch {
            /* badge simply stays neutral */
        }
    };

    useEffect(() => {
        setSynced(null);
        refreshStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, isFinal, versionId]);

    const loadDialogData = async () => {
        setLoading(true);
        setError("");
        setPreview(null);
        try {
            const [optResp, prevResp] = await Promise.all([
                apiFetch(`/api/pms-sync/options?boqProjectId=${encodeURIComponent(boqProjectId || "")}`),
                apiFetch(`/api/pms-sync/preview`, { method: "POST", body: JSON.stringify({ versionId }) }),
            ]);
            const opt = await optResp.json().catch(() => ({}));
            if (!optResp.ok) throw new Error(opt.message || "Could not load PMS data");
            setDepartments(opt.departments || []);
            setEmployees(opt.employees || []);
            setProjects(opt.projects || []);
            setMatchedBy(opt.matchedBy || null);
            setPmsProjectId(opt.selectedProjectId || "");

            const prev = await prevResp.json().catch(() => ({}));
            if (!prevResp.ok) throw new Error(prev.message || "Could not build preview");
            setPreview(prev);
        } catch (e: any) {
            setError(e?.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const openDialog = () => {
        setOpen(true);
        setDepartment(ALL);
        setAssignerId("");
        setTaskOwnerId("");
        setAssigneeIds([]);
        loadDialogData();
    };

    const people = useMemo(
        () => (department === ALL ? employees : employees.filter((e) => e.department === department)),
        [employees, department],
    );

    const personOptions: Option[] = useMemo(
        () => people.map((e) => ({ value: e.id, label: `${e.name}${e.empCode ? ` (${e.empCode})` : ""}`, hint: e.department })),
        [people],
    );
    const projectOptions: Option[] = useMemo(
        () => projects.map((p) => ({ value: p.id, label: p.title, hint: p.projectCode })),
        [projects],
    );

    const onDepartmentChange = (d: string) => {
        setDepartment(d);
        // Drop selections that no longer belong to the chosen department.
        const ok = (id: string) => d === ALL || employees.find((e) => e.id === id)?.department === d;
        if (assignerId && !ok(assignerId)) setAssignerId("");
        if (taskOwnerId && !ok(taskOwnerId)) setTaskOwnerId("");
        setAssigneeIds((prev) => prev.filter(ok));
    };

    const canSync = !!pmsProjectId && !!assignerId && !!taskOwnerId && !!preview && preview.newCount > 0 && !syncing;

    const BATCH_SIZE = 5;

    const doSync = async () => {
        setSyncing(true);
        setError("");
        const total = preview?.newCount || 0;
        let created = 0;
        let failed = 0;
        let skipped = 0;
        const keySteps: string[] = [];
        const failures: any[] = [];
        setProgress({ done: 0, failed: 0, total });
        try {
            // A BOQ with a linked source BOM has two parts: [0] = this BOQ (Execution),
            // [1] = its BOM (Procurement). Only parts that have new lines are sent.
            const parts: PreviewPart[] = preview?.parts && preview.parts.length > 0
                ? preview.parts
                : [{ type, keyStep: keyStepName, versionNumber: 0, total: 0, newCount: total, skipCount: 0 }];

            for (let pi = 0; pi < parts.length; pi++) {
                if (parts[pi].newCount <= 0) continue;
                let failedInPart = 0;
                // Send the tasks in small batches so the progress bar can move.
                // Each batch only touches lines not yet in PMS, so retries never duplicate.
                for (let guard = 0; guard < 1000; guard++) {
                    const resp = await apiFetch("/api/pms-sync/sync", {
                        method: "POST",
                        body: JSON.stringify({
                            versionId,
                            part: pi === 0 ? "self" : "linked_bom",
                            pmsProjectId,
                            assignerId,
                            taskOwnerId,
                            assigneeIds,
                            department: department === ALL ? null : department,
                            limit: BATCH_SIZE,
                            skip: failedInPart,
                        }),
                    });
                    const d = await resp.json().catch(() => ({}));
                    if (!resp.ok) throw new Error(d.message || "Sync failed");
                    created += d.created || 0;
                    failed += d.failed || 0;
                    failedInPart += d.failed || 0;
                    if (guard === 0) skipped += d.skipped || 0;
                    if (d.keyStep && !keySteps.includes(d.keyStep)) keySteps.push(d.keyStep);
                    if (Array.isArray(d.failures)) failures.push(...d.failures);
                    setProgress({ done: created, failed, total });
                    if (!d.remaining || (d.created || 0) + (d.failed || 0) === 0) break;
                }
            }
            const keyStep = keySteps.join(" + ") || keyStepName;

            toast({
                title: failed ? "Synced with some errors" : "Synced to PMS",
                description: `${created} task(s) created under "${keyStep}"${skipped ? `, ${skipped} already existed` : ""}${failed ? `, ${failed} failed` : ""}.`,
                variant: failed ? "destructive" : undefined,
            });
            if (failed) {
                setError(`${failed} task(s) failed: ${failures.slice(0, 20).map((f: any) => `${f.name} (${f.error})`).join("; ")}`);
                await loadDialogData();
            } else {
                setOpen(false);
            }
        } catch (e: any) {
            setError(
                `${e?.message || "Sync failed"}${created > 0 ? ` — ${created} task(s) were already created; press Sync again to continue with the rest.` : ""}`,
            );
            await loadDialogData();
        } finally {
            setSyncing(false);
            setProgress(null);
            refreshStatus();
        }
    };

    if (!enabled || !isFinal || !versionId) return null;

    return (
        <>
            <Button
                variant="outline"
                size="icon"
                className={
                    synced
                        ? "h-9 w-9 border border-emerald-200 bg-emerald-50 text-emerald-600 hover:text-emerald-700 hover:border-emerald-300 shadow-sm shrink-0"
                        : "h-9 w-9 border border-indigo-200 bg-indigo-50 text-indigo-600 hover:text-indigo-700 hover:border-indigo-300 shadow-sm shrink-0"
                }
                title={
                    synced
                        ? "Already synced to PMS"
                        : type === "boq"
                            ? 'Sync this final BOQ and its source BOM to PMS (Execution + Procurement tasks)'
                            : `Sync this final BOM to PMS (creates tasks under "${keyStepName}")`
                }
                onClick={openDialog}
            >
                {synced ? <CheckCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>

            <Dialog open={open} onOpenChange={(v) => !syncing && setOpen(v)}>
                <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
                    <DialogHeader>
                        <DialogTitle>Sync to PMS</DialogTitle>
                        <DialogDescription>
                            {preview?.parts && preview.parts.length > 1 ? (
                                <>Creates <b>Execution</b> tasks from this BOQ and <b>Procurement</b> tasks from its source BOM (V{preview.parts[1].versionNumber}). Each task runs from today to 7 days from today.</>
                            ) : (
                                <>Creates tasks under the key step <b>{keyStepName}</b>. Each task runs from today to 7 days from today.</>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex items-center justify-center py-10 text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading from PMS…
                        </div>
                    ) : (
                        <div className="space-y-4 min-w-0 w-full">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase">PMS Project</Label>
                                    {matchedBy && pmsProjectId && (
                                        <span className="text-[11px] text-slate-500">
                                            {matchedBy === "saved" ? "used last time – you can change it" : "matched by name – you can change it"}
                                        </span>
                                    )}
                                </div>
                                <SearchableSelect value={pmsProjectId} onChange={setPmsProjectId} options={projectOptions} placeholder="Select PMS project" />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase">Department</Label>
                                <Select value={department} onValueChange={onDepartmentChange}>
                                    <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                                    <SelectContent className="max-h-[260px]">
                                        <SelectItem value={ALL}>All departments</SelectItem>
                                        {departments.map((d) => (
                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase">Assigner</Label>
                                <SearchableSelect value={assignerId} onChange={setAssignerId} options={personOptions} placeholder="Select assigner" />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase">Task Owner</Label>
                                <SearchableSelect value={taskOwnerId} onChange={setTaskOwnerId} options={personOptions} placeholder="Select task owner" />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase">Assignees</Label>
                                    <span className="text-[11px] text-slate-500">
                                        {assigneeIds.length > 0 ? `${assigneeIds.length} selected` : "none selected – task owner will be the assignee"}
                                    </span>
                                </div>
                                <MultiSelect values={assigneeIds} onChange={setAssigneeIds} options={personOptions} placeholder="Select assignees (optional)" />
                            </div>

                            {syncing && progress && progress.total > 0 && (() => {
                                const handled = progress.done + progress.failed;
                                const pct = Math.min(100, Math.round((handled / progress.total) * 100));
                                return (
                                    <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-3 space-y-2">
                                        <div className="flex items-center justify-between text-xs font-medium text-indigo-800">
                                            <span className="flex items-center gap-1.5">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing to PMS…
                                            </span>
                                            <span>{handled} / {progress.total} tasks · {pct}%</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                                            <div className="h-full rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${pct}%` }} />
                                        </div>
                                        <p className="text-[11px] text-indigo-700">
                                            Please keep this window open until it finishes.
                                            {progress.failed > 0 && <span className="text-red-600"> {progress.failed} failed so far.</span>}
                                        </p>
                                    </div>
                                );
                            })()}

                            {!syncing && preview && (
                                preview.total > 0 && preview.newCount === 0 ? (
                                    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                                        <CheckCheck className="h-4 w-4 shrink-0" />
                                        Already synced to PMS — all {preview.total} task(s) exist. Nothing new to sync.
                                    </div>
                                ) : (
                                    <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-1">
                                        {preview.parts && preview.parts.length > 1 ? (
                                            preview.parts.map((p) => (
                                                <div key={p.type}>
                                                    <b>{p.keyStep}</b> ({p.type.toUpperCase()} V{p.versionNumber}):{" "}
                                                    {p.total === 0 ? "no lines found" : p.newCount === 0 ? "already synced" : `${p.newCount} new task(s)`}
                                                    {p.newCount > 0 && p.skipCount > 0 && <> · {p.skipCount} already in PMS (skipped)</>}
                                                </div>
                                            ))
                                        ) : (
                                            <div>
                                                {preview.newCount} new task(s) will be created
                                                {preview.skipCount > 0 && <> · {preview.skipCount} already in PMS (skipped)</>}
                                                {preview.newCount === 0 && preview.total === 0 && (
                                                    <> — no {type === "bom" ? "material lines" : "products"} found in this final version.</>
                                                )}
                                            </div>
                                        )}
                                        {preview.parts && preview.parts.length > 1 && (
                                            <div className="font-medium">Total: {preview.newCount} new task(s) will be created</div>
                                        )}
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {error && <p className="text-xs text-red-600 break-words">{error}</p>}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={syncing}>Cancel</Button>
                        <Button onClick={doSync} disabled={!canSync}>
                            {syncing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {syncing && progress && progress.total > 0
                                ? `Syncing ${Math.min(100, Math.round(((progress.done + progress.failed) / progress.total) * 100))}%`
                                : "Sync to PMS"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
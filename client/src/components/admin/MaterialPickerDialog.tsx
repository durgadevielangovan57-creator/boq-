import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Package } from "lucide-react";
import apiFetch from "@/lib/api";

export interface PickedMaterial {
    name: string;
    code?: string;
    unit?: string;
    rate?: number;
    category?: string;
    description?: string;
}

export function MaterialPickerDialog({
    open,
    onOpenChange,
    onPick,
    multiple,
    onPickMultiple,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    onPick?: (m: PickedMaterial) => void;
    multiple?: boolean;
    onPickMultiple?: (items: PickedMaterial[]) => void;
}) {
    const [q, setQ] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Record<string, PickedMaterial>>({});

    useEffect(() => {
        if (!open) {
            setQ("");
            setResults([]);
            setSelected({});
            return;
        }
        const t = setTimeout(() => {
            setLoading(true);
            apiFetch(`/api/materials/search${q ? `?q=${encodeURIComponent(q)}` : ""}`)
                .then((r) => r.json())
                .then((d) => setResults(d.materials || []))
                .catch(() => setResults([]))
                .finally(() => setLoading(false));
        }, 250);
        return () => clearTimeout(t);
    }, [q, open]);

    const toKey = (m: any) => m.id || m.name;

    const toggleSelect = (m: any) => {
        const key = toKey(m);
        setSelected((prev) => {
            const next = { ...prev };
            if (next[key]) delete next[key];
            else next[key] = { name: m.name, code: m.code, unit: m.unit, rate: m.rate, category: m.category, description: m.description };
            return next;
        });
    };

    const confirmMultiple = () => {
        onPickMultiple?.(Object.values(selected));
        onOpenChange(false);
    };

    const pickSingle = (m: any) => {
        onPick?.({ name: m.name, code: m.code, unit: m.unit, rate: m.rate, category: m.category, description: m.description });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Pick from Materials Master</DialogTitle>
                </DialogHeader>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search materials by name, code, category..." autoFocus />
                </div>
                <div className="overflow-y-auto flex-1 space-y-1 min-h-[200px]">
                    {loading ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Searching...</p>
                    ) : results.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No materials found.</p>
                    ) : (
                        results.map((m) => {
                            const key = toKey(m);
                            const isSelected = !!selected[key];
                            return (
                                <div
                                    key={key}
                                    onClick={() => (multiple ? toggleSelect(m) : pickSingle(m))}
                                    className={`flex items-center justify-between border rounded-md p-2 cursor-pointer hover:bg-muted/50 ${isSelected ? "border-primary bg-primary/5" : ""}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium">{m.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {m.category || "—"} {m.unit ? `· ${m.unit}` : ""} {m.rate ? `· ₹${m.rate}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    {multiple && <input type="checkbox" checked={isSelected} readOnly className="h-4 w-4" />}
                                </div>
                            );
                        })
                    )}
                </div>
                {multiple && (
                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <span className="text-xs text-muted-foreground self-center mr-auto">{Object.keys(selected).length} selected</span>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={confirmMultiple} disabled={Object.keys(selected).length === 0}>Add Selected</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
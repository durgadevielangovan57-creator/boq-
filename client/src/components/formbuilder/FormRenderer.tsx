import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { FieldDef, FormSchema, GridSection } from "@/lib/formSchema";

// data shape: { [fieldId]: value, [gridSectionId]: Array<{[colId]: value}> }
export type FormData = Record<string, any>;

function FieldInput({ field, value, onChange, readOnly }: { field: FieldDef; value: any; onChange: (v: any) => void; readOnly?: boolean }) {
    if (readOnly) {
        if (field.type === "checkbox") return <span>{value ? "Yes" : "No"}</span>;
        return <span className="text-sm">{value !== undefined && value !== null && value !== "" ? String(value) : <span className="text-muted-foreground">—</span>}</span>;
    }
    switch (field.type) {
        case "textarea":
            return <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
        case "number":
            return <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
        case "date":
            return <Input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
        case "time":
            return <Input type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
        case "datetime":
            return <Input type="datetime-local" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
        case "dropdown":
            return (
                <Select value={value || ""} onValueChange={onChange}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                        {(field.options || []).map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        case "checkbox":
            return <Checkbox checked={!!value} onCheckedChange={onChange} />;
        case "file":
            return (
                <Input
                    type="file"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => onChange({ name: file.name, url: reader.result });
                        reader.readAsDataURL(file);
                    }}
                />
            );
        default:
            return <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
    }
}

function GridEditor({ section, rows, onChange, readOnly }: { section: GridSection; rows: any[]; onChange: (rows: any[]) => void; readOnly?: boolean }) {
    const addRow = () => onChange([...(rows || []), {}]);
    const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
    const setCell = (idx: number, colId: string, val: any) => {
        const next = [...rows];
        next[idx] = { ...next[idx], [colId]: val };
        onChange(next);
    };

    const displayRows = rows && rows.length > 0 ? rows : [{}];

    return (
        <div className="space-y-2">
            <div className="overflow-x-auto border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {section.columns.map((c) => (
                                <TableHead key={c.id}>{c.label}</TableHead>
                            ))}
                            {!readOnly && section.allowVendorAddRows !== false && <TableHead className="w-10" />}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayRows.map((row, idx) => (
                            <TableRow key={idx}>
                                {section.columns.map((c) => (
                                    <TableCell key={c.id} className="min-w-[140px]">
                                        <FieldInput field={c} value={row[c.id]} onChange={(v) => setCell(idx, c.id, v)} readOnly={readOnly} />
                                    </TableCell>
                                ))}
                                {!readOnly && section.allowVendorAddRows !== false && (
                                    <TableCell>
                                        {displayRows.length > (section.minRows || 1) && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {!readOnly && section.allowVendorAddRows !== false && (
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    <Plus className="h-4 w-4 mr-1" /> Add Row
                </Button>
            )}
        </div>
    );
}

export function FormRenderer({
    schema,
    data,
    onChange,
    readOnly,
}: {
    schema: FormSchema;
    data: FormData;
    onChange?: (data: FormData) => void;
    readOnly?: boolean;
}) {
    const set = (key: string, value: any) => {
        if (!onChange) return;
        onChange({ ...data, [key]: value });
    };

    if (!schema?.sections?.length) {
        return <p className="text-sm text-muted-foreground">Nothing to show here.</p>;
    }

    return (
        <div className="space-y-6">
            {schema.sections.map((section) => (
                <div key={section.id} className="space-y-3">
                    <h4 className="font-semibold text-sm">{section.title}</h4>
                    {section.type === "grid" ? (
                        <GridEditor section={section} rows={data[section.id] || []} onChange={(rows) => set(section.id, rows)} readOnly={readOnly} />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {section.fields.map((f) => (
                                <div key={f.id} className="space-y-1.5">
                                    <Label className="text-xs">
                                        {f.label} {f.required && <span className="text-destructive">*</span>}
                                    </Label>
                                    <FieldInput field={f} value={data[f.id]} onChange={(v) => set(f.id, v)} readOnly={readOnly} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
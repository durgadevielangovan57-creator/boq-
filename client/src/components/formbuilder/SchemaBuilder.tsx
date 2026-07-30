import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Table2, ListPlus } from "lucide-react";
import {
    FieldDef,
    FieldType,
    FieldsSection,
    GridSection,
    Section,
    FormSchema,
    FIELD_TYPE_LABELS,
    emptyField,
    emptyFieldsSection,
    emptyGridSection,
} from "@/lib/formSchema";

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

function FieldRow({
    field,
    onChange,
    onRemove,
}: {
    field: FieldDef;
    onChange: (f: FieldDef) => void;
    onRemove: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 border rounded-md p-2 bg-muted/30">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
                className="flex-1 min-w-[140px]"
                placeholder="Field label"
                value={field.label}
                onChange={(e) => onChange({ ...field, label: e.target.value })}
            />
            <Select value={field.type} onValueChange={(v) => onChange({ ...field, type: v as FieldType })}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {FIELD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {field.type === "dropdown" && (
                <Input
                    className="min-w-[160px] flex-1"
                    placeholder="Options, comma separated"
                    value={(field.options || []).join(", ")}
                    onChange={(e) => onChange({ ...field, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
            )}
            <div className="flex items-center gap-1 text-xs">
                <Switch checked={!!field.required} onCheckedChange={(c) => onChange({ ...field, required: c })} />
                <span className="text-muted-foreground">Required</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
                <Switch checked={field.visibleToVendor !== false} onCheckedChange={(c) => onChange({ ...field, visibleToVendor: c })} />
                <span className="text-muted-foreground">Visible to Vendor</span>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
    );
}

function FieldsSectionEditor({ section, onChange, onRemove }: { section: FieldsSection; onChange: (s: FieldsSection) => void; onRemove: () => void }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
                <Input
                    className="font-semibold text-base border-none px-0 shadow-none focus-visible:ring-0"
                    value={section.title}
                    onChange={(e) => onChange({ ...section, title: e.target.value })}
                />
                <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-2">
                {section.fields.map((f) => (
                    <FieldRow
                        key={f.id}
                        field={f}
                        onChange={(nf) => onChange({ ...section, fields: section.fields.map((x) => (x.id === f.id ? nf : x)) })}
                        onRemove={() => onChange({ ...section, fields: section.fields.filter((x) => x.id !== f.id) })}
                    />
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...section, fields: [...section.fields, emptyField()] })}>
                    <Plus className="h-4 w-4 mr-1" /> Add Field
                </Button>
            </CardContent>
        </Card>
    );
}

function GridSectionEditor({ section, onChange, onRemove }: { section: GridSection; onChange: (s: GridSection) => void; onRemove: () => void }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
                <div className="flex items-center gap-2 flex-1">
                    <Table2 className="h-4 w-4 text-muted-foreground" />
                    <Input
                        className="font-semibold text-base border-none px-0 shadow-none focus-visible:ring-0"
                        value={section.title}
                        onChange={(e) => onChange({ ...section, title: e.target.value })}
                    />
                </div>
                <div className="flex items-center gap-1 text-xs mr-2">
                    <Switch checked={section.allowVendorAddRows !== false} onCheckedChange={(c) => onChange({ ...section, allowVendorAddRows: c })} />
                    <span className="text-muted-foreground whitespace-nowrap">Vendor can add rows</span>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Define the columns of this table.</p>
                {section.columns.map((c) => (
                    <FieldRow
                        key={c.id}
                        field={c}
                        onChange={(nc) => onChange({ ...section, columns: section.columns.map((x) => (x.id === c.id ? nc : x)) })}
                        onRemove={() => onChange({ ...section, columns: section.columns.filter((x) => x.id !== c.id) })}
                    />
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChange({ ...section, columns: [...section.columns, { ...emptyField(), label: "New Column" }] })}
                >
                    <Plus className="h-4 w-4 mr-1" /> Add Column
                </Button>
            </CardContent>
        </Card>
    );
}

export function SchemaBuilder({ schema, onChange }: { schema: FormSchema; onChange: (s: FormSchema) => void }) {
    const setSection = (id: string, next: Section) => {
        onChange({ sections: schema.sections.map((s) => (s.id === id ? next : s)) });
    };
    const removeSection = (id: string) => {
        onChange({ sections: schema.sections.filter((s) => s.id !== id) });
    };

    return (
        <div className="space-y-4">
            {schema.sections.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
                    No sections yet. Add a set of fields, or a table (rows &amp; columns) below.
                </div>
            )}
            {schema.sections.map((s) =>
                s.type === "grid" ? (
                    <GridSectionEditor key={s.id} section={s} onChange={(ns) => setSection(s.id, ns)} onRemove={() => removeSection(s.id)} />
                ) : (
                    <FieldsSectionEditor key={s.id} section={s} onChange={(ns) => setSection(s.id, ns)} onRemove={() => removeSection(s.id)} />
                )
            )}
            <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => onChange({ sections: [...schema.sections, emptyFieldsSection()] })}>
                    <ListPlus className="h-4 w-4 mr-1" /> Add Field Section
                </Button>
                <Button type="button" variant="secondary" onClick={() => onChange({ sections: [...schema.sections, emptyGridSection()] })}>
                    <Table2 className="h-4 w-4 mr-1" /> Add Table (Rows &amp; Columns)
                </Button>
            </div>
        </div>
    );
}
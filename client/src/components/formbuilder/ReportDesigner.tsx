import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus, Trash2, ArrowUp, ArrowDown, Type, Image as ImageIcon, Table2, Minus, MoveVertical, PenLine, Tag,
} from "lucide-react";
import {
    ReportElement, ReportSchema, TextElement, ImageElement, TableElement, SignatureElement,
    AVAILABLE_TOKENS, emptyTextElement, emptyImageElement, emptyTableElement, emptyDividerElement, emptySpacerElement, emptySignatureElement,
} from "@/lib/reportSchema";

function TokenInserter({ onInsert }: { onInsert: (token: string) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm"><Tag className="h-3.5 w-3.5 mr-1" /> Insert Field</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-64 overflow-y-auto">
                {AVAILABLE_TOKENS.map((group) => (
                    <div key={group.group}>
                        <DropdownMenuLabel>{group.group}</DropdownMenuLabel>
                        {group.tokens.map((t) => (
                            <DropdownMenuItem key={t.key} onClick={() => onInsert(`{{${t.key}}}`)}>{t.label}</DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                    </div>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function TextBlock({ el, onChange }: { el: TextElement; onChange: (e: TextElement) => void }) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const insert = (token: string) => {
        const ta = ref.current;
        if (!ta) return onChange({ ...el, content: el.content + token });
        const start = ta.selectionStart ?? el.content.length;
        const end = ta.selectionEnd ?? el.content.length;
        const next = el.content.slice(0, start) + token + el.content.slice(end);
        onChange({ ...el, content: next });
    };
    return (
        <div className="space-y-2">
            <Textarea ref={ref} value={el.content} onChange={(e) => onChange({ ...el, content: e.target.value })} rows={2} />
            <div className="flex flex-wrap items-center gap-2">
                <TokenInserter onInsert={insert} />
                <Select value={el.align || "left"} onValueChange={(v) => onChange({ ...el, align: v as any })}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={el.fontSize || "base"} onValueChange={(v) => onChange({ ...el, fontSize: v as any })}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="sm">Small</SelectItem>
                        <SelectItem value="base">Normal</SelectItem>
                        <SelectItem value="lg">Large</SelectItem>
                        <SelectItem value="xl">X-Large</SelectItem>
                        <SelectItem value="2xl">Heading</SelectItem>
                    </SelectContent>
                </Select>
                <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={!!el.bold} onChange={(e) => onChange({ ...el, bold: e.target.checked })} /> Bold
                </label>
            </div>
        </div>
    );
}

function ImageBlock({ el, onChange }: { el: ImageElement; onChange: (e: ImageElement) => void }) {
    return (
        <div className="space-y-2">
            <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => onChange({ ...el, src: reader.result as string });
                    reader.readAsDataURL(file);
                }}
            />
            {el.src && <img src={el.src} alt="" style={{ width: el.width || 150 }} />}
            <div className="flex items-center gap-2">
                <Label className="text-xs">Width (px)</Label>
                <Input className="w-24" type="number" value={el.width || 150} onChange={(e) => onChange({ ...el, width: Number(e.target.value) })} />
                <Select value={el.align || "left"} onValueChange={(v) => onChange({ ...el, align: v as any })}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

function TableBlock({ el, onChange }: { el: TableElement; onChange: (e: TableElement) => void }) {
    const cols = el.columns || [];
    const rows = el.rows || [];

    const setCol = (idx: number, label: string) => onChange({ ...el, columns: cols.map((c, i) => (i === idx ? { ...c, label } : c)) });
    const addCol = () => onChange({ ...el, columns: [...cols, { id: `col_${Date.now()}`, label: "Column" }] });
    const removeCol = (idx: number) => onChange({ ...el, columns: cols.filter((_, i) => i !== idx) });
    const addRow = () => onChange({ ...el, rows: [...rows, {}] });
    const removeRow = (idx: number) => onChange({ ...el, rows: rows.filter((_, i) => i !== idx) });
    const setCell = (r: number, colId: string, val: string) =>
        onChange({ ...el, rows: rows.map((row, i) => (i === r ? { ...row, [colId]: val } : row)) });

    return (
        <div className="space-y-3">
            <Select value={el.mode} onValueChange={(v) => onChange({ ...el, mode: v as any })}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="static">Static (I'll type the values)</SelectItem>
                    <SelectItem value="bound">Bound to a Form's table (auto-filled per vendor)</SelectItem>
                </SelectContent>
            </Select>

            {el.mode === "bound" ? (
                <div className="space-y-1">
                    <Label className="text-xs">Table / Section title to pull from (must match exactly)</Label>
                    <Input
                        value={el.boundTitle || ""}
                        onChange={(e) => onChange({ ...el, boundTitle: e.target.value })}
                        placeholder='e.g. "Material Table" (the section title used in an attached Form)'
                    />
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="overflow-x-auto border rounded-md">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40">
                                    {cols.map((c, idx) => (
                                        <th key={c.id} className="p-1">
                                            <div className="flex items-center gap-1">
                                                <Input className="h-7 text-xs" value={c.label} onChange={(e) => setCol(idx, e.target.value)} />
                                                {cols.length > 1 && (
                                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCol(idx)}>
                                                        <Trash2 className="h-3 w-3 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, r) => (
                                    <tr key={r} className="border-b">
                                        {cols.map((c) => (
                                            <td key={c.id} className="p-1">
                                                <Input className="h-7 text-xs" value={row[c.id] || ""} onChange={(e) => setCell(r, c.id, e.target.value)} />
                                            </td>
                                        ))}
                                        <td>
                                            {rows.length > 1 && (
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(r)}>
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={addCol}><Plus className="h-3.5 w-3.5 mr-1" /> Column</Button>
                        <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Row</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Cell text can also use {"{{tender.title}}"} style fields.</p>
                </div>
            )}
        </div>
    );
}

function SignatureBlock({ el, onChange }: { el: SignatureElement; onChange: (e: SignatureElement) => void }) {
    const setRole = (idx: number, val: string) => onChange({ ...el, roles: el.roles.map((r, i) => (i === idx ? val : r)) });
    return (
        <div className="space-y-2">
            {el.roles.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2">
                    <Input value={r} onChange={(e) => setRole(idx, e.target.value)} />
                    {el.roles.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => onChange({ ...el, roles: el.roles.filter((_, i) => i !== idx) })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    )}
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...el, roles: [...el.roles, "New Role"] })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Role
            </Button>
        </div>
    );
}

const ELEMENT_LABEL: Record<string, string> = {
    text: "Text",
    image: "Image / Logo",
    table: "Table",
    divider: "Divider",
    spacer: "Spacer",
    signature: "Signature Block",
};
const ELEMENT_ICON: Record<string, any> = {
    text: Type, image: ImageIcon, table: Table2, divider: Minus, spacer: MoveVertical, signature: PenLine,
};

function Zone({
    title, elements, onChange,
}: {
    title: string;
    elements: ReportElement[];
    onChange: (els: ReportElement[]) => void;
}) {
    const update = (idx: number, next: ReportElement) => onChange(elements.map((e, i) => (i === idx ? next : e)));
    const remove = (idx: number) => onChange(elements.filter((_, i) => i !== idx));
    const move = (idx: number, dir: -1 | 1) => {
        const next = [...elements];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target], next[idx]];
        onChange(next);
    };
    const add = (el: ReportElement) => onChange([...elements, el]);

    return (
        <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
                <p className="font-semibold text-sm">{title}</p>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" variant="secondary" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add Block</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => add(emptyTextElement())}><Type className="h-4 w-4 mr-2" /> Text</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => add(emptyImageElement())}><ImageIcon className="h-4 w-4 mr-2" /> Image / Logo</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => add(emptyTableElement())}><Table2 className="h-4 w-4 mr-2" /> Table</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => add(emptyDividerElement())}><Minus className="h-4 w-4 mr-2" /> Divider</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => add(emptySpacerElement())}><MoveVertical className="h-4 w-4 mr-2" /> Spacer</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => add(emptySignatureElement())}><PenLine className="h-4 w-4 mr-2" /> Signature Block</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-3">
                {elements.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No blocks yet.</p>}
                {elements.map((el, idx) => {
                    const Icon = ELEMENT_ICON[el.type];
                    return (
                        <div key={el.id} className="border rounded-md p-3 bg-muted/20">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                                    <Icon className="h-3.5 w-3.5" /> {ELEMENT_LABEL[el.type]}
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(idx)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                </div>
                            </div>
                            {el.type === "text" && <TextBlock el={el} onChange={(e) => update(idx, e)} />}
                            {el.type === "image" && <ImageBlock el={el} onChange={(e) => update(idx, e)} />}
                            {el.type === "table" && <TableBlock el={el} onChange={(e) => update(idx, e)} />}
                            {el.type === "signature" && <SignatureBlock el={el} onChange={(e) => update(idx, e)} />}
                            {el.type === "divider" && <p className="text-xs text-muted-foreground">A horizontal line.</p>}
                            {el.type === "spacer" && (
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs">Height (px)</Label>
                                    <Input className="w-24 h-7" type="number" value={el.height ?? 16} onChange={(e) => update(idx, { ...el, height: Number(e.target.value) })} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

export function ReportDesigner({ schema, onChange }: { schema: ReportSchema; onChange: (s: ReportSchema) => void }) {
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs">Watermark text (optional, e.g. "DRAFT")</Label>
                <Input value={schema.watermark || ""} onChange={(e) => onChange({ ...schema, watermark: e.target.value })} placeholder="Leave blank for none" />
            </div>
            <Zone title="Header" elements={schema.header} onChange={(els) => onChange({ ...schema, header: els })} />
            <Zone title="Body" elements={schema.body} onChange={(els) => onChange({ ...schema, body: els })} />
            <Zone title="Footer" elements={schema.footer} onChange={(els) => onChange({ ...schema, footer: els })} />
        </div>
    );
}
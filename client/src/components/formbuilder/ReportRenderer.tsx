import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportElement, ReportSchema, ReportContext, resolveTokens, getSampleContext } from "@/lib/reportSchema";

const FONT_SIZE_CLASS: Record<string, string> = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-2xl",
};

function ElementView({ el, ctx }: { el: ReportElement; ctx: ReportContext }) {
    switch (el.type) {
        case "text":
            return (
                <p
                    className={`${FONT_SIZE_CLASS[el.fontSize || "base"]} ${el.bold ? "font-bold" : ""}`}
                    style={{ textAlign: el.align || "left" }}
                >
                    {resolveTokens(el.content, ctx)}
                </p>
            );
        case "image":
            if (!el.src) return null;
            return (
                <div style={{ textAlign: el.align || "left" }}>
                    <img src={el.src} alt="" style={{ width: el.width || 150, display: "inline-block" }} />
                </div>
            );
        case "divider":
            return <hr className="my-2 border-gray-300" />;
        case "spacer":
            return <div style={{ height: el.height ?? 16 }} />;
        case "table": {
            if (el.mode === "bound") {
                const source = ctx.gridSources.find((g) => g.title.trim().toLowerCase() === (el.boundTitle || "").trim().toLowerCase());
                if (!source) {
                    return (
                        <p className="text-xs text-muted-foreground italic border border-dashed rounded p-2">
                            Table "{el.boundTitle || "(unset)"}" will be filled from the matching Form table once a vendor responds.
                        </p>
                    );
                }
                return (
                    <Table>
                        <TableHeader>
                            <TableRow>{source.columns.map((c) => <TableHead key={c.id}>{c.label}</TableHead>)}</TableRow>
                        </TableHeader>
                        <TableBody>
                            {(source.rows.length ? source.rows : [{}]).map((row: any, i: number) => (
                                <TableRow key={i}>
                                    {source.columns.map((c) => <TableCell key={c.id}>{row[c.id] ?? ""}</TableCell>)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                );
            }
            const cols = el.columns || [];
            const rows = el.rows && el.rows.length ? el.rows : [{}];
            return (
                <Table>
                    <TableHeader>
                        <TableRow>{cols.map((c) => <TableHead key={c.id}>{c.label}</TableHead>)}</TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, i) => (
                            <TableRow key={i}>
                                {cols.map((c) => <TableCell key={c.id}>{resolveTokens(row[c.id] || "", ctx)}</TableCell>)}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            );
        }
        case "signature":
            return (
                <div className="grid gap-6 mt-6" style={{ gridTemplateColumns: `repeat(${el.roles.length}, minmax(0,1fr))` }}>
                    {el.roles.map((role) => (
                        <div key={role} className="text-center">
                            <div className="h-12 border-b border-gray-400 mb-1" />
                            <p className="text-sm font-medium">{role}</p>
                            <p className="text-xs text-muted-foreground">Date: ______________</p>
                        </div>
                    ))}
                </div>
            );
        default:
            return null;
    }
}

export function ReportRenderer({ schema, context, id }: { schema: ReportSchema; context?: ReportContext; id?: string }) {
    const ctx = context || getSampleContext();
    return (
        <div id={id} className="bg-white text-black p-8 mx-auto relative" style={{ maxWidth: 800, fontFamily: "Georgia, serif" }}>
            {schema.watermark && (
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                    style={{ zIndex: 0 }}
                >
                    <span style={{ fontSize: "6rem", fontWeight: 900, color: "rgba(0,0,0,0.06)", transform: "rotate(-30deg)", whiteSpace: "nowrap" }}>
                        {schema.watermark}
                    </span>
                </div>
            )}
            <div className="relative" style={{ zIndex: 1 }}>
                {schema.header?.length > 0 && (
                    <div className="pb-4 mb-4 border-b-2 border-gray-800 space-y-1">
                        {schema.header.map((el) => <ElementView key={el.id} el={el} ctx={ctx} />)}
                    </div>
                )}
                <div className="space-y-2">
                    {schema.body.map((el) => <ElementView key={el.id} el={el} ctx={ctx} />)}
                </div>
                {schema.footer?.length > 0 && (
                    <div className="pt-4 mt-6 border-t border-gray-300 space-y-1">
                        {schema.footer.map((el) => <ElementView key={el.id} el={el} ctx={ctx} />)}
                    </div>
                )}
            </div>
        </div>
    );
}
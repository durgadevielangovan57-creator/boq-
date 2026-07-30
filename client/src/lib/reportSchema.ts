// Types for the Summary Sheet "report designer" — a print-style document made of
// ordered blocks (text, image, table, divider, spacer, signature) that can reference
// live tender/vendor data through {{tokens}}.

export type ReportElementType = "text" | "image" | "table" | "divider" | "spacer" | "signature";

export interface TextElement {
    id: string;
    type: "text";
    content: string; // may contain {{tender.title}} style tokens
    align?: "left" | "center" | "right";
    bold?: boolean;
    fontSize?: "sm" | "base" | "lg" | "xl" | "2xl";
}

export interface ImageElement {
    id: string;
    type: "image";
    src: string; // data URL
    width?: number; // px
    align?: "left" | "center" | "right";
}

export interface StaticTableColumn {
    id: string;
    label: string;
}

export interface TableElement {
    id: string;
    type: "table";
    mode: "static" | "bound";
    // static mode: admin fills columns + rows manually (cell text may contain tokens)
    columns?: StaticTableColumn[];
    rows?: Record<string, string>[];
    // bound mode: pulls rows live from a matching grid-section title inside a Form
    // attached to the same tender (populated at render/export time)
    boundTitle?: string;
}

export interface DividerElement {
    id: string;
    type: "divider";
}

export interface SpacerElement {
    id: string;
    type: "spacer";
    height?: number; // px
}

export interface SignatureElement {
    id: string;
    type: "signature";
    roles: string[]; // e.g. ["Prepared By", "Checked By", "Approved By"]
}

export type ReportElement = TextElement | ImageElement | TableElement | DividerElement | SpacerElement | SignatureElement;

export interface ReportSchema {
    header: ReportElement[];
    body: ReportElement[];
    footer: ReportElement[];
    watermark?: string;
}

export const AVAILABLE_TOKENS: { group: string; tokens: { key: string; label: string }[] }[] = [
    {
        group: "Tender",
        tokens: [
            { key: "tender.number", label: "Tender Number" },
            { key: "tender.title", label: "Tender Title" },
            { key: "tender.clientName", label: "Client Name" },
            { key: "tender.location", label: "Location" },
            { key: "tender.address", label: "Address" },
            { key: "tender.description", label: "Description" },
            { key: "tender.status", label: "Status" },
            { key: "tender.category", label: "Category" },
            { key: "tender.estimatedBudget", label: "Estimated Budget" },
            { key: "tender.startDate", label: "Start Date" },
            { key: "tender.endDate", label: "End Date" },
            { key: "tender.submissionDeadline", label: "Submission Deadline" },
        ],
    },
    {
        group: "Vendor",
        tokens: [
            { key: "vendor.name", label: "Vendor Name" },
            { key: "vendor.company", label: "Vendor Company" },
            { key: "vendor.username", label: "Vendor Username" },
        ],
    },
    {
        group: "Other",
        tokens: [{ key: "date.today", label: "Today's Date" }],
    },
];

export interface ReportContext {
    tender: Record<string, string>;
    vendor: { name: string; company: string; username: string } | null;
    gridSources: { linkId: string; sectionId: string; title: string; columns: { id: string; label: string }[]; rows: any[] }[];
    today: string;
}

const SAMPLE_CONTEXT: ReportContext = {
    tender: {
        number: "TDR-0001",
        title: "Sample Tender Title",
        clientName: "Sample Client Pvt Ltd",
        location: "Chennai",
        address: "123 Sample Street",
        description: "Sample description",
        status: "Draft",
        category: "Construction",
        estimatedBudget: "5,00,000",
        startDate: "01/01/2026",
        endDate: "31/03/2026",
        submissionDeadline: "15/01/2026",
    },
    vendor: { name: "Sample Vendor", company: "Sample Vendor Co.", username: "vendor1" },
    gridSources: [],
    today: new Date().toLocaleDateString(),
};

export function getSampleContext(): ReportContext {
    return SAMPLE_CONTEXT;
}

export function resolveTokens(text: string, ctx: ReportContext): string {
    if (!text) return text;
    return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
        const [scope, field] = key.split(".");
        if (scope === "tender") return ctx.tender?.[field] ?? `{{${key}}}`;
        if (scope === "vendor") return ctx.vendor ? (ctx.vendor as any)[field] ?? `{{${key}}}` : "";
        if (scope === "date" && field === "today") return ctx.today;
        return `{{${key}}}`;
    });
}

let idCounter = 0;
export function genReportId(prefix: string) {
    idCounter += 1;
    return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function emptyTextElement(): TextElement {
    return { id: genReportId("txt"), type: "text", content: "New text", align: "left", fontSize: "base" };
}
export function emptyImageElement(): ImageElement {
    return { id: genReportId("img"), type: "image", src: "", width: 150, align: "left" };
}
export function emptyTableElement(): TableElement {
    return {
        id: genReportId("tbl"),
        type: "table",
        mode: "static",
        columns: [
            { id: genReportId("col"), label: "Description" },
            { id: genReportId("col"), label: "Amount" },
        ],
        rows: [{}],
    };
}
export function emptyDividerElement(): DividerElement {
    return { id: genReportId("div"), type: "divider" };
}
export function emptySpacerElement(): SpacerElement {
    return { id: genReportId("spc"), type: "spacer", height: 16 };
}
export function emptySignatureElement(): SignatureElement {
    return { id: genReportId("sig"), type: "signature", roles: ["Prepared By", "Checked By", "Approved By"] };
}

export function emptyReportSchema(): ReportSchema {
    return {
        header: [{ ...emptyTextElement(), content: "{{tender.clientName}}", bold: true, fontSize: "xl", align: "center" }],
        body: [
            { ...emptyTextElement(), content: "TENDER SUMMARY", bold: true, fontSize: "lg", align: "center" },
            emptyDividerElement(),
            { ...emptyTextElement(), content: "Tender No: {{tender.number}}" },
            { ...emptyTextElement(), content: "Project: {{tender.title}}" },
            { ...emptyTextElement(), content: "Client: {{tender.clientName}}" },
        ],
        footer: [emptySignatureElement()],
    };
}

// True if this looks like a Report schema (header/body/footer) vs the older field-based FormSchema (sections).
export function isReportSchema(schema: any): schema is ReportSchema {
    return !!schema && (Array.isArray(schema.body) || Array.isArray(schema.header) || Array.isArray(schema.footer));
}
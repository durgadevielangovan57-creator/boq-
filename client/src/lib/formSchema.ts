// Shared types for the Form Builder / Summary Sheet module.
// A "template" (or a form attached to a tender) is just a `FormSchema`:
// a list of sections, where each section is either a plain set of fields,
// or a "grid" (spreadsheet-like rows & columns) the vendor can add rows to.

export type FieldType =
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "time"
    | "datetime"
    | "dropdown"
    | "checkbox"
    | "file";

export interface FieldDef {
    id: string;
    label: string;
    type: FieldType;
    required?: boolean;
    visibleToVendor?: boolean; // default true
    options?: string[]; // for dropdown
    placeholder?: string;
}

export interface FieldsSection {
    id: string;
    type: "fields";
    title: string;
    fields: FieldDef[];
}

export interface GridSection {
    id: string;
    type: "grid";
    title: string;
    columns: FieldDef[];
    allowVendorAddRows?: boolean;
    minRows?: number;
}

export type Section = FieldsSection | GridSection;

export interface FormSchema {
    sections: Section[];
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
    text: "Text",
    textarea: "Long Text",
    number: "Number",
    date: "Date",
    time: "Time",
    datetime: "Date & Time",
    dropdown: "Dropdown",
    checkbox: "Checkbox (Yes/No)",
    file: "File Upload",
};

let idCounter = 0;
export function genId(prefix: string) {
    idCounter += 1;
    return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function emptyField(): FieldDef {
    return { id: genId("field"), label: "New Field", type: "text", required: false, visibleToVendor: true };
}

export function emptyFieldsSection(): FieldsSection {
    return { id: genId("section"), type: "fields", title: "New Section", fields: [emptyField()] };
}

export function emptyGridSection(): GridSection {
    return {
        id: genId("grid"),
        type: "grid",
        title: "New Table",
        columns: [
            { id: genId("col"), label: "Item", type: "text", visibleToVendor: true },
            { id: genId("col"), label: "Quantity", type: "number", visibleToVendor: true },
            { id: genId("col"), label: "Rate", type: "number", visibleToVendor: true },
        ],
        allowVendorAddRows: true,
        minRows: 1,
    };
}

export function emptySchema(): FormSchema {
    return { sections: [] };
}
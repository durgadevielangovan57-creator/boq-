import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Bold, Eraser } from "lucide-react";
import { hasFormatting, richOrNull, sanitizeRichHtml, richToPlain } from "@/lib/richDescription";
import { saveRich, useRichFor } from "@/lib/richDescriptionStore";

/**
 * Description box with Bold + text colour (new, additive).
 *
 * - `value` is the normal PLAIN-text description (unchanged everywhere else).
 * - Bold/colour is remembered separately (see server/rich_text_routes.ts), so
 *   PDF / Excel / search keep using the plain text and never show formatting.
 * - Drop-in for a <textarea>: onChange gives the plain text while typing,
 *   onCommit gives it when the box loses focus (run your existing save there).
 */

const COLOURS = [
    { c: "#111827", n: "Black" },
    { c: "#dc2626", n: "Red" },
    { c: "#ea580c", n: "Orange" },
    { c: "#ca8a04", n: "Gold" },
    { c: "#16a34a", n: "Green" },
    { c: "#2563eb", n: "Blue" },
    { c: "#7c3aed", n: "Purple" },
];

type Props = {
    value: string;
    onChange?: (plain: string) => void;
    /** after the box loses focus (formatting is already saved by then) */
    onCommit?: (plain: string) => void | Promise<void>;
    onFocus?: () => void;
    disabled?: boolean;
    placeholder?: string;
    /** wrapper look (border, background, width) */
    className?: string;
    /** text look (size, weight, colour) */
    textClassName?: string;
    minHeight?: number;
    /** padding of the text area (default "px-3 py-1.5") */
    padClassName?: string;
    /** true = no default border / background (caller styles the wrapper) */
    bare?: boolean;
};

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const squash = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
const plainToHtml = (s: string) => escapeHtml(s || "").replace(/\n/g, "<br>");

export function RichDescriptionEditor({
    value, onChange, onCommit, onFocus, disabled, placeholder = "Description...",
    className = "", textClassName = "text-xs", minHeight = 32,
    padClassName = "px-3 py-1.5", bare = false,
}: Props) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const [focused, setFocused] = useState(false);
    const stored = useRichFor(value, !focused);

    // always call the latest callbacks (they close over fresh state)
    const cbs = useRef({ onChange, onCommit, onFocus });
    cbs.current = { onChange, onCommit, onFocus };

    const startHtml = useRef("");

    // Show the value (with its formatting) whenever it changes from outside — never while typing.
    useEffect(() => {
        const el = boxRef.current;
        if (!el || focused) return;
        const want = richOrNull(stored, value); // formatting that still matches this exact text
        if (want) {
            if (sanitizeRichHtml(el.innerHTML) !== want) el.innerHTML = want;
        } else if (squash(richToPlain(sanitizeRichHtml(el.innerHTML))) !== squash(value)) {
            el.innerHTML = plainToHtml(value); // different text -> plain
        }
        // else: the box already shows this text – leave it (keeps formatting just applied)
    }, [value, stored, focused]);

    const read = () => {
        const html = sanitizeRichHtml(boxRef.current?.innerHTML || "");
        return { html, plain: richToPlain(html) };
    };

    const exec = (cmd: string, arg?: string) => {
        if (disabled) return;
        boxRef.current?.focus();
        // bold -> a real <b> tag (styled below); colour -> <span style="color:...">
        document.execCommand("styleWithCSS", false, cmd === "foreColor" ? "true" : "false");
        document.execCommand(cmd, false, arg);
        cbs.current.onChange?.(read().plain);
    };

    const keepSelection = (e: ReactMouseEvent) => e.preventDefault();

    const commit = async () => {
        const { html, plain } = read();
        // Save formatting FIRST so it is in place when the parent saves / re-renders.
        // (skipped when nothing was changed while the box had focus)
        const changed = html !== startHtml.current;
        const needsSave = hasFormatting(html) ? changed : changed && hasFormatting(startHtml.current);
        if (plain.trim() && needsSave) await saveRich(plain, hasFormatting(html) ? html : "");
        await cbs.current.onCommit?.(plain);
    };

    return (
        <div
            ref={wrapRef}
            className={`group relative ${bare ? "" : "rounded-md border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-100"} ${className}`}
            onFocus={() => {
                if (!focused) {
                    startHtml.current = read().html;
                    setFocused(true);
                    cbs.current.onFocus?.();
                }
            }}
            onBlur={(e) => {
                // moving between the box and its toolbar is not "leaving"
                if (wrapRef.current?.contains(e.relatedTarget as Node)) return;
                setFocused(false);
                void commit();
            }}
        >
            {!disabled && focused && (
                <div className="flex flex-wrap items-center gap-1 border-b bg-white px-1.5 py-1 rounded-t-md">
                    <button type="button" title="Bold" onMouseDown={keepSelection} onClick={() => exec("bold")}
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200">
                        <Bold className="h-3.5 w-3.5" />
                    </button>
                    <span className="mx-0.5 h-4 w-px bg-slate-200" />
                    {COLOURS.map(({ c, n }) => (
                        <button key={c} type="button" title={`${n} text`} onMouseDown={keepSelection} onClick={() => exec("foreColor", c)}
                            className="h-4 w-4 rounded-full ring-1 ring-slate-300 hover:scale-110 transition-transform"
                            style={{ background: c }} />
                    ))}
                    <span className="mx-0.5 h-4 w-px bg-slate-200" />
                    <button type="button" title="Clear bold / colour" onMouseDown={keepSelection} onClick={() => exec("removeFormat")}
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200">
                        <Eraser className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
            <div
                ref={boxRef}
                contentEditable={!disabled}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                data-placeholder={placeholder}
                onInput={() => cbs.current.onChange?.(read().plain)}
                onPaste={(e) => {
                    // paste as plain text so styling from Word / websites never leaks in
                    e.preventDefault();
                    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
                }}
                className={`[&_b]:font-extrabold [&_strong]:font-extrabold min-w-0 w-full resize-y overflow-auto whitespace-pre-wrap break-words ${padClassName} outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] ${disabled ? "cursor-not-allowed opacity-70" : ""} ${textClassName}`}
                style={{ minHeight }}
            />
        </div>
    );
}

export default RichDescriptionEditor;
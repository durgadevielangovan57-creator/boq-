import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./command";
import { cn } from "@/lib/utils";

export type SearchableOption = {
    value: string;
    label: string;
    /** small grey text shown after the label, e.g. the parent category */
    sublabel?: string;
    className?: string;
};

type Props = {
    value?: string;
    onValueChange: (value: string) => void;
    options: SearchableOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
};

/**
 * Drop-in replacement for a long <Select>: same look as the normal dropdown, but
 * it has a search box at the top so you can type to find the item instead of
 * scrolling through hundreds of entries.
 */
export function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    className,
    disabled,
}: Props) {
    const [open, setOpen] = React.useState(false);
    const selected = React.useMemo(() => options.find((o) => o.value === value), [options, value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        className,
                    )}
                >
                    <span className={cn("truncate", !selected && "text-muted-foreground")}>
                        {selected ? selected.label : placeholder}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            {/* Only mount the (possibly long) list while the dropdown is open */}
            {open && (
                <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0"
                    align="start"
                >
                    <Command>
                        <CommandInput placeholder={searchPlaceholder} />
                        {/* stopPropagation on wheel so the list still scrolls when used inside a dialog */}
                        <CommandList className="max-h-64" onWheel={(e) => e.stopPropagation()}>
                            <CommandEmpty>{emptyText}</CommandEmpty>
                            {options.map((o, i) => (
                                <CommandItem
                                    key={`${o.value}-${i}`}
                                    value={`${o.label} ${o.sublabel || ""} ${i}`}
                                    onSelect={() => {
                                        onValueChange(o.value);
                                        setOpen(false);
                                    }}
                                    className={o.className}
                                >
                                    <Check className={cn("mr-2 h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{o.label}</span>
                                    {o.sublabel ? (
                                        <span className="ml-1 text-xs text-muted-foreground">({o.sublabel})</span>
                                    ) : null}
                                </CommandItem>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            )}
        </Popover>
    );
}
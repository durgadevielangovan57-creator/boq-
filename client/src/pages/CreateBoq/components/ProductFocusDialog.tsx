import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoqItemCard } from "./BoqItemCard";
import { parseTableData } from "../utils";

/**
 * Product Focus Mode.
 *
 * This dialog is intentionally a thin wrapper: it does not manage products,
 * items, rates, or any BOM data itself. It simply renders the existing
 * `BoqItemCard` for a single product at a time, passing through the exact
 * same handler props the main Generate BOM grid already uses. Every edit
 * made here updates the same parent `boqItems` state as the main grid, so
 * there is nothing to sync — closing this dialog just stops rendering it.
 *
 * `cardProps` intentionally reuses `BoqItemCard`'s own prop type so this
 * component can never drift out of sync with what `BoqItemCard` actually
 * accepts, and so we never redeclare/duplicate its handler signatures here.
 */
type BoqItemCardProps = React.ComponentProps<typeof BoqItemCard>;

interface ProductFocusDialogProps {
    open: boolean;
    onClose: () => void;
    /** Current position of the focused product within the page's existing ordered product list (sortedAllItems). */
    productIndex: number;
    /** Total number of products in that same ordered list. */
    totalProducts: number;
    onPrevious: () => void;
    onNext: () => void;
    /** Every prop BoqItemCard needs, forwarded unchanged from the main page. */
    cardProps: BoqItemCardProps;
}

export function ProductFocusDialog({
    open,
    onClose,
    productIndex,
    totalProducts,
    onPrevious,
    onNext,
    cardProps,
}: ProductFocusDialogProps) {
    // Full-screen is purely a sizing preference for this dialog. It must persist
    // across Next/Previous, so it is NOT reset when the focused product changes.
    const [isFullScreen, setIsFullScreen] = useState(false);

    const productName = parseTableData(cardProps.boqItem.table_data).product_name || cardProps.boqItem.estimator || "Product";
    const canGoPrevious = productIndex > 0;
    const canGoNext = productIndex < totalProducts - 1;

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                className={cn(
                    "flex flex-col p-0 gap-0",
                    isFullScreen
                        // True edge-to-edge full screen: override the Dialog's default
                        // centered/rounded/max-width classes rather than just growing them.
                        ? "fixed inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none max-h-none rounded-none sm:rounded-none border-0"
                        : "sm:max-w-4xl max-h-[85vh]"
                )}
            >
                <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
                    <DialogTitle className="truncate pr-4 text-base" title={productName}>
                        {productName}
                    </DialogTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 mr-6"
                        title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                        onClick={() => setIsFullScreen(prev => !prev)}
                    >
                        {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4">
                    <BoqItemCard {...cardProps} />
                </div>

                <div className="px-4 py-3 border-t flex items-center justify-between bg-slate-50 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!canGoPrevious}
                        onClick={onPrevious}
                        className="h-8 gap-2 font-bold text-[10px] uppercase tracking-widest"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Previous
                    </Button>

                    <span className="text-[11px] font-black text-blue-900 uppercase tracking-[0.2em]">
                        Product {productIndex + 1} of {totalProducts}
                    </span>

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!canGoNext}
                        onClick={onNext}
                        className="h-8 gap-2 font-bold text-[10px] uppercase tracking-widest"
                    >
                        Next <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
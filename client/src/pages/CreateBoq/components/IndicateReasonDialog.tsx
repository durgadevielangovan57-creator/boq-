import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Small confirmation dialog shown whenever someone ticks an "Indicate"
 * checkbox (either on a product card or an individual row). It forces a
 * reason to be entered before the indicate flag is actually saved.
 *
 * The reason itself is persisted as a normal BOM comment (via onConfirm,
 * which the caller wires up to the existing /api/boq-comments endpoint),
 * so it shows up automatically wherever comments for that product/item are
 * already viewable (the Comments icon/thread) — no new storage or viewing
 * UI needed.
 *
 * This is a brand-new, self-contained component: it doesn't alter any
 * existing dialog or component.
 */
export function IndicateReasonDialog({
    open,
    onOpenChange,
    onConfirm,
    targetLabel,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called with the trimmed reason text once the user confirms. */
    onConfirm: (reason: string) => Promise<void> | void;
    /** Optional human-readable name of the product/item being indicated. */
    targetLabel?: string;
}) {
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    // Reset the textbox every time the dialog is (re)opened.
    useEffect(() => {
        if (open) {
            setReason("");
            setSaving(false);
        }
    }, [open]);

    const handleSave = async () => {
        const trimmed = reason.trim();
        if (!trimmed || saving) return;
        setSaving(true);
        try {
            await onConfirm(trimmed);
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle className="text-rose-700">Mark as Indicate</DialogTitle>
                    <DialogDescription>
                        {targetLabel
                            ? `Please enter a reason for indicating "${targetLabel}". This reason will be saved as a comment and can be viewed later from the Comments icon.`
                            : "Please enter a reason for indicating this. This reason will be saved as a comment and can be viewed later from the Comments icon."}
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for indicating..."
                    className="min-h-[90px] text-sm"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSave();
                        }
                    }}
                />
                <DialogFooter>
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                        onClick={handleSave}
                        disabled={saving || !reason.trim()}
                    >
                        {saving ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
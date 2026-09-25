import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AddReasonDialog({
    open,
    onOpenChange,
    onConfirm,
    targetLabel,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (reason: string) => Promise<void> | void;
    targetLabel?: string;
}) {
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

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
                    <DialogTitle className="text-slate-800">Mandatory Justification</DialogTitle>
                    <DialogDescription className="text-slate-600">
                        {targetLabel
                            ? `Please enter a reason for adding "${targetLabel}" to this version.`
                            : "Please enter a reason for adding this item to this version."}
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for addition..."
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
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={handleSave}
                        disabled={saving || !reason.trim()}
                    >
                        {saving ? "Adding..." : "Add Item"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
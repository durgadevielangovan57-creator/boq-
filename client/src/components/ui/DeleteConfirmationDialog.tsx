import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (action: "archive" | "trash", reason?: string) => void;
  title?: string;
  itemName?: string;
  permanentDelete?: boolean;
  requireJustification?: boolean;
}

export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  title,
  itemName,
  permanentDelete = false,
  requireJustification = false,
}: DeleteConfirmationDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = (action: "archive" | "trash") => {
    if (requireJustification && !reason.trim()) {
      return; // Validation fails
    }
    // Only pass reason if requireJustification is true, or you can just always pass it
    onConfirm(action, requireJustification ? reason.trim() : undefined);
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) setReason("");
      onOpenChange(open);
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || `Remove "${itemName || 'Item'}"?`}</DialogTitle>
          <DialogDescription className="pt-2">
            {permanentDelete ? (
              <p className="mb-4">This action cannot be undone. The item will be permanently deleted.</p>
            ) : (
              <>
                Where would you like to move this item?
                <ul className="list-disc pl-5 mt-2 space-y-1 text-left mb-4">
                  <li><strong>Archive:</strong> Safe storage, securely hidden but can be restored anytime.</li>
                  <li><strong className="text-destructive">Trash:</strong> Will be automatically and permanently deleted after 30 days.</li>
                </ul>
              </>
            )}
            
            {requireJustification && (
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-800 text-left">
                  Mandatory Justification <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500 text-left">
                  This item was copied from a previous version. Please explain why it is being deleted.
                </p>
                <textarea 
                  className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-blue-500 text-slate-800" 
                  rows={3} 
                  placeholder="Reason for deletion..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 mt-4 sm:flex-row flex-col">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {permanentDelete ? (
            <Button variant="destructive" onClick={() => handleConfirm('trash')} disabled={requireJustification && !reason.trim()}>Delete Permanently</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => handleConfirm('archive')} disabled={requireJustification && !reason.trim()}>Archive</Button>
              <Button variant="destructive" onClick={() => handleConfirm('trash')} disabled={requireJustification && !reason.trim()}>Trash</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

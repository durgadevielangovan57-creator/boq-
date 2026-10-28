import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart, Building2, User, Calendar, FileText, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/reportsExport";
import apiFetch from "@/lib/api";

interface PoDetailModalProps {
  po: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PoDetailModal({ po, open, onOpenChange }: PoDetailModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (open && po?.id) {
      loadPoDetails(po.id);
    }
  }, [open, po?.id]);

  const loadPoDetails = async (poId: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/purchase-orders/${poId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (e) {
      console.warn("Failed to load PO items:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!po) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Purchase Order: {po.po_number}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Project: {po.project_name || "N/A"} • Issued on {formatDate(po.po_date || po.created_at)}
                </DialogDescription>
              </div>
            </div>
            <Badge className="capitalize text-xs font-semibold px-2.5 py-0.5">
              {po.status || "draft"}
            </Badge>
          </div>
        </DialogHeader>

        {/* PO Key Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 bg-muted/40 rounded-xl border border-border text-xs">
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Vendor</span>
            <span className="font-semibold text-foreground text-xs">{po.vendor_name || "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Project</span>
            <span className="font-semibold text-foreground text-xs">{po.project_name || "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Requested By</span>
            <span className="font-semibold text-foreground text-xs">{po.requested_by || "System"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Approved By</span>
            <span className="font-semibold text-foreground text-xs">{po.approved_by || "Pending"}</span>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mt-2 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Ordered Line Items ({items.length})
          </h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-10 text-center text-xs">#</TableHead>
                  <TableHead className="text-xs">Item & Description</TableHead>
                  <TableHead className="text-xs text-center w-20">Unit</TableHead>
                  <TableHead className="text-xs text-right w-20">Qty</TableHead>
                  <TableHead className="text-xs text-right w-24">Rate (₹)</TableHead>
                  <TableHead className="text-xs text-right w-28">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading ordered materials...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                      No line items found for this purchase order.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it, idx) => (
                    <TableRow key={it.id || idx} className="text-xs">
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <span className="font-semibold text-foreground block">{it.item}</span>
                        {it.description && (
                          <span className="text-[11px] text-muted-foreground block line-clamp-1">
                            {it.description}
                          </span>
                        )}
                        {it.hsn_code && (
                          <span className="text-[10px] text-muted-foreground">
                            HSN: {it.hsn_code}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{it.unit || "-"}</TableCell>
                      <TableCell className="text-right font-medium">{it.qty}</TableCell>
                      <TableCell className="text-right">{formatCurrency(it.rate)}</TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {formatCurrency(it.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="flex justify-end pt-2">
          <div className="w-64 space-y-1.5 p-3 bg-muted/30 rounded-xl border border-border text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-medium text-foreground">{formatCurrency(po.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax / GST:</span>
              <span className="font-medium text-foreground">{formatCurrency(po.tax)}</span>
            </div>
            <div className="border-t border-border pt-1.5 flex justify-between font-bold text-sm text-foreground">
              <span>Grand Total:</span>
              <span className="text-primary">{formatCurrency(po.total)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

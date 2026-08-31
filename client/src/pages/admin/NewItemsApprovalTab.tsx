import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, Package, ArrowRight } from "lucide-react";
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { computeBoq } from "@/lib/boqCalc";
import { useQueryClient } from "@tanstack/react-query";

// Renders Save / Save As requests submitted from Generate BOM Product
// Cards. Fully additive: talks only to the new
// /api/boq-manual-item-requests endpoints and never touches the existing
// /api/product-approvals data shown in the other tabs.

type ManualItemRequest = {
  id: string;
  type: "save" | "save_as";
  boq_item_id: string;
  project_id: string | null;
  version_id: string | null;
  source_product_name: string;
  new_product_name: string | null;
  item_indexes: number[] | string;
  items: any[] | string;
  calculated_results: any;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  requested_by_name: string;
  approved_by_name: string | null;
  created_at: string;
  decided_at: string | null;
  // Present when the backend could join the source product card — contains
  // that product's full, current table_data (all items, old + new).
  source_table_data?: any;
};

const asArray = (v: any) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return []; } }
  return [];
};

const asObj = (v: any) => {
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return {}; } }
  return {};
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

export default function NewItemsApprovalTab({ canAct }: { canAct: boolean }) {
  const [requests, setRequests] = useState<ManualItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/boq-manual-item-requests?status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error("Failed to load manual item requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [statusFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/boq-manual-item-requests/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Approved" });
      fetchRequests();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to approve request", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Reason for rejection (optional):") || undefined;
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/boq-manual-item-requests/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Rejected" });
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to reject request", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-bold">Pending</Badge>;
    if (status === "approved") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 font-bold">Approved</Badge>;
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 font-bold">Rejected</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            className="h-8 text-xs font-bold capitalize"
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {requests.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-slate-400">No {statusFilter !== "all" ? statusFilter : ""} requests</CardContent></Card>
      )}

      {requests.map((r) => {
        const newItems = asArray(r.items);
        const calcResults = asObj(r.calculated_results);
        const productConfig = asObj(calcResults.productConfig);
        const isExpanded = expandedId === r.id;

        const globalProductItemsRaw = asArray((r as any).global_product_items);
        const globalProductItems = globalProductItemsRaw.map((it: any, i: number) => ({
          id: it.material_id || `global-${i}`,
          title: it.material_name,
          description: it.material_name,
          unit: it.unit,
          qty: it.qty,
          qtyPerSqf: it.qty,
          supply_rate: it.supply_rate,
          install_rate: it.install_rate,
          location: it.location,
          freezeAndEdit: it.freeze_and_edit,
          shop_name: ""
        }));

        let mergedItems = [...newItems];
        if (r.type === "save") {
          // Requests submitted before the add/edit/delete "full edit" Save
          // flow existed have no `_action` tag on their items — treat those
          // as plain additions, same as before.
          const nameKey = (it: any) => (it.title || it.description || it.material_name || it.name || "").toString().toLowerCase().trim();
          const newItemsAdd = newItems.filter((it: any) => (it._action || "add") === "add");
          const newItemsEdit = newItems.filter((it: any) => it._action === "edit");
          const newItemsDelete = newItems.filter((it: any) => it._action === "delete");
          const editByKey = new Map(newItemsEdit.map((it: any) => [nameKey(it), it]));
          const deleteKeys = new Set(newItemsDelete.map((it: any) => nameKey(it)));

          mergedItems = globalProductItems.map((it: any) => {
            const key = nameKey(it);
            if (deleteKeys.has(key)) {
              return { ...it, manualApproval: { requestId: r.id, status: r.status, action: "delete" } };
            }
            if (editByKey.has(key)) {
              const editPatch = editByKey.get(key) || {};
              return { ...it, ...editPatch, manualApproval: { requestId: r.id, status: r.status, action: "edit" } };
            }
            return it;
          });

          if (r.status === "approved") {
            // Deleted items are already removed from the live product by
            // now — re-add them here purely for display, so the approval
            // history still shows what was taken out.
            const presentKeys = new Set(mergedItems.map(nameKey));
            newItemsDelete.forEach((it: any) => {
              if (!presentKeys.has(nameKey(it))) {
                mergedItems.push({ ...it, manualApproval: { requestId: r.id, status: r.status, action: "delete" } });
              }
            });
          }

          if (r.status !== 'approved') {
            // Append them if they aren't in the global product yet (pending or rejected)
            const taggedNewItems = newItemsAdd.map((it: any) => ({
              ...it,
              manualApproval: { requestId: r.id, status: r.status, action: "add" }
            }));
            mergedItems.push(...taggedNewItems);
          } else {
            // If approved, they are already inserted into globalProductItems by the backend.
            // We just need to identify and highlight them by matching names.
            const newNames = new Set(newItemsAdd.map((ni: any) => nameKey(ni)));
            mergedItems = mergedItems.map((it: any) => {
              if (newNames.has(nameKey(it))) {
                return { ...it, manualApproval: { requestId: r.id, status: r.status, action: "add" } };
              }
              return it;
            });
          }
        }

        const items: any[] = r.type === "save" ? mergedItems : newItems;
        const usingFullProductView = r.type === "save";
        const isNewItem = (it: any) =>
          usingFullProductView
            ? !!(it?.manualApproval && it.manualApproval.requestId === r.id && (it.manualApproval.action || "add") === "add")
            : true;
        const newItemCount = r.type === "save" ? newItems.length : items.length;

        // Build basis for computeBoq from submitted product config
        const basis = {
          requiredUnitType: (productConfig.requiredUnitType || "Sqft") as any,
          baseRequiredQty: Number(productConfig.baseRequiredQty || 1),
          wastagePctDefault: 0,
        };

        // Build materialLines from submitted items
        const materialLines = items.map((it: any) => ({
          id: it.material_id || it.title || `item-${it.index}`,
          name: it.title || it.description || "Untitled",
          unit: it.unit || "-",
          location: it.location || it.description || "Main Area",
          baseQty: Number(it.qtyPerSqf ?? it.qty ?? 0),
          wastagePct: it.wastagePct !== undefined ? Number(it.wastagePct) : undefined,
          supplyRate: Number(it.supply_rate ?? 0),
          installRate: Number(it.install_rate ?? 0),
          applyWastage: it.wastagePct !== undefined && Number(it.wastagePct) > 0,
          freeze_and_edit: it.freezeAndEdit || false,
          shop_name: it.shop_name || "",
        }));

        let boqRes: any = null;
        try {
          boqRes = computeBoq(basis, materialLines, basis.baseRequiredQty);
        } catch { /* ignore computation errors */ }

        return (
          <Card key={r.id} className="overflow-hidden">
            <CardContent className="p-0">
              {/* Header Row */}
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      {r.type === "save" ? (
                        <>{newItemCount} change{newItemCount === 1 ? "" : "s"} to <span className="text-primary">{r.source_product_name}</span></>
                      ) : (
                        <>New Manual Product: <span className="text-primary">{r.new_product_name}</span></>
                      )}
                    </div>
                    {r.type === "save_as" && (
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        Source: {r.source_product_name} <ArrowRight className="h-3 w-3" /> {r.new_product_name}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 mt-0.5">Requested by {r.requested_by_name} · {formatDate(r.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(r.status)}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50/50">
                  {/* Config Summary Bar — matches ProductApprovals layout */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div className="bg-white rounded-lg border p-3">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Change Type</p>
                      <p className="font-bold text-sm">{r.type === "save" ? "New Manual Items" : "New Product (Save As)"}</p>
                    </div>
                    <div className="bg-white rounded-lg border p-3">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Source Product</p>
                      <p className="font-bold text-sm truncate">{r.source_product_name}</p>
                    </div>
                    {r.new_product_name && (
                      <div className="bg-white rounded-lg border p-3">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">New Product Name</p>
                        <p className="font-bold text-sm truncate">{r.new_product_name}</p>
                      </div>
                    )}
                    {productConfig.category && (
                      <div className="bg-white rounded-lg border p-3">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Category</p>
                        <p className="font-bold text-sm truncate">{productConfig.category}{productConfig.subcategory ? ` / ${productConfig.subcategory}` : ""}</p>
                      </div>
                    )}
                    <div className="bg-white rounded-lg border p-3">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Unit Type</p>
                      <p className="font-bold text-sm">{productConfig.requiredUnitType || "Sqft"}</p>
                    </div>
                    <div className="bg-white rounded-lg border p-3">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Base Qty</p>
                      <p className="font-bold text-sm">{productConfig.baseRequiredQty || 1}</p>
                    </div>
                    {(productConfig.dimA || productConfig.dimB || productConfig.dimC) && (
                      <div className="bg-white rounded-lg border p-3">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Dimensions</p>
                        <p className="font-bold text-sm">
                          {[productConfig.dimA, productConfig.dimB, productConfig.dimC].filter(Boolean).join(" × ")}
                        </p>
                      </div>
                    )}
                    {calcResults?.grandTotal !== undefined && (
                      <div className="bg-white rounded-lg border p-3">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Calculated Total</p>
                        <p className="font-bold text-sm text-primary">₹{Number(calcResults.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    )}
                  </div>

                  {productConfig.description && (
                    <div className="bg-white rounded-lg border p-3">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Description</p>
                      <p className="text-sm">{productConfig.description}</p>
                    </div>
                  )}

                  {/* Items Table — matches ProductApprovals detail table */}
                  <div className="rounded-lg border overflow-hidden bg-white">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="w-[40px] font-bold">Sl</TableHead>
                          {usingFullProductView && <TableHead className="w-[70px] font-bold">Status</TableHead>}
                          <TableHead className="font-bold py-4">Item</TableHead>
                          <TableHead className="w-[120px] font-bold">Description</TableHead>
                          <TableHead className="w-[60px] font-bold">Unit</TableHead>
                          <TableHead className="w-[100px] font-bold">Qty</TableHead>
                          <TableHead className="w-[100px] font-bold">Supply Rate</TableHead>
                          <TableHead className="w-[100px] font-bold">Install Rate</TableHead>
                          <TableHead className="w-[110px] font-bold">Base Amount</TableHead>
                          <TableHead className="w-[80px] font-bold">Wastage %</TableHead>
                          <TableHead className="w-[80px] font-bold">Wastage Qty</TableHead>
                          <TableHead className="w-[90px] font-bold">Total Qty</TableHead>
                          <TableHead className="w-[90px] font-bold">Final Amount</TableHead>
                          {boqRes && <TableHead className="w-[90px] font-bold">Per {basis.requiredUnitType} Qty</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it: any, idx: number) => {
                          const supplyRate = Number(it.supply_rate ?? 0);
                          const installRate = Number(it.install_rate ?? 0);
                          const baseQty = Number(it.qtyPerSqf ?? it.qty ?? 0);
                          const wastagePct = Number(it.wastagePct ?? 0);
                          const rate = supplyRate + installRate;
                          const baseAmt = baseQty * rate;
                          const isFrozen = it.freezeAndEdit;
                          const isNew = isNewItem(it);
                          const action = it?.manualApproval?.action;
                          const isDeleted = action === "delete";
                          const isEdited = action === "edit";

                          // Use computeBoq results if available
                          const computed = boqRes?.computed?.[idx];
                          const wastageQty = computed?.wastageQty ?? (baseQty * wastagePct / 100);
                          const totalQty = computed?.roundOffQty ?? (baseQty + wastageQty);
                          const finalAmt = computed?.lineTotal ?? (totalQty * rate);
                          const perUnitQty = computed?.perUnitQty ?? 0;

                          return (
                            <TableRow
                              key={idx}
                              className={`hover:bg-muted/5 text-[11px] ${isDeleted
                                ? "bg-red-50 border-l-4 border-l-red-500 shadow-sm line-through opacity-70"
                                : isNew
                                  ? "bg-emerald-50 border-l-4 border-l-emerald-500 shadow-sm"
                                  : isEdited
                                    ? "bg-amber-50 border-l-4 border-l-amber-500 shadow-sm"
                                    : isFrozen
                                      ? "bg-cyan-100/60 border-l-4 border-l-cyan-500 shadow-sm"
                                      : ""
                                }`}
                            >
                              <TableCell className="text-center font-medium">{idx + 1}</TableCell>
                              {usingFullProductView && (
                                <TableCell>
                                  {isDeleted ? (
                                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 font-bold text-[10px] px-1.5 py-0">Removed</Badge>
                                  ) : isNew ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-bold text-[10px] px-1.5 py-0">New</Badge>
                                  ) : isEdited ? (
                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-bold text-[10px] px-1.5 py-0">Edited</Badge>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-medium">Existing</span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="font-semibold">{it.title || it.description}</TableCell>
                              <TableCell className="text-[10px] text-muted-foreground">{it.location || it.description || "-"}</TableCell>
                              <TableCell className="text-[10px] font-medium">{it.unit || "-"}</TableCell>
                              <TableCell className="text-[11px] font-bold text-center">{baseQty}</TableCell>
                              <TableCell className="text-[10px] font-bold">₹{supplyRate.toLocaleString()}</TableCell>
                              <TableCell className="text-[10px] font-bold">₹{installRate.toLocaleString()}</TableCell>
                              <TableCell className="text-[10px] font-bold">₹{baseAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-[10px] font-bold text-orange-600">{wastagePct}%</TableCell>
                              <TableCell className="text-[10px] font-bold text-orange-600">{wastageQty.toFixed(2)}</TableCell>
                              <TableCell className="text-[10px] font-bold">{totalQty.toFixed(2)}</TableCell>
                              <TableCell className="text-[10px] font-bold text-blue-600">₹{finalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              {boqRes && <TableCell className="text-[10px] font-bold text-primary">{perUnitQty.toFixed(4)}</TableCell>}
                            </TableRow>
                          );
                        })}
                        {/* Grand Total Row — sums whatever is currently shown (full
                            product when merged view is active, submitted items otherwise) */}
                        <TableRow className="bg-muted/20 font-black">
                          <TableCell colSpan={usingFullProductView ? 8 : 7} className="text-right py-3 pr-4">Total (Incl. Wastage)</TableCell>
                          <TableCell className="text-[11px] font-bold">
                            ₹{items.reduce((sum: number, it: any) => {
                              const rate = Number(it.supply_rate ?? 0) + Number(it.install_rate ?? 0);
                              return sum + Number(it.qtyPerSqf ?? it.qty ?? 0) * rate;
                            }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell colSpan={3}></TableCell>
                          <TableCell className="text-[11px] font-bold text-primary">
                            ₹{(r.type === "save"
                              ? items.reduce((sum: number, it: any, idx: number) => sum + (boqRes?.computed?.[idx]?.lineTotal ?? (Number(it.qtyPerSqf ?? it.qty ?? 0) * (Number(it.supply_rate ?? 0) + Number(it.install_rate ?? 0)))), 0)
                              : (boqRes?.grandTotal ?? calcResults?.grandTotal ?? 0)
                            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          {boqRes && <TableCell></TableCell>}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  {usingFullProductView && (
                    <p className="text-[11px] text-slate-400 px-1">
                      Showing the full product — <span className="font-bold text-emerald-600">new</span>, <span className="font-bold text-amber-600">edited</span>, and <span className="font-bold text-red-600">removed</span> materials are highlighted; unchanged items shown for context.
                    </p>
                  )}

                  {r.status === "rejected" && r.rejection_reason && (
                    <div className="text-xs text-red-600"><span className="font-bold">Rejection reason:</span> {r.rejection_reason}</div>
                  )}
                  {r.status !== "pending" && (
                    <div className="text-[11px] text-slate-400">{r.status === "approved" ? "Approved" : "Rejected"} by {r.approved_by_name || "-"} · {formatDate(r.decided_at)}</div>
                  )}

                  {r.status === "pending" && canAct && (
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white font-bold" disabled={actionLoading === r.id} onClick={() => handleApprove(r.id)}>
                        {actionLoading === r.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="h-8 font-bold" disabled={actionLoading === r.id} onClick={() => handleReject(r.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
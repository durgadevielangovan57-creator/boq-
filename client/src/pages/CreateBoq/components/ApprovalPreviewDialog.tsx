import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronUp, ChevronDown, Loader2, CheckCircle2, XCircle, Lock, History, Clock, Briefcase, MapPin, IndianRupee, GripVertical, Search, ArrowUp, ArrowLeft, ArrowRight, ArrowDown, Plus, Trash2, Save, MessageSquare, Users, ChevronsUpDown, Check, X, RefreshCw, Star, Edit, Reply, AlertTriangle } from "lucide-react";
import { fuzzySearch, cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { computeBoq, UnitType } from "@/lib/boqCalc";
import { getEstimatorTypeFromProduct } from "@/lib/estimatorUtils";
import ProductPicker from "@/components/ProductPicker";
import MaterialPicker from "@/components/MaterialPicker";
import Step11Preview from "@/components/Step11Preview";
import { BomSketchCompareDialog } from "@/components/BomSketchCompareDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from 'xlsx';
import { DeleteConfirmationDialog } from "../../../components/ui/DeleteConfirmationDialog";
import { ProductAnalysisDialog } from "@/components/ProductAnalysisDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { Textarea } from "../../../components/ui/textarea";
import { Checkbox } from "../../../components/ui/checkbox";
import { useData } from "../../../lib/store";
import { Project, BOMVersion, BOMItem, Product, Step11Item, BOMHistory, BOMComment, User, PROJECT_STATUSES, getProjectStatusMeta } from '../types';
import { parseTableData, parseImages, safeJson, VERSION_LABEL } from '../utils';

export function ApprovalPreviewDialog({
  approval,
  items,
  loading,
  open,
  onClose,
  onAction,
  actionLoading
}: {
  approval: any,
  items: any[],
  loading: boolean,
  open: boolean,
  onClose: () => void,
  onAction: (id: string, action: 'approve' | 'reject' | 'approve-edit' | 'reject-edit') => void,
  actionLoading: string | null
}) {
  if (!approval) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">{approval.project_name}</DialogTitle>
                <DialogDescription className="text-sm font-medium text-slate-500">
                  {approval.project_client} • Version V{approval.version_number} • {approval.status === 'edit_requested' ? "Edit Request" : "Standard Approval"}
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-2 mr-8">
              <Button
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50 font-bold"
                onClick={() => onAction(approval.id, approval.status === 'edit_requested' ? 'reject-edit' : 'reject')}
                disabled={!!actionLoading}
              >
                {actionLoading === approval.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white font-bold"
                onClick={() => onAction(approval.id, approval.status === 'edit_requested' ? 'approve-edit' : 'approve')}
                disabled={!!actionLoading}
              >
                {actionLoading === approval.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Approve
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <Loader2 className="h-10 w-10 animate-spin" />
              <span className="font-bold">Loading BOM Details...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item, idx) => {
                const td = typeof item.table_data === 'string' ? JSON.parse(item.table_data) : item.table_data;
                const step11Items = Array.isArray(td.step11_items) ? td.step11_items : [];
                let displayLines = [];

                if (td.materialLines && td.targetRequiredQty !== undefined) {
                  const res = computeBoq(
                    td.configBasis || { requiredUnitType: "Sqft", baseRequiredQty: 1, wastagePctDefault: 0 },
                    td.materialLines || [],
                    td.targetRequiredQty || 1
                  );
                  displayLines = res.computed.map((line: any) => ({
                    title: line.name,
                    description: line.name,
                    unit: line.unit,
                    shop_name: line.shop_name,
                    qtyPerSqf: line.perUnitQty,
                    requiredQty: line.scaledQty,
                    roundOff: line.roundOffQty,
                    rateSqft: line.supplyRate + line.installRate,
                    amount: line.lineTotal,
                    is_project_pricing: line.is_project_pricing
                  }));
                  const manualAdditions = step11Items.filter((i: any) => i && i.manual).map((it: any) => ({
                    ...it,
                    qtyPerSqf: it.qtyPerSqf ?? 0,
                    requiredQty: it.qty ?? 0,
                    roundOff: it.qty ?? 0,
                    rateSqft: it.rate || (it.supply_rate + it.install_rate),
                    amount: (it.qty ?? 0) * (it.rate || (it.supply_rate + it.install_rate))
                  }));
                  displayLines = [...displayLines, ...manualAdditions];
                } else {
                  displayLines = step11Items.map((it: any) => ({
                    ...it,
                    qtyPerSqf: it.qtyPerSqf ?? 0,
                    requiredQty: it.qty ?? 0,
                    roundOff: it.qty ?? 0,
                    rateSqft: it.rate || (it.supply_rate + it.install_rate),
                    amount: (it.qty ?? 0) * (it.rate || (it.supply_rate + it.install_rate))
                  }));
                }

                return (
                  <Card key={item.id} className="border-slate-200 overflow-hidden shadow-sm">
                    <CardHeader className="bg-slate-50 py-3 px-4 border-b">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold">#{idx + 1}</span>
                          <span className="font-bold text-slate-800 uppercase tracking-tight">{td.product_name || item.estimator}</span>
                        </div>
                        {td.targetRequiredQty && (
                          <Badge variant="outline" className="bg-white font-bold border-blue-200 text-blue-700">
                            Target: {td.targetRequiredQty} {td.configBasis?.requiredUnitType || "Unit"}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table className="text-[11px]">
                        <TableHeader className="bg-slate-50/50">
                          <TableRow>
                            <TableHead className="w-10">Sl</TableHead>
                            <TableHead>Item / Material</TableHead>
                            <TableHead>Shop</TableHead>
                            <TableHead className="text-center">Unit</TableHead>
                            <TableHead className="text-center">Qty/Unit</TableHead>
                            <TableHead className="text-center">Required Qty</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right px-6">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayLines.map((l: any, iIdx: number) => (
                            <TableRow key={iIdx} className="hover:bg-slate-50/30">
                              <TableCell className="text-slate-400 font-medium">{iIdx + 1}</TableCell>
                              <TableCell className="font-semibold text-slate-700">
                                {l.title}
                                {l.manual && <Badge className="ml-2 scale-75 h-4 bg-amber-100 text-amber-700 border-amber-200 uppercase">Manual</Badge>}
                              </TableCell>
                              <TableCell className="text-slate-500">{l.shop_name || "—"}</TableCell>
                              <TableCell className="text-center font-medium">{l.unit}</TableCell>
                              <TableCell className="text-center">{Number(l.qtyPerSqf).toFixed(3)}</TableCell>
                              <TableCell className="text-center font-bold text-blue-600">{Number(l.requiredQty).toFixed(2)}</TableCell>
                              <TableCell className="text-right font-medium text-slate-600">₹{Number(l.rateSqft).toLocaleString()}</TableCell>
                              <TableCell className="text-right px-6 font-bold text-slate-900 bg-slate-50/30">₹{Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <tfoot className="bg-slate-50/50 border-t font-bold">
                          <TableRow>
                            <TableCell colSpan={7} className="text-right uppercase text-[10px] text-slate-500 font-extrabold tracking-widest">Product Total</TableCell>
                            <TableCell className="text-right px-6 text-sm text-green-700">
                              ₹{displayLines.reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        </tfoot>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50">
          <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500 hover:text-slate-700">Close Preview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
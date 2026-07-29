import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Printer, X, Calculator, FileText,
  ShieldAlert, ChevronDown, ChevronUp, GripVertical, Trash2, History,
  MessageSquare, MapPin, Save, Plus, Info, LayoutList, AlignJustify,
} from "lucide-react";
import apiFetch from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { computeBoq } from "@/lib/boqCalc";

interface BoqPreviewModalProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
}

function calculateItemTotal(item: any): number {
  if (item.isEngineBased) {
    const target = item.targetRequiredQty || 1;
    const basis = item.configBasis || { baseRequiredQty: 1, wastagePctDefault: 0 };
    const result = computeBoq(basis, item.materialLines || [], target);
    return result.grandTotal;
  }
  // For non-engine based (manual items), use step11_items total
  return (item.step11_items || []).reduce((s: number, si: any) => {
    const amount = si.amount || ((si.qty || 0) * ((si.supply_rate || 0) + (si.install_rate || 0)));
    return s + (Number(amount) || 0);
  }, 0);
}

export function BoqPreviewModal({ open, onClose, planId, planName }: BoqPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  // compact view: hides the full material table, shows only item header + totals
  const [isCompactView, setIsCompactView] = useState(false);

  useEffect(() => {
    if (open && planId) {
      const fetchPreview = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await apiFetch(`/api/sketch-plans/${planId}/preview-boq`);
          const data = await res.json();
          if (res.ok) {
            setItems(data.items || []);
            // Chevron closed by default as requested
            setExpandedItems(new Set());
          } else {
            setError(data.message || "Failed to fetch BOQ preview");
            setItems([]);
          }
        } catch (err) {
          console.error("Failed to fetch BOQ preview:", err);
          setError("A connection error occurred. Please check your internet and try again.");
        } finally {
          setLoading(false);
        }
      };
      fetchPreview();
    }
  }, [open, planId]);

  // FIX: create a brand-new Set so React detects the state change
  const toggleExpand = (idx: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Compact view: collapse all items
  const handleCompactToggle = () => {
    setIsCompactView(prev => {
      const next = !prev;
      if (next) {
        // Collapse all when entering compact view
        setExpandedItems(new Set());
      } else {
        // Expand all when leaving compact view
        setExpandedItems(new Set(items.map((_, i) => i)));
      }
      return next;
    });
  };

  const totalAmount = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-none w-screen h-screen m-0 p-0 rounded-none overflow-hidden flex flex-col bg-slate-50 border-none font-sans">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 p-2 rounded-lg text-white">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">BOM Preview</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 font-semibold">{planName}</span>
                <span className="h-1 w-1 rounded-full bg-blue-500 inline-block"></span>
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Financial Verification</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Compact View toggle — now functional */}
            {!loading && items.length > 0 && (
              <Button
                variant={isCompactView ? "default" : "outline"}
                size="sm"
                onClick={handleCompactToggle}
                className={`h-9 px-4 text-xs font-semibold ${isCompactView
                  ? "bg-slate-800 text-white hover:bg-slate-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
              >
                {isCompactView
                  ? <><AlignJustify className="h-3.5 w-3.5 mr-1.5" /> Full View</>
                  : <><LayoutList className="h-3.5 w-3.5 mr-1.5" /> Compact View</>
                }
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-9 px-4 text-xs font-semibold border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print PDF
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-full hover:bg-slate-100"
            >
              <X className="h-5 w-5 text-slate-400" />
            </Button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-40 gap-4"
              >
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">Generating BOM Preview</p>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mt-1">Fetching live rates &amp; configurations</p>
                </div>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-24 bg-red-50 rounded-2xl border border-dashed border-red-200 flex flex-col items-center gap-4"
              >
                <ShieldAlert className="h-12 w-12 text-red-500" />
                <div>
                  <p className="text-lg font-bold text-red-800">Preview Interrupted</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
                <Button variant="outline" onClick={() => window.location.reload()} className="border-red-200 text-red-700 hover:bg-red-50">
                  Reload Preview
                </Button>
              </motion.div>
            ) : items.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center gap-4"
              >
                <FileText className="h-12 w-12 text-slate-300" />
                <div>
                  <p className="text-lg font-bold text-slate-900">No Items to Display</p>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mt-1">Add items to your sketch plan to generate BOM</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-7xl mx-auto">

                {/* Info banner */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
                  <Info className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-indigo-700 font-semibold">
                    This is a <strong>dynamic preview</strong>. All rates are fetched from the live library.
                    Buttons below are shown for layout reference only — they are disabled in preview mode.
                  </p>
                </div>

                {/* ── Compact view: summary table ────────────────── */}
                {isCompactView && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-widest">Compact Summary</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{items.length} items</span>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wide">
                          <th className="px-4 py-2 text-left w-10">#</th>
                          <th className="px-4 py-2 text-left">Product</th>
                          <th className="px-4 py-2 text-left">Area</th>
                          <th className="px-4 py-2 text-center">Target</th>
                          <th className="px-4 py-2 text-center">Items</th>
                          <th className="px-4 py-2 text-right">Rate / Unit</th>
                          <th className="px-4 py-2 text-right">Grand Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => {
                          const itemTotal = calculateItemTotal(item);
                          const targetQty = item.targetRequiredQty || 1;
                          const ratePerUnit = targetQty > 0 ? itemTotal / targetQty : 0;
                          
                          // Use the engine flag from server if available, else derive
                          const isEngine = item.isEngineBased ?? !!item.materialLines;
                          
                          const lineCount = isEngine
                            ? (item.materialLines?.length || 0)
                            : (item.step11_items?.length || 0);
                            
                          const unitDisplay = item.requiredUnitType || item.configBasis?.requiredUnitType || item.unit || item.dimension_unit || "nos";

                          return (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5 text-slate-400 font-medium">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-900">{item.product_name}</td>
                              <td className="px-4 py-2.5 text-slate-500">{item.category || "—"}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-blue-700">
                                {targetQty} {unitDisplay}
                              </td>
                              <td className="px-4 py-2.5 text-center text-slate-500">{lineCount}</td>
                              <td className="px-4 py-2.5 text-right text-blue-700 font-bold">
                                ₹{ratePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-2.5 text-right font-black text-slate-900">
                                ₹{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                        <tr>
                          <td colSpan={6} className="px-4 py-3 text-right text-xs font-black text-slate-700 uppercase tracking-wider">
                            Project Estimated Total
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-black text-slate-900">
                            ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </motion.div>
                )}

                {/* ── Item cards (hidden in compact view) ───────── */}
                {!isCompactView && items.map((item, idx) => {
                  const isExpanded = expandedItems.has(idx);
                  const itemTotal = calculateItemTotal(item);
                  const targetQty = item.targetRequiredQty || 1;
                  const ratePerUnit = targetQty > 0 ? itemTotal / targetQty : 0;

                  // Build display lines exactly like BoqItemCard
                  let displayLines: any[] = [];
                  const isEngineBased = !!(item.materialLines && item.targetRequiredQty !== undefined);

                  if (isEngineBased) {
                      try {
                        const basis = item.configBasis || { baseRequiredQty: 1, wastagePctDefault: 0 };
                        const boqResult = computeBoq(basis, item.materialLines || [], targetQty);
                        displayLines = boqResult.computed.map((line: any, lineIdx: number) => {
                          return {
                            ...line,
                            title: line.name,
                            description: line.name,
                            unit: line.unit,
                            shop_name: line.shop_name,
                            image: line.image,
                            category: line.category,
                            qtyPerSqf: line.perUnitQty,
                            requiredQty: line.scaledQty,
                            roundOff: line.roundOffQty,
                            rateSqft: (line.supplyRate || 0) + (line.installRate || 0),
                            amount: line.lineTotal,
                            s_no: lineIdx + 1,
                          };
                        });
                        const manualLines = (item.step11_items || [])
                          .filter((si: any) => si?.manual)
                          .map((si: any, siIdx: number) => ({
                            ...si,
                            title: si.title || si.name,
                            qtyPerSqf: si.qty || 0,
                            requiredQty: si.qty || 0,
                            roundOff: si.qty || 0,
                            rateSqft: (si.supply_rate || 0) + (si.install_rate || 0),
                            amount: si.amount || ((si.qty || 0) * ((si.supply_rate || 0) + (si.install_rate || 0))),
                            s_no: displayLines.length + siIdx + 1,
                          }));
                        displayLines = [...displayLines, ...manualLines];
                      } catch (e) {
                        console.error("Failed to compute BOQ preview:", e);
                        displayLines = [];
                      }
                  } else {
                    displayLines = (item.step11_items || []).map((si: any, siIdx: number) => ({
                      ...si,
                      title: si.title || si.name,
                      qtyPerSqf: si.qty || 0,
                      requiredQty: si.qty || 0,
                      roundOff: si.qty || 0,
                      rateSqft: (si.supply_rate || 0) + (si.install_rate || 0),
                      amount: si.amount || ((si.qty || 0) * ((si.supply_rate || 0) + (si.install_rate || 0))),
                      s_no: siIdx + 1,
                    }));
                  }

                  const subTotal = displayLines.reduce((s: number, l: any) => s + (l.amount || 0), 0);

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="border border-slate-200 rounded-lg overflow-hidden bg-white"
                    >
                      {/* ── Card header row ── */}
                      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex flex-wrap justify-between items-center gap-x-4 gap-y-2">
                        <div className="flex items-center gap-3 font-bold text-gray-800 flex-1 min-w-0">
                          <GripVertical className="h-4 w-4 flex-shrink-0 text-gray-300" />
                          <select disabled className="text-xs p-0.5 border border-slate-200 rounded bg-white text-slate-400 cursor-not-allowed">
                            <option>{idx + 1}</option>
                          </select>

                          <span className="truncate max-w-xs text-sm font-bold text-gray-900" title={item.product_name}>
                            {item.product_name}
                          </span>

                          <div className="flex items-center gap-2 ml-2">
                            <label className="flex items-center gap-1 text-[10px] text-blue-600 font-bold bg-white px-1.5 py-0.5 rounded border border-blue-200 shadow-sm opacity-50 cursor-not-allowed whitespace-nowrap">
                              <input type="checkbox" disabled /> Convert to LS
                            </label>
                            <label className="flex items-center gap-1 text-[10px] text-blue-700 font-bold bg-white px-1.5 py-0.5 rounded border border-blue-300 shadow-sm opacity-50 cursor-not-allowed whitespace-nowrap">
                              <input type="checkbox" disabled /> Fixed Rate
                            </label>
                            <label className="flex items-center gap-1 text-[10px] text-rose-600 font-bold bg-white px-1.5 py-0.5 rounded border border-rose-200 shadow-sm opacity-50 cursor-not-allowed whitespace-nowrap">
                              <input type="checkbox" disabled /> Indicate
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* FIX: use a plain button to avoid any event bubbling issues */}
                          <button
                            type="button"
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-200 transition-colors"
                            onClick={() => toggleExpand(idx)}
                          >
                            {isExpanded
                              ? <ChevronUp className="h-4 w-4 text-slate-500" />
                              : <ChevronDown className="h-4 w-4 text-slate-500" />
                            }
                          </button>
                        </div>
                      </div>

                      {/* ── Card content ── */}
                      <div className="px-4 pt-2.5 pb-3 space-y-2.5">

                        {/* ROW 1: Area  ·  Add Item + Finalize */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 border border-slate-300 rounded px-2.5 py-1 bg-white shadow-sm">
                            <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Project Area</span>
                            <span className="text-xs font-black text-slate-900 ml-0.5">{item.category || "Not Specified"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-7 px-3 text-xs font-bold border-slate-400 text-slate-700 opacity-50 cursor-not-allowed" disabled>
                              <Plus className="h-3 w-3 mr-1" /> Add Item
                            </Button>
                            <Button size="sm" className="h-7 px-3 text-xs font-bold bg-green-600 text-white opacity-50 cursor-not-allowed" disabled>
                              Finalize
                            </Button>
                          </div>
                        </div>

                        {/* ROW 2: Rate · Total · Target  |  Analysis · Template · Comments · Delete */}
                        <div className="flex items-center justify-between gap-3 border-y border-slate-200 py-2">
                          <div className="flex items-center gap-2">
                            {/* Rate */}
                            <div className="flex flex-col bg-blue-50 border border-blue-200 rounded px-3 py-1.5 min-w-[110px]">
                              <span className="text-[9px] font-extrabold text-blue-500 uppercase tracking-tight leading-none mb-0.5">
                                RATE PER {(item.requiredUnitType || item.configBasis?.requiredUnitType || "Unit").toUpperCase()}
                              </span>
                              <span className="text-sm font-black text-blue-800 leading-tight">
                                ₹{ratePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            {/* Grand Total */}
                            <div className="flex flex-col bg-slate-100 border border-slate-300 rounded px-3 py-1.5 min-w-[110px]">
                              <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-tight leading-none mb-0.5">GRAND TOTAL</span>
                              <span className="text-sm font-black text-slate-900 leading-tight">
                                ₹{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            {/* Target — engine-based only */}
                            {isEngineBased && (
                              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded px-3 py-1.5">
                                <span className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-tight">Target</span>
                                <span className="text-sm font-black text-indigo-800">{targetQty}</span>
                                <span className="text-[9px] font-extrabold text-indigo-500 uppercase">{item.requiredUnitType || item.configBasis?.requiredUnitType || "Unit"}</span>
                              </div>
                            )}
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs font-bold border-blue-300 text-blue-700 bg-blue-50 opacity-50 cursor-not-allowed" disabled>
                              <History className="h-3 w-3 mr-1" /> Analysis
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs font-semibold border-slate-400 text-slate-700 opacity-50 cursor-not-allowed" disabled>
                              <Save className="h-3 w-3 mr-1" /> Save as Template
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs font-semibold border-slate-400 text-slate-700 opacity-50 cursor-not-allowed" disabled>
                              <MessageSquare className="h-3 w-3 mr-1" /> Comments (0)
                            </Button>
                            <Button variant="destructive" size="sm" className="h-7 w-7 p-0 bg-red-500 opacity-50 cursor-not-allowed" disabled>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* ROW 3: Description (1 line + hover tooltip)  +  HSN  +  SAC */}
                        <div className="flex items-center gap-3">
                          <div className="relative group flex-1 min-w-0">
                            <div className="truncate text-xs text-slate-800 font-semibold bg-white border border-slate-300 rounded px-2.5 py-1.5 cursor-default shadow-sm">
                              {item.finalize_description || item.product_name || "—"}
                            </div>
                            {(item.finalize_description || item.product_name) && (
                              <div className="absolute z-50 bottom-full left-0 mb-2 hidden group-hover:block w-[540px] max-w-[80vw] bg-slate-900 text-white text-[11px] font-medium leading-relaxed rounded-lg shadow-2xl px-4 py-3 pointer-events-none">
                                {item.finalize_description || item.product_name}
                                <div className="absolute top-full left-5 border-[6px] border-transparent border-t-slate-900" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-extrabold text-slate-600 uppercase">HSN:</span>
                            <span className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 min-w-[64px]">
                              {item.hsn_code || "Not Set"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-extrabold text-slate-600 uppercase">SAC:</span>
                            <span className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 min-w-[64px]">
                              {item.sac_code || "Not Set"}
                            </span>
                          </div>
                        </div>

                      </div>

                      {/* ── Expanded material table ── */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            key={`table-${idx}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="overflow-x-auto border-t border-slate-200">
                              <table className="border-collapse text-xs min-w-full">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
                                    <th className="border px-1 py-2 text-center w-8">
                                      <GripVertical className="h-3 w-3 mx-auto text-gray-300" />
                                    </th>
                                    <th className="border px-2 py-2 text-left w-10">Sl</th>
                                    <th className="border px-1 py-2 text-center w-12">Image</th>
                                    <th className="border px-2 py-2 text-left w-56">Item</th>
                                    <th className="border px-2 py-2 text-left w-28">Shop</th>
                                    <th className="border px-2 py-2 text-left w-64">Description</th>
                                    <th className="border px-2 py-2 text-center w-14">Unit</th>
                                    <th className="border px-2 py-2 text-center w-20">
                                      Qty/{item.configBasis?.requiredUnitType || "Sqf"}
                                    </th>
                                    <th className="border px-2 py-2 text-center w-24">Required Qty</th>
                                    <th className="border px-2 py-2 text-center w-20">Round off</th>
                                    <th className="border px-2 py-2 text-center w-24">
                                      Rate/{item.configBasis?.requiredUnitType || "Unit"}
                                    </th>
                                    <th className="border px-2 py-2 text-center w-28 text-green-700">Amount</th>
                                    <th className="border px-2 py-2 text-center w-14">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayLines.length === 0 ? (
                                    <tr>
                                      <td colSpan={13} className="text-center py-4 text-gray-400 italic text-xs">
                                        No material lines found.
                                      </td>
                                    </tr>
                                  ) : (
                                    displayLines.map((line: any, lineIdx: number) => (
                                      <tr key={lineIdx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors text-xs">
                                        <td className="border px-1 py-2 text-center text-gray-300">
                                          <GripVertical className="h-3 w-3 mx-auto" />
                                        </td>
                                        <td className="border px-2 py-2 text-center text-gray-400 font-medium">
                                          {line.s_no || lineIdx + 1}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center bg-gray-50/30">
                                          <div className="w-10 h-10 rounded border border-gray-200 bg-white overflow-hidden flex items-center justify-center mx-auto shadow-sm">
                                            {line.image
                                              ? <img src={line.image} alt="" className="max-w-full max-h-full object-contain" />
                                              : <span className="text-[8px] text-gray-300">N/A</span>
                                            }
                                          </div>
                                        </td>
                                        <td className="border px-2 py-2 text-left">
                                          <div className="font-medium text-gray-900">{line.title || line.name || "-"}</div>
                                          {line.category && line.category !== "General" && (
                                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-tight mt-0.5">
                                              {line.category}
                                            </Badge>
                                          )}
                                          {line.manual && (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0 font-bold uppercase mt-0.5">
                                              Manual
                                            </Badge>
                                          )}
                                        </td>
                                        <td className="border px-2 py-2 text-gray-500">{line.shop_name || "-"}</td>
                                        <td className="border px-2 py-2 text-gray-500 truncate max-w-[250px]" title={line.description || "-"}>
                                          {line.description || "-"}
                                        </td>
                                        <td className="border px-2 py-2 text-center font-medium text-gray-600 uppercase">
                                          {line.unit || "-"}
                                        </td>
                                        <td className="border px-2 py-2 text-center text-gray-600">
                                          {typeof line.qtyPerSqf === "number" ? line.qtyPerSqf.toFixed(3) : (line.qtyPerSqf ?? "-")}
                                        </td>
                                        <td className="border px-2 py-2 text-center text-blue-600 font-medium">
                                          {typeof line.requiredQty === "number" ? line.requiredQty.toFixed(2) : (line.requiredQty ?? "-")}
                                        </td>
                                        <td className="border px-2 py-2 text-center font-bold text-gray-800">
                                          {line.roundOff ?? "-"}
                                        </td>
                                        <td className="border px-2 py-2 text-center text-gray-700 font-medium">
                                          ₹{(line.rateSqft || 0).toLocaleString()}
                                        </td>
                                        <td className="border px-2 py-2 text-center font-bold text-green-700 bg-green-50">
                                          ₹{(line.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="border px-2 py-2 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-400 opacity-50 cursor-not-allowed" disabled>
                                              <MessageSquare className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 opacity-50 cursor-not-allowed" disabled>
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                                <tfoot className="bg-gray-50/50 border-t-2 border-gray-200">
                                  <tr className="text-gray-600 font-medium">
                                    <td colSpan={11} className="border px-2 py-1 text-right uppercase tracking-wider text-[10px]">
                                      Material Sub-total
                                    </td>
                                    <td className="border px-2 py-1 text-right font-semibold">
                                      ₹{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="border px-2 py-1" />
                                  </tr>
                                  <tr className="font-bold bg-blue-50/20 text-blue-900">
                                    <td colSpan={11} className="border px-2 py-1.5 text-right uppercase tracking-wider text-[10px]">
                                      Grand Total
                                    </td>
                                    <td className="border px-2 py-1.5 text-right bg-blue-50/30">
                                      ₹{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="border px-2 py-1.5" />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {/* Rate per unit bar */}
                            <div className="bg-gray-50 px-4 py-2 flex justify-end border-t border-gray-200">
                              <div className="flex items-center gap-4">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">
                                  Rate per {item.requiredUnitType || item.configBasis?.requiredUnitType || "Unit"}:
                                </span>
                                <span className="text-sm font-extrabold text-blue-700 border-b-2 border-blue-600">
                                  ₹{ratePerUnit.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* ── Footer REMOVED as requested ── */}
      </DialogContent>
    </Dialog>
  );
}

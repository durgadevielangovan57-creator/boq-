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

export function ProjectPricingBanner({
  items,
  onApplyAll,
  onApplySingle,
  onIgnoreSingle,
  isUpdating
}: {
  items: any[];
  onApplyAll: () => void | Promise<void>;
  onApplySingle: (m: any) => void;
  onIgnoreSingle: (m: any) => void;
  isUpdating?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (items.length === 0) return null;
  return (
    <div id="project-pricing-banner" className="bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 mb-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-full hidden sm:block">
            {isUpdating ? <Loader2 className="h-5 w-5 text-blue-700 animate-spin" /> : <Star className="h-5 w-5 text-blue-700" />}
          </div>
          <div>
            <div className="font-bold text-blue-900">⚠️ Project Pricing Available!</div>
            <div className="text-blue-700">
              {items.length} {items.length === 1 ? "item" : "items"} in this BOM have Project Pricing available. Do you want to update and use the Project Pricing?
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-blue-300 text-blue-800 hover:bg-blue-100 h-9 font-bold bg-white"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Hide Details" : "View Details"}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 h-9 shadow-sm"
            onClick={onApplyAll}
            disabled={isUpdating}
          >
            {isUpdating ? "Updating as project pricing..." : "Use Project Pricing"}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-blue-200 bg-white/50 p-3 max-h-[250px] overflow-y-auto w-full">
          <table className="w-full text-xs">
            <thead className="text-left text-blue-900/70 border-b border-blue-200">
              <tr>
                <th className="pb-1.5 font-bold uppercase w-[15%]">Product</th>
                <th className="pb-1.5 font-bold uppercase w-[35%]">Item Name</th>
                <th className="pb-1.5 font-bold uppercase text-right w-[15%]">Current Rate</th>
                <th className="pb-1.5 font-bold uppercase text-right w-[15%]">PP Rate</th>
                <th className="pb-1.5 font-bold uppercase text-center w-[20%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {items.map((m, idx) => (
                <tr key={`pp-${m.boqItemId}-${m.type}-${m.index}-${idx}`} className="hover:bg-blue-50/50">
                  <td className="py-1.5 text-slate-500 font-semibold truncate max-w-[120px]" title={m.productName}>{m.productName}</td>
                  <td className="py-1.5 font-bold truncate max-w-[200px]" title={m.name || "Item"}>{m.name || "Item"}</td>
                  <td className="py-1.5 text-right text-slate-600">₹{m.currentRate}</td>
                  <td className="py-1.5 text-right font-bold text-blue-700">₹{m.ppRate}</td>
                  <td className="py-1.5 flex justify-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-slate-500 hover:bg-slate-100 font-bold" onClick={() => onIgnoreSingle(m)}>Ignore</Button>
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5 border-blue-300 text-blue-700 hover:bg-blue-100 font-bold bg-white" onClick={() => onApplySingle(m)}>Use PP</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
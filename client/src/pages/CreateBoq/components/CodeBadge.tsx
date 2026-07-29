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

export function CodeBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-bold text-gray-500 uppercase">{label}:</span>
      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 min-w-[60px]">{value}</span>
    </div>
  );
}
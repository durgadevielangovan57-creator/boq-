import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, ArrowRight, GripVertical, ChevronsUpDown, Check, Layers, Maximize2, Minimize2, Plus, Search } from "lucide-react";
import { fuzzySearch } from "@/lib/utils";
import { computeBoq } from "@/lib/boqCalc";
import apiFetch from "@/lib/api";

// ── Drag-to-resize handle ───────────────────────────────────────────────
function ResizeHandle({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.offsetWidth;
    const startH = el.offsetHeight;

    const onMouseMove = (ev: MouseEvent) => {
      const newW = Math.max(400, startW + (ev.clientX - startX) * 2); // *2 because dialog is centered with translate(-50%)
      const newH = Math.max(300, startH + (ev.clientY - startY) * 2);
      el.style.width = newW + "px";
      el.style.maxWidth = newW + "px";
      el.style.height = newH + "px";
      el.style.maxHeight = newH + "px";
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [containerRef]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute bottom-1 right-1 cursor-nwse-resize p-1 rounded hover:bg-slate-200/60 transition-colors z-50 select-none"
      title="Drag to resize"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" className="text-slate-400">
        <path d="M12 2L2 12M12 6L6 12M12 10L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// A "pending manual item" is a raw step11_items entry (manual: true) that
// has not yet been locked into a Save / Save As approval request.
export type PendingManualItem = {
  index: number; // original index in table_data.step11_items
  id?: string;
  title?: string;
  description?: string;
  unit?: string;
  qty?: number;
  qtyPerSqf?: number;
  supply_rate?: number;
  install_rate?: number;
  shop_name?: string;
  category?: string;
  [key: string]: any;
};

// ── Save (confirm) dialog ───────────────────────────────────────────────

export function SaveConfirmDialog({
  open,
  onOpenChange,
  productName,
  items,
  isSubmitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  items: PendingManualItem[];
  isSubmitting: boolean;
  onConfirm: () => void;
}) {
  const saveDialogRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={saveDialogRef} className="max-w-2xl min-h-[40vh] max-h-[85vh] overflow-hidden flex flex-col border-4 border-slate-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-slate-800">Add Items to Existing Product?</DialogTitle>
          <DialogDescription className="text-base text-slate-500 mt-2">
            You have added <span className="font-bold text-primary">{items.length} new manual item{items.length === 1 ? "" : "s"}</span> to <span className="font-bold text-slate-700">{productName}</span>.
            <br />
            Do you want to add these items to the existing product and submit the changes for approval?
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto rounded-xl border-2 border-slate-200 divide-y bg-white shadow-inner min-h-0">
          {items.map((it) => (
            <div key={it.index} className="px-5 py-4 text-base flex items-center justify-between hover:bg-slate-50 transition-colors">
              <span className="font-bold text-slate-700">{it.title || it.description || "Untitled item"}</span>
              <span className="text-slate-400 font-semibold">{it.unit || ""}</span>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="h-12 px-6 font-bold text-slate-600 border-2">Cancel</Button>
          <Button onClick={onConfirm} disabled={isSubmitting} className="h-12 px-8 font-black text-white bg-primary hover:bg-primary/90 shadow-md">
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Yes, Add & Submit
          </Button>
        </DialogFooter>
        <ResizeHandle containerRef={saveDialogRef} />
      </DialogContent>
    </Dialog>
  );
}

// ── Save As wizard dialog ───────────────────────────────────────────────
// Step 1: Product Name / Category / Subcategory (unchanged).
// Step 2: "Configuration" — a full-screen dialog that mirrors the Manage
// Product configuration screen (description, dims, item table with
// per-item wastage / round-off, live totals) so item details — including
// the product description — are captured and submitted exactly the same
// way Manage Product does it.

type ItemConfig = {
  selected: boolean;
  qty: number;
  wastagePct: number;
  supplyRate: number;
  installRate: number;
  freezeAndEdit: boolean;
  applyWastage: boolean;
  applyRounding: boolean;
  description: string;
};

export function SaveAsWizardDialog({
  open,
  onOpenChange,
  sourceProductName,
  items,
  isSubmitting,
  existingProductNames,
  onSubmit,
  mode = "save_as",
  onSubmitSave,
  preDeletedIndexes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceProductName: string;
  items: PendingManualItem[];
  isSubmitting: boolean;
  existingProductNames: string[];
  onSubmit: (payload: { newProductName: string; selectedIndexes: number[]; items: any[]; calculatedResults: any; productConfig?: any; description?: string }) => void;
  /** "save_as" (default, unchanged): build a brand-new product from the
   * selected items. "save": edit THIS existing product in place — skips
   * the product-name step, and adds a delete toggle so existing materials
   * can be removed (not just new ones added), all submitted together for
   * approval. */
  mode?: "save_as" | "save";
  onSubmitSave?: (payload: { addedIndexes: number[]; deletedIndexes: number[]; editedItems: { index: number; patch: any }[]; deletedMaterialIndexes?: number[]; editedMaterialIndexes?: { index: number; patch: any }[] }) => void;
  preDeletedIndexes?: number[];
}) {
  const [step, setStep] = useState<1 | 2>(mode === "save" ? 2 : 1);
  // ── Save mode only: existing materials marked for removal. They stay
  // visible in the table (styled red / struck-through) rather than
  // disappearing, so the admin approval view can show a clear diff. ──
  const [deletedIndexes, setDeletedIndexes] = useState<Set<number>>(new Set());

  // Re-initialize when opened
  useEffect(() => {
    if (open) {
      setStep(mode === "save" ? 2 : 1);
      setDeletedIndexes(new Set(preDeletedIndexes || []));
    }
  }, [open, mode, preDeletedIndexes]);
  const [newProductName, setNewProductName] = useState("");
  const [nameError, setNameError] = useState("");
  const [configByIndex, setConfigByIndex] = useState<Record<number, ItemConfig>>({});

  // ── Category / Subcategory (required for the new product being created) ──
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");

  // ── Product description (Configuration step — must be saved) ──
  const [productDescription, setProductDescription] = useState("");

  // ── Full-screen toggle for the Configuration step ──
  const [isMaximized, setIsMaximized] = useState(true);
  const [isCompactView, setIsCompactView] = useState(false);

  // Load the same category list used elsewhere in the app (Manage Product, etc.)
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadingCategories(true);
      try {
        const res = await apiFetch("/api/material-categories");
        if (res.ok) {
          const d = await res.json();
          setCategories(Array.isArray(d.categories) ? d.categories : []);
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, [open]);

  // Load subcategories whenever the chosen category changes
  useEffect(() => {
    if (!category) { setSubcategories([]); return; }
    (async () => {
      setLoadingSubcategories(true);
      try {
        const res = await apiFetch(`/api/material-subcategories/${encodeURIComponent(category)}`);
        if (res.ok) {
          const d = await res.json();
          setSubcategories(Array.isArray(d.subcategories) ? d.subcategories : []);
        }
      } catch (err) {
        console.error("Failed to load subcategories:", err);
      } finally {
        setLoadingSubcategories(false);
      }
    })();
  }, [category]);

  const [dimA, setDimA] = useState<number | undefined>();
  const [dimB, setDimB] = useState<number | undefined>();
  const [dimC, setDimC] = useState<number | undefined>();
  const [requiredUnitType, setRequiredUnitType] = useState("Sqft");
  const [baseRequiredQty, setBaseRequiredQty] = useState(1);
  const [wastagePctDefault, setWastagePctDefault] = useState(0);

  // ── Unit Type options — mirrors Manage Product's Step 3 "Unit Type"
  // dropdown exactly: same defaults + any additional units found on
  // materials in the catalog, deduped and sorted. ──
  const [unitTypeMaterials, setUnitTypeMaterials] = useState<any[]>([]);
  useEffect(() => {
    if (!open || unitTypeMaterials.length > 0) return;
    (async () => {
      try {
        const res = await apiFetch("/api/materials");
        if (res.ok) {
          const d = await res.json();
          setUnitTypeMaterials(Array.isArray(d) ? d : (d.materials || []));
        }
      } catch (err) {
        console.error("Failed to load materials for unit types:", err);
      }
    })();
  }, [open]);

  const availableUnitTypes = useMemo(() => {
    const defaults = ["Sqft", "Sqmt", "Length", "LS", "RFT", "RMT"];
    const finalUnits = [...defaults];
    (unitTypeMaterials || []).map((m: any) => m.unit?.trim()).filter(Boolean).forEach((u: string) => {
      const lowerU = u.toLowerCase();
      const isSqftVariant = lowerU === "sft" || lowerU === "sqft";
      const hasSqftVariant = finalUnits.some(fu => { const lfu = fu.toLowerCase(); return lfu === "sft" || lfu === "sqft"; });
      if (isSqftVariant && hasSqftVariant) return;
      if (!finalUnits.some(fu => fu.toLowerCase() === lowerU)) finalUnits.push(u);
    });
    return finalUnits.sort();
  }, [unitTypeMaterials]);

  const [addItemOpen, setAddItemOpen] = useState(false);

  // ── Add Item (master catalog) — mirrors Manage Product's "Add Additional
  // Materials" dialog so a genuinely new material can be brought in here too,
  // not just a previously removed row from this same list. ──
  const [extraItems, setExtraItems] = useState<PendingManualItem[]>([]);
  const nextExtraIndexRef = useRef(-1);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");

  useEffect(() => {
    if (!addItemOpen || availableMaterials.length > 0) return;
    (async () => {
      setLoadingMaterials(true);
      try {
        const res = await apiFetch("/api/materials");
        if (res.ok) {
          const d = await res.json();
          setAvailableMaterials(Array.isArray(d) ? d : (d.materials || []));
        }
      } catch (err) {
        console.error("Failed to load materials:", err);
      } finally {
        setLoadingMaterials(false);
      }
    })();
  }, [addItemOpen]);

  const uniqueMaterials = useMemo(
    () => Array.from(new Map(availableMaterials.map((m: any) => [(m.id || m.name || Math.random()).toString(), m])).values()),
    [availableMaterials]
  );

  const addNewMaterial = (material: any) => {
    if (allItems.some((it) => it.id && it.id === material.id && configByIndex[it.index]?.selected)) return;
    const rate = Number(material.rate) || 0;
    const index = nextExtraIndexRef.current--;
    const newItem: PendingManualItem = {
      index,
      id: material.id,
      title: material.name,
      description: material.technicalspecification || material.name || "",
      unit: material.unit,
      shop_name: material.shop_name,
      shop_id: material.shop_id || material.shopId,
      category: material.category,
      supply_rate: rate,
      install_rate: 0,
      wastagePct: wastagePctDefault,
    };
    setExtraItems((prev) => [...prev, newItem]);
    setConfigByIndex((prev) => ({
      ...prev,
      [index]: {
        selected: true,
        qty: 1,
        wastagePct: wastagePctDefault,
        supplyRate: rate,
        installRate: 0,
        freezeAndEdit: false,
        applyWastage: true,
        applyRounding: true,
        description: newItem.description || newItem.title || "",
      },
    }));
  };


  useEffect(() => {
    if (dimA !== undefined || dimB !== undefined || dimC !== undefined) {
      setBaseRequiredQty((Number(dimA) || 1) * (Number(dimB) || 1) * (Number(dimC) || 1));
    }
  }, [dimA, dimB, dimC]);

  const prevOpenRef = React.useRef(false);
  useEffect(() => {
    // Only reset when the dialog first opens (open transitions false → true).
    // This prevents parent re-renders (which create new `items` refs) from
    // resetting the wizard back to step 1 while the user is on step 2.
    if (!open) { prevOpenRef.current = false; return; }
    if (prevOpenRef.current) return;          // already open — skip reset
    prevOpenRef.current = true;
    setStep(mode === "save" ? 2 : 1);
    setDeletedIndexes(new Set());
    setNewProductName("");
    setNameError("");
    setCategory("");
    setSubcategory("");
    setCategoryError("");
    setProductDescription("");
    setDimA(undefined);
    setDimB(undefined);
    setDimC(undefined);
    setRequiredUnitType("Sqft");
    setBaseRequiredQty(1);
    setWastagePctDefault(0);
    setIsMaximized(true);
    setIsCompactView(false);
    setExtraItems([]);
    nextExtraIndexRef.current = -1;
    setAvailableMaterials([]);
    setMaterialSearch("");
    const initial: Record<number, ItemConfig> = {};
    items.forEach((it) => {
      initial[it.index] = {
        selected: true,
        // qtyPerSqf is the per-unit qty from renderLines (engine-computed or manual)
        qty: Number(it.qtyPerSqf ?? it.qty ?? 0) || 0,
        wastagePct: Number(it.wastagePct) || 0,
        // renderLines stores rates as rateSqft (total rate), but individual supply/install
        // rates come from supply_rate / install_rate
        supplyRate: Number(it.supply_rate ?? (it as any).supplyRate ?? 0) || 0,
        installRate: Number(it.install_rate ?? (it as any).installRate ?? 0) || 0,
        freezeAndEdit: !!(it.freezeAndEdit || (it as any).freeze_and_edit),
        applyWastage: (it as any).applyWastage !== false,
        applyRounding: (it as any).applyRounding !== false,
        description: it.description || it.title || "",
      };
    });
    setConfigByIndex(initial);
  }, [open, items]);

  // All items available to this wizard: the original manual items passed in,
  // plus any brand-new materials brought in via "+ Add Item" (master catalog).
  const allItems = useMemo(() => [...items, ...extraItems], [items, extraItems]);

  const selectedItems = useMemo(() => allItems.filter((it) => configByIndex[it.index]?.selected), [allItems, configByIndex]);
  const removedItems = useMemo(() => allItems.filter((it) => configByIndex[it.index] && !configByIndex[it.index]?.selected), [allItems, configByIndex]);

  // Reuse the existing calculation engine (client/src/lib/boqCalc.ts) — a single
  // call over every included line, same as Manage Product, so totals / rate-per-unit
  // and per-line wastage & round-off math match exactly.
  const boqResult = useMemo(() => {
    const lines = selectedItems.map((it) => {
      const cfg = configByIndex[it.index];
      return {
        _index: it.index,
        id: it.id,
        name: it.title || it.description,
        unit: it.unit,
        location: it.shop_name || "Main Area",
        shop_name: it.shop_name,
        shop_id: it.shop_id,
        description: cfg?.description || it.description || it.title,
        baseQty: Number(cfg?.qty) || 0,
        wastagePct: cfg?.wastagePct,
        supplyRate: Number(cfg?.supplyRate) || 0,
        installRate: Number(cfg?.installRate) || 0,
        applyWastage: cfg?.applyWastage !== false,
        applyRounding: cfg?.applyRounding !== false,
        freezeAndEdit: cfg?.freezeAndEdit,
      };
    });
    return computeBoq({ requiredUnitType, baseRequiredQty, wastagePctDefault }, lines, baseRequiredQty);
  }, [selectedItems, configByIndex, requiredUnitType, baseRequiredQty, wastagePctDefault]);

  const computedResults = useMemo(
    () => selectedItems.map((it) => ({
      item: it,
      cfg: configByIndex[it.index],
      line: boqResult.computed.find((c: any) => c._index === it.index),
    })),
    [selectedItems, configByIndex, boqResult]
  );

  const grandTotal = boqResult.grandTotal;

  const updateConfig = (index: number, patch: Partial<ItemConfig>) => {
    setConfigByIndex((prev) => ({ ...prev, [index]: { ...prev[index], ...patch } }));
  };

  const removeItem = (index: number) => updateConfig(index, { selected: false });
  const addBackItem = (index: number) => {
    updateConfig(index, { selected: true });
    setAddItemOpen(false);
  };

  const goNext = () => {
    if (step === 1) {
      const trimmed = newProductName.trim();
      if (!trimmed) { setNameError("Product name is required"); return; }
      if (existingProductNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
        setNameError("A product with this name already exists in this BOM. Choose a different name.");
        return;
      }
      setNameError("");
      if (!category) { setCategoryError("Category is required"); return; }
      setCategoryError("");
    }
    setStep((s) => (Math.min(2, s + 1) as 1 | 2));
  };
  const goBack = () => setStep((s) => (Math.max(1, s - 1) as 1 | 2));

  const handleSubmit = () => {
    if (selectedItems.length === 0) return;
    const payload = {
      newProductName: newProductName.trim(),
      selectedIndexes: selectedItems.map((it) => it.index),
      description: productDescription,
      items: computedResults.map(({ item, cfg, line }) => ({
        // Identity
        id: item.id || item.materialId,
        materialId: item.materialId || item.id,
        title: item.title || item.description,
        name: item.title || item.description,
        description: cfg.description || item.description || item.title,
        // Manage Product / product_approvals store the per-item free-text
        // description under "location" (step11_product_items.location) —
        // mirror it here so it survives approval instead of being dropped.
        location: cfg.description || item.description || item.title,
        unit: item.unit,
        shop_name: item.shop_name,
        shop_id: item.shop_id,
        category: item.category,
        // Per-unit qty (the qty-per-base-unit configured in the Configuration step)
        qty: cfg.qty,
        qtyPerSqf: cfg.qty,
        baseQty: cfg.qty,
        // Wastage & round-off / freeze settings
        wastagePct: cfg.wastagePct,
        freezeAndEdit: cfg.freezeAndEdit,
        applyWastage: cfg.applyWastage,
        applyRounding: cfg.applyRounding,
        // Rates
        supply_rate: cfg.supplyRate,
        install_rate: cfg.installRate,
        supplyRate: cfg.supplyRate,
        installRate: cfg.installRate,
        // Pre-computed amounts (for display / fallback)
        requiredQty: line?.roundOffQty ?? cfg.qty,
        roundOff: line?.roundOffQty ?? cfg.qty,
        wastageQty: line?.wastageQty ?? 0,
        amount: line?.lineTotal ?? 0,
      })),
      calculatedResults: {
        totalSupply: boqResult.totalSupply,
        totalInstall: boqResult.totalInstall,
        grandTotal,
        ratePerUnit: boqResult.ratePerUnit,
      },
      productConfig: {
        dimA,
        dimB,
        dimC,
        requiredUnitType,
        baseRequiredQty,
        wastagePctDefault,
        category,
        subcategory,
        description: productDescription,
      }
    };
    onSubmit(payload);
  };

  // ── Save mode: submit added / edited / deleted materials on THIS
  // existing product for approval (no new product is created). ──────────
  const handleSubmitSaveEdit = () => {
    if (!onSubmitSave) return;
    const addedIdx: number[] = [];
    const editedItemsOut: { index: number; patch: any }[] = [];
    const deletedMaterialIdx: number[] = [];
    // Edits to existing materialLines (qty/description/freeze/rate etc.)
    // route through their own list, keyed by _materialIdx — same reasoning
    // as deletedMaterialIndexes: materialLines is a separate array/index-space
    // from step11_items, and these rows share a synthetic index sentinel
    // that isn't a real position in tableData.materialLines.
    const editedMaterialIdx: { index: number; patch: any }[] = [];

    computedResults.forEach(({ item, cfg }) => {
      const isEngineLine = (item as any)._materialIdx !== undefined && (item as any)._s11Idx === undefined;

      // If deleted, we don't need to add it to editedItems or addedIdx.
      // deletedIndexes is passed separately (materialLine deletions go out
      // through their own deletedMaterialIndexes list, keyed by _materialIdx
      // since these items share a synthetic negative `index` sentinel that
      // isn't a real position in tableData.materialLines).
      if (deletedIndexes.has(item.index)) {
        if (isEngineLine) {
          deletedMaterialIdx.push((item as any)._materialIdx);
        }
        return;
      }

      const isFreshAdd = !isEngineLine && item.manual === true && !item.manualApproval;

      if (isFreshAdd) {
        addedIdx.push(item.index);
      }
      // Existing item (or fresh add) — compare against its original persisted values to
      // detect an edit worth submitting.
      const origQty = Number((item as any).qtyPerSqf ?? item.qty ?? 0) || 0;
      const origWastage = Number((item as any).wastagePct) || 0;
      const origSupply = Number((item as any).supply_rate ?? (item as any).supplyRate ?? 0) || 0;
      const origInstall = Number((item as any).install_rate ?? (item as any).installRate ?? 0) || 0;
      const origFreeze = !!((item as any).freezeAndEdit || (item as any).freeze_and_edit);
      const origApplyWastage = (item as any).applyWastage !== false;
      const origApplyRounding = (item as any).applyRounding !== false;
      const origDescription = (item as any).description || (item as any).title || "";
      const changed = cfg.qty !== origQty || cfg.wastagePct !== origWastage || cfg.supplyRate !== origSupply
        || cfg.installRate !== origInstall || cfg.freezeAndEdit !== origFreeze || cfg.applyWastage !== origApplyWastage
        || cfg.applyRounding !== origApplyRounding || (cfg.description || "") !== origDescription;

      if (!changed) return;

      const patch = {
        qty: cfg.qty,
        qtyPerSqf: cfg.qty,
        baseQty: cfg.qty,
        wastagePct: cfg.wastagePct,
        freezeAndEdit: cfg.freezeAndEdit,
        applyWastage: cfg.applyWastage,
        applyRounding: cfg.applyRounding,
        supply_rate: cfg.supplyRate,
        install_rate: cfg.installRate,
        supplyRate: cfg.supplyRate,
        installRate: cfg.installRate,
        description: cfg.description || origDescription,
      };

      if (isEngineLine) {
        // Fresh additions of engine lines aren't a real thing (they'd have
        // come in via addedIdx/step11 instead), so any changed engine line
        // here is always an edit to a pre-existing material.
        editedMaterialIdx.push({ index: (item as any)._materialIdx, patch });
        return;
      }

      editedItemsOut.push({ index: item.index, patch });
    });

    // Filter deletedIndexes to only include step11 items (not engine/materialLine items)
    const step11DeletedIndexes = Array.from(deletedIndexes).filter(idx => {
      const item = allItems.find(it => it.index === idx);
      return !item || (item as any)._s11Idx !== undefined;
    });

    onSubmitSave({
      addedIndexes: addedIdx,
      deletedIndexes: step11DeletedIndexes,
      editedItems: editedItemsOut,
      deletedMaterialIndexes: deletedMaterialIdx,
      editedMaterialIndexes: editedMaterialIdx,
    } as any);
  };

  const stepLabels = ["Product Name", "Configuration"];

  const wizardDialogRef = useRef<HTMLDivElement>(null);

  const dialogSizeClass = step === 1
    ? "w-[90vw] max-w-4xl max-h-[90vh]"
    : isMaximized
      ? "w-screen h-screen max-w-none max-h-none rounded-none"
      : "w-[96vw] max-w-[1400px] h-[92vh] max-h-[92vh]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={wizardDialogRef} className={`${dialogSizeClass} overflow-hidden flex flex-col border-4 border-slate-200 shadow-2xl p-4 sm:p-6 transition-all`}>
        {step === 1 && (
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-800">
              {newProductName.trim() ? newProductName.trim() : "Save As New Product"}
            </DialogTitle>
            <DialogDescription className="text-base">
              Source Product: <span className="font-bold text-primary">{sourceProductName}</span>
            </DialogDescription>
          </DialogHeader>
        )}

        {step === 2 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border-2 border-primary/10 shadow-sm shrink-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{mode === "save" ? "Editing Product" : "Configuration For"}</h3>
                <p className="text-2xl font-extrabold text-slate-900">{mode === "save" ? sourceProductName : (newProductName || "New Product")}</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
              <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Compact View</span>
                <Checkbox checked={isCompactView} onCheckedChange={(val) => setIsCompactView(!!val)} />
              </div>
              <div className="text-center md:text-right">
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Cost (for {baseRequiredQty} {requiredUnitType})</h3>
                <p className="text-3xl font-black text-slate-900">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center md:text-right bg-primary/5 px-6 py-3 rounded-xl border border-primary/20">
                <h3 className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Final Rate per {requiredUnitType}</h3>
                <p className="text-4xl font-black text-primary">₹{boqResult.ratePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                title={isMaximized ? "Restore" : "Full screen"}
                onClick={() => setIsMaximized((v) => !v)}
              >
                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {mode !== "save" && (
          <div className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-2 shrink-0">
            {stepLabels.map((label, i) => (
              <React.Fragment key={label}>
                <span className={i + 1 === step ? "text-primary" : i + 1 < step ? "text-slate-600" : ""}>{i + 1}. {label}</span>
                {i < stepLabels.length - 1 && <span className="text-slate-300">›</span>}
              </React.Fragment>
            ))}
          </div>
        )}
        {mode === "save" && (
          <div className="flex items-center gap-4 text-[11px] font-bold mb-2 shrink-0">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-50 border border-emerald-200 inline-block" /> New material</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-50 border border-red-200 inline-block" /> Marked for removal</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-cyan-100 border border-cyan-200 inline-block" /> Freeze & Edit</span>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 mt-4">
            <div className="space-y-3">
              <Label htmlFor="new-product-name" className="text-sm font-bold uppercase text-slate-500">Product Name</Label>
              <Input
                id="new-product-name"
                placeholder="e.g. ABC Panelling Premium"
                className="h-12 text-lg font-bold border-2 border-slate-200 focus-visible:border-primary"
                value={newProductName}
                onChange={(e) => { setNewProductName(e.target.value); setNameError(""); }}
                autoFocus
              />
              {nameError && <p className="text-sm text-red-600 font-bold">{nameError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase text-slate-500">Category</Label>
                <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={loadingCategories}
                      className="h-11 w-full justify-between font-bold border-2 border-slate-200"
                    >
                      <span className={category ? "" : "text-slate-400 font-normal"}>
                        {category || (loadingCategories ? "Loading..." : "Select category")}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent style={{ width: "var(--radix-popover-trigger-width)" }} className="p-0" align="start" side="bottom">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search category..." value={categorySearch} onValueChange={setCategorySearch} />
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty>No categories found.</CommandEmpty>
                        <CommandGroup>
                          {categories
                            .filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()))
                            .map((c) => (
                              <CommandItem
                                key={c}
                                value={c}
                                onSelect={() => { setCategory(c); setSubcategory(""); setCategoryError(""); setCategoryOpen(false); setCategorySearch(""); }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${category === c ? "opacity-100" : "opacity-0"}`} />
                                {c}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase text-slate-500">Subcategory</Label>
                <Popover open={subcategoryOpen} onOpenChange={setSubcategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={!category || loadingSubcategories}
                      className="h-11 w-full justify-between font-bold border-2 border-slate-200"
                    >
                      <span className={subcategory ? "" : "text-slate-400 font-normal"}>
                        {subcategory || (!category ? "Select category first" : loadingSubcategories ? "Loading..." : subcategories.length === 0 ? "No subcategories" : "Select subcategory")}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent style={{ width: "var(--radix-popover-trigger-width)" }} className="p-0" align="start" side="bottom">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search subcategory..." value={subcategorySearch} onValueChange={setSubcategorySearch} />
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty>No subcategories found.</CommandEmpty>
                        <CommandGroup>
                          {subcategories
                            .filter(s => s.toLowerCase().includes(subcategorySearch.toLowerCase()))
                            .map((s) => (
                              <CommandItem
                                key={s}
                                value={s}
                                onSelect={() => { setSubcategory(s); setSubcategoryOpen(false); setSubcategorySearch(""); }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${subcategory === s ? "opacity-100" : "opacity-0"}`} />
                                {s}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {categoryError && <p className="text-sm text-red-600 font-bold">{categoryError}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 mt-1 flex flex-col flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 p-6 bg-white rounded-xl border shadow-sm items-end">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Unit Type</label>
                <Select value={requiredUnitType} onValueChange={(v) => setRequiredUnitType(v)}>
                  <SelectTrigger className="font-bold"><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {availableUnitTypes.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-5 space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Product Description</label>
                <Textarea placeholder="Enter a description..." value={productDescription} onChange={(e) => setProductDescription(e.target.value)} className="min-h-[80px] font-medium" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Dim A</label>
                <Input type="number" value={dimA ?? ""} onChange={(e) => setDimA(e.target.value ? Number(e.target.value) : undefined)} placeholder="A" className="font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Dim B</label>
                <Input type="number" value={dimB ?? ""} onChange={(e) => setDimB(e.target.value ? Number(e.target.value) : undefined)} placeholder="B" className="font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Dim C</label>
                <Input type="number" value={dimC ?? ""} onChange={(e) => setDimC(e.target.value ? Number(e.target.value) : undefined)} placeholder="C" className="font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Basis Qty</label>
                <Input type="number" value={baseRequiredQty} onChange={(e) => setBaseRequiredQty(Number(e.target.value) || 0)} className="font-bold bg-muted/30" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Wastage %</label>
                <Input
                  type="number"
                  value={wastagePctDefault}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setWastagePctDefault(v);
                    setConfigByIndex((prev) => {
                      const next = { ...prev };
                      selectedItems.forEach((it) => { if (next[it.index]?.applyWastage) next[it.index] = { ...next[it.index], wastagePct: v }; });
                      return next;
                    });
                  }}
                  className="font-bold border-orange-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground invisible">Actions</label>
                <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full h-10 px-4 text-xs font-bold text-primary border-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2">
                      <Plus className="h-4 w-4" /> Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                    <DialogHeader><DialogTitle className="text-xl font-bold">Add Items</DialogTitle></DialogHeader>

                    {removedItems.length > 0 && (
                      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Removed from this list — tap to restore</p>
                        <div className="flex flex-wrap gap-2">
                          {removedItems.map((it) => (
                            <button
                              key={it.index}
                              type="button"
                              onClick={() => addBackItem(it.index)}
                              className="text-xs font-bold px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-white hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                            >
                              <Plus className="h-3 w-3" /> {it.title || it.description || "Untitled item"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search materials by name or code..." className="pl-10 h-10" value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} />
                    </div>
                    <div className="overflow-y-auto border rounded-xl flex-1">
                      <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="font-bold">Material Name</TableHead>
                            <TableHead className="font-bold">Unit</TableHead>
                            <TableHead className="font-bold">Shop</TableHead>
                            <TableHead className="font-bold">Rate</TableHead>
                            <TableHead className="text-right font-bold pr-6">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingMaterials ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                          ) : uniqueMaterials.filter((m: any) => fuzzySearch(materialSearch, [m.name || "", m.code || ""])).length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No materials found.</TableCell></TableRow>
                          ) : uniqueMaterials.filter((m: any) => fuzzySearch(materialSearch, [m.name || "", m.code || ""])).map((material: any) => {
                            const alreadyAdded = allItems.some((it) => it.id && it.id === material.id && configByIndex[it.index]?.selected);
                            return (
                              <TableRow key={material.id} className="hover:bg-muted/10">
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <span>{material.name}</span>
                                    {material.is_project_pricing && (
                                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider">Project Pricing</Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">Code: {material.code || material.id}</div>
                                </TableCell>
                                <TableCell>{material.unit || "-"}</TableCell>
                                <TableCell>{material.shop_name || "-"}</TableCell>
                                <TableCell className="font-bold text-[13px]">₹{Number(material.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right pr-4">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={alreadyAdded}
                                    className="h-8 text-xs font-bold border-primary text-primary hover:bg-primary hover:text-white disabled:opacity-50"
                                    onClick={() => addNewMaterial(material)}
                                  >
                                    {alreadyAdded ? "Added" : "Add"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="rounded-xl border shadow-sm overflow-x-auto bg-white min-h-[320px]">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead className="w-[40px] font-bold">Sl</TableHead>
                    <TableHead className="w-[40px] font-bold"></TableHead>
                    <TableHead className="font-bold py-4">Item</TableHead>
                    <TableHead className="w-[100px] font-bold">Shop</TableHead>
                    {!isCompactView && <TableHead className="w-[120px] font-bold">Item Description</TableHead>}
                    <TableHead className="w-[60px] font-bold">Unit</TableHead>
                    <TableHead className="w-[120px] font-bold text-center">Qty / {baseRequiredQty} {requiredUnitType}</TableHead>
                    <TableHead className="w-[120px] font-bold">Rate / Material Unit</TableHead>
                    {!isCompactView && (
                      <>
                        <TableHead className="w-[110px] font-bold">Base Amount</TableHead>
                        <TableHead className="w-[70px] font-bold">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px]">Wastage</span>
                            <Checkbox
                              checked={selectedItems.length > 0 && selectedItems.every((it) => configByIndex[it.index]?.applyWastage)}
                              onCheckedChange={(checked) => setConfigByIndex((prev) => {
                                const next = { ...prev };
                                selectedItems.forEach((it) => { next[it.index] = { ...next[it.index], applyWastage: !!checked }; });
                                return next;
                              })}
                            />
                          </div>
                        </TableHead>
                        <TableHead className="w-[70px] font-bold">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px]">Round Off</span>
                            <Checkbox
                              checked={selectedItems.length > 0 && selectedItems.every((it) => configByIndex[it.index]?.applyRounding)}
                              onCheckedChange={(checked) => setConfigByIndex((prev) => {
                                const next = { ...prev };
                                selectedItems.forEach((it) => { next[it.index] = { ...next[it.index], applyRounding: !!checked }; });
                                return next;
                              })}
                            />
                          </div>
                        </TableHead>
                        <TableHead className="w-[80px] font-bold">Wastage %</TableHead>
                        <TableHead className="w-[80px] font-bold">Wastage Qty</TableHead>
                        <TableHead className="w-[90px] font-bold">Total Qty</TableHead>
                      </>
                    )}
                    <TableHead className="w-[80px] font-bold">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-center leading-tight">Freeze &<br />Edit</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-[90px] font-bold">Final Amount</TableHead>
                    {!isCompactView && <TableHead className="w-[90px] font-bold">Per {requiredUnitType} Qty</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computedResults.map(({ item: it, cfg, line }, idx) => {
                    const rate = (cfg?.supplyRate || 0) + (cfg?.installRate || 0);
                    const baseAmt = (cfg?.qty || 0) * rate;
                    const isFreezed = !!cfg?.freezeAndEdit;
                    const isFreshAdd = mode === "save" && it.manual === true && !it.manualApproval;
                    const isMarkedDeleted = mode === "save" && deletedIndexes.has(it.index);
                    const rowClass = isMarkedDeleted
                      ? "bg-red-50 border-red-200 line-through opacity-60"
                      : isFreshAdd
                        ? "bg-emerald-50 border-emerald-200"
                        : isFreezed
                          ? "bg-cyan-100 border-cyan-200"
                          : "bg-white";
                    // "save" mode supports deleting AND editing both step11_items
                    // (it._s11Idx) and engine material-line rows (it._materialIdx) — the
                    // latter cover the product's pre-existing/original materials. Edits
                    // made below (qty/description/rate/wastage/freeze) are diffed against
                    // the original values in handleSubmitSaveEdit and, for engine lines,
                    // go out via editedMaterialIndexes so they go through the same
                    // admin-approval flow as everything else here.
                    const isEngineLine = mode === "save" && (it as any)._s11Idx === undefined && (it as any)._materialIdx !== undefined;
                    const isEngineLineInSaveMode = mode === "save" && (it as any)._s11Idx === undefined && (it as any)._materialIdx === undefined;
                    return (
                      <TableRow key={`${it._s11Idx !== undefined ? "s11" : "ml"}-${it.index}-${idx}`} className={`hover:bg-muted/5 transition-colors border-b ${rowClass}`}>
                        <TableCell className="text-center cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                        </TableCell>
                        <TableCell className="text-center font-medium text-[10px]">{idx + 1}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isEngineLineInSaveMode}
                            title={isEngineLineInSaveMode ? "Engine materials aren't editable here" : isMarkedDeleted ? "Undo delete" : (mode === "save" && (it.index >= 0 || isEngineLine)) ? "Delete this material" : "Remove"}
                            onClick={() => {
                              if (isEngineLineInSaveMode) return;
                              if (mode === "save" && (it.index >= 0 || isEngineLine)) {
                                setDeletedIndexes((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(it.index)) next.delete(it.index); else next.add(it.index);
                                  return next;
                                });
                              } else {
                                removeItem(it.index);
                              }
                            }}
                            className={`h-6 w-6 p-0 hover:bg-red-50 ${isEngineLineInSaveMode ? "opacity-30 cursor-not-allowed" : isMarkedDeleted ? "text-emerald-600 hover:text-emerald-700" : "text-red-500 hover:text-red-700"}`}
                          >
                            <span className="text-xs font-bold">{isMarkedDeleted ? "↺" : "×"}</span>
                          </Button>
                        </TableCell>
                        <TableCell className="font-semibold text-[10px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{it.title || it.description || "Untitled item"}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[300px] break-words">
                                <p className="text-xs font-bold">{it.title || it.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{it.shop_name || "N/A"}</TableCell>
                        {!isCompactView && (
                          <TableCell>
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full">
                                    <Input value={cfg?.description ?? ""} onChange={(e) => updateConfig(it.index, { description: e.target.value })} className="h-8 border-muted text-[10px] px-2 truncate" />
                                  </div>
                                </TooltipTrigger>
                                {cfg?.description && (
                                  <TooltipContent className="max-w-xs break-words whitespace-normal text-xs p-3">
                                    {cfg.description}
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        )}
                        <TableCell className="text-[10px] font-medium">{it.unit}</TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Input type="number" value={cfg?.qty ?? 0} onChange={(e) => updateConfig(it.index, { qty: Number(e.target.value) || 0 })} className="h-8 border-muted text-[11px] px-2 font-bold w-20 text-center" />
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] font-bold">₹{rate.toLocaleString()}</TableCell>
                        {!isCompactView && (
                          <>
                            <TableCell className="text-[10px] font-bold">₹{baseAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-center"><Checkbox checked={!!cfg?.applyWastage} onCheckedChange={(checked) => updateConfig(it.index, { applyWastage: !!checked })} /></TableCell>
                            <TableCell className="text-center"><Checkbox checked={!!cfg?.applyRounding} onCheckedChange={(checked) => updateConfig(it.index, { applyRounding: !!checked })} /></TableCell>
                            <TableCell>
                              <Input type="number" value={cfg?.wastagePct ?? ""} onChange={(e) => updateConfig(it.index, { wastagePct: e.target.value ? Number(e.target.value) : 0 })} placeholder="Global" className="h-8 border-orange-200 text-[10px] px-2 font-bold w-full" />
                            </TableCell>
                            <TableCell className="text-[10px] font-bold text-orange-600">{(line?.wastageQty ?? 0).toFixed(2)}</TableCell>
                            <TableCell className="text-[10px] font-bold">{(line?.roundOffQty ?? cfg?.qty ?? 0).toFixed(2)}</TableCell>
                          </>
                        )}
                        <TableCell className="text-center">
                          <Checkbox checked={!!cfg?.freezeAndEdit} onCheckedChange={(checked) => updateConfig(it.index, { freezeAndEdit: !!checked })} />
                        </TableCell>
                        <TableCell className="text-[10px] font-bold text-blue-600">₹{(line?.lineTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        {!isCompactView && <TableCell className="text-[10px] font-bold text-primary">{(line?.perUnitQty ?? 0).toFixed(4)}</TableCell>}
                      </TableRow>
                    );
                  })}
                  {computedResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isCompactView ? 10 : 18} className="text-center py-6 text-muted-foreground italic">
                        No items selected. Use "+ Add Item" to bring one back.
                      </TableCell>
                    </TableRow>
                  )}
                  {computedResults.length > 0 && (
                    <TableRow className="bg-muted/20 font-black">
                      <TableCell colSpan={isCompactView ? 9 : 16} className="text-right py-3 pr-4">Total (Incl. Wastage)</TableCell>
                      <TableCell className="text-[11px] text-primary">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      {!isCompactView && <TableCell></TableCell>}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {selectedItems.length === 0 && <p className="text-sm text-red-600 font-bold">Select at least one item to submit.</p>}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 shrink-0">
          <div>
            {step > 1 && mode !== "save" && (
              <Button variant="outline" onClick={goBack} disabled={isSubmitting}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            {step < 2 ? (
              <Button onClick={goNext} disabled={isSubmitting}>
                Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : mode === "save" ? (
              <Button
                onClick={handleSubmitSaveEdit}
                disabled={isSubmitting}
                className="bg-primary text-white"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Submit for Approval
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting || selectedItems.length === 0} className="bg-primary text-white">
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Submit for Approval
              </Button>
            )}
          </div>
        </DialogFooter>
        {step === 1 && <ResizeHandle containerRef={wizardDialogRef} />}
      </DialogContent>
    </Dialog>
  );
}
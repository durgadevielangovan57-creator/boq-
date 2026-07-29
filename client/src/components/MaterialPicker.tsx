import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { fuzzySearch } from "@/lib/utils";

type Material = {
  id: string;
  name: string;
  code: string;
  image?: string;
  category?: string;
  subcategory?: string;
  vendor_category?: string;
  tax_code_type?: string;
  tax_code_value?: string;
  shop_name?: string;
  unit?: string;
  hsn_code?: string;
  sac_code?: string;
  rate?: number;
  is_project_pricing?: boolean;
  created_at: string;
  updated_at: string;
};

const parseImages = (imageField: string | null | undefined): string[] => {
  if (!imageField) return [];
  try {
    if (imageField.startsWith('[')) return JSON.parse(imageField);
    return [imageField];
  } catch (e) {
    return [imageField];
  }
};

type MaterialPickerProps = {
  onSelectTemplate: (material: Material) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function MaterialPicker({
  onSelectTemplate,
  open,
  onOpenChange,
}: MaterialPickerProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [pricingTab, setPricingTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const sortMaterialsByName = (a: Material, b: Material) => {
    const normalize = (text: string) => text.trim().toLowerCase();
    const aName = normalize(a.name || "");
    const bName = normalize(b.name || "");

    const splitChunks = (value: string) => value.match(/(\d+|\D+)/g) || [value];
    const aChunks = splitChunks(aName);
    const bChunks = splitChunks(bName);

    for (let i = 0; i < Math.min(aChunks.length, bChunks.length); i++) {
      const aChunk = aChunks[i];
      const bChunk = bChunks[i];
      const aNum = Number(aChunk);
      const bNum = Number(bChunk);

      const aIsNum = !Number.isNaN(aNum);
      const bIsNum = !Number.isNaN(bNum);

      if (aIsNum && bIsNum) {
        if (aNum !== bNum) return aNum - bNum;
        continue;
      }
      if (aIsNum && !bIsNum) {
        return -1;
      }
      if (!aIsNum && bIsNum) {
        return 1;
      }

      const cmp = aChunk.localeCompare(bChunk, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }

    if (aChunks.length !== bChunks.length) return aChunks.length - bChunks.length;
    return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
  };

  // Load all materials when dialog opens
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const response = await apiFetch("/api/materials", {
          headers: {},
        });
        if (response.ok) {
          const data = await response.json();
          const materialList = (data.materials || []).map((m: any) => ({
            ...m,
            category: m.category || m.category_name || "",
            subcategory: m.subcategory || m.subcategory_name || "",
            category_name: m.category_name || m.category || "",
            subcategory_name: m.subcategory_name || m.subcategory || "",
          })).sort(sortMaterialsByName);
          setMaterials(materialList);
        } else {
          toast({
            title: "Error",
            description: "Failed to load materials",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Failed to load materials:", err);
        toast({
          title: "Error",
          description: "Failed to load materials",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadMaterials();
    }
  }, [open, toast]);

  // Reset filters when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setCategoryFilter("all");
      setSubcategoryFilter("all");
    }
  }, [open]);

  // Derive unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    materials.forEach(m => {
      const c = m.category || "";
      if (c) cats.add(c);
    });
    return Array.from(cats).sort();
  }, [materials]);

  // Derive subcategories based on selected category
  const subcategories = useMemo(() => {
    const subs = new Set<string>();
    const base = categoryFilter === "all" ? materials : materials.filter(m => (m.category || "") === categoryFilter);
    base.forEach(m => {
      const s = m.subcategory || "";
      if (s) subs.add(s);
    });
    return Array.from(subs).sort();
  }, [materials, categoryFilter]);

  // Reset subcategory when category changes
  useEffect(() => {
    setSubcategoryFilter("all");
  }, [categoryFilter]);

  // Apply all filters (category, subcategory, text search)
  const filteredMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let base = materials;

    // Pricing tab filter
    if (pricingTab === "project_pricing") {
      base = base.filter(m => m.is_project_pricing);
    }

    // Category filter
    if (categoryFilter !== "all") {
      base = base.filter(m => (m.category || "") === categoryFilter);
    }

    // Subcategory filter
    if (subcategoryFilter !== "all") {
      base = base.filter(m => (m.subcategory || "") === subcategoryFilter);
    }

    // Text search
    if (!query) return base;

    return base
      .map((material) => {
        const name = (material.name || "").toLowerCase();
        const code = (material.code || "").toLowerCase();
        const shop = (material.shop_name || "").toLowerCase();
        const cat = (material.category || "").toLowerCase();

        const isMatch = fuzzySearch(query, [name, code, shop, cat]);
        if (!isMatch) return null;

        let score = 0;
        if (name.includes(query)) score += 100;
        if (shop.includes(query)) score += 70;
        const queryWords = query.split(/\s+/).filter(Boolean);
        if (queryWords.some(word => name.includes(word))) score += 50;
        if (code.includes(query)) score += 30;
        if (cat.includes(query)) score += 20;

        return { material, score };
      })
      .filter((item): item is { material: Material; score: number } => item !== null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return sortMaterialsByName(a.material, b.material);
      })
      .map((item) => item.material);
  }, [searchQuery, materials, categoryFilter, subcategoryFilter]);

  const handleMaterialSelect = (material: Material) => {
    onSelectTemplate(material);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[90vw] h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="text-xl font-bold text-slate-800">Select Material</DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Choose a material from a shop to add to your BOQ
          </p>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Controls Row */}
          <div className="p-6 py-4 bg-slate-50/50 border-b space-y-4">
            <div className="flex items-center justify-between">
              <Tabs value={pricingTab} onValueChange={setPricingTab} className="w-fit">
                <TabsList className="bg-slate-200/50">
                  <TabsTrigger value="all" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600">
                    All Materials
                  </TabsTrigger>
                  <TabsTrigger value="project_pricing" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-amber-600">
                    Project Pricing
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {filteredMaterials.length > 0 && (
                <div className="text-xs text-slate-500 font-medium">
                  Showing <span className="text-blue-600 font-bold">{filteredMaterials.length}</span> of <span className="text-slate-700 font-bold">{materials.length}</span> materials
                </div>
              )}
            </div>

            <div className="flex gap-3 items-center">
              <div className="flex-1 min-w-0">
                <Input
                  id="material-search"
                  placeholder="Search by name, code or shop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 text-sm border-slate-200 focus:ring-2 focus:ring-blue-500/20 bg-white"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 text-sm border-slate-200 w-[160px] shrink-0 bg-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="max-h-56 overflow-y-auto">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={subcategoryFilter}
                onValueChange={setSubcategoryFilter}
                disabled={subcategories.length === 0}
              >
                <SelectTrigger className="h-10 text-sm border-slate-200 w-[160px] shrink-0 bg-white">
                  <SelectValue placeholder="Sub Category" />
                </SelectTrigger>
                <SelectContent className="max-h-56 overflow-y-auto">
                  <SelectItem value="all">All Sub Categories</SelectItem>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* Material List */}
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                <div className="text-slate-500 font-medium italic">Loading materials...</div>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="text-center text-slate-400 py-20 flex flex-col items-center gap-2">
                <div className="text-4xl">🔍</div>
                <div className="font-medium">
                  {materials.length === 0
                    ? "No materials available in the library"
                    : "No materials match your current filters"}
                </div>
                <Button
                  variant="link"
                  onClick={() => { setSearchQuery(""); setCategoryFilter("all"); }}
                  className="text-blue-600 h-auto p-0"
                >
                  Clear all filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 py-2">
                {filteredMaterials.map((material) => (
                  <div
                    key={material.id}
                    onClick={() => handleMaterialSelect(material)}
                    className="group w-full flex items-center gap-4 p-3 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-md transition-all cursor-pointer bg-white"
                  >
                    <div className="h-16 w-16 border border-slate-100 rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center shrink-0 group-hover:border-blue-200 transition-colors">
                      {material.image ? (
                        <img
                          src={parseImages(material.image)[0]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-[10px] text-slate-300 font-bold uppercase text-center leading-none">NO IMAGE</div>
                      )}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors truncate">
                          {material.name}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {material.is_project_pricing && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 text-[9px] px-1.5 py-0 h-4 font-bold whitespace-nowrap">
                              ★ Project Pricing
                            </Badge>
                          )}
                          {material.code && (
                            <div className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              {material.code}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        {material.shop_name && (
                          <div className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider flex items-center shrink-0">
                            <span className="w-1 h-1 bg-blue-400 rounded-full mr-1.5 shrink-0 animate-pulse" />
                            {material.shop_name}
                          </div>
                        )}
                        {material.category && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            {material.shop_name && <span className="w-1 h-1 bg-slate-300 rounded-full" />}
                            {material.category}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-300 italic shrink-0">
                          ({material.unit || "unit"})
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="text-sm font-bold text-green-600">
                        ₹{Number(material.rate || 0).toLocaleString()}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
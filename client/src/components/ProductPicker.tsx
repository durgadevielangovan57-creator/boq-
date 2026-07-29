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
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { fuzzySearch } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  code: string;
  image?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  category_name?: string;
  subcategory_name?: string;
  hsn_code?: string;
  sac_code?: string;
  tax_code_type?: string;
  tax_code_value?: string;
};

type ProductPickerProps = {
  onSelectProduct: (product: Product) => void;
  selectedProjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function ProductPicker({
  onSelectProduct,
  selectedProjectId,
  open,
  onOpenChange,
}: ProductPickerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load all products on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await apiFetch("/api/products?approvedOnly=true", {
          headers: {},
        });
        if (response.ok) {
          const data = await response.json();
          const productList = (data.products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            code: p.code || "",
            image: p.image,
            category: p.category || p.category_name || "",
            subcategory: p.subcategory || p.subcategory_name || "",
            category_name: p.category_name || p.category || "",
            subcategory_name: p.subcategory_name || p.subcategory || "",
            description: p.description,
            hsn_code: p.hsn_code,
            sac_code: p.sac_code,
            tax_code_type: p.tax_code_type,
            tax_code_value: p.tax_code_value,
          }));
          setProducts(productList);
        } else {
          toast({
            title: "Error",
            description: "Failed to load products",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Failed to load products:", err);
        toast({
          title: "Error",
          description: "Failed to load products",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [toast]);

  // Reset filters when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setCategoryFilter("all");
      setSubcategoryFilter("all");
    }
  }, [open]);

  // Derive unique categories from all products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      const c = p.category_name || p.category || "";
      if (c) cats.add(c);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Derive subcategories based on selected category
  const subcategories = useMemo(() => {
    const subs = new Set<string>();
    const base = categoryFilter === "all" ? products : products.filter(p => (p.category_name || p.category || "") === categoryFilter);
    base.forEach(p => {
      const s = p.subcategory_name || p.subcategory || "";
      if (s) subs.add(s);
    });
    return Array.from(subs).sort();
  }, [products, categoryFilter]);

  // Reset subcategory when category changes
  useEffect(() => {
    setSubcategoryFilter("all");
  }, [categoryFilter]);

  // Apply all filters
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return products.filter((product) => {
      // Category filter
      if (categoryFilter !== "all") {
        const cat = product.category_name || product.category || "";
        if (cat !== categoryFilter) return false;
      }
      // Subcategory filter
      if (subcategoryFilter !== "all") {
        const sub = product.subcategory_name || product.subcategory || "";
        if (sub !== subcategoryFilter) return false;
      }
      // Text search
      if (query) {
        const name = product.name || "";
        const description = product.description || "";
        if (!fuzzySearch(query, [name, description])) return false;
      }
      return true;
    });
  }, [products, searchQuery, categoryFilter, subcategoryFilter]);

  const handleProductSelect = (product: Product) => {
    onSelectProduct(product);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[90vw] h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="text-xl font-bold text-slate-800">Select Product</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Controls Row */}
          <div className="p-6 py-4 bg-slate-50/50 border-b space-y-3">
            <div className="flex gap-3 items-center">
              <div className="flex-1 min-w-0">
                <Input
                  id="product-search"
                  placeholder="Search by name, category, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 text-sm border-slate-200 focus:ring-2 focus:ring-blue-500/20"
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

            {filteredProducts.length > 0 && (
              <div className="text-xs text-slate-500 font-medium">
                Showing <span className="text-blue-600 font-bold">{filteredProducts.length}</span> of <span className="text-slate-700 font-bold">{products.length}</span> products
              </div>
            )}
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                <div className="text-slate-500 font-medium italic">Loading products...</div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center text-slate-400 py-20 flex flex-col items-center gap-2">
                <div className="text-4xl">🔍</div>
                <div className="font-medium">
                  {products.length === 0
                    ? "No products available in the library"
                    : "No products match your current filters"}
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
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className="group w-full flex items-center gap-4 p-3 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-md transition-all cursor-pointer bg-white"
                  >
                    <div className="h-16 w-16 border border-slate-100 rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center shrink-0 group-hover:border-blue-200 transition-colors">
                      {product.image ? (
                        <img
                          src={parseImages(product.image)[0]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-[10px] text-slate-300 font-bold uppercase text-center leading-none">NO IMAGE</div>
                      )}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors truncate">
                        {product.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <div className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold uppercase tracking-wider">
                          {product.category_name || product.category || "General"}
                        </div>
                        {product.subcategory_name || product.subcategory ? (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                            {product.subcategory_name || product.subcategory}
                          </div>
                        ) : null}
                      </div>
                      {product.description && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-1.5 opacity-80 italic">
                          {product.description}
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
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
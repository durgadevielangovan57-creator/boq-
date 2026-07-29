import React, { useState } from "react";
import { postJSON } from "@/lib/api";
import { useData } from "@/lib/store";
import { Layout } from "@/components/layout/Layout";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Upload, Trash2, Eye, Copy, FileText, AlertCircle, CheckCircle2, Store } from "lucide-react";

// ── Config per tab ──────────────────────────────────────────────────────────

const MAT_HEADERS = ["name", "code", "unit", "rate", "category", "subcategory", "shop_name", "vendor_category", "tax_code_type", "tax_code_value", "brandname", "technicalspecification"];
const SHOP_HEADERS = ["name", "location", "city", "state", "country", "pincode", "phoneCountryCode", "contactNumber", "gstNo", "vendorCategory"];

const MAT_LABELS: Record<string, string> = {
  technicalspecification: "Technical Specification", shop_name: "Shop Name",
  vendor_category: "Vendor Category", tax_code_type: "Tax Code Type",
  tax_code_value: "Tax Code Value", brandname: "Brand",
};
const SHOP_LABELS: Record<string, string> = {
  phoneCountryCode: "Phone Code", contactNumber: "Contact Number",
  gstNo: "GST No", vendorCategory: "Vendor Category",
};

const emptyRow = (headers: string[]) => Object.fromEntries(headers.map(h => [h, ""]));

function generateCodeFromName(name: string) {
  if (!name) return "";
  return name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

function headerLabel(h: string, labels: Record<string, string>) {
  return labels[h] || (h.charAt(0).toUpperCase() + h.slice(1).replace(/_/g, " "));
}

type ActiveTab = "materials" | "shops";
type PreviewState = { headers: string[]; rows: Record<string, any>[] } | null;

// ── Component ───────────────────────────────────────────────────────────────

export default function BulkMaterialUpload() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("materials");
  const [matRows, setMatRows] = useState(() => Array(10).fill(null).map(() => emptyRow(MAT_HEADERS)));
  const [shopRows, setShopRows] = useState(() => Array(10).fill(null).map(() => emptyRow(SHOP_HEADERS)));
  const [matPreview, setMatPreview] = useState<PreviewState>(null);
  const [shopPreview, setShopPreview] = useState<PreviewState>(null);
  const [matLoading, setMatLoading] = useState(false);
  const [shopLoading, setShopLoading] = useState(false);
  const [matResult, setMatResult] = useState<any>(null);
  const [shopResult, setShopResult] = useState<any>(null);

  const { toast } = useToast();
  const { refreshMaterials, refreshPendingApprovals } = useData();

  const isMat = activeTab === "materials";
  const headers = isMat ? MAT_HEADERS : SHOP_HEADERS;
  const labels = isMat ? MAT_LABELS : SHOP_LABELS;
  const rows = isMat ? matRows : shopRows;
  const setRows = isMat ? setMatRows : setShopRows;
  const preview = isMat ? matPreview : shopPreview;
  const setPreview = isMat ? setMatPreview : setShopPreview;
  const loading = isMat ? matLoading : shopLoading;
  const setLoading = isMat ? setMatLoading : setShopLoading;
  const result = isMat ? matResult : shopResult;
  const setResult = isMat ? setMatResult : setShopResult;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const updateCell = (rowIndex: number, col: string, value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [col]: value };
      if (isMat && col === "name") next[rowIndex].code = generateCodeFromName(value);
      return next;
    });
  };

  const addRows = (count = 5) =>
    setRows(prev => [...prev, ...Array(count).fill(null).map(() => emptyRow(headers))]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (!text?.includes("\t")) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    setRows(prev => {
      const next = [...prev];
      lines.forEach((line, i) => {
        if (i >= next.length) next.push(emptyRow(headers));
        const cols = line.split("\t");
        const row = { ...next[i] };
        headers.forEach((h, j) => { if (cols[j] !== undefined) row[h] = cols[j].trim(); });
        if (isMat && row.name && !row.code) row.code = generateCodeFromName(row.name);
        next[i] = row;
      });
      return next;
    });
    toast({ title: "Data Pasted", description: `Imported ${lines.length} rows.` });
  };

  const handlePreview = () => {
    const active = rows.filter(r => Object.values(r).some(v => v.trim()));
    if (!active.length) return toast({ title: "No Data", description: `Enter some ${isMat ? "material" : "shop"} data first.`, variant: "destructive" });
    if (active.some(r => !r.name?.trim())) return toast({ title: "Validation Error", description: "Some rows are missing 'Name'.", variant: "destructive" });
    if (!isMat && active.some(r => !r.city?.trim())) return toast({ title: "Validation Error", description: "Some rows are missing 'City'.", variant: "destructive" });
    setPreview({ headers, rows: active });
    toast({ title: "Preview Generated", description: `Parsed ${active.length} rows.` });
  };

  const handleUpload = async () => {
    if (!preview?.rows.length) return toast({ title: "No Preview", description: "Preview your data before uploading.", variant: "destructive" });
    setLoading(true);
    setResult(null);
    try {
      const endpoint = isMat ? "/bulk-materials" : "/bulk-shops";
      const res = await postJSON(endpoint, { rows: preview.rows });
      setResult(res);
      if (!res.errors?.length) {
        setPreview(null);
        setRows(Array(10).fill(null).map(() => emptyRow(headers)));
      } else {
        toast({ title: "Partial Success", description: `${res.errors.length} errors. Fix highlighted rows.`, variant: "destructive" });
      }
      if (!isMat) toast({ title: "Success", description: `${res.createdShopsCount || 0} shops submitted for approval.` });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(headers.join("\t"));
    toast({ title: "Template Copied", description: "Header template (TSV) copied to clipboard." });
  };

  const resetGrid = () => {
    setRows(Array(10).fill(null).map(() => emptyRow(headers)));
    setPreview(null);
    setResult(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const TabBtn = ({ tab, icon: Icon, label }: { tab: ActiveTab; icon: any; label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
        activeTab === tab ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Bulk Upload</h2>
            <p className="text-muted-foreground">
              Add multiple {isMat ? "materials" : "shops"} by typing below or pasting from Excel.
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-md text-xs text-blue-800 max-w-xs">
            <p className="flex items-center gap-1 font-semibold mb-1"><AlertCircle className="h-3 w-3" /> Pro Tip</p>
            Copy cells from Excel and paste anywhere in the table grid!
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          <TabBtn tab="materials" icon={FileText} label="Materials" />
          <TabBtn tab="shops" icon={Store} label="Shops" />
        </div>

        <Card className="border-none shadow-md overflow-hidden bg-slate-50/30">
          <CardHeader className="bg-white border-b py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                {isMat ? <FileText className="h-5 w-5 text-primary" /> : <Store className="h-5 w-5 text-primary" />}
                {isMat ? "Material Entry Grid" : "Shop Entry Grid"}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyTemplate}>
                  <Copy className="mr-2 h-3.5 w-3.5" /> Copy Headers
                </Button>
                <Button variant="ghost" size="sm" onClick={resetGrid} className="text-destructive hover:bg-destructive/5 h-8">
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Reset Grid
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px] border-b" onPaste={handlePaste}>
              <Table className="border-collapse">
                <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm border-b">
                  <TableRow>
                    <TableHead className="w-10 text-center font-bold text-slate-600 border-r">#</TableHead>
                    {headers.map(h => (
                      <TableHead key={h} className="min-w-[150px] font-bold text-slate-600 border-r">
                        <div className="flex items-center gap-1">
                          {headerLabel(h, labels)}
                          {isMat && h === "code" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-3 w-3 text-slate-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent><p>Auto-generated from Name (non-editable)</p></TooltipContent>
                            </Tooltip>
                          )}
                          {!isMat && (h === "name" || h === "city") && <span className="text-red-400 text-xs">*</span>}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {rows.map((row, ri) => (
                    <TableRow key={ri} className="group hover:bg-slate-50 transition-colors">
                      <TableCell className="text-center font-mono text-xs text-slate-400 border-r bg-slate-50/50">{ri + 1}</TableCell>
                      {headers.map(h => (
                        <TableCell key={h} className="p-0 border-r">
                          <input
                            type="text"
                            value={row[h]}
                            readOnly={isMat && h === "code"}
                            tabIndex={isMat && h === "code" ? -1 : 0}
                            onChange={e => updateCell(ri, h, e.target.value)}
                            placeholder={h === "name" || (!isMat && h === "city") ? "Required..." : ""}
                            className={cn(
                              "w-full h-10 px-3 border-none focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm bg-transparent",
                              isMat && h === "code" && "bg-slate-50/50 text-slate-500 cursor-not-allowed font-mono text-xs"
                            )}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          <CardFooter className="bg-white border-t p-4 flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={() => addRows(5)} className="text-slate-600 h-9">
              + Add 5 More Rows
            </Button>
            <Button onClick={handlePreview} className="min-w-[150px] shadow-sm">
              <Eye className="mr-2 h-4 w-4" /> Preview & Validate
            </Button>
          </CardFooter>
        </Card>

        {preview && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-primary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-primary/5 py-4">
              <div>
                <CardTitle className="text-lg text-primary flex items-center gap-2">
                  <Upload className="h-5 w-5" /> Ready to Upload
                </CardTitle>
                <CardDescription className="text-primary/70">
                  Verified {preview.rows.length} valid {isMat ? "material" : "shop"} rows.
                  {!isMat && " Shops will be submitted for approval."}
                </CardDescription>
              </div>
              <Button onClick={handleUpload} disabled={loading} size="lg" className="bg-primary hover:bg-primary/90 px-8">
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                {loading ? "Uploading..." : "Confirm Bulk Import"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[300px]">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      {preview.headers.map(h => (
                        <TableHead key={h} className="text-xs uppercase tracking-wider text-slate-500">
                          {headerLabel(h, labels)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row, i) => (
                      <TableRow key={i} className="hover:bg-muted/30">
                        {preview.headers.map(h => (
                          <TableCell key={h} className="text-sm py-2">
                            {row[h] || <span className="text-slate-300 italic">empty</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="py-3 border-b border-green-100">
              <CardTitle className="flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle2 className="h-4 w-4" /> Upload Results
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="text-[10px] bg-white border rounded p-3 text-green-800 font-mono overflow-auto max-h-[150px]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

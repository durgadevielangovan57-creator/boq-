import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { getJSON } from "@/lib/api";
import {
  ArrowLeft,
  Scale,
  FileDown,
  Layers,
  IndianRupee,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  Search,
  Filter,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
  Briefcase,
  User,
  MapPin,
  ClipboardList,
  LayoutGrid,
  List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Project {
  id: string;
  name: string;
  client: string;
  budget?: string | number;
  location?: string;
  client_address?: string;
  gst_no?: string;
  project_value: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProjectCompareViewProps {
  projects: Project[];
}

export default function ProjectCompareView({ projects }: ProjectCompareViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Access levels
  const isAdmin = user?.role === "admin" || user?.role === "software_team";
  const isManager = user?.role === "product_manager" || user?.role === "finance_team" || user?.role === "purchase_team";
  const isEmployee = !isAdmin && !isManager;

  // Comparison State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compareData, setCompareData] = useState<any[]>([]);

  // View Mode: grid or list
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Expandable Table Sections
  const [expandedSections, setExpandedSections] = useState({
    financials: true,
    boq: true,
    versions: true,
    timeline: true,
    products: true
  });

  // Extract unique filter candidates
  const clients = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (p.client) set.add(p.client); });
    return Array.from(set).sort();
  }, [projects]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (p.location) set.add(p.location); });
    return Array.from(set).sort();
  }, [projects]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (p.status) set.add(p.status); });
    return Array.from(set).sort();
  }, [projects]);

  // Filtered projects for selection
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.client.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClient = selectedClient === "all" || p.client === selectedClient;
      const matchesLocation = selectedLocation === "all" || p.location === selectedLocation;
      const matchesStatus = selectedStatus === "all" || p.status === selectedStatus;
      return matchesSearch && matchesClient && matchesLocation && matchesStatus;
    });
  }, [projects, searchQuery, selectedClient, selectedLocation, selectedStatus]);

  // Handle card click
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (prev.length >= 5) {
        toast({
          title: "Limit reached",
          description: "You can compare up to 5 projects side-by-side.",
          variant: "destructive"
        });
        return prev;
      }
      return [...prev, id];
    });
  };

  // Run the side-by-side comparison API
  const handleStartComparison = async () => {
    if (selectedIds.length < 2) {
      toast({
        title: "Selection required",
        description: "Please select 2 or more projects to compare.",
        variant: "destructive"
      });
      return;
    }

    setLoadingCompare(true);
    try {
      const idsParam = selectedIds.join(",");
      const data = await getJSON(`/api/projects/compare?ids=${idsParam}`);
      if (data && data.projects) {
        setCompareData(data.projects);
        setIsComparing(true);
      } else {
        throw new Error("Invalid response schema");
      }
    } catch (err: any) {
      toast({
        title: "Failed to compare",
        description: err.message || "Failed to load comparison data.",
        variant: "destructive"
      });
    } finally {
      setLoadingCompare(false);
    }
  };

  // Clear selections
  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Toggle Table sections
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Recharts Chart Data Prep
  const barChartData = useMemo(() => {
    if (compareData.length === 0) return [];
    return compareData.map(p => ({
      name: p.project.name,
      Revenue: p.financials.grandTotal,
      Budget: p.financials.baseTotal,
      Profit: p.financials.profit
    }));
  }, [compareData]);

  // Helper: check highlighting levels
  // Highlighting green for highest revenue/margin, yellow for changes, red for lowest
  const getHighlightClass = (metric: string, val: number, allVals: number[]) => {
    if (allVals.length <= 1) return "";
    const maxVal = Math.max(...allVals);
    const minVal = Math.min(...allVals);

    if (val === maxVal && maxVal !== minVal) {
      // For budgets (costs), lower is usually better, but for revenue/margin higher is better
      const isCost = metric.toLowerCase().includes("budget") || metric.toLowerCase().includes("cost");
      return isCost 
        ? "bg-rose-50 text-rose-800 font-black border border-rose-200" 
        : "bg-emerald-50 text-emerald-800 font-black border border-emerald-200";
    }
    if (val === minVal && maxVal !== minVal) {
      const isCost = metric.toLowerCase().includes("budget") || metric.toLowerCase().includes("cost");
      return isCost 
        ? "bg-emerald-50 text-emerald-800 font-black border border-emerald-200" 
        : "bg-rose-50 text-rose-800 font-black border border-rose-200";
    }
    return "bg-slate-50 text-slate-900 border border-slate-200 font-black";
  };

  // Compile all distinct products across compared projects
  const uniqueProducts = useMemo(() => {
    if (compareData.length === 0) return [];
    const map = new Map<string, { category: string; unit: string }>();
    compareData.forEach(p => {
      if (Array.isArray(p.items)) {
        p.items.forEach((item: any) => {
          if (item.productName) {
            map.set(item.productName, {
              category: item.category || "General",
              unit: item.unit || "nos"
            });
          }
        });
      }
    });
    return Array.from(map.entries()).map(([productName, details]) => ({
      productName,
      ...details
    })).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [compareData]);

  // Trigger project creation modal prefilled to duplicate
  const handleDuplicateProject = (project: any) => {
    toast({
      title: "Duplication Helper",
      description: `Opening project setup. Feel free to customize project name "${project.name} - Copy".`
    });
    
    sessionStorage.setItem("duplicate_project_src", JSON.stringify({
      name: `${project.name} - Copy`,
      client: project.client,
      budget: project.budget,
      location: project.location,
      client_address: project.client_address,
      gst_no: project.gst_no
    }));

    setLocation("/create-project");
  };

  // PDF Export
  const handleExportPDF = () => {
    if (compareData.length === 0) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const timestamp = new Date().toLocaleDateString();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(33, 41, 54);
    doc.text("PROJECT SIDE-BY-SIDE COMPARISON REPORT", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${timestamp} | Access Level: ${user?.role?.toUpperCase()}`, 14, 21);

    // Build side-by-side grid data
    const headers = ["Metric", ...compareData.map(p => p.project.name)];
    
    const rows = [
      // Section: Financials
      [{ content: "FINANCIALS", colSpan: headers.length, styles: { fillColor: [241, 245, 249], fontStyle: "bold" } }],
      ["Project Budget (₹)", ...compareData.map(p => isEmployee ? "RESTRICTED" : Math.round(p.financials.baseTotal).toLocaleString())],
      ["Final Price (₹)", ...compareData.map(p => Math.round(p.financials.grandTotal).toLocaleString())],
      ["Surplus Profit (₹)", ...compareData.map(p => isEmployee ? "RESTRICTED" : Math.round(p.financials.profit).toLocaleString())],
      ["Margin (%)", ...compareData.map(p => isEmployee ? "RESTRICTED" : `${p.financials.margin.toFixed(1)}%`)],
      ["Tax Amount (₹)", ...compareData.map(p => isEmployee ? "RESTRICTED" : Math.round(p.financials.tax).toLocaleString())],
      ["Discounts Given (₹)", ...compareData.map(p => isEmployee ? "RESTRICTED" : Math.round(p.financials.discount).toLocaleString())],

      // Section: BOQ summary
      [{ content: "BOQ SPECS", colSpan: headers.length, styles: { fillColor: [241, 245, 249], fontStyle: "bold" } }],
      ["Total BOQ Items", ...compareData.map(p => p.financials.itemCount)],
      ["Material Share (₹)", ...compareData.map(p => isEmployee ? "RESTRICTED" : Math.round(p.financials.materialCost).toLocaleString())],
      ["Labour Share (₹)", ...compareData.map(p => isEmployee ? "RESTRICTED" : Math.round(p.financials.labourCost).toLocaleString())],

      // Section: Versioning
      [{ content: "REVISION LIFECYCLE", colSpan: headers.length, styles: { fillColor: [241, 245, 249], fontStyle: "bold" } }],
      ["Latest Version", ...compareData.map(p => p.selectedVersion ? `V${p.selectedVersion.version_number}` : "N/A")],
      ["Version Status", ...compareData.map(p => p.selectedVersion ? p.selectedVersion.status.toUpperCase() : "N/A")],
      ["Total Revision Count", ...compareData.map(p => p.versionCount)],

      // Section: Timeline
      [{ content: "TIMELINES", colSpan: headers.length, styles: { fillColor: [241, 245, 249], fontStyle: "bold" } }],
      ["Created Date", ...compareData.map(p => new Date(p.project.created_at).toLocaleDateString())],
      ["Last Updated Date", ...compareData.map(p => new Date(p.project.updated_at).toLocaleDateString())],
    ];

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 28,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
        valign: "middle"
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      }
    });

    // Save
    doc.save(`Project_Comparison_Snapshot_${Date.now()}.pdf`);
    toast({
      title: "PDF Saved",
      description: "Side-by-side comparison report successfully exported."
    });
  };

  // CSV/Excel Export
  const handleExportCSV = () => {
    if (compareData.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Headers
    const headers = ["Metric", ...compareData.map(p => p.project.name)].join(",");
    csvContent += headers + "\r\n";

    // Data Row Generator
    const addRow = (label: string, getter: (p: any) => string | number) => {
      const row = [label, ...compareData.map(p => getter(p))].join(",");
      csvContent += row + "\r\n";
    };

    addRow("Client", p => p.project.client);
    addRow("Location", p => p.project.location || "N/A");
    addRow("Status", p => p.project.status);
    
    if (!isEmployee) {
      addRow("Total Cost / Budget (INR)", p => Math.round(p.financials.baseTotal));
      addRow("Revenue / Final Price (INR)", p => Math.round(p.financials.grandTotal));
      addRow("Net Profit (INR)", p => Math.round(p.financials.profit));
      addRow("Gross Margin (%)", p => p.financials.margin.toFixed(2));
      addRow("Tax Amount (INR)", p => Math.round(p.financials.tax));
      addRow("Discounts (INR)", p => Math.round(p.financials.discount));
      addRow("Material Cost Share (INR)", p => Math.round(p.financials.materialCost));
      addRow("Labour Cost Share (INR)", p => Math.round(p.financials.labourCost));
    }
    
    addRow("Total BOQ Item Count", p => p.financials.itemCount);
    addRow("Latest Version", p => p.selectedVersion ? `V${p.selectedVersion.version_number}` : "N/A");
    addRow("Revision Count", p => p.versionCount);
    addRow("Created At", p => new Date(p.project.created_at).toLocaleDateString());
    addRow("Updated At", p => new Date(p.project.updated_at).toLocaleDateString());

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Project_Compare_Data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Exported",
      description: "Project metrics saved to CSV format successfully."
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            {isComparing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full border border-slate-200"
                onClick={() => setIsComparing(false)}
              >
                <ArrowLeft size={16} />
              </Button>
            )}
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Scale className="text-amber-500" size={22} />
              {isComparing ? "Project Comparison Matrix" : "Project Comparison Dashboard"}
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">
            {isComparing 
              ? `Comparing ${compareData.length} Selected Projects Side-by-Side`
              : "Select 2 or more projects and compare client quotes, margins, BOM metrics, and revisions."}
          </p>
        </div>

        {isComparing && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="rounded-xl h-9 border-slate-200 text-xs font-bold gap-2"
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPDF}
              className="rounded-xl h-9 border-slate-200 text-xs font-bold gap-2"
            >
              <FileDown size={14} /> PDF Report
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsComparing(false)}
              className="rounded-xl h-9 border border-slate-200 text-xs font-bold"
            >
              Change Selection
            </Button>
          </div>
        )}
      </div>

      {!isComparing ? (
        /* ================= SELECTION STATE ================= */
        <div className="space-y-6">
          
          {/* SEARCH & FILTERS ROW (100% RESPONSIVE GRID TO PREVENT RIGHT OVERFLOW) */}
          <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardContent className="p-5 flex flex-col gap-4">
              
              {/* Responsive Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                
                {/* Search */}
                <div className="relative w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by project or client..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-slate-400"
                  />
                </div>

                {/* Client Filter */}
                <div className="relative w-full">
                  <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                  >
                    <option value="all">All Clients</option>
                    {clients.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Location Filter */}
                <div className="w-full">
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="all">All Locations</option>
                    {locations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="w-full">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="all">All Statuses</option>
                    {statuses.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              {/* Action Buttons Row (Self-contained, prevents pushing inside) */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 mt-1 gap-4 flex-wrap">
                <div className="text-xs font-black uppercase text-slate-500 tracking-wider">
                  Selected Candidate Projects: <span className="text-amber-500 font-extrabold text-sm">{selectedIds.length}</span> <span className="text-slate-400">/ 5 max</span>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  
                  {/* Grid / List View Toggle Toggles */}
                  <div className="flex items-center gap-1 border border-slate-200 p-0.5 rounded-xl bg-slate-50">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setViewMode("grid")}
                      className={cn("h-7 w-7 rounded-lg text-xs transition-all", viewMode === "grid" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-700")}
                    >
                      <LayoutGrid size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setViewMode("list")}
                      className={cn("h-7 w-7 rounded-lg text-xs transition-all", viewMode === "list" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-700")}
                    >
                      <List size={14} />
                    </Button>
                  </div>

                  {selectedIds.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleClearSelection}
                      className="text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl h-8 px-3"
                    >
                      Clear ({selectedIds.length})
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    onClick={handleStartComparison}
                    disabled={selectedIds.length < 2 || loadingCompare}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase rounded-xl h-8 px-4 gap-2 shadow-sm shrink-0"
                  >
                    {loadingCompare ? (
                      <span className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <Scale size={14} />
                    )}
                    Compare Projects ({selectedIds.length})
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* VIEW SWITCHER RENDERING */}
          {viewMode === "grid" ? (
            /* ================= GRID VIEW ================= */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                const projectVal = parseFloat(p.project_value) || 0;
                const projectCost = p.budget ? parseFloat(String(p.budget)) || 0 : 0;
                const calculatedMargin = projectVal > 0 ? ((projectVal - projectCost) / projectVal) * 100 : 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleToggleSelect(p.id)}
                    className={cn(
                      "bg-white p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300",
                      isSelected 
                        ? "ring-2 ring-amber-500 border-amber-400 bg-amber-50/10" 
                        : "border-slate-200"
                    )}
                  >
                    {/* Select indicator */}
                    <div className={cn(
                      "absolute top-4 right-4 h-5 w-5 rounded-full border flex items-center justify-center transition-colors",
                      isSelected 
                        ? "bg-amber-500 border-amber-500 text-white" 
                        : "border-slate-300 bg-white text-transparent group-hover:border-slate-400"
                    )}>
                      <Check size={12} className="stroke-[3]" />
                    </div>

                    <div>
                      {/* Client & Status tag */}
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-slate-100 text-slate-800 border-slate-100 h-4 text-[8px] font-black tracking-wider uppercase">
                          {p.client}
                        </Badge>
                        <Badge className={cn("h-4 text-[8px] font-black tracking-wider uppercase",
                          p.status === "approved" || p.status === "finalized" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          p.status === "draft" ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-100 text-slate-500"
                        )}>
                          {p.status}
                        </Badge>
                      </div>

                      {/* Project Title */}
                      <h3 className="text-sm font-black text-slate-900 leading-snug tracking-tight pr-6 mb-3">
                        {p.name}
                      </h3>

                      {/* Stats List */}
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center text-[10px] font-black text-slate-800">
                          <span className="flex items-center gap-1 uppercase text-slate-500"><MapPin size={10} /> Location</span>
                          <span>{p.location || "N/A"}</span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-black text-slate-800">
                          <span className="flex items-center gap-1 uppercase text-slate-500"><IndianRupee size={10} /> Grand Value</span>
                          <span className="text-slate-950 font-extrabold">₹{Math.round(projectVal).toLocaleString()}</span>
                        </div>

                        {!isEmployee && (
                          <div className="flex justify-between items-center text-[10px] font-black text-slate-800">
                            <span className="flex items-center gap-1 uppercase text-slate-500"><Briefcase size={10} /> Margin</span>
                            <span className={cn("font-extrabold", calculatedMargin >= 20 ? "text-emerald-600" : "text-amber-500")}>
                              {calculatedMargin.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress / Footer */}
                    <div>
                      {!isEmployee && (
                        <div className="space-y-1 mb-2">
                          <Progress value={calculatedMargin} className="h-1 bg-slate-100" />
                        </div>
                      )}
                      <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-800 tracking-widest pt-2 border-t border-slate-100">
                        <span>Created: {new Date(p.created_at).toLocaleDateString()}</span>
                        <span className="text-slate-500">ID: {p.id.substring(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredProjects.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 bg-white border border-slate-200 rounded-3xl p-8">
                  <Briefcase size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-xs font-black uppercase tracking-wider">No matching projects found</p>
                  <p className="text-[10px] mt-1 text-slate-400">Adjust your search or filter tags to select projects.</p>
                </div>
              )}
            </div>
          ) : (
            /* ================= LIST VIEW (NEW OPTION AS REQUESTED) ================= */
            <Card className="rounded-3xl border border-slate-200 overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-900 text-[10px] font-black uppercase tracking-widest">
                      <th className="p-4 w-[60px] text-center">Select</th>
                      <th className="p-4">Project Name</th>
                      <th className="p-4">Client</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Status</th>
                      {!isEmployee && (
                        <>
                          <th className="p-4 text-right">Grand Value</th>
                          <th className="p-4 text-right">Margin</th>
                        </>
                      )}
                      <th className="p-4 text-center">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p) => {
                      const isSelected = selectedIds.includes(p.id);
                      const projectVal = parseFloat(p.project_value) || 0;
                      const projectCost = p.budget ? parseFloat(String(p.budget)) || 0 : 0;
                      const calculatedMargin = projectVal > 0 ? ((projectVal - projectCost) / projectVal) * 100 : 0;

                      return (
                        <tr 
                          key={p.id}
                          onClick={() => handleToggleSelect(p.id)}
                          className={cn(
                            "border-b border-slate-100 cursor-pointer transition-colors text-xs hover:bg-slate-50/50",
                            isSelected ? "bg-amber-50/10 hover:bg-amber-50/20" : ""
                          )}
                        >
                          <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div 
                              onClick={() => handleToggleSelect(p.id)}
                              className={cn(
                                "mx-auto h-5 w-5 rounded-full border flex items-center justify-center transition-colors cursor-pointer",
                                isSelected ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-400"
                              )}
                            >
                              <Check size={11} className="stroke-[3]" />
                            </div>
                          </td>
                          <td className="p-4 font-black text-slate-900 max-w-[250px] truncate">{p.name}</td>
                          <td className="p-4 font-extrabold text-slate-800">{p.client}</td>
                          <td className="p-4 font-bold text-slate-800">{p.location || "N/A"}</td>
                          <td className="p-4">
                            <Badge className={cn("text-[9px] font-black tracking-wider uppercase px-2 h-5 rounded-md",
                              p.status === "approved" || p.status === "finalized" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                              p.status === "draft" ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-100 text-slate-500"
                            )}>
                              {p.status}
                            </Badge>
                          </td>
                          {!isEmployee && (
                            <>
                              <td className="p-4 font-extrabold text-slate-900 text-right">₹{Math.round(projectVal).toLocaleString()}</td>
                              <td className={cn("p-4 font-black text-right", calculatedMargin >= 20 ? "text-emerald-600" : "text-amber-500")}>
                                {calculatedMargin.toFixed(1)}%
                              </td>
                            </>
                          )}
                          <td className="p-4 font-bold text-slate-800 text-center">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredProjects.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-500 font-bold uppercase tracking-wider italic">
                          No matching projects found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </div>
      ) : (
        /* ================= SIDE-BY-SIDE COMPARE STATE ================= */
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* ANALYTICS VISUAL DASHBOARDS */}
          {!isEmployee && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost & Revenue Compare */}
              <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white">
                <CardHeader className="p-5 border-b border-slate-100">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-900">Financial Comparison (INR)</CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#0f172a" fontSize={9} fontWeight="bold" />
                      <YAxis stroke="#0f172a" fontSize={9} fontWeight="bold" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString()}`} contentStyle={{ borderRadius: "8px", fontWeight: "black", fontSize: "11px", color: "#000" }} />
                      <Legend wrapperStyle={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase" }} />
                      <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue / Quote" />
                      <Bar dataKey="Budget" fill="#64748b" radius={[4, 4, 0, 0]} name="Cost / Budget" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Profit & Margin Compare */}
              <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white">
                <CardHeader className="p-5 border-b border-slate-100">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-900">Projected Profit Surplus & Margin %</CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-64 flex flex-col justify-between">
                  <ResponsiveContainer width="100%" height="80%">
                    <BarChart data={barChartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#0f172a" fontSize={9} fontWeight="bold" />
                      <YAxis stroke="#0f172a" fontSize={9} fontWeight="bold" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString()}`} contentStyle={{ borderRadius: "8px", fontWeight: "black", fontSize: "11px", color: "#000" }} />
                      <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} name="Projected Profit">
                        {compareData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.financials.margin >= 20 ? "#10b981" : "#f59e0b"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-around items-center pt-2 border-t border-slate-100 text-[10px] font-black uppercase text-slate-900 tracking-wider">
                    {compareData.map((p, idx) => (
                      <div key={idx} className="text-center">
                        <span className="block text-xs font-black text-slate-950">{p.financials.margin.toFixed(1)}%</span>
                        <span>{p.project.name.substring(0, 15)}...</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* MAIN COMPARISON TABLES (texts are fully bold, highly legible, and darker) */}
          <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[700px] border-collapse">
                {/* HEADERS */}
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-white">
                    <th className="w-1/4 p-4 text-left text-xs font-black uppercase tracking-wider">Metrics Matrix</th>
                    {compareData.map((p, idx) => (
                      <th key={p.project.id} className="p-4 text-left text-xs font-black uppercase tracking-wider relative group border-l border-slate-800">
                        <div className="flex flex-col h-full justify-between">
                          <div className="mb-2">
                            <span className="block text-amber-400 text-[9px] font-extrabold uppercase tracking-widest mb-0.5">PROJECT {idx + 1}</span>
                            <span className="block text-sm font-black text-white leading-tight tracking-tight">{p.project.name}</span>
                          </div>
                          
                          {/* Column quick actions */}
                          <div className="flex gap-1.5 mt-2 opacity-95 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setLocation(`/finalize-bom?project=${p.project.id}`)}
                              className="text-[8px] h-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase rounded-md px-1.5"
                            >
                              BOQ
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => handleDuplicateProject(p.project)}
                              className="text-[8px] h-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase rounded-md px-1.5"
                            >
                              Copy
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setLocation(`/proposal/${p.project.id}`)}
                              className="text-[8px] h-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase rounded-md px-1.5"
                            >
                              Proposal
                            </Button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {/* ================= A. FINANCIAL COMPARISON ================= */}
                  <tr 
                    onClick={() => toggleSection("financials")}
                    className="bg-slate-100 border-y border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors"
                  >
                    <td colSpan={compareData.length + 1} className="p-3 text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
                      <span className="flex items-center gap-2"><IndianRupee size={14} className="text-amber-500" /> A. Financial Comparison Matrix</span>
                      {expandedSections.financials ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>

                  {expandedSections.financials && (
                    <>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Cost (Budget)</td>
                        {compareData.map((p) => {
                          const budget = p.financials.baseTotal;
                          const allBudgets = compareData.map(d => d.financials.baseTotal);
                          return (
                            <td key={p.project.id} className="p-3 text-xs border-l border-slate-100">
                              <span className={cn("px-2.5 py-1 rounded-lg inline-block text-slate-950 font-black", getHighlightClass("budget", budget, allBudgets))}>
                                {isEmployee ? "RESTRICTED" : `₹${Math.round(budget).toLocaleString()}`}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Final Total (Revenue)</td>
                        {compareData.map((p) => {
                          const grand = p.financials.grandTotal;
                          const allGrands = compareData.map(d => d.financials.grandTotal);
                          return (
                            <td key={p.project.id} className="p-3 text-xs border-l border-slate-100">
                              <span className={cn("px-2.5 py-1 rounded-lg inline-block text-slate-950 font-black", getHighlightClass("revenue", grand, allGrands))}>
                                ₹{Math.round(grand).toLocaleString()}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Net Profit</td>
                        {compareData.map((p) => {
                          const profit = p.financials.profit;
                          const allProfits = compareData.map(d => d.financials.profit);
                          return (
                            <td key={p.project.id} className="p-3 text-xs border-l border-slate-100">
                              <span className={cn("px-2.5 py-1 rounded-lg inline-block text-slate-950 font-black", getHighlightClass("profit", profit, allProfits))}>
                                {isEmployee ? "RESTRICTED" : `₹${Math.round(profit).toLocaleString()}`}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Gross Margin %</td>
                        {compareData.map((p) => {
                          const marginVal = p.financials.margin;
                          const allMargins = compareData.map(d => d.financials.margin);
                          return (
                            <td key={p.project.id} className="p-3 text-xs border-l border-slate-100">
                              <span className={cn("px-2.5 py-1 rounded-lg inline-block text-slate-950 font-black", getHighlightClass("margin", marginVal, allMargins))}>
                                {isEmployee ? "RESTRICTED" : `${marginVal.toFixed(1)}%`}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Tax / GST (INR)</td>
                        {compareData.map((p) => (
                          <td key={p.project.id} className="p-3 text-xs font-black text-slate-950 border-l border-slate-100">
                            {isEmployee ? "RESTRICTED" : `₹${Math.round(p.financials.tax || 0).toLocaleString()}`}
                          </td>
                        ))}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Discounts Given</td>
                        {compareData.map((p) => (
                          <td key={p.project.id} className="p-3 text-xs font-black text-slate-950 border-l border-slate-100">
                            {isEmployee ? "RESTRICTED" : `₹${Math.round(p.financials.discount || 0).toLocaleString()}`}
                          </td>
                        ))}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Finance Charge %</td>
                        {compareData.map((p) => (
                          <td key={p.project.id} className="p-3 text-xs font-black text-slate-950 border-l border-slate-100">
                            {isEmployee ? "RESTRICTED" : `${(p.financials.financePercent || 0).toFixed(1)}%`}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* ================= B. BOQ COMPARISON ================= */}
                  <tr 
                    onClick={() => toggleSection("boq")}
                    className="bg-slate-100 border-y border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors"
                  >
                    <td colSpan={compareData.length + 1} className="p-3 text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
                      <span className="flex items-center gap-2"><Layers size={14} className="text-amber-500" /> B. BOQ & Resource Splits</span>
                      {expandedSections.boq ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>

                  {expandedSections.boq && (
                    <>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Total Items Count</td>
                        {compareData.map((p) => (
                          <td key={p.project.id} className="p-3 text-xs font-black text-slate-950 border-l border-slate-100">
                            {p.financials.itemCount} items
                          </td>
                        ))}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Material Cost Share</td>
                        {compareData.map((p) => {
                          const mat = p.financials.materialCost;
                          const percentage = mat / (p.financials.materialCost + p.financials.labourCost || 1) * 100;
                          return (
                            <td key={p.project.id} className="p-3 text-xs border-l border-slate-100">
                              {isEmployee ? (
                                <span className="font-black text-slate-900">RESTRICTED</span>
                              ) : (
                                <div>
                                  <span className="block font-black text-slate-950 text-xs">₹{Math.round(mat).toLocaleString()}</span>
                                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{percentage.toFixed(0)}% contribution</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Labour Cost Share</td>
                        {compareData.map((p) => {
                          const lab = p.financials.labourCost;
                          const percentage = lab / (p.financials.materialCost + p.financials.labourCost || 1) * 100;
                          return (
                            <td key={p.project.id} className="p-3 text-xs border-l border-slate-100">
                              {isEmployee ? (
                                <span className="font-black text-slate-900">RESTRICTED</span>
                              ) : (
                                <div>
                                  <span className="block font-black text-slate-950 text-xs">₹{Math.round(lab).toLocaleString()}</span>
                                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">{percentage.toFixed(0)}% contribution</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  )}

                  {/* ================= C. VERSION COMPARISON ================= */}
                  <tr 
                    onClick={() => toggleSection("versions")}
                    className="bg-slate-100 border-y border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors"
                  >
                    <td colSpan={compareData.length + 1} className="p-3 text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
                      <span className="flex items-center gap-2"><Activity size={14} className="text-amber-500" /> C. Version Summary Matrix</span>
                      {expandedSections.versions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>

                  {expandedSections.versions && (
                    <>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Latest Version</td>
                        {compareData.map((p) => (
                          <td key={p.project.id} className="p-3 text-xs border-l border-slate-100">
                            <Badge className="bg-slate-950 text-white font-extrabold px-2 h-5 rounded-md text-[10px]">
                              {p.selectedVersion ? `V${p.selectedVersion.version_number}` : "N/A"}
                            </Badge>
                          </td>
                        ))}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Latest Status</td>
                        {compareData.map((p) => (
                          <td key={p.project.id} className="p-3 text-xs border-l border-slate-100">
                            <Badge className={cn("font-black tracking-wider uppercase text-[8px] h-4.5 px-2",
                              p.selectedVersion?.status === 'approved' ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-blue-50 text-blue-800"
                            )}>
                              {p.selectedVersion?.status || "N/A"}
                            </Badge>
                          </td>
                        ))}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Total Revisions</td>
                        {compareData.map((p) => (
                          <td key={p.project.id} className="p-3 text-xs font-black text-slate-950 border-l border-slate-100">
                            {p.versionCount} version iteration(s)
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* ================= D. TIMELINE COMPARISON ================= */}
                  <tr 
                    onClick={() => toggleSection("timeline")}
                    className="bg-slate-100 border-y border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors"
                  >
                    <td colSpan={compareData.length + 1} className="p-3 text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
                      <span className="flex items-center gap-2"><Calendar size={14} className="text-amber-500" /> D. Timeline Comparisons</span>
                      {expandedSections.timeline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>

                  {expandedSections.timeline && (
                    <>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Created Date</td>
                        {compareData.map((p) => (
                          <td key={p.project.id} className="p-3 text-xs font-black text-slate-950 border-l border-slate-100">
                            {new Date(p.project.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                        ))}
                      </tr>

                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 pl-6 text-xs font-black text-slate-900 uppercase">Last Updated</td>
                        {compareData.map((p) => (
                          <td key={p.project.id} className="p-3 text-xs font-black text-slate-950 border-l border-slate-100">
                            {new Date(p.project.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* ================= E. PRODUCT COMPARISON ================= */}
                  <tr 
                    onClick={() => toggleSection("products")}
                    className="bg-slate-200 border-y border-slate-300 cursor-pointer hover:bg-slate-300/80 transition-colors"
                  >
                    <td colSpan={compareData.length + 1} className="p-3 text-xs font-black uppercase tracking-widest text-slate-950 flex items-center justify-between">
                      <span className="flex items-center gap-2"><Briefcase size={14} className="text-blue-600" /> E. Side-by-Side Product BOQ Items</span>
                      {expandedSections.products ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>

                  {expandedSections.products && (
                    <>
                      {uniqueProducts.length > 0 ? (
                        uniqueProducts.map((prod) => (
                          <tr key={prod.productName} className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 pl-6 text-xs leading-tight">
                              <span className="font-extrabold block text-slate-950">{prod.productName}</span>
                              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">{prod.category} | {prod.unit}</span>
                            </td>
                            {compareData.map((p) => {
                              const match = p.items?.find((item: any) => item.productName === prod.productName);
                              return (
                                <td key={p.project.id} className="p-3 text-xs border-l border-slate-100">
                                  {match ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center justify-between text-[10px] font-bold">
                                        <span className="text-slate-700 uppercase font-black">Qty:</span>
                                        <span className="text-slate-950 font-black">{match.qty} {prod.unit}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] font-bold">
                                        <span className="text-slate-700 uppercase font-black">Rate:</span>
                                        <span className="text-slate-950 font-black">₹{Math.round(match.rate).toLocaleString()}</span>
                                      </div>
                                      <div className="flex items-center justify-between border-t border-slate-100 pt-0.5 text-[10px] font-bold">
                                        <span className="text-blue-700 uppercase font-black">Total:</span>
                                        <span className="text-slate-950 font-black text-[11px]">₹{Math.round(match.total).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-black text-slate-400 italic uppercase">Not Included</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={compareData.length + 1} className="p-8 text-center text-xs font-black text-slate-500 italic">
                            No product details found for comparison versions.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  ShoppingCart,
  Users,
  Percent,
  ClipboardList,
  FolderKanban,
  GitBranch,
  Layers,
  Package,
  Building2,
  FileText,
  Activity,
  ShieldCheck,
  ChevronRight,
  Search,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface ReportItem {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: any;
  badge?: string;
  isPopular?: boolean;
}

export const ALL_REPORTS_LIST: ReportItem[] = [
  // 1. Business & Financial
  {
    id: "executive-summary",
    title: "Executive Financial Dashboard",
    category: "Business & Financial",
    description: "Executive high-level KPIs, monthly spend trends, project commitments, delivery rates, and vendor share.",
    icon: TrendingUp,
    badge: "Executive",
    isPopular: true,
  },
  {
    id: "budget-vs-actual",
    title: "Budget vs Actual Spending",
    category: "Business & Financial",
    description: "Detailed project-by-project analysis of Allocated Budget vs PO Commitments, Variances, and Over-budget alerts.",
    icon: DollarSign,
    badge: "Critical",
    isPopular: true,
  },
  {
    id: "monthly-spend",
    title: "Monthly Spending & Cash Flow",
    category: "Business & Financial",
    description: "Month-by-month spending velocity over the last 3, 6, and 12 months with trend lines and growth comparisons.",
    icon: FileSpreadsheet,
  },
  {
    id: "budget-exceed-audit",
    title: "Budget Exceed & Overspend Audit",
    category: "Business & Financial",
    description: "Audit trail of every project or PO that exceeded authorized budget, with reasons and authorization details.",
    icon: AlertTriangle,
    badge: "Audit",
  },

  // 2. Purchase & Procurement
  {
    id: "po-register",
    title: "Purchase Order Register & Detail",
    category: "Procurement & POs",
    description: "Complete register of all 760+ POs with vendor, project, subtotal, tax, total, status, delivery, and payments.",
    icon: ShoppingCart,
    badge: "Core",
    isPopular: true,
  },
  {
    id: "vendor-spend",
    title: "Vendor Spend & Share Analysis",
    category: "Procurement & POs",
    description: "Analysis of spending across all 260+ vendors, average order value, ratings, and wallet share concentration.",
    icon: Users,
    isPopular: true,
  },
  {
    id: "rate-savings",
    title: "PO Rate Reduction & Savings History",
    category: "Procurement & POs",
    description: "Cost reduction savings achieved through negotiated rates vs original rates, with authorization history.",
    icon: Percent,
    badge: "Savings",
  },
  {
    id: "po-requests-pipeline",
    title: "PO Requests vs Release Pipeline",
    category: "Procurement & POs",
    description: "Tracking department PO requests from initiation to approval and release of final purchase orders.",
    icon: ClipboardList,
  },

  // 3. Projects & BOQ / BOM Performance
  {
    id: "projects-portfolio",
    title: "Project Portfolio Performance",
    category: "Projects & BOQ",
    description: "Project performance analysis across all 180+ projects: client, budget, square feet, profit margins, and PO spend.",
    icon: FolderKanban,
    isPopular: true,
  },
  {
    id: "bom-boq-revisions",
    title: "BOM & BOQ Revision Evolution",
    category: "Projects & BOQ",
    description: "Version history analysis tracking changes, lock status, and budget revisions across project versions.",
    icon: GitBranch,
  },

  // 4. Materials & Item Master
  {
    id: "materials-catalog",
    title: "Material Master & Price Book",
    category: "Materials & Master",
    description: "Catalog of 2,380+ materials with benchmark rates, categories, units, tax codes (HSN/SAC), and vendors.",
    icon: Package,
  },
  {
    id: "material-consumption",
    title: "Material Spend & Top Purchases",
    category: "Materials & Master",
    description: "Ranking of materials by total expenditure in purchase orders and quantity procured.",
    icon: Layers,
    isPopular: true,
  },

  // 5. Vendors & Suppliers
  {
    id: "vendor-directory",
    title: "Vendor Directory & Ratings",
    category: "Vendors & Suppliers",
    description: "Comprehensive directory of registered suppliers, categories, cities, ratings, and order history.",
    icon: Building2,
  },

  // 6. Sales & Client Proposals
  {
    id: "client-proposals",
    title: "Client Proposals & Revenue Pipeline",
    category: "Sales & Proposals",
    description: "Register of client proposals, version numbers, statuses, associated projects, and potential contract values.",
    icon: FileText,
  },

  // 7. Site & Field Operations
  {
    id: "site-progress",
    title: "Site Daily Reports & Logs",
    category: "Site Management",
    description: "Daily site engineering reports, task progress percentages, labour deployment, and work completion tracking.",
    icon: Activity,
  },

  // 8. System Activity & Audit Trail
  {
    id: "audit-trail",
    title: "System Activity & Audit Trail",
    category: "Audit & Security",
    description: "39,000+ security and audit event logs recording user actions, logins, updates, and navigation across modules.",
    icon: ShieldCheck,
    badge: "Security",
  },
];

interface ReportsCatalogProps {
  onSelectReport: (reportId: string) => void;
}

export function ReportsCatalog({ onSelectReport }: ReportsCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Categories" },
    { id: "Business & Financial", label: "Business & Financial" },
    { id: "Procurement & POs", label: "Procurement & POs" },
    { id: "Projects & BOQ", label: "Projects & BOQ" },
    { id: "Materials & Master", label: "Materials & Master" },
    { id: "Vendors & Suppliers", label: "Vendors & Suppliers" },
    { id: "Sales & Proposals", label: "Sales & Proposals" },
    { id: "Site Management", label: "Site Management" },
    { id: "Audit & Security", label: "Audit & Security" },
  ];

  const filteredReports = ALL_REPORTS_LIST.filter((rep) => {
    const matchesCategory =
      selectedCategory === "all" || rep.category === selectedCategory;
    const matchesSearch =
      rep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedReports = categories
    .filter((c) => c.id !== "all")
    .map((cat) => ({
      category: cat.label,
      reports: filteredReports.filter((r) => r.category === cat.label),
    }))
    .filter((g) => g.reports.length > 0);

  return (
    <div className="space-y-6">
      {/* Search & Category Filter Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search all reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm bg-background"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Featured / Popular Reports Spotlight */}
      {selectedCategory === "all" && !searchQuery && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Most Popular Reports
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ALL_REPORTS_LIST.filter((r) => r.isPopular).map((rep) => {
              const Icon = rep.icon;
              return (
                <Card
                  key={rep.id}
                  onClick={() => onSelectReport(rep.id)}
                  className="group hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer border border-border bg-gradient-to-br from-card to-card/60"
                >
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                        <Icon className="h-5 w-5" />
                      </div>
                      {rep.badge && (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                          {rep.badge}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                        <span>{rep.title}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {rep.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Grouped Reports by Category */}
      <div className="space-y-6">
        {groupedReports.map((group) => (
          <div key={group.category} className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>{group.category}</span>
                <Badge variant="secondary" className="text-[10px] font-semibold">
                  {group.reports.length} Reports
                </Badge>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {group.reports.map((report) => {
                const Icon = report.icon;
                return (
                  <div
                    key={report.id}
                    onClick={() => onSelectReport(report.id)}
                    className="flex items-start gap-3.5 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group"
                  >
                    <div className="p-2.5 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 justify-between">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {report.title}
                        </h3>
                        {report.badge && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                            {report.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {report.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {groupedReports.length === 0 && (
          <div className="text-center py-12 border border-dashed rounded-xl bg-card">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-foreground">No reports found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No reports match your search query "{searchQuery}".
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

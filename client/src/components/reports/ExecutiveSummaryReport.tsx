import React from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Building2,
  Package,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PieChart as PieChartIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/reportsExport";

interface ExecutiveSummaryReportProps {
  data: {
    kpis?: any;
    monthlySpend?: any[];
    poStatusDistribution?: any[];
    topVendors?: any[];
    topProjects?: any[];
    budgetExceedSummary?: any;
  } | null;
  loading: boolean;
  onNavigateToReport: (reportId: string) => void;
}

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];

export function ExecutiveSummaryReport({
  data,
  loading,
  onNavigateToReport,
}: ExecutiveSummaryReportProps) {
  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading Executive Analytics...</p>
      </div>
    );
  }

  const kpis = data.kpis || {};
  const monthlySpend = data.monthlySpend || [];
  const poStatusDist = data.poStatusDistribution || [];
  const topVendors = data.topVendors || [];
  const topProjects = data.topProjects || [];
  const exceedSummary = data.budgetExceedSummary || {};

  // Formatted pie data
  const pieData = poStatusDist.map((s) => ({
    name: (s.status || "draft").toUpperCase(),
    value: parseFloat(s.total_amount || 0),
    count: parseInt(s.count || 0),
  }));

  return (
    <div className="space-y-6">
      {/* KPI Highlight Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spend */}
        <Card className="border border-border shadow-sm hover:border-primary/40 transition-all bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total PO Spend (Filtered)
              </span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-foreground">
                {formatCompactCurrency(kpis.filtered_po_total)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Exact: {formatCurrency(kpis.filtered_po_total)}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Orders: <strong className="text-foreground">{kpis.filtered_po_count || 0} POs</strong></span>
              <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">
                Committed
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Delivered Value */}
        <Card className="border border-border shadow-sm hover:border-emerald-500/40 transition-all bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Delivered / Fulfilled
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-foreground">
                {formatCompactCurrency(kpis.delivered_po_total)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Exact: {formatCurrency(kpis.delivered_po_total)}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Fulfillment:{" "}
                <strong className="text-emerald-600">
                  {kpis.filtered_po_total > 0
                    ? `${((kpis.delivered_po_total / kpis.filtered_po_total) * 100).toFixed(1)}%`
                    : "0%"}
                </strong>
              </span>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">
                Delivered
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Active Projects */}
        <Card className="border border-border shadow-sm hover:border-indigo-500/40 transition-all bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Project Portfolio
              </span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-foreground">
                {kpis.total_projects || 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Active Projects: <strong className="text-indigo-600">{kpis.active_projects || 0}</strong>
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Proposals: <strong className="text-foreground">{kpis.total_proposals || 0}</strong></span>
              <button
                onClick={() => onNavigateToReport("projects-portfolio")}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                View <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Vendors & Materials */}
        <Card className="border border-border shadow-sm hover:border-amber-500/40 transition-all bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Supply Chain Ecosystem
              </span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-black text-foreground">
                {kpis.total_vendors || 0}{" "}
                <span className="text-sm font-medium text-muted-foreground">Vendors</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Catalog: <strong className="text-foreground">{kpis.total_materials || 0} Materials</strong>
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Overspend Events:{" "}
                <strong className="text-rose-600">{exceedSummary.exceed_count || 0}</strong>
              </span>
              <button
                onClick={() => onNavigateToReport("budget-vs-actual")}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                Variance <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Spending Trend Area Chart (2 Cols) */}
        <Card className="lg:col-span-2 border border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Monthly Spend & Procurement Velocity (Last 12 Months)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total purchase order expenditure committed month-over-month.
              </p>
            </div>
            <button
              onClick={() => onNavigateToReport("monthly-spend")}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Full Details <ArrowUpRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlySpend}
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    stroke="#94A3B8"
                  />
                  <YAxis
                    tickFormatter={(val) => formatCompactCurrency(val)}
                    tick={{ fontSize: 11 }}
                    stroke="#94A3B8"
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(val), "Spend Amount"]}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderRadius: "8px",
                      color: "#fff",
                      border: "none",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSpend)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* PO Status Breakdown Pie Chart (1 Col) */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-emerald-600" />
              PO Status Distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Breakdown by order lifecycle state.
            </p>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(val), "Amount"]}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderRadius: "8px",
                      color: "#fff",
                      border: "none",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Status Legend Pills */}
            <div className="space-y-1.5 mt-2">
              {pieData.slice(0, 4).map((entry, idx) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="font-medium text-foreground">{entry.name}</span>
                    <span className="text-[10px] text-muted-foreground">({entry.count} POs)</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {formatCompactCurrency(entry.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Projects & Top Vendors Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Projects by PO Spend */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Top 5 Projects by Procurement Spend
              </CardTitle>
            </div>
            <button
              onClick={() => onNavigateToReport("projects-portfolio")}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              All Projects <ArrowUpRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {topProjects.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate max-w-[220px]">
                        {p.project_name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {p.po_count} Purchase Orders
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-foreground block">
                      {formatCurrency(p.total_spend)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatCompactCurrency(p.total_spend)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Suppliers by PO Spend */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                Top 5 Vendors by Spend
              </CardTitle>
            </div>
            <button
              onClick={() => onNavigateToReport("vendor-spend")}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              All Vendors <ArrowUpRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {topVendors.map((v, idx) => (
                <div
                  key={idx}
                  className="p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate max-w-[220px]">
                        {v.vendor_name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {v.po_count} Orders Delivered / Active
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-foreground block">
                      {formatCurrency(v.total_spend)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatCompactCurrency(v.total_spend)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

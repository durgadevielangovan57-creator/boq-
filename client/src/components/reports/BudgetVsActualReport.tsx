import React, { useState } from "react";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Building2,
  Search,
  ArrowUpDown,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatCompactCurrency } from "@/lib/reportsExport";

interface BudgetVsActualReportProps {
  records: any[];
  loading: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  onSelectProject?: (projectId: string) => void;
}

export function BudgetVsActualReport({
  records,
  loading,
  search,
  onSearchChange,
  onSelectProject,
}: BudgetVsActualReportProps) {
  const [sortField, setSortField] = useState<string>("actual_po_spend");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Compute Aggregates
  const totalBudget = records.reduce((sum, r) => sum + parseFloat(r.allocated_budget || 0), 0);
  const totalSpend = records.reduce((sum, r) => sum + parseFloat(r.actual_po_spend || 0), 0);
  const totalDelivered = records.reduce((sum, r) => sum + parseFloat(r.delivered_spend || 0), 0);
  const overBudgetCount = records.filter((r) => parseFloat(r.actual_po_spend || 0) > parseFloat(r.allocated_budget || 0) && parseFloat(r.allocated_budget || 0) > 0).length;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    const aVal = parseFloat(a[sortField] || 0) || a[sortField] || "";
    const bVal = parseFloat(b[sortField] || 0) || b[sortField] || "";
    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Allocated Budget
            </span>
            <div className="text-2xl font-black text-foreground mt-2">
              {formatCompactCurrency(totalBudget)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Exact: {formatCurrency(totalBudget)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Actual PO Spend
            </span>
            <div className="text-2xl font-black text-foreground mt-2">
              {formatCompactCurrency(totalSpend)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Exact: {formatCurrency(totalSpend)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Delivered / Invoiced Spend
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-2">
              {formatCompactCurrency(totalDelivered)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Exact: {formatCurrency(totalDelivered)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Over-Budget Projects
            </span>
            <div className="text-2xl font-black text-rose-600 mt-2 flex items-center gap-2">
              <span>{overBudgetCount}</span>
              {overBudgetCount > 0 && (
                <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Projects exceeding allocated budgets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Budget vs Actual Data Table */}
      <Card className="border border-border shadow-sm bg-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-foreground">
              Project Budget vs PO Spend Matrix
            </h3>
            <p className="text-xs text-muted-foreground">
              Real-time variance tracking between project allocated budget and purchase order commitments.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search project or client..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center text-xs">#</TableHead>
                <TableHead
                  className="text-xs cursor-pointer hover:text-primary"
                  onClick={() => handleSort("project_name")}
                >
                  <div className="flex items-center gap-1">
                    <span>Project Name & Client</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort("allocated_budget")}
                >
                  Allocated Budget
                </TableHead>
                <TableHead
                  className="text-xs text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort("actual_po_spend")}
                >
                  Actual PO Spend
                </TableHead>
                <TableHead className="text-xs text-right">Delivered</TableHead>
                <TableHead
                  className="text-xs text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort("variance_amount")}
                >
                  Variance (Diff)
                </TableHead>
                <TableHead className="text-xs text-center w-40">Budget Utilization</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-xs">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading budget comparison data...
                  </TableCell>
                </TableRow>
              ) : sortedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-xs">
                    No project records found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRecords.map((row, idx) => {
                  const budget = parseFloat(row.allocated_budget || 0);
                  const spend = parseFloat(row.actual_po_spend || 0);
                  const variance = budget - spend;
                  const pct = budget > 0 ? (spend / budget) * 100 : (spend > 0 ? 100 : 0);
                  const isOver = budget > 0 && spend > budget;
                  const isNear = budget > 0 && pct >= 80 && pct <= 100;

                  return (
                    <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center text-xs font-medium text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[180px]">
                          <span className="font-bold text-xs text-foreground block hover:text-primary cursor-pointer">
                            {row.project_name}
                          </span>
                          <span className="text-[11px] text-muted-foreground block">
                            Client: {row.client_name || "N/A"} • {row.po_count} POs
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold text-foreground">
                        {formatCurrency(budget)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-foreground">
                        {formatCurrency(spend)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-emerald-600 font-medium">
                        {formatCurrency(row.delivered_spend)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs font-bold ${
                          variance < 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {formatCurrency(variance)}
                      </TableCell>
                      <TableCell className="w-40">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-medium">{pct.toFixed(1)}%</span>
                            <span className="text-muted-foreground">
                              {spend > budget && budget > 0 ? "Exceeded" : "Used"}
                            </span>
                          </div>
                          <Progress
                            value={Math.min(pct, 100)}
                            className={`h-2 ${
                              isOver
                                ? "[&>div]:bg-rose-500 bg-rose-100"
                                : isNear
                                ? "[&>div]:bg-amber-500 bg-amber-100"
                                : "[&>div]:bg-emerald-500 bg-emerald-100"
                            }`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isOver ? (
                          <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0">
                            <AlertTriangle className="h-3 w-3" /> Over Budget
                          </Badge>
                        ) : isNear ? (
                          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 bg-amber-50 px-1.5 py-0">
                            Near Limit
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-600 bg-emerald-50 px-1.5 py-0">
                            Within Budget
                          </Badge>
                        )}
                        {row.exceed_count > 0 && (
                          <span className="block text-[9px] text-rose-500 font-semibold mt-0.5">
                            {row.exceed_count} override(s)
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

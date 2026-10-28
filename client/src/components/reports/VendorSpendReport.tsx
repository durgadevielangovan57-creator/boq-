import React, { useState } from "react";
import {
  Users,
  DollarSign,
  ShoppingCart,
  Star,
  MapPin,
  Search,
  ArrowUpDown,
  Building2,
  TrendingUp,
  RotateCcw,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { formatCurrency, formatCompactCurrency, formatDate } from "@/lib/reportsExport";

interface VendorSpendReportProps {
  records: any[];
  loading: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  onSelectDateRange?: (range: string) => void;
  onSelectProject?: (projectId: string) => void;
}

export function VendorSpendReport({
  records,
  loading,
  search,
  onSearchChange,
  onSelectDateRange,
  onSelectProject,
}: VendorSpendReportProps) {
  const [sortField, setSortField] = useState<string>("total_spent");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Compute Aggregates
  const totalSpend = records.reduce((sum, r) => sum + parseFloat(r.total_spent || 0), 0);
  const totalOrders = records.reduce((sum, r) => sum + parseInt(r.total_orders || 0), 0);
  const totalVendors = records.length;
  const avgSpendPerVendor = totalVendors > 0 ? totalSpend / totalVendors : 0;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (["total_spent", "total_orders", "avg_order_value", "rating"].includes(sortField)) {
      aVal = parseFloat(aVal || 0);
      bVal = parseFloat(bVal || 0);
    }
    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  // Top 8 Vendors for chart
  const chartData = sortedRecords.slice(0, 8).map((r) => ({
    name: (r.vendor_name || "Unknown").slice(0, 16),
    fullName: r.vendor_name,
    spent: parseFloat(r.total_spent || 0),
    orders: parseInt(r.total_orders || 0),
  }));

  return (
    <div className={`space-y-6 transition-opacity duration-200 ${loading ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border shadow-sm bg-card relative overflow-hidden">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Vendor Spend
            </span>
            <div className="text-2xl font-black text-primary mt-2">
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
              Active Suppliers
            </span>
            <div className="text-2xl font-black text-foreground mt-2">
              {totalVendors}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Suppliers with PO orders issued
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Orders Dispatched
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-2">
              {totalOrders.toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Total PO transactions fulfilled
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average Spend Per Vendor
            </span>
            <div className="text-2xl font-black text-foreground mt-2">
              {formatCompactCurrency(avgSpendPerVendor)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Mean procurement value per supplier
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Vendors Visual Bar Chart */}
      {chartData.length > 0 && (
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Top Vendors by Procurement Spend (Share of Wallet)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                    stroke="#94A3B8"
                  />
                  <YAxis
                    tickFormatter={(val) => formatCompactCurrency(val)}
                    tick={{ fontSize: 11 }}
                    stroke="#94A3B8"
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(val), "Total Spent"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                      border: "none",
                    }}
                  />
                  <Bar dataKey="spent" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendors Table */}
      <Card className="border border-border shadow-sm bg-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-foreground">
              Supplier Spend Directory
            </h3>
            <p className="text-xs text-muted-foreground">
              Vendor procurement ranking, orders count, and performance metrics.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search vendor name or city..."
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
                  onClick={() => handleSort("vendor_name")}
                >
                  <div className="flex items-center gap-1">
                    <span>Vendor / Company</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-xs">Location</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead
                  className="text-xs text-center cursor-pointer hover:text-primary"
                  onClick={() => handleSort("total_orders")}
                >
                  Orders
                </TableHead>
                <TableHead
                  className="text-xs text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort("total_spent")}
                >
                  Total Spent
                </TableHead>
                <TableHead
                  className="text-xs text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort("avg_order_value")}
                >
                  Avg Order
                </TableHead>
                <TableHead className="text-xs text-center">Share of Wallet</TableHead>
                <TableHead className="text-xs text-right">Last Order Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-xs text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Updating vendor spend data...
                  </TableCell>
                </TableRow>
              ) : sortedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-xs text-muted-foreground">
                    <div className="max-w-md mx-auto space-y-3">
                      <p className="font-semibold text-foreground text-sm">
                        No vendor spend records found for the selected filter.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This project or timeframe might not have any purchase orders issued. Try widening your date range or clearing the project filter.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        {onSelectDateRange && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onSelectDateRange("this_year")}
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            View This Year (2026)
                          </Button>
                        )}
                        {onSelectDateRange && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onSelectDateRange("all")}
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            View All Time
                          </Button>
                        )}
                        {onSelectProject && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onSelectProject("all")}
                          >
                            <Building2 className="h-3 w-3 mr-1" />
                            All Projects
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedRecords.map((v, idx) => {
                  const spent = parseFloat(v.total_spent || 0);
                  const sharePct = totalSpend > 0 ? ((spent / totalSpend) * 100).toFixed(1) : "0";

                  return (
                    <TableRow key={v.vendor_id || idx} className="hover:bg-muted/30 transition-colors text-xs">
                      <TableCell className="text-center text-muted-foreground font-medium">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-foreground block">
                          {v.vendor_name}
                        </span>
                        {v.gstno && (
                          <span className="text-[10px] text-muted-foreground block">
                            GST: {v.gstno}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {v.city ? `${v.city}${v.state ? `, ${v.state}` : ""}` : "-"}
                      </TableCell>
                      <TableCell>
                        {v.vendor_category ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            {v.vendor_category}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-foreground">
                        {v.total_orders || 0}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {formatCurrency(spent)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(v.avg_order_value)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {sharePct}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                        {formatDate(v.last_order_date)}
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

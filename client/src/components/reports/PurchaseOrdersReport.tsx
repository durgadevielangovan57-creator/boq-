import React, { useState } from "react";
import {
  ShoppingCart,
  DollarSign,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Eye,
  ArrowUpDown,
  Building2,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatCompactCurrency, formatDate } from "@/lib/reportsExport";
import { PoDetailModal } from "./PoDetailModal";

interface PurchaseOrdersReportProps {
  records: any[];
  summary: any;
  loading: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedVendorId: string;
  onVendorChange: (vendorId: string) => void;
  vendors: { id: string; name: string }[];
}

export function PurchaseOrdersReport({
  records,
  summary = {},
  loading,
  search,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedVendorId,
  onVendorChange,
  vendors = [],
}: PurchaseOrdersReportProps) {
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const totalCount = parseInt(summary?.total_count || records.length || 0);
  const grandTotal = parseFloat(summary?.grand_total || 0);
  const totalSubtotal = parseFloat(summary?.total_subtotal || 0);
  const totalTax = parseFloat(summary?.total_tax || 0);
  const avgPoValue = parseFloat(summary?.avg_po_value || 0);

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
    if (["total", "subtotal", "tax"].includes(sortField)) {
      aVal = parseFloat(aVal || 0);
      bVal = parseFloat(bVal || 0);
    }
    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = sortedRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getStatusBadge = (status: string) => {
    const s = (status || "draft").toLowerCase();
    switch (s) {
      case "approved":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Approved</Badge>;
      case "ordered":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Ordered</Badge>;
      case "delivered":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">Delivered</Badge>;
      case "pending_approval":
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status || "Draft"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Purchase Orders
            </span>
            <div className="text-2xl font-black text-foreground mt-2">
              {totalCount.toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Across selected date & project filters
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Order Value (Gross)
            </span>
            <div className="text-2xl font-black text-primary mt-2">
              {formatCompactCurrency(grandTotal)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Exact: {formatCurrency(grandTotal)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Tax / GST Paid
            </span>
            <div className="text-2xl font-black text-foreground mt-2">
              {formatCompactCurrency(totalTax)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Subtotal: {formatCompactCurrency(totalSubtotal)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average PO Value
            </span>
            <div className="text-2xl font-black text-foreground mt-2">
              {formatCompactCurrency(avgPoValue)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Mean value per purchase order
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main PO Register Table Card */}
      <Card className="border border-border shadow-sm bg-card">
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter Dropdown */}
            <Select value={selectedStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="h-8 text-xs w-36 bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="draft" className="text-xs">Draft</SelectItem>
                <SelectItem value="pending_approval" className="text-xs">Pending</SelectItem>
                <SelectItem value="approved" className="text-xs">Approved</SelectItem>
                <SelectItem value="ordered" className="text-xs">Ordered</SelectItem>
                <SelectItem value="delivered" className="text-xs">Delivered</SelectItem>
                <SelectItem value="rejected" className="text-xs">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {/* Vendor Filter Dropdown */}
            <Select value={selectedVendorId} onValueChange={onVendorChange}>
              <SelectTrigger className="h-8 text-xs w-44 bg-background">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all" className="text-xs font-semibold">
                  All Vendors ({vendors.length})
                </SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs truncate max-w-[240px]">
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search PO #, project, vendor..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center text-xs">#</TableHead>
                <TableHead
                  className="text-xs cursor-pointer hover:text-primary"
                  onClick={() => handleSort("po_number")}
                >
                  <div className="flex items-center gap-1">
                    <span>PO Number</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs cursor-pointer hover:text-primary"
                  onClick={() => handleSort("po_date")}
                >
                  Date
                </TableHead>
                <TableHead
                  className="text-xs cursor-pointer hover:text-primary"
                  onClick={() => handleSort("project_name")}
                >
                  Project
                </TableHead>
                <TableHead
                  className="text-xs cursor-pointer hover:text-primary"
                  onClick={() => handleSort("vendor_name")}
                >
                  Vendor / Supplier
                </TableHead>
                <TableHead className="text-xs text-center w-16">Items</TableHead>
                <TableHead
                  className="text-xs text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort("subtotal")}
                >
                  Subtotal
                </TableHead>
                <TableHead
                  className="text-xs text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort("tax")}
                >
                  Tax
                </TableHead>
                <TableHead
                  className="text-xs text-right cursor-pointer hover:text-primary"
                  onClick={() => handleSort("total")}
                >
                  Total (₹)
                </TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs text-center w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-xs text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading purchase orders...
                  </TableCell>
                </TableRow>
              ) : paginatedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-xs text-muted-foreground">
                    No purchase orders match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRecords.map((po, idx) => (
                  <TableRow key={po.id} className="hover:bg-muted/30 transition-colors text-xs">
                    <TableCell className="text-center text-muted-foreground font-medium">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => {
                          setSelectedPo(po);
                          setDetailModalOpen(true);
                        }}
                        className="font-bold text-primary hover:underline text-left cursor-pointer"
                      >
                        {po.po_number}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(po.po_date || po.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground block max-w-[160px] truncate" title={po.project_name}>
                        {po.project_name || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground block max-w-[160px] truncate" title={po.vendor_name}>
                        {po.vendor_name || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {po.total_items || "-"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(po.subtotal)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(po.tax)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      {formatCurrency(po.total)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(po.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 cursor-pointer"
                        onClick={() => {
                          setSelectedPo(po);
                          setDetailModalOpen(true);
                        }}
                        title="View PO Details"
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {sortedRecords.length > pageSize && (
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length} records
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="px-2 text-foreground font-semibold">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* PO Detail Modal */}
      <PoDetailModal
        po={selectedPo}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </div>
  );
}

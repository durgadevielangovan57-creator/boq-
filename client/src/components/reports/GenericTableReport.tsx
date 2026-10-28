import React, { useState } from "react";
import { Search, ArrowUpDown, Download, Filter } from "lucide-react";
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
import { ColumnDef, formatCurrency, formatDate } from "@/lib/reportsExport";

export interface SummaryCardItem {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}

interface GenericTableReportProps {
  title: string;
  description: string;
  columns: ColumnDef[];
  records: any[];
  loading: boolean;
  summaryCards?: SummaryCardItem[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  defaultSortField?: string;
}

export function GenericTableReport({
  title,
  description,
  columns,
  records,
  loading,
  summaryCards = [],
  searchPlaceholder = "Search records...",
  emptyMessage = "No records found.",
  defaultSortField,
}: GenericTableReportProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>(
    defaultSortField || (columns[0]?.key || "id")
  );
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return Object.values(r).some((v) =>
      String(v || "").toLowerCase().includes(term)
    );
  });

  const sortedRecords = [...filteredRecords].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    const colDef = columns.find((c) => c.key === sortField);
    if (colDef?.format === "currency" || colDef?.format === "number") {
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

  const renderCellContent = (col: ColumnDef, val: any) => {
    if (val === null || val === undefined || val === "") return "-";

    if (col.format === "currency") {
      return (
        <span className="font-semibold text-foreground">
          {formatCurrency(val)}
        </span>
      );
    }
    if (col.format === "date") {
      return <span className="text-muted-foreground">{formatDate(val)}</span>;
    }
    if (col.format === "percentage") {
      return <span>{val ? `${val}%` : "0%"}</span>;
    }

    // Status badges for common status fields
    if (col.key === "status") {
      const s = String(val).toLowerCase();
      if (s === "approved" || s === "completed") {
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 capitalize">{val}</Badge>;
      }
      if (s === "pending" || s === "pending_approval" || s === "in progress") {
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 capitalize">{val}</Badge>;
      }
      if (s === "rejected" || s === "failed" || s === "cancelled") {
        return <Badge variant="destructive" className="capitalize">{val}</Badge>;
      }
      return <Badge variant="outline" className="capitalize">{val}</Badge>;
    }

    return <span>{String(val)}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Metric Summary Cards (if provided) */}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card, idx) => (
            <Card key={idx} className="border border-border shadow-sm bg-card">
              <CardContent className="p-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {card.label}
                </span>
                <div className={`text-2xl font-black mt-2 ${card.color || "text-foreground"}`}>
                  {card.value}
                </div>
                {card.subtext && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {card.subtext}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Table Card */}
      <Card className="border border-border shadow-sm bg-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center text-xs">#</TableHead>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`text-xs cursor-pointer hover:text-primary ${
                      col.format === "currency" || col.format === "number"
                        ? "text-right"
                        : col.key === "status"
                        ? "text-center"
                        : "text-left"
                    }`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        col.format === "currency" || col.format === "number"
                          ? "justify-end"
                          : col.key === "status"
                          ? "justify-center"
                          : "justify-start"
                      }`}
                    >
                      <span>{col.header}</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="text-center py-12 text-xs text-muted-foreground"
                  >
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading report data...
                  </TableCell>
                </TableRow>
              ) : paginatedRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="text-center py-12 text-xs text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRecords.map((row, idx) => (
                  <TableRow key={row.id || idx} className="hover:bg-muted/30 transition-colors text-xs">
                    <TableCell className="text-center text-muted-foreground font-medium">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`${
                          col.format === "currency" || col.format === "number"
                            ? "text-right"
                            : col.key === "status"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {renderCellContent(col, row[col.key])}
                      </TableCell>
                    ))}
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
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { ReportsHeader, FilterState } from "@/components/reports/ReportsHeader";
import { ReportsCatalog, ALL_REPORTS_LIST } from "@/components/reports/ReportsCatalog";
import { ExecutiveSummaryReport } from "@/components/reports/ExecutiveSummaryReport";
import { BudgetVsActualReport } from "@/components/reports/BudgetVsActualReport";
import { PurchaseOrdersReport } from "@/components/reports/PurchaseOrdersReport";
import { VendorSpendReport } from "@/components/reports/VendorSpendReport";
import { GenericTableReport, SummaryCardItem } from "@/components/reports/GenericTableReport";
import {
  ColumnDef,
  exportToExcel,
  exportToCsv,
  exportToPdf,
  formatCurrency,
  formatCompactCurrency,
} from "@/lib/reportsExport";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/store";
import apiFetch from "@/lib/api";

export default function Reports() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute<{ reportId: string }>("/reports/:reportId");
  const { user } = useData();
  const isAdminOrSoftware = user?.role === "admin" || user?.role === "software_team";

  const [currentReportId, setCurrentReportId] = useState<string | null>(
    params?.reportId || null
  );

  // Sync route param with state
  useEffect(() => {
    if (params?.reportId) {
      setCurrentReportId(params.reportId);
    } else {
      setCurrentReportId(null);
    }
  }, [params?.reportId]);

  // Global Filter State (Defaulting to last3months as requested)
  const [filters, setFilters] = useState<FilterState>({
    dateRange: "last3months",
    startDate: "",
    endDate: "",
    projectId: "all",
    vendorId: "all",
    status: "all",
    search: "",
  });

  // Filter Metadata from server
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);

  // Active Report Data State
  const [reportData, setReportData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Load Filters on Mount
  useEffect(() => {
    const loadFilters = async () => {
      setLoadingFilters(true);
      try {
        const res = await apiFetch("/api/reports/filters");
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
          setVendors(data.vendors || []);
        }
      } catch (e) {
        console.warn("Failed to load report filter options:", e);
      } finally {
        setLoadingFilters(false);
      }
    };
    loadFilters();
  }, []);

  // Fetch Active Report Data
  const fetchReportData = useCallback(async () => {
    setLoadingData(true);
    try {
      const qParams = new URLSearchParams({
        dateRange: filters.dateRange,
        startDate: filters.startDate,
        endDate: filters.endDate,
        projectId: filters.projectId,
        vendorId: filters.vendorId,
        status: filters.status,
        search: filters.search,
      });

      let endpoint = "/api/reports/dashboard-summary";

      if (currentReportId === "executive-summary" || !currentReportId) {
        endpoint = `/api/reports/dashboard-summary?${qParams.toString()}`;
      } else if (currentReportId === "budget-vs-actual") {
        endpoint = `/api/reports/financial/budget-vs-actual?${qParams.toString()}`;
      } else if (currentReportId === "po-register") {
        endpoint = `/api/reports/procurement/purchase-orders?${qParams.toString()}`;
      } else if (currentReportId === "vendor-spend") {
        endpoint = `/api/reports/procurement/vendor-spend?${qParams.toString()}`;
      } else if (currentReportId === "rate-savings") {
        endpoint = `/api/reports/procurement/rate-savings?${qParams.toString()}`;
      } else if (currentReportId === "po-requests-pipeline") {
        endpoint = `/api/reports/procurement/po-requests?${qParams.toString()}`;
      } else if (currentReportId === "projects-portfolio") {
        endpoint = `/api/reports/projects/performance?${qParams.toString()}`;
      } else if (
        currentReportId === "materials-catalog" ||
        currentReportId === "material-consumption"
      ) {
        endpoint = `/api/reports/materials/catalog-and-spend?${qParams.toString()}`;
      } else if (currentReportId === "client-proposals") {
        endpoint = `/api/reports/sales/proposals?${qParams.toString()}`;
      } else if (currentReportId === "site-progress") {
        endpoint = `/api/reports/site/progress?${qParams.toString()}`;
      } else if (currentReportId === "audit-trail") {
        endpoint = `/api/reports/audit/activity?${qParams.toString()}`;
      } else if (currentReportId === "budget-exceed-audit") {
        endpoint = `/api/reports/financial/budget-vs-actual?${qParams.toString()}`;
      } else if (currentReportId === "monthly-spend") {
        endpoint = `/api/reports/dashboard-summary?${qParams.toString()}`;
      } else if (currentReportId === "vendor-directory") {
        endpoint = `/api/reports/procurement/vendor-spend?${qParams.toString()}`;
      } else if (currentReportId === "bom-boq-revisions") {
        endpoint = `/api/reports/projects/performance?${qParams.toString()}`;
      }

      const res = await apiFetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        const errText = await res.text();
        console.error(`Failed to fetch report [${currentReportId}]:`, res.status, errText);
        setReportData({ records: [], kpis: {}, summary: {}, error: `Failed to load data (${res.status})` });
      }
    } catch (e) {
      console.warn(`Failed to fetch report [${currentReportId}]:`, e);
      setReportData({ records: [], kpis: {}, summary: {}, error: "Network error loading report" });
    } finally {
      setLoadingData(false);
    }
  }, [currentReportId, filters]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Handle report selection
  const handleSelectReport = (reportId: string) => {
    setCurrentReportId(reportId);
    setLocation(`/reports/${reportId}`);
  };

  const handleBackToCatalog = () => {
    setCurrentReportId(null);
    setLocation("/reports");
  };

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  // Identify active report config
  const activeReport = ALL_REPORTS_LIST.find((r) => r.id === currentReportId);

  // Column definitions for export and generic tables
  const getActiveReportColumns = (): ColumnDef[] => {
    switch (currentReportId) {
      case "budget-vs-actual":
        return [
          { header: "Project Name", key: "project_name" },
          { header: "Client", key: "client_name" },
          { header: "Allocated Budget", key: "allocated_budget", format: "currency" },
          { header: "Actual Spend", key: "actual_po_spend", format: "currency" },
          { header: "Delivered", key: "delivered_spend", format: "currency" },
          { header: "Variance", key: "variance_amount", format: "currency" },
          { header: "Utilization %", key: "budget_utilization_pct", format: "percentage" },
          { header: "Status", key: "project_status" },
        ];
      case "po-register":
        return [
          { header: "PO Number", key: "po_number" },
          { header: "PO Date", key: "po_date", format: "date" },
          { header: "Project", key: "project_name" },
          { header: "Vendor", key: "vendor_name" },
          { header: "Items Count", key: "total_items", format: "number" },
          { header: "Subtotal", key: "subtotal", format: "currency" },
          { header: "Tax (GST)", key: "tax", format: "currency" },
          { header: "Total Amount", key: "total", format: "currency" },
          { header: "Status", key: "status" },
        ];
      case "vendor-spend":
      case "vendor-directory":
        return [
          { header: "Vendor Name", key: "vendor_name" },
          { header: "City", key: "city" },
          { header: "Category", key: "vendor_category" },
          { header: "Orders Count", key: "total_orders", format: "number" },
          { header: "Total Spent", key: "total_spent", format: "currency" },
          { header: "Avg Order Value", key: "avg_order_value", format: "currency" },
          { header: "Last Order Date", key: "last_order_date", format: "date" },
        ];
      case "rate-savings":
        return [
          { header: "PO Number", key: "po_number" },
          { header: "Project", key: "project_name" },
          { header: "Vendor", key: "vendor_name" },
          { header: "Item Name", key: "item_name" },
          { header: "Original Rate", key: "original_rate", format: "currency" },
          { header: "Reduced Rate", key: "reduced_rate", format: "currency" },
          { header: "Saved Amount", key: "reduction_amount", format: "currency" },
          { header: "Status", key: "status" },
          { header: "Approved By", key: "approved_by_name" },
        ];
      case "projects-portfolio":
      case "bom-boq-revisions":
        return [
          { header: "Project Name", key: "name" },
          { header: "Client", key: "client" },
          { header: "Location", key: "location" },
          { header: "Allocated Budget", key: "allocated_budget", format: "currency" },
          { header: "Contract Revenue", key: "contract_revenue", format: "currency" },
          { header: "PO Spend", key: "actual_spend", format: "currency" },
          { header: "Profit Margin %", key: "profit_margin_pct", format: "percentage" },
          { header: "Status", key: "status" },
        ];
      case "materials-catalog":
      case "material-consumption":
        return [
          { header: "Material Name", key: "name" },
          { header: "Code", key: "code" },
          { header: "Category", key: "category" },
          { header: "Subcategory", key: "subcategory" },
          { header: "Unit", key: "unit" },
          { header: "Benchmark Rate", key: "catalog_rate", format: "currency" },
          { header: "Total Qty Procured", key: "total_qty_bought", format: "number" },
          { header: "Total Spent", key: "total_amount_spent", format: "currency" },
          { header: "Orders", key: "order_count", format: "number" },
        ];
      case "po-requests-pipeline":
        return [
          { header: "Project Name", key: "project_name" },
          { header: "Requester", key: "requester_name" },
          { header: "Department", key: "department" },
          { header: "Items Count", key: "items_count", format: "number" },
          { header: "Total Qty", key: "total_qty", format: "number" },
          { header: "Status", key: "status" },
          { header: "Created Date", key: "created_at", format: "date" },
        ];
      case "client-proposals":
        return [
          { header: "Project Name", key: "project_name" },
          { header: "Client / Vendor", key: "vendor_name" },
          { header: "Version", key: "version_number", format: "number" },
          { header: "Budget", key: "project_budget" },
          { header: "Status", key: "status" },
          { header: "Created At", key: "created_at", format: "date" },
        ];
      case "site-progress":
        return [
          { header: "Project Name", key: "project_name" },
          { header: "Engineer", key: "engineer_name" },
          { header: "Report Date", key: "report_date", format: "date" },
          { header: "Summary", key: "summary" },
          { header: "Total Tasks", key: "total_tasks", format: "number" },
          { header: "Completed Tasks", key: "completed_tasks", format: "number" },
          { header: "Status", key: "status" },
        ];
      case "audit-trail":
        return [
          { header: "Timestamp", key: "created_at", format: "date" },
          { header: "Username", key: "username" },
          { header: "Role", key: "role" },
          { header: "Module", key: "module" },
          { header: "Action", key: "action" },
          { header: "Details", key: "details" },
          { header: "IP Address", key: "ip_address" },
        ];
      case "monthly-spend":
        return [
          { header: "Month", key: "month" },
          { header: "Orders Count", key: "po_count", format: "number" },
          { header: "Total Amount Spent", key: "amount", format: "currency" },
        ];
      default:
        return [
          { header: "ID", key: "id" },
          { header: "Name / Details", key: "name" },
          { header: "Status", key: "status" },
          { header: "Amount", key: "total", format: "currency" },
        ];
    }
  };

  const getExportRows = (): any[] => {
    if (!reportData) return [];
    if (Array.isArray(reportData)) return reportData;
    if (reportData.records) return reportData.records;
    if (reportData.monthlySpend && currentReportId === "monthly-spend") return reportData.monthlySpend;
    if (reportData.topVendors && currentReportId === "vendor-spend") return reportData.topVendors;
    return [];
  };

  // Export Callbacks
  const handleExportExcel = () => {
    const filename = `${activeReport?.title || "Report"}_${filters.dateRange}`;
    const columns = getActiveReportColumns();
    const rows = getExportRows();
    exportToExcel(filename, activeReport?.title || "Report", columns, rows);
  };

  const handleExportCsv = () => {
    const filename = `${activeReport?.title || "Report"}_${filters.dateRange}`;
    const columns = getActiveReportColumns();
    const rows = getExportRows();
    exportToCsv(filename, columns, rows);
  };

  const handleExportPdf = () => {
    const filename = `${activeReport?.title || "Report"}_${filters.dateRange}`;
    const columns = getActiveReportColumns();
    const rows = getExportRows();
    exportToPdf(
      filename,
      activeReport?.title || "BuildEstimate Report",
      `Filter: ${filters.dateRange} • Total Records: ${rows.length}`,
      columns,
      rows,
      true
    );
  };

  // Render view content based on active report
  const renderReportContent = () => {
    // 1. If no specific report is chosen, show the Zoho Books Reports Master Catalog
    if (!currentReportId) {
      return <ReportsCatalog onSelectReport={handleSelectReport} />;
    }

    // 2. Executive Summary Report
    if (currentReportId === "executive-summary") {
      return (
        <ExecutiveSummaryReport
          data={reportData}
          loading={loadingData}
          onNavigateToReport={handleSelectReport}
        />
      );
    }

    // 3. Budget vs Actual Spend Report
    if (currentReportId === "budget-vs-actual") {
      return (
        <BudgetVsActualReport
          records={reportData?.records || []}
          loading={loadingData}
          search={filters.search}
          onSearchChange={(search) => handleFilterChange({ search })}
        />
      );
    }

    // 4. Purchase Orders Register Report
    if (currentReportId === "po-register") {
      return (
        <PurchaseOrdersReport
          records={reportData?.records || []}
          summary={reportData?.summary}
          loading={loadingData}
          search={filters.search}
          onSearchChange={(search) => handleFilterChange({ search })}
          selectedStatus={filters.status}
          onStatusChange={(status) => handleFilterChange({ status })}
          selectedVendorId={filters.vendorId}
          onVendorChange={(vendorId) => handleFilterChange({ vendorId })}
          vendors={vendors}
        />
      );
    }

    // 5. Vendor Spend Report
    if (currentReportId === "vendor-spend") {
      return (
        <VendorSpendReport
          records={reportData?.records || []}
          loading={loadingData}
          search={filters.search}
          onSearchChange={(search) => handleFilterChange({ search })}
          onSelectDateRange={(dateRange) => handleFilterChange({ dateRange, startDate: "", endDate: "" })}
          onSelectProject={(projectId) => handleFilterChange({ projectId })}
        />
      );
    }

    // 6. Generic Table Reports for all other system modules
    const records = reportData?.records || (Array.isArray(reportData) ? reportData : reportData?.monthlySpend || []);
    const columns = getActiveReportColumns();

    let summaryCards: SummaryCardItem[] = [];
    if (currentReportId === "rate-savings") {
      const totalSaved = reportData?.totalSavings || 0;
      summaryCards = [
        {
          label: "Total Negotiated Savings",
          value: formatCurrency(totalSaved),
          subtext: "Approved rate reductions vs original rates",
          color: "text-emerald-600",
        },
        {
          label: "Negotiation Requests",
          value: records.length,
          subtext: "Total item rate change requests logged",
        },
      ];
    } else if (currentReportId === "projects-portfolio") {
      const totalBudget = records.reduce((s: number, r: any) => s + parseFloat(r.allocated_budget || 0), 0);
      const totalSpend = records.reduce((s: number, r: any) => s + parseFloat(r.actual_spend || 0), 0);
      summaryCards = [
        { label: "Total Projects", value: records.length },
        { label: "Portfolio Budget", value: formatCompactCurrency(totalBudget), subtext: formatCurrency(totalBudget) },
        { label: "Total PO Spend", value: formatCompactCurrency(totalSpend), color: "text-primary" },
      ];
    } else if (currentReportId === "materials-catalog" || currentReportId === "material-consumption") {
      const totalCatalogSpend = records.reduce((s: number, r: any) => s + parseFloat(r.total_amount_spent || 0), 0);
      summaryCards = [
        { label: "Listed Materials", value: records.length },
        { label: "Procured Spend", value: formatCompactCurrency(totalCatalogSpend), color: "text-primary" },
      ];
    } else if (currentReportId === "monthly-spend") {
      const totalMonthlySpend = records.reduce((s: number, r: any) => s + parseFloat(r.amount || 0), 0);
      const totalMonthlyOrders = records.reduce((s: number, r: any) => s + parseInt(r.po_count || 0), 0);
      summaryCards = [
        { label: "Total Period Spend", value: formatCurrency(totalMonthlySpend), color: "text-primary" },
        { label: "Total Purchase Orders", value: totalMonthlyOrders },
      ];
    }

    return (
      <GenericTableReport
        title={activeReport?.title || "Report Records"}
        description={activeReport?.description || "Detailed records and historical tracking."}
        columns={columns}
        records={records}
        loading={loadingData}
        summaryCards={summaryCards}
        searchPlaceholder={`Search ${activeReport?.title || "records"}...`}
      />
    );
  };

  if (user && !isAdminOrSoftware) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            The Reports and Analytics module is restricted to Admin and Software Team members only.
          </p>
          <Button className="mt-4" onClick={() => setLocation("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto pb-12">
        {/* Reports Header Bar */}
        <ReportsHeader
          currentReportId={currentReportId}
          reportTitle={activeReport?.title}
          reportCategory={activeReport?.category}
          onBackToCatalog={handleBackToCatalog}
          filters={filters}
          onFilterChange={handleFilterChange}
          projects={projects}
          onRefresh={fetchReportData}
          onExportExcel={handleExportExcel}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          loading={loadingData}
        />

        {/* Dynamic Report View */}
        {renderReportContent()}
      </div>
    </Layout>
  );
}

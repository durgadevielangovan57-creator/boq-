import React, { useState, useMemo } from "react";
import {
  Calendar,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  FileDown,
  RefreshCw,
  Search,
  ChevronRight,
  ArrowLeft,
  SlidersHorizontal,
  X,
  RotateCcw,
  Check,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface FilterState {
  dateRange: string;
  startDate: string;
  endDate: string;
  projectId: string;
  vendorId: string;
  status: string;
  search: string;
}

interface ReportsHeaderProps {
  currentReportId: string | null;
  reportTitle?: string;
  reportCategory?: string;
  onBackToCatalog: () => void;
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  projects: { id: string; name: string; client?: string }[];
  onRefresh: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  loading?: boolean;
}

export function ReportsHeader({
  currentReportId,
  reportTitle,
  reportCategory,
  onBackToCatalog,
  filters,
  onFilterChange,
  projects,
  onRefresh,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  loading = false,
}: ReportsHeaderProps) {
  const [projectSearch, setProjectSearch] = useState("");
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);

  const datePresets = useMemo(
    () => [
      { id: "this_month", label: "This Month (October 2026)", group: "Standard" },
      { id: "last_month", label: "Last Month (September 2026)", group: "Standard" },
      { id: "last3months", label: "Last 3 Months", group: "Standard" },
      { id: "last6months", label: "Last 6 Months", group: "Standard" },
      { id: "this_year", label: "This Year (2026)", group: "Standard" },
      { id: "last_year", label: "Last Year (2025)", group: "Standard" },
      { id: "7days", label: "Last 7 Days", group: "Standard" },
      { id: "today", label: "Today", group: "Standard" },
      { id: "all", label: "All Time", group: "Standard" },

      // Specific Historical Months
      { id: "month_2026-10", label: "October 2026", group: "Months (2026)" },
      { id: "month_2026-09", label: "September 2026", group: "Months (2026)" },
      { id: "month_2026-08", label: "August 2026", group: "Months (2026)" },
      { id: "month_2026-07", label: "July 2026", group: "Months (2026)" },
      { id: "month_2026-06", label: "June 2026", group: "Months (2026)" },
      { id: "month_2026-05", label: "May 2026", group: "Months (2026)" },
      { id: "month_2026-04", label: "April 2026", group: "Months (2026)" },
      { id: "month_2026-03", label: "March 2026", group: "Months (2026)" },

      // Custom
      { id: "custom", label: "Custom Date Range...", group: "Custom" },
    ],
    []
  );

  const handleDatePresetChange = (presetId: string) => {
    if (presetId === "custom") {
      onFilterChange({ dateRange: "custom" });
    } else {
      onFilterChange({ dateRange: presetId, startDate: "", endDate: "" });
    }
  };

  const getPresetLabel = (id: string) => {
    const found = datePresets.find((p) => p.id === id);
    if (found) return found.label;
    if (id.startsWith("month_")) return id.replace("month_", "Month ");
    if (id.startsWith("year_")) return id.replace("year_", "Year ");
    return id || "Select Date Range";
  };

  // Filtered projects for searchable dropdown
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    const term = projectSearch.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.client && p.client.toLowerCase().includes(term))
    );
  }, [projects, projectSearch]);

  const selectedProjectObj = useMemo(
    () => projects.find((p) => p.id === filters.projectId),
    [projects, filters.projectId]
  );

  const isFilterActive =
    filters.dateRange !== "all" ||
    filters.projectId !== "all" ||
    Boolean(filters.search) ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  const handleResetFilters = () => {
    onFilterChange({
      dateRange: "all",
      startDate: "",
      endDate: "",
      projectId: "all",
      vendorId: "all",
      status: "all",
      search: "",
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-sm mb-6 space-y-4 transition-all">
      {/* Top Bar: Title & Breadcrumb & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {currentReportId ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button
                  onClick={onBackToCatalog}
                  className="hover:text-primary transition-colors flex items-center gap-1 font-medium text-primary cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> All Reports
                </button>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{reportCategory}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-primary font-semibold">{reportTitle}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                {reportTitle}
                <Badge variant="outline" className="text-xs font-normal border-primary/30 text-primary bg-primary/5">
                  {reportCategory}
                </Badge>
              </h1>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold px-2 py-0.5">
                  Enterprise Intelligence Hub
                </Badge>
                <span className="text-xs text-muted-foreground">• Real-time Analytics</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mt-1">
                Reports & Financial Analytics
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Cross-module reports covering Budgets, Purchase Orders, Materials, Projects, Vendors, and Performance.
              </p>
            </div>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-9 gap-1.5 text-xs font-medium cursor-pointer"
            title="Refresh Report Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-9 gap-2 text-xs font-semibold shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Export Report</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                Export Options
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onExportExcel}
                className="gap-2.5 text-xs font-medium cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span>Excel Spreadsheet</span>
                  <span className="text-[10px] text-muted-foreground">Download as .xlsx file</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onExportCsv}
                className="gap-2.5 text-xs font-medium cursor-pointer"
              >
                <FileDown className="h-4 w-4 text-blue-600" />
                <div className="flex flex-col">
                  <span>CSV Document</span>
                  <span className="text-[10px] text-muted-foreground">Universal data file (.csv)</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onExportPdf}
                className="gap-2.5 text-xs font-medium cursor-pointer"
              >
                <FileText className="h-4 w-4 text-rose-600" />
                <div className="flex flex-col">
                  <span>PDF Document</span>
                  <span className="text-[10px] text-muted-foreground">Printable executive report (.pdf)</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Toolbar Bar */}
      <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="flex items-center gap-1.5 text-muted-foreground font-semibold shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span>Filters:</span>
          </div>

          {/* Date Range / Month / Year Selector */}
          <div className="w-[210px]">
            <Select
              value={filters.dateRange}
              onValueChange={handleDatePresetChange}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <Calendar className="h-3.5 w-3.5 text-primary mr-1.5 shrink-0" />
                <SelectValue placeholder="Select Date / Period" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Standard Periods
                  </SelectLabel>
                  {datePresets
                    .filter((p) => p.group === "Standard")
                    .map((preset) => (
                      <SelectItem key={preset.id} value={preset.id} className="text-xs">
                        {preset.label}
                      </SelectItem>
                    ))}
                </SelectGroup>

                <SelectSeparator />

                <SelectGroup>
                  <SelectLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Specific Months (2026)
                  </SelectLabel>
                  {datePresets
                    .filter((p) => p.group === "Months (2026)")
                    .map((preset) => (
                      <SelectItem key={preset.id} value={preset.id} className="text-xs">
                        {preset.label}
                      </SelectItem>
                    ))}
                </SelectGroup>

                <SelectSeparator />

                <SelectGroup>
                  <SelectItem value="custom" className="text-xs font-medium text-primary">
                    Custom Date Range...
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Searchable Project Selector */}
          <div className="w-[230px]">
            <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectPopoverOpen}
                  className="h-8 w-full justify-between text-xs px-2.5 font-normal bg-background hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Filter className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      {filters.projectId === "all"
                        ? `All Projects (${projects.length})`
                        : selectedProjectObj?.name || "Select Project"}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 opacity-50 shrink-0 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-2" align="start">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search projects..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-0.5 text-xs">
                    {/* All Projects Option */}
                    <button
                      type="button"
                      onClick={() => {
                        onFilterChange({ projectId: "all" });
                        setProjectPopoverOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted text-left transition-colors cursor-pointer ${
                        filters.projectId === "all" ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
                      }`}
                    >
                      <span>All Projects ({projects.length})</span>
                      {filters.projectId === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>

                    {filteredProjects.map((p) => {
                      const isSelected = filters.projectId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onFilterChange({ projectId: p.id });
                            setProjectPopoverOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted text-left transition-colors cursor-pointer ${
                            isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="truncate">{p.name}</div>
                            {p.client && (
                              <div className="text-[10px] text-muted-foreground truncate">{p.client}</div>
                            )}
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}

                    {filteredProjects.length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        No projects match "{projectSearch}"
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Search within Report Records */}
          <div className="relative min-w-[160px] max-w-[240px] flex-1">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search in records..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* Applied Filter Tags & Reset All Button */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Badge variant="secondary" className="text-[11px] font-normal py-0.5 px-2 bg-muted/80">
            Period: <span className="font-semibold text-foreground ml-1">{getPresetLabel(filters.dateRange)}</span>
          </Badge>

          {filters.projectId !== "all" && (
            <Badge
              variant="default"
              className="text-[11px] font-normal py-0.5 px-2 max-w-[160px] truncate bg-primary/10 text-primary border border-primary/20 flex items-center gap-1"
            >
              <span className="truncate">{selectedProjectObj?.name || filters.projectId}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ projectId: "all" })}
                className="hover:text-primary-foreground hover:bg-primary rounded-full p-0.5 cursor-pointer"
                title="Clear project filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}

          {filters.search && (
            <Badge
              variant="outline"
              className="text-[11px] font-normal py-0.5 px-2 flex items-center gap-1"
            >
              <span>"{filters.search}"</span>
              <button
                type="button"
                onClick={() => onFilterChange({ search: "" })}
                className="hover:text-foreground cursor-pointer"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}

          {isFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer gap-1"
              title="Reset all filters to All Time & All Projects"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Custom Date Pickers (Shown when 'custom' is active) */}
      {filters.dateRange === "custom" && (
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs bg-muted/40 p-3 rounded-lg border border-border">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" /> Custom Date Range:
          </span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Start:</span>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange({ startDate: e.target.value })}
              className="h-8 w-36 text-xs bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">End:</span>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange({ endDate: e.target.value })}
              className="h-8 w-36 text-xs bg-background"
            />
          </div>
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs font-semibold"
            onClick={onRefresh}
          >
            Apply Range
          </Button>
        </div>
      )}
    </div>
  );
}

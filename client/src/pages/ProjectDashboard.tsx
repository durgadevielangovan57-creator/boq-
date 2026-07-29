import { useEffect, useState, useMemo } from "react"; // Dashboard logic
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  User,
  MapPin,
  ChevronRight,
  ExternalLink,
  Loader2,
  FileText,
  Clock,
  CheckCircle2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  BarChart3,
  IndianRupee,
  PieChart as PieChartIcon,
  Search,
  X,
  FileDown,
  LayoutDashboard,
  ClipboardList,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Activity,
  Layers,
  History,
  ShieldCheck,
  Zap,
  Scale,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn, fuzzySearch } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ProjectCompareView from "@/components/ProjectCompareView";

interface Project {
  id: string;
  name: string;
  client: string;
  budget: string;
  location: string;
  client_address: string;
  gst_no: string;
  project_value: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Version {
  id: string;
  project_id: string;
  version_number: number;
  status: string;
  type: string;
  is_last_final?: boolean;
  final_budget?: number;
  final_revenue?: number;
  final_profit?: number;
  final_margin?: number;
  created_at: string;
  updated_at: string;
}

interface ProfitabilityData {
  id: string;
  version_number: number;
  type: string;
  budgetValue: number;
  revenueValue: number;
  profitValue: number;
  margin: number;
}

interface BudgetExceedLog {
  id: number;
  project_id: string;
  project_budget: string;
  project_value_at_exceed: string;
  exceeded_amount: string;
  reason: string;
  created_at: string;
}

interface ManagementReportData {
  project: Project;
  finalVersion: Version | null;
  versions: Version[];
  categoryBreakdown: {
    name: string;
    budget: number;
    revenue: number;
    profit: number;
    margin: number;
  }[];
  split: {
    material: number;
    labour: number;
    supply: number;
    install: number;
  };
  topCategories: any[];
}

const ProfitDonut = ({ margin }: { margin: number }) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const safeMargin = Math.min(Math.max(margin, 0), 100);
  const offset = circumference - (safeMargin / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <svg className="w-16 h-16 transform -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          className="text-gray-100"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-1000",
            margin >= 20 ? "text-emerald-500" : margin >= 10 ? "text-amber-500" : "text-rose-500"
          )}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-gray-700">{Math.round(margin)}%</span>
    </div>
  );
};

export default function ProjectDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectVersions, setProjectVersions] = useState<Record<string, Version[]>>({});
  const [projectProfitability, setProjectProfitability] = useState<Record<string, ProfitabilityData | null>>({});
  const [projectLogs, setProjectLogs] = useState<Record<string, BudgetExceedLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  
  // Management Report State
  const [selectedReportProjectId, setSelectedReportProjectId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ManagementReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/api/boq-projects");
      if (response.ok) {
        const data = await response.json();
        const projectList = data.projects || [];
        setProjects(projectList);

        // Fetch versions, logs, and profitability in parallel
        const versionPromises = projectList.map((p: Project) =>
          apiFetch(`/api/boq-versions/${p.id}`).then((res) => res.json())
        );
        const logPromises = projectList.map((p: Project) =>
          apiFetch(`/api/budget-exceed-logs/${p.id}`).then((res) => res.json())
        );
        const profitabilityPromises = projectList.map((p: Project) =>
          apiFetch(`/api/projects/${p.id}/final-profitability`).then((res) => res.json())
        );

        const [versionsResults, logsResults, profitResults] = await Promise.all([
          Promise.all(versionPromises),
          Promise.all(logPromises),
          Promise.all(profitabilityPromises)
        ]);

        const versionsMap: Record<string, Version[]> = {};
        const logsMap: Record<string, BudgetExceedLog[]> = {};
        const profitMap: Record<string, ProfitabilityData | null> = {};

        projectList.forEach((p: Project, idx: number) => {
          versionsMap[p.id] = versionsResults[idx].versions || [];
          logsMap[p.id] = logsResults[idx].logs || [];
          
          const rawProfit = profitResults[idx];
          if (rawProfit) {
            profitMap[p.id] = {
              ...rawProfit,
              budgetValue: Number(rawProfit.budgetValue || 0),
              revenueValue: Number(rawProfit.revenueValue || 0),
              profitValue: Number(rawProfit.profitValue || 0),
              margin: Number(rawProfit.margin || 0)
            };
          } else {
            profitMap[p.id] = null;
          }
        });

        setProjectVersions(versionsMap);
        setProjectLogs(logsMap);
        setProjectProfitability(profitMap);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load project data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReportData = async (projectId: string) => {
    try {
      setLoadingReport(true);
      const res = await apiFetch(`/api/projects/${projectId}/management-report`);
      if (res.ok) {
        const data = await res.json();
        
        // Parse strings to numbers for safety
        if (data.finalVersion) {
          data.finalVersion.final_budget = Number(data.finalVersion.final_budget || 0);
          data.finalVersion.final_revenue = Number(data.finalVersion.final_revenue || 0);
          data.finalVersion.final_profit = Number(data.finalVersion.final_profit || 0);
          data.finalVersion.final_margin = Number(data.finalVersion.final_margin || 0);
        }

        if (data.versions) {
          data.versions = data.versions.map((v: any) => ({
            ...v,
            final_budget: Number(v.final_budget || 0),
            final_revenue: Number(v.final_revenue || 0),
            final_profit: Number(v.final_profit || 0),
            final_margin: Number(v.final_margin || 0),
          }));
        }

        if (data.split) {
          data.split.material = Number(data.split.material || 0);
          data.split.labour = Number(data.split.labour || 0);
        }

        setReportData(data);
        setSelectedReportProjectId(projectId);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to load management report." });
    } finally {
      setLoadingReport(false);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    return projects.filter(p => fuzzySearch(searchTerm, [p.name, p.client, p.location]));
  }, [projects, searchTerm]);

  const toggleExpand = (projectId: string) => {
    setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "submitted":
      case "finalized":
      case "approved":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 text-[10px] h-5">
            <CheckCircle2 size={10} className="mr-1" />
            Approved
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="outline" className="text-gray-500 border-gray-200 text-[10px] h-5">
            <Clock size={10} className="mr-1" />
            Draft
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[10px] h-5">{status}</Badge>;
    }
  };

  const generateProjectReport = (project: Project) => {
    const profitData = projectProfitability[project.id];
    const versions = projectVersions[project.id] || [];
    
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("PROJECT SUMMARY REPORT", 14, 25);
    
    doc.setFontSize(10);
    doc.text(`BUILD ESTIMATE - ${project.name.toUpperCase()}`, 14, 32);
    
    // Meta info
    doc.setTextColor(100, 100, 100);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, 14, 50);
    
    // Project Details Table
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text("Basic Information", 14, 65);
    
    autoTable(doc, {
      startY: 70,
      head: [['Property', 'Information']],
      body: [
        ['Project Name', project.name],
        ['Client Name', project.client || 'N/A'],
        ['Project Location', project.location || 'N/A'],
        ['Current Status', project.status.toUpperCase()],
        ['GST Number', project.gst_no || 'N/A'],
        ['Registration Date', formatDate(project.created_at)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [52, 73, 94] },
    });

    // Financial Overview
    let currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.text("Financial Overview (Finalized Snapshot)", 14, currentY);
    
    if (profitData) {
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Financial Metric', 'Value']],
        body: [
          ['Snapshot Source', `${profitData.type.toUpperCase()} Version ${profitData.version_number}`],
          ['Project Value', `INR ${Math.round(profitData.revenueValue).toLocaleString()}`],
          ['Budget (Cost)', `INR ${Math.round(profitData.budgetValue).toLocaleString()}`],
          ['Revenue', `INR ${Math.round(profitData.profitValue).toLocaleString()}`],
          ['Margin (%)', `${profitData.margin.toFixed(2)}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [44, 175, 132] },
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text("No finalized version found for financial snapshot.", 14, currentY + 10);
    }

    // Version Tracking
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : currentY + 25;
    doc.text("Version History & Tracking", 14, currentY);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Version', 'Type', 'Status', 'Last Updated']],
      body: versions.map(v => [
        `V${v.version_number}${v.is_last_final ? ' (FINAL)' : ''}`,
        v.type.toUpperCase(),
        v.status.toUpperCase(),
        formatDate(v.updated_at)
      ]),
      theme: 'striped',
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`BuildEstimate Project Management System - Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`${project.name}_Summary_Report.pdf`);
    toast({ title: "Report Generated", description: "Project report has been downloaded successfully." });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500 font-medium">Loading Dashboard...</p>
        </div>
      </Layout>
    );
  }

  const totalProjects = projects.length;
  const finalizedVersionsCount = Object.values(projectVersions)
    .flat()
    .filter((v) => v.is_last_final).length;

  return (
    <Layout>
      <div className="min-h-screen bg-[#F8F9FB] -mt-4 -mx-4 px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4 flex-1">
              <div>
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <LayoutDashboard size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Enterprise Dashboard</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {selectedReportProjectId && activeTab === 'reports' ? "Management Overview" : "Project Dashboard"}
                </h1>
                <p className="text-slate-500 mt-1 font-medium text-xs">
                  {selectedReportProjectId && activeTab === 'reports' 
                    ? `Strategic insights for ${reportData?.project.name}`
                    : "Comprehensive financial overview and version tracking"}
                </p>
              </div>

              {/* Tabs Toggle */}
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'overview') setSelectedReportProjectId(null); }} className="w-auto">
                <TabsList className="bg-slate-100 p-1 rounded-xl">
                  <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 h-8 px-4 text-xs font-bold">
                    <LayoutDashboard size={14} />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 h-8 px-4 text-xs font-bold">
                    <ClipboardList size={14} />
                    Management Reports
                  </TabsTrigger>
                  <TabsTrigger value="compare" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 h-8 px-4 text-xs font-bold">
                    <Scale size={14} />
                    Project Compare
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {!selectedReportProjectId && (
                <div className="flex gap-3">
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                            <BarChart3 size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Projects</p>
                            <p className="text-lg font-bold text-slate-900 leading-none">{totalProjects}</p>
                        </div>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
                        <div className="h-10 w-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Finalized</p>
                            <p className="text-lg font-bold text-slate-900 leading-none">{finalizedVersionsCount}</p>
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* Global Search Bar (Only shown in selection modes) */}
          {(!selectedReportProjectId || activeTab === 'overview') && (
            <div className="relative max-w-md group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                placeholder="Search projects by name, client or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 h-11 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-100 transition-all"
                />
                {searchTerm && (
                <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
                >
                    <X size={14} />
                </button>
                )}
            </div>
          )}

          <Tabs value={activeTab} className="space-y-6">
            <TabsContent value="overview" className="space-y-6 m-0">
              {/* Projects List */}
              <div className="grid grid-cols-1 gap-6 pb-20">
                {filteredProjects.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-20 text-center">
                    <Search size={48} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900">No projects found</h3>
                    <p className="text-slate-500 mt-1">Try adjusting your search term</p>
                    <Button variant="link" className="mt-4 text-blue-600 font-bold" onClick={() => setSearchTerm("")}>Clear search</Button>
                  </div>
                ) : (
                  filteredProjects.map((project) => {
                    const profitData = projectProfitability[project.id];
                    const isExpanded = expandedProjects[project.id];
                    const hasFinal = !!profitData;

                    return (
                      <Card
                        key={project.id}
                        className={cn(
                          "rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 overflow-hidden",
                          isExpanded ? "ring-2 ring-blue-100 shadow-md" : "hover:shadow-md"
                        )}
                      >
                        <CardContent className="p-0">
                          {/* Project Header Row */}
                          <div className="p-6 flex items-center justify-between gap-6">
                            <div className="flex-1 flex items-center gap-4">
                              <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                <TrendingUp size={24} />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                                    {project.name}
                                  </h2>
                                  {hasFinal && (
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[9px] font-black h-4 px-1.5 uppercase">
                                      Final {profitData.type?.toUpperCase()} V{profitData.version_number}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                  <span className="flex items-center gap-1.5">
                                    <User size={14} className="text-slate-400" /> {project.client || "No Client"}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <MapPin size={14} className="text-slate-400" /> {project.location || "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Summary Metrics (Visible when collapsed) */}
                            {!isExpanded && (
                              <div className="hidden lg:flex items-center gap-8 mr-4">
                                 <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Revenue</p>
                                    <p className="text-sm font-bold text-slate-700">₹{parseFloat(project.project_value || "0").toLocaleString()}</p>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                                    <div className="mt-0.5">{getStatusBadge(project.status)}</div>
                                 </div>
                              </div>
                            )}

                            <div className="flex items-center gap-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-slate-200 text-slate-600 rounded-xl h-9 px-3 font-bold text-[10px] uppercase gap-1.5"
                                onClick={() => generateProjectReport(project)}
                              >
                                <FileDown size={14} />
                                Report
                              </Button>
                              <Button
                                size="sm"
                                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 px-4 font-bold text-xs"
                                onClick={() => setLocation(`/finalize-bom?project=${project.id}`)}
                              >
                                View BOQ
                                <ExternalLink size={14} className="ml-2" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl hover:bg-slate-100 border border-slate-200 text-slate-500"
                                onClick={() => toggleExpand(project.id)}
                              >
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </Button>
                            </div>
                          </div>

                          {/* Expandable Section */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="border-t border-slate-100 bg-[#FBFCFD]"
                              >
                                {/* Profitability Dashboard */}
                                <div className="p-8">
                                  <div className="flex items-center gap-2 mb-6">
                                    <BarChart3 size={18} className="text-blue-600" />
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">
                                      Financial Insights {hasFinal && <span className="text-slate-400 ml-1">({profitData.type?.toUpperCase()} SNAPSHOT)</span>}
                                    </h3>
                                  </div>

                                  {hasFinal ? (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                                      {/* Profit Gauge */}
                                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2">
                                         <ProfitDonut margin={profitData.margin} />
                                         <div className="text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expected Margin</p>
                                            <p className="text-lg font-black text-slate-900">{profitData.margin.toFixed(1)}%</p>
                                         </div>
                                      </div>

                                      {/* Metrics Cards */}
                                      <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                          <div className="flex items-center gap-2 text-slate-400 mb-1">
                                            <FileText size={14} />
                                            <p className="text-[10px] font-bold uppercase tracking-wider">Project Budget</p>
                                          </div>
                                          <p className="text-xl font-bold text-slate-900">₹{Math.round(profitData.budgetValue).toLocaleString()}</p>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                          <div className="flex items-center gap-2 text-blue-500 mb-1">
                                            <IndianRupee size={14} />
                                            <p className="text-[10px] font-bold uppercase tracking-wider">Project Revenue</p>
                                          </div>
                                          <p className="text-xl font-bold text-slate-900">₹{Math.round(profitData.revenueValue).toLocaleString()}</p>
                                        </div>

                                        <div className={cn(
                                          "p-4 rounded-xl border shadow-sm",
                                          profitData.profitValue >= 0 ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"
                                        )}>
                                          <div className={cn(
                                            "flex items-center gap-2 mb-1",
                                            profitData.profitValue >= 0 ? "text-emerald-600" : "text-rose-600"
                                          )}>
                                            <TrendingUp size={14} />
                                            <p className="text-[10px] font-bold uppercase tracking-wider">Expected Profit</p>
                                          </div>
                                          <p className={cn(
                                            "text-xl font-bold",
                                            profitData.profitValue >= 0 ? "text-emerald-700" : "text-rose-700"
                                          )}>
                                            ₹{Math.round(profitData.profitValue).toLocaleString()}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                                      <PieChartIcon size={32} className="mx-auto text-slate-300 mb-3" />
                                      <p className="text-slate-500 font-medium text-sm">Profitability data is only available once a version is marked as <span className="font-bold text-amber-600">FINAL</span>.</p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="reports" className="m-0 space-y-8 pb-20">
               {!selectedReportProjectId ? (
                /* Project Selection List for Reports */
                <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <ClipboardList className="text-blue-600" size={20} />
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Project Selection</h3>
                                <p className="text-[10px] text-slate-500 font-medium">Select a project to view its detailed Management Report Dashboard</p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/30">
                                    <TableHead className="font-bold text-[10px] uppercase tracking-wider h-12 text-slate-400">Project Name</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-wider h-12 text-slate-400">Client</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-wider h-12 text-slate-400">Status</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-wider h-12 text-slate-400">Value</TableHead>
                                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider h-12 text-slate-400">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProjects.map(p => {
                                    const hasFinal = !!projectProfitability[p.id];
                                    return (
                                        <TableRow key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <TableCell className="font-bold text-slate-800 text-sm">{p.name}</TableCell>
                                            <TableCell className="text-xs text-slate-600 font-medium">{p.client || 'N/A'}</TableCell>
                                            <TableCell>{getStatusBadge(p.status)}</TableCell>
                                            <TableCell className="text-xs font-bold text-slate-900">₹{parseFloat(p.project_value || "0").toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-xl h-8 border-slate-200 bg-white group-hover:border-blue-300 group-hover:bg-blue-50 group-hover:text-blue-700 font-bold text-[10px] uppercase gap-2 transition-all"
                                                    onClick={() => fetchReportData(p.id)}
                                                    disabled={loadingReport}
                                                >
                                                    {loadingReport && selectedReportProjectId === p.id ? (
                                                        <Loader2 size={12} className="animate-spin" />
                                                    ) : (
                                                        <ExternalLink size={12} />
                                                    )}
                                                    Open Management Report
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
               ) : (
                /* Management Overview Dashboard View */
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Sticky Management Header */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 sticky top-4 z-10">
                        <div className="flex items-center gap-4">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-xl hover:bg-slate-100 text-slate-400"
                                onClick={() => setSelectedReportProjectId(null)}
                            >
                                <ArrowLeft size={20} />
                            </Button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-slate-900 leading-none">{reportData?.project.name}</h2>
                                    <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[9px] font-black uppercase">Enterprise Report</Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-slate-400">
                                    <span className="flex items-center gap-1"><User size={12} /> {reportData?.project.client}</span>
                                    <span className="flex items-center gap-1"><MapPin size={12} /> {reportData?.project.location}</span>
                                    <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {reportData?.project.status.toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="rounded-xl h-9 border-slate-200 font-bold text-[10px] uppercase gap-2" onClick={() => reportData && generateProjectReport(reportData.project)}>
                                <FileDown size={14} /> PDF Summary
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-xl h-9 border-slate-200 font-bold text-[10px] uppercase gap-2">
                                <ExternalLink size={14} /> Share Link
                            </Button>
                            <Button size="sm" className="rounded-xl h-9 bg-slate-900 hover:bg-slate-800 font-bold text-[10px] uppercase gap-2" onClick={() => setLocation(`/finalize-bom?project=${reportData?.project.id}`)}>
                                Open BOQ Tool
                            </Button>
                        </div>
                    </div>

                    {/* Financial Summary Cards (Section 2) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                <Layers size={40} className="text-slate-900" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Cost (Budget)</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs font-bold text-slate-400">₹</span>
                                <h3 className="text-2xl font-black text-slate-900">
                                    {Math.round(reportData?.finalVersion?.final_budget || 0).toLocaleString()}
                                </h3>
                            </div>
                            <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                <Badge className="bg-slate-50 text-slate-600 border-slate-100 h-4 px-1 text-[8px]">SNAPSHOT</Badge>
                                <span>Based on V{reportData?.finalVersion?.version_number}</span>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-blue-600">
                                <IndianRupee size={40} />
                            </div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Project Value</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs font-bold text-blue-600">₹</span>
                                <h3 className="text-2xl font-black text-slate-900">
                                    {Math.round(reportData?.finalVersion?.final_revenue || 0).toLocaleString()}
                                </h3>
                            </div>
                            <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50/50 w-fit px-2 py-0.5 rounded border border-blue-100">
                                <ArrowUpRight size={10} />
                                <span>Project Value</span>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-emerald-600">
                                <TrendingUp size={40} />
                            </div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Revenue</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs font-bold text-emerald-600">₹</span>
                                <h3 className="text-2xl font-black text-slate-900">
                                    {Math.round(reportData?.finalVersion?.final_profit || 0).toLocaleString()}
                                </h3>
                            </div>
                            <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                                <ShieldCheck size={10} />
                                <span>Financial Surplus</span>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-amber-600">
                                <PieChartIcon size={40} />
                            </div>
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Gross Margin (%)</p>
                            <div className="flex items-baseline gap-1">
                                <h3 className="text-2xl font-black text-slate-900">
                                    {(reportData?.finalVersion?.final_margin || 0).toFixed(1)}%
                                </h3>
                            </div>
                            <div className="mt-4">
                                <Progress value={reportData?.finalVersion?.final_margin || 0} className="h-1.5 bg-slate-100" />
                                <div className="flex justify-between items-center mt-2 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                                    <span>0%</span>
                                    <span className="text-emerald-500">Target 25%+</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mid Section: Visuals & Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Cost Breakdown (Section 5) */}
                        <Card className="lg:col-span-2 rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                            <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Category Cost Breakdown</CardTitle>
                                    <p className="text-[10px] text-slate-400 font-bold">Contribution per category to total revenue</p>
                                </div>
                                <Layers size={20} className="text-slate-300" />
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="p-6 space-y-6">
                                    {reportData?.categoryBreakdown.map((cat, idx) => {
                                        const percentage = (cat.revenue / (reportData?.finalVersion?.final_revenue || 1)) * 100;
                                        return (
                                            <div key={idx} className="space-y-2">
                                                <div className="flex justify-between items-center text-xs font-bold">
                                                    <span className="text-slate-700">{cat.name}</span>
                                                    <div className="flex gap-4 items-center">
                                                        <span className="text-slate-400 text-[10px]">₹{Math.round(cat.revenue).toLocaleString()}</span>
                                                        <span className="text-blue-600">{percentage.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                                <div className="relative h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${percentage}%` }}
                                                        transition={{ duration: 1, ease: "easeOut" }}
                                                        className={cn(
                                                            "h-full rounded-full shadow-sm",
                                                            idx === 0 ? "bg-blue-500" : idx === 1 ? "bg-indigo-500" : "bg-slate-400"
                                                        )}
                                                    />
                                                </div>
                                                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                                                    <span className="uppercase tracking-widest">Margin: {cat.margin.toFixed(1)}%</span>
                                                    <span className={cn(cat.margin >= 15 ? "text-emerald-500" : "text-amber-500")}>
                                                        {cat.margin >= 15 ? "HEALTHY" : "OPTIMIZE"}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Material vs Labour Split (Section 6) */}
                        <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                            <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Resource Split</CardTitle>
                                    <p className="text-[10px] text-slate-400 font-bold">Material vs Labour contribution</p>
                                </div>
                                <Zap size={20} className="text-slate-300" />
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="space-y-8">
                                    {/* Material Card */}
                                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                                                <Layers size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Material Cost</p>
                                                <p className="text-sm font-bold text-slate-900">₹{Math.round(reportData?.split.material || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-blue-600">
                                                {((reportData?.split.material || 0) / ((reportData?.split.material || 1) + (reportData?.split.labour || 0)) * 100).toFixed(0)}%
                                            </p>
                                        </div>
                                    </div>

                                    {/* Labour Card */}
                                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                                                <Activity size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labour Cost</p>
                                                <p className="text-sm font-bold text-slate-900">₹{Math.round(reportData?.split.labour || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-amber-600">
                                                {((reportData?.split.labour || 0) / ((reportData?.split.material || 1) + (reportData?.split.labour || 0)) * 100).toFixed(0)}%
                                            </p>
                                        </div>
                                    </div>

                                    {/* Small Gauge for split */}
                                    <div className="pt-4 text-center space-y-2">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">
                                            <span>Material</span>
                                            <span>Labour</span>
                                        </div>
                                        <div className="flex h-3 rounded-full overflow-hidden border border-slate-200">
                                            <div 
                                                className="bg-blue-500 h-full" 
                                                style={{ width: `${((reportData?.split.material || 0) / ((reportData?.split.material || 1) + (reportData?.split.labour || 0)) * 100)}%` }} 
                                            />
                                            <div 
                                                className="bg-amber-500 h-full" 
                                                style={{ width: `${((reportData?.split.labour || 0) / ((reportData?.split.material || 1) + (reportData?.split.labour || 0)) * 100)}%` }} 
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 italic">Material to Labour Ratio: {((reportData?.split.material || 0) / (reportData?.split.labour || 1)).toFixed(1)}:1</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Bottom Section: Timeline & Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* BOQ Version Timeline (Section 4) */}
                        <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                            <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Version History Timeline</CardTitle>
                                    <p className="text-[10px] text-slate-400 font-bold">Lifecycle tracking of BOQ and BOM iterations</p>
                                </div>
                                <History size={20} className="text-slate-300" />
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-6 relative ml-4 before:absolute before:left-[-1px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                                    {reportData?.versions.slice(0, 6).map((v, idx) => (
                                        <div key={v.id} className="relative pl-8">
                                            {/* Dot */}
                                            <div className={cn(
                                                "absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm ring-2",
                                                v.is_last_final ? "bg-amber-500 ring-amber-100" : "bg-slate-300 ring-slate-100"
                                            )} />
                                            
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100 group hover:bg-blue-50/30 transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-slate-900 uppercase">Version {v.version_number}</span>
                                                        <Badge variant="outline" className={cn("text-[8px] h-4 font-bold uppercase", v.type === 'boq' ? "text-purple-600 bg-purple-50" : "text-blue-600 bg-blue-50")}>
                                                            {v.type.toUpperCase()}
                                                        </Badge>
                                                        {v.is_last_final && <Badge className="bg-amber-500 text-white text-[8px] h-4 font-black">FINAL</Badge>}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 mt-0.5 font-bold">{formatDate(v.created_at)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {getStatusBadge(v.status)}
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ChevronRight size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {reportData?.versions.length && reportData.versions.length > 6 && (
                                        <p className="text-[10px] text-center text-slate-400 font-bold py-2 uppercase tracking-widest">+{reportData.versions.length - 6} More Versions</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Activities & Risk Section (Sections 11 & 12) */}
                        <div className="space-y-8">
                            {/* Risk Alerts */}
                            <Card className="rounded-2xl border border-rose-100 bg-rose-50/30 shadow-sm overflow-hidden">
                                <CardHeader className="p-4 border-b border-rose-100 flex flex-row items-center gap-3">
                                    <AlertTriangle className="text-rose-600" size={18} />
                                    <CardTitle className="text-[11px] font-black uppercase tracking-widest text-rose-700">Project Risk Watch</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    {(reportData?.finalVersion?.final_margin || 0) < 15 && (
                                        <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-rose-200">
                                            <div className="h-6 w-6 bg-rose-100 text-rose-600 rounded flex items-center justify-center shrink-0">
                                                <TrendingUp size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-900">Low Profit Margin</p>
                                                <p className="text-[10px] text-slate-500">Current margin ({(reportData?.finalVersion?.final_margin || 0).toFixed(1)}%) is below the healthy threshold of 15%.</p>
                                            </div>
                                        </div>
                                    )}
                                    {reportData?.versions.length && reportData.versions.length > 5 && (
                                        <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-amber-200">
                                            <div className="h-6 w-6 bg-amber-100 text-amber-600 rounded flex items-center justify-center shrink-0">
                                                <Layers size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-900">High Revision Count</p>
                                                <p className="text-[10px] text-slate-500">Project has {reportData.versions.length} revisions. Review scope changes for potential cost creep.</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-blue-200">
                                        <div className="h-6 w-6 bg-blue-100 text-blue-600 rounded flex items-center justify-center shrink-0">
                                            <ShieldCheck size={14} />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-900">Governance Status</p>
                                            <p className="text-[10px] text-slate-500">Final version V{reportData?.finalVersion?.version_number} is locked and approved.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Smart Insights (Section 15) */}
                            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center gap-3">
                                    <Zap className="text-blue-600" size={18} />
                                    <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-500">Executive Insights</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="space-y-4">
                                        {reportData?.topCategories[0] && (
                                            <p className="text-[11px] font-medium text-slate-600 flex gap-2">
                                                <span className="text-blue-500 font-bold">•</span>
                                                <span>The <strong className="text-slate-900">{reportData.topCategories[0].name}</strong> category contributes {((reportData.topCategories[0].revenue / (reportData.finalVersion?.final_revenue || 1)) * 100).toFixed(0)}% of total project revenue.</span>
                                            </p>
                                        )}
                                        <p className="text-[11px] font-medium text-slate-600 flex gap-2">
                                            <span className="text-blue-500 font-bold">•</span>
                                            <span>Labour costs are optimized at {((reportData?.split.labour || 0) / ((reportData?.split.material || 1) + (reportData?.split.labour || 0)) * 100).toFixed(0)}% of total cost.</span>
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-600 flex gap-2">
                                            <span className="text-blue-500 font-bold">•</span>
                                            <span>Project margin is currently <strong className={cn(reportData?.finalVersion?.final_margin && reportData.finalVersion.final_margin > 20 ? "text-emerald-600" : "text-slate-900")}>{(reportData?.finalVersion?.final_margin || 0).toFixed(1)}%</strong>.</span>
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
               )}
            </TabsContent>

            <TabsContent value="compare" className="m-0 space-y-8 pb-20">
              <ProjectCompareView projects={projects} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}


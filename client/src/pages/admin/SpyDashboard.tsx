import { useState, useEffect } from "react";
import {
  Eye,
  Search,
  Filter,
  Calendar,
  Mail,
  Download,
  ArrowLeftRight,
  User,
  Activity,
  Box,
  Trash2,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import apiFetch from "@/lib/api";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  user_id: string;
  username: string;
  role: string;
  action: string;
  module: string;
  page: string;
  details: string;
  before_data: string | null;
  after_data: string | null;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UsageAnalytics } from "./UsageAnalytics";

export default function SpyDashboard() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = "/api/audit/logs?limit=200";
      if (search) url += `&username=${encodeURIComponent(search)}`;
      if (moduleFilter !== "all") url += `&module=${encodeURIComponent(moduleFilter)}`;
      if (actionFilter !== "all") url += `&action=${encodeURIComponent(actionFilter)}`;

      const response = await apiFetch(url);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Failed to fetch logs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter, actionFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleSendEmail = async () => {
    const email = prompt("Enter administrator email to send summary:");
    if (!email) return;

    setSendingEmail(true);
    try {
      const res = await apiFetch("/api/audit/send-summary", {
        method: "POST",
        body: JSON.stringify({ to: email }),
      });
      if (res.ok) {
        toast({
          title: "Email Sent",
          description: `Activity summary has been sent to ${email}`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send email summary",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadCSV = () => {
    if (logs.length === 0) return;

    const headers = ["Timestamp", "User", "Role", "Action", "Module", "Details", "IP Address"];
    const rows = logs.map(log => [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      log.username || "Unknown",
      log.role || "-",
      log.action,
      log.module || "-",
      log.details || "-",
      log.ip_address || "-"
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_log_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/20";
      case "UPDATE": return "bg-blue-500/15 text-blue-600 border-blue-500/20";
      case "DELETE": return "bg-rose-500/15 text-rose-600 border-rose-500/20";
      case "LOGIN": return "bg-amber-500/15 text-amber-600 border-amber-500/20";
      case "NAVIGATE": return "bg-slate-500/15 text-slate-600 border-slate-500/20";
      default: return "bg-gray-500/15 text-gray-600 border-gray-500/20";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE": return <Plus className="h-3 w-3 mr-1" />;
      case "UPDATE": return <RefreshCw className="h-3 w-3 mr-1" />;
      case "DELETE": return <Trash2 className="h-3 w-3 mr-1" />;
      case "LOGIN": return <User className="h-3 w-3 mr-1" />;
      case "NAVIGATE": return <Activity className="h-3 w-3 mr-1" />;
      default: return null;
    }
  };

  const DiffViewer = ({ before, after }: { before: string | null, after: string | null }) => {
    if (!before && !after) return <div className="text-muted-foreground italic p-4 text-center">No data details available for this log entry.</div>;

    let beforeObj = before ? JSON.parse(before) : null;
    let afterObj = after ? JSON.parse(after) : null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500">Before Change</h4>
          <ScrollArea className="h-80 border rounded-md bg-slate-950 p-4 font-mono text-[11px] text-slate-300">
            <pre>{beforeObj ? JSON.stringify(beforeObj, null, 2) : "// No previous state recorded"}</pre>
          </ScrollArea>
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500">After Change</h4>
          <ScrollArea className="h-80 border rounded-md bg-slate-950 p-4 font-mono text-[11px] text-slate-300">
            <pre>{afterObj ? JSON.stringify(afterObj, null, 2) : "// Resource deleted or no after state"}</pre>
          </ScrollArea>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-4 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Eye className="h-8 w-8 text-blue-500" /> Spy Dashboard
            </h2>
            <p className="text-muted-foreground font-medium">
              Project activity monitoring, user action history, and usage analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadCSV} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendEmail} disabled={sendingEmail || logs.length === 0}>
              <Mail className="h-4 w-4 mr-2" />
              Send Summary
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={fetchLogs}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="bg-slate-100/50 p-1">
            <TabsTrigger value="activity" className="text-sm font-semibold">Activity Feed</TabsTrigger>
            <TabsTrigger value="analytics" className="text-sm font-semibold">Usage Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="m-0">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-1 shadow-sm border-slate-200 h-fit">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-6">
              <form onSubmit={handleSearch} className="space-y-1.5">
                <label className="text-xs font-black uppercase text-muted-foreground">Search User</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Username..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </form>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-muted-foreground">Action Type</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                >
                  <option value="all">All Actions</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                  <option value="LOGIN">Login</option>
                  <option value="NAVIGATE">Navigate</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-muted-foreground">Module</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                >
                  <option value="all">All Modules</option>
                  <option value="Shops">Shops</option>
                  <option value="Materials">Materials</option>
                  <option value="Projects">Projects</option>
                  <option value="Auth">Auth</option>
                  <option value="BOM">BOM/BOQ</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3 shadow-md">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base font-bold">Activity Feed</CardTitle>
                  <CardDescription>Real-time system interactions</CardDescription>
                </div>
                {logs.length > 0 && (
                  <Badge variant="outline" className="bg-white border-blue-200 text-blue-600">
                    {logs.length} Entries
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-320px)]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-[180px] font-bold">Timestamp</TableHead>
                      <TableHead className="font-bold">Identity</TableHead>
                      <TableHead className="font-bold">Action</TableHead>
                      <TableHead className="font-bold">Details</TableHead>
                      <TableHead className="text-right font-bold pr-6">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-64 text-center">
                          <Activity className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
                          <p className="text-muted-foreground">Analyzing logs...</p>
                        </TableCell>
                      </TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-64 text-center">
                          <Activity className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                          <p className="text-muted-foreground">No logs found matching filters</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell className="text-xs text-muted-foreground align-top py-4">
                            <div className="font-semibold text-slate-700">{format(new Date(log.created_at), "MMM dd, yyyy")}</div>
                            <div>{format(new Date(log.created_at), "HH:mm:ss")}</div>
                          </TableCell>
                          <TableCell className="align-top py-4">
                            <div className="font-bold text-slate-900">{log.username || "Anonymous"}</div>
                            <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">{log.role || "No Role"}</div>
                          </TableCell>
                          <TableCell className="align-top py-4">
                            <Badge className={`${getActionColor(log.action)} border font-bold text-[10px] h-5`}>
                              {getActionIcon(log.action)}
                              {log.action}
                            </Badge>
                            <div className="text-[10px] mt-1 text-muted-foreground font-semibold uppercase">{log.module}</div>
                          </TableCell>
                          <TableCell className="max-w-[300px] text-xs font-medium text-slate-600 align-top py-4">
                            {log.details}
                            <div className="mt-2 text-[10px] flex gap-2 items-center opacity-70">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded border">{log.ip_address}</span>
                              <span className="truncate border-l pl-2 max-w-[150px]">{log.user_agent}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right align-top py-4 pr-6">
                            {(log.before_data || log.after_data) && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-blue-100 hover:bg-blue-50 text-blue-600">
                                    <ArrowLeftRight className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[85vh]">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-xl">
                                      <Activity className="h-6 w-6 text-blue-500" /> Action Detail
                                    </DialogTitle>
                                    <DialogDescription>
                                      Action performed by <span className="font-bold text-slate-900">{log.username}</span> in <span className="font-bold text-blue-600">{log.module}</span> on {format(new Date(log.created_at), "PPP p")}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-100 text-sm font-medium text-blue-800 mb-4">
                                    {log.details}
                                  </div>
                                  <DiffViewer before={log.before_data} after={log.after_data} />
                                </DialogContent>
                              </Dialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
          </TabsContent>

          <TabsContent value="analytics" className="m-0">
            <UsageAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

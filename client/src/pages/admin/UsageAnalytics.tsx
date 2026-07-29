import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { 
  Activity, 
  Clock, 
  Users, 
  User,
  Database, 
  Server, 
  DownloadCloud,
  Calendar as CalendarIcon 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import apiFetch from "@/lib/api";

interface UserStat {
  username: string;
  role: string;
  total_active_hours: number;
  total_logins: number;
  last_active_time: string;
  avg_daily_hours: number;
  total_egress_mb: number;
  total_actions: number;
}

interface SystemStats {
  totalEgressMb: number;
  totalActions: number;
}

export function UsageAnalytics() {
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats>({ totalEgressMb: 0, totalActions: 0 });
  
  // Default to last 7 days
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  const [selectedUser, setSelectedUser] = useState<UserStat | null>(null);
  const [userDetails, setUserDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const url = `/api/audit/usage-analytics?fromDate=${fromDate}&toDate=${toDate}`;
      const response = await apiFetch(url);
      if (response.ok) {
        const data = await response.json();
        setUserStats(data.userStats || []);
        setSystemStats(data.systemStats || { totalEgressMb: 0, totalActions: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics();
  };

  const handleUserClick = async (user: UserStat) => {
    setSelectedUser(user);
    setLoadingDetails(true);
    try {
      const url = `/api/audit/usage-analytics/${encodeURIComponent(user.username)}?fromDate=${fromDate}&toDate=${toDate}`;
      const response = await apiFetch(url);
      if (response.ok) {
        const data = await response.json();
        setUserDetails(data.moduleStats || []);
      }
    } catch (error) {
      console.error("Failed to fetch user details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatNumber = (num: number) => {
    return Number(num || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Date Filter Card */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <form onSubmit={handleFilter} className="flex flex-col md:flex-row items-end gap-4">
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> From Date
              </label>
              <Input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> To Date
              </label>
              <Input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
              Apply Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* System Level Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white shadow-sm border-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Active Users</p>
                <h3 className="text-2xl font-bold text-slate-900">{userStats.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white shadow-sm border-emerald-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Total Actions</p>
                <h3 className="text-2xl font-bold text-slate-900">{formatNumber(systemStats.totalActions)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white shadow-sm border-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Est. Egress (Bandwidth)</p>
                <h3 className="text-2xl font-bold text-slate-900">{formatNumber(systemStats.totalEgressMb)} MB</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Working Hours Tracking */}
        <Card className="shadow-md">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              User Working Hours
            </CardTitle>
            <CardDescription>Track time spent actively using the system</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead className="font-bold">User</TableHead>
                    <TableHead className="font-bold text-center">Active Hours</TableHead>
                    <TableHead className="font-bold text-center">Logins</TableHead>
                    <TableHead className="font-bold text-right pr-4">Avg Daily Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center">
                        <Activity className="h-6 w-6 animate-spin mx-auto text-blue-500 mb-2" />
                        <p className="text-muted-foreground text-sm">Calculating hours...</p>
                      </TableCell>
                    </TableRow>
                  ) : userStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                        No user activity in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    userStats.map((user, idx) => (
                      <TableRow 
                        key={idx} 
                        className="hover:bg-slate-50/80 cursor-pointer"
                        onClick={() => handleUserClick(user)}
                      >
                        <TableCell className="py-3">
                          <div className="font-bold text-slate-800">{user.username}</div>
                          <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">{user.role || "User"}</div>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            {formatNumber(user.total_active_hours)} hrs
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-slate-600 font-medium py-3">
                          {user.total_logins}
                        </TableCell>
                        <TableCell className="text-right pr-4 text-slate-600 font-medium py-3">
                          {formatNumber(user.avg_daily_hours)} hrs/day
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Supabase Egress Tracking */}
        <Card className="shadow-md border-purple-100">
          <CardHeader className="pb-3 border-b bg-purple-50/30">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DownloadCloud className="h-5 w-5 text-purple-500" />
              Egress Tracking Estimation
            </CardTitle>
            <CardDescription>Approximated database and network bandwidth consumption</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead className="font-bold">User</TableHead>
                    <TableHead className="font-bold text-center">API Actions</TableHead>
                    <TableHead className="font-bold text-right pr-4">Est. Bandwidth</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center">
                        <Activity className="h-6 w-6 animate-spin mx-auto text-purple-500 mb-2" />
                        <p className="text-muted-foreground text-sm">Analyzing payload data...</p>
                      </TableCell>
                    </TableRow>
                  ) : userStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                        No activity in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    userStats.map((user, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/80">
                        <TableCell className="py-3">
                          <div className="font-bold text-slate-800">{user.username}</div>
                          <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">{user.role || "User"}</div>
                        </TableCell>
                        <TableCell className="text-center text-slate-600 font-medium py-3">
                          {formatNumber(user.total_actions)}
                        </TableCell>
                        <TableCell className="text-right pr-4 py-3">
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            {formatNumber(user.total_egress_mb)} MB
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              User Activity Details
            </DialogTitle>
            <DialogDescription>
              Detailed usage breakdown for <span className="font-bold text-slate-800">{selectedUser?.username}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {loadingDetails ? (
              <div className="py-12 text-center">
                <Activity className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-muted-foreground">Loading details...</p>
              </div>
            ) : userDetails.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No detailed module activity found.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                   <div className="bg-slate-50 p-3 rounded-lg border">
                     <p className="text-xs text-slate-500 uppercase font-semibold">Total Hours</p>
                     <p className="text-lg font-bold text-slate-800">{formatNumber(selectedUser?.total_active_hours || 0)}</p>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-lg border">
                     <p className="text-xs text-slate-500 uppercase font-semibold">Total Logins</p>
                     <p className="text-lg font-bold text-slate-800">{selectedUser?.total_logins || 0}</p>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-lg border">
                     <p className="text-xs text-slate-500 uppercase font-semibold">Total Actions</p>
                     <p className="text-lg font-bold text-slate-800">{selectedUser?.total_actions || 0}</p>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-lg border">
                     <p className="text-xs text-slate-500 uppercase font-semibold">Est. Egress</p>
                     <p className="text-lg font-bold text-slate-800">{formatNumber(selectedUser?.total_egress_mb || 0)} MB</p>
                   </div>
                </div>

                <h4 className="font-semibold text-slate-700 mt-6 mb-2 border-b pb-2">Module-wise Time Spent</h4>
                <div className="max-h-[300px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                      <TableRow>
                        <TableHead className="font-bold">Module</TableHead>
                        <TableHead className="font-bold text-center">Actions Count</TableHead>
                        <TableHead className="font-bold text-right pr-4">Time Spent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userDetails.map((detail, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-slate-700">
                            {detail.module}
                          </TableCell>
                          <TableCell className="text-center text-slate-600">
                            {detail.action_count}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {detail.total_minutes >= 60 
                                ? `${formatNumber(detail.total_minutes / 60)} hrs` 
                                : `${formatNumber(detail.total_minutes)} mins`}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

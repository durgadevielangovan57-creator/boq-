import { useEffect, useState } from "react";
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
import {
  ReceiptText,
  Clock,
  CheckCircle2,
  Truck,
  ArrowRight,
  Loader2,
  IndianRupee,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: any;
  color: string;
}

const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => (
  <Card className="border-slate-200 shadow-sm overflow-hidden">
    <CardContent className="p-0">
      <div className="flex items-stretch">
        <div className={`w-2 ${color}`}></div>
        <div className="flex-1 p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
              <p className="text-3xl font-black text-slate-900">{value}</p>
            </div>
            <div className={`p-2 rounded-lg ${color.replace('bg-', 'bg-').replace('600', '100')} ${color.replace('bg-', 'text-')}`}>
              <Icon size={20} />
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function PurchaseDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    ordered: 0,
    delivered: 0,
    totalAmount: 0
  });
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/purchase-orders");
      if (res.ok) {
        const data = await res.json();
        const pos = data.purchaseOrders || [];

        const newStats = pos.reduce((acc: any, po: any) => {
          acc.total++;
          acc.totalAmount += parseFloat(po.total_amount || 0);
          if (po.status === 'pending_approval') acc.pending++;
          if (po.status === 'approved') acc.approved++;
          if (po.status === 'ordered') acc.ordered++;
          if (po.status === 'delivered') acc.delivered++;
          return acc;
        }, { total: 0, pending: 0, approved: 0, ordered: 0, delivered: 0, totalAmount: 0 });

        setStats(newStats);
        setRecentPOs(pos.slice(0, 5));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading procurement overview...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Procurement Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Real-time overview of your purchase orders and supply chain.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total POs" value={stats.total} icon={ReceiptText} color="bg-slate-600" />
          <StatCard title="Pending Appr." value={stats.pending} icon={Clock} color="bg-blue-600" />
          <StatCard title="In Transit" value={stats.ordered} icon={Truck} color="bg-indigo-600" />
          <StatCard title="Delivered" value={stats.delivered} icon={CheckCircle2} color="bg-emerald-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Recent Activity</CardTitle>
                <p className="text-xs text-slate-500 font-medium">Latest purchase orders created</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/purchase-orders")} className="text-primary font-bold">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-bold">PO Number</TableHead>
                    <TableHead className="font-bold">Vendor</TableHead>
                    <TableHead className="font-bold text-right">Amount</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPOs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-slate-400 italic">No recent orders.</TableCell>
                    </TableRow>
                  ) : (
                    recentPOs.map((po) => (
                      <TableRow key={po.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => setLocation(`/purchase-orders/${po.id}`)}>
                        <TableCell className="font-bold text-primary">{po.po_number}</TableCell>
                        <TableCell className="font-medium">{po.vendor_name || "N/A"}</TableCell>
                        <TableCell className="text-right font-bold text-green-700">₹{parseFloat(po.total_amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`
                            ${po.status === 'pending_approval' ? 'bg-blue-50 text-blue-600 border-blue-100' : ''}
                            ${po.status === 'approved' ? 'bg-green-50 text-green-600 border-green-100' : ''}
                            ${po.status === 'ordered' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : ''}
                            ${po.status === 'delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ''}
                            ${po.status === 'draft' ? 'bg-gray-50 text-gray-600 border-gray-100' : ''}
                          `}>
                            {po.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-slate-900 text-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ShoppingBag className="text-primary" />
                Procurement Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Procurement Value</p>
                <p className="text-4xl font-black text-white flex items-center gap-1">
                  <IndianRupee className="h-6 w-6 text-primary" />
                  {stats.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-3">
                  <span className="text-slate-400">Completion Rate</span>
                  <span className="font-bold text-emerald-400">
                    {stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-3">
                  <span className="text-slate-400">Active Requests</span>
                  <span className="font-bold text-blue-400">{stats.pending}</span>
                </div>
                <div className="flex justify-between items-center text-sm pb-3">
                  <span className="text-slate-400">Items in Transit</span>
                  <span className="font-bold text-indigo-400">{stats.ordered}</span>
                </div>
              </div>

              {stats.pending > 0 && (
                <div className="bg-blue-600/20 border border-blue-600/30 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-blue-100 mb-1">Approval Required</p>
                    <p className="text-blue-200 leading-relaxed">
                      There are {stats.pending} purchase orders waiting for your review.
                    </p>
                    <Button variant="link" size="sm" onClick={() => setLocation("/po-approvals")} className="text-blue-400 p-0 h-auto mt-2 font-bold hover:text-blue-300">
                      Go to Approvals →
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
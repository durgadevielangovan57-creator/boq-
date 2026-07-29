import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import apiFetch from "@/lib/api";

export default function RateReductionHistory() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/purchase-orders/rate-reductions"],
    queryFn: async () => {
      const res = await apiFetch("/api/purchase-orders/rate-reductions");
      if (!res.ok) throw new Error("Failed to fetch rate reduction history");
      return res.json();
    },
  });

  return (
    <div className="container mx-auto py-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/purchase-orders")} className="h-9">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Annexures
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>PO Rate Reduction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Original Rate</TableHead>
                  <TableHead className="text-right">Reduced Rate</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Annexure Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : !data?.rateReductions?.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No rate reduction history found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.rateReductions.map((req: any) => (
                    <TableRow key={req.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(req.changed_at), "PPp")}</TableCell>
                      <TableCell className="font-medium">{req.project_name || '-'}</TableCell>
                      <TableCell className="font-medium">{req.po_number}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={req.item_name}>{req.item_name}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={req.vendor_name}>{req.vendor_name}</TableCell>
                      <TableCell className="text-right">₹{Number(req.original_rate).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        ₹{Number(req.reduced_rate).toFixed(2)}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate" title={req.reason}>{req.reason}</TableCell>
                      <TableCell>
                        {req.po_status === 'approved' && <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Approved</Badge>}
                        {req.po_status === 'rejected' && <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>}
                        {req.po_status === 'pending_approval' && <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>}
                        {req.po_status === 'draft' && <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">Draft</Badge>}
                        {req.po_status === 'revised' && <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Revised</Badge>}
                        {req.po_status === 'ordered' && <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-300">Ordered</Badge>}
                        {req.po_status === 'delivered' && <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">Delivered</Badge>}
                        {!req.po_status && <Badge variant="outline">-</Badge>}
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
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, CheckCircle } from "lucide-react";
import apiFetch from "@/lib/api";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export default function ProposalApprovals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProposal, setSelectedProposal] = useState<any>(null);

  const { data: proposals, isLoading } = useQuery({
    queryKey: ["/api/proposals"],
    queryFn: async () => {
      const res = await apiFetch("/api/proposals");
      if (!res.ok) throw new Error("Failed to fetch proposals");
      return res.json();
    },
  });

  const { data: items, isLoading: isLoadingItems } = useQuery({
    queryKey: ["/api/proposals", selectedProposal?.id, "items"],
    queryFn: async () => {
      if (!selectedProposal?.id) return [];
      const res = await apiFetch(`/api/proposals/${selectedProposal.id}/items`);
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
    enabled: !!selectedProposal?.id,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/proposals/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Proposal Approved", description: "The proposal has been approved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setSelectedProposal(null);
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to approve proposal" }),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 w-full max-w-[1400px] mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-heading text-slate-800">Proposal Approvals</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve customized vendor proposals derived from Sketch Plans.
          </p>
        </div>

        <div className="border rounded-md bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No proposals found.
                  </TableCell>
                </TableRow>
              ) : (
                proposals?.map((proposal: any) => (
                  <TableRow key={proposal.id}>
                    <TableCell className="font-medium">{proposal.project_name || "Unknown Project"}</TableCell>
                    <TableCell>{proposal.vendor_name || "Unknown Vendor"}</TableCell>
                    <TableCell>v{proposal.version_number}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          proposal.status === "approved"
                            ? "default"
                            : proposal.status === "rejected"
                            ? "destructive"
                            : proposal.status === "submitted"
                            ? "secondary"
                            : "outline"
                        }
                        className={proposal.status === 'approved' ? 'bg-green-600' : ''}
                      >
                        {proposal.status?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{proposal.created_at ? format(new Date(proposal.created_at), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedProposal(proposal)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!selectedProposal} onOpenChange={(open) => !open && setSelectedProposal(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center pr-10">
                <span>Proposal v{selectedProposal?.version_number} - {selectedProposal?.vendor_name}</span>
                <Badge 
                  variant={selectedProposal?.status === 'approved' ? 'default' : 'secondary'} 
                  className={selectedProposal?.status === 'approved' ? 'bg-green-600' : ''}
                >
                  {selectedProposal?.status?.toUpperCase()}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="border rounded-md mt-4">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-center">Unit</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingItems ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : items?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        No items found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items?.map((item: any) => {
                      const amount = Number(item.amount) > 0 ? Number(item.amount) : Number(item.qty) * Number(item.rate);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={item.description}>
                            {item.description || '-'}
                          </TableCell>
                          <TableCell className="text-right">{Number(item.qty).toFixed(2)}</TableCell>
                          <TableCell className="text-center">{item.unit}</TableCell>
                          <TableCell className="text-right">₹{Number(item.rate).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">₹{amount.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <div className="text-lg font-bold">
                Total Value: ₹
                {items?.reduce((sum: number, it: any) => {
                  const amt = Number(it.amount) > 0 ? Number(it.amount) : Number(it.qty) * Number(it.rate);
                  return sum + amt;
                }, 0).toFixed(2) || "0.00"}
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedProposal(null)}>
                  Close
                </Button>
                {selectedProposal?.status !== "approved" && (
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => approveMutation.mutate(selectedProposal.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Approve Proposal
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Package,
  RefreshCw,
} from "lucide-react";

interface MaterialSubmission {
  id: string;
  template_name: string;
  template_code: string;
  shop_name: string;
  rate: number;
  unit: string;
  brandname: string;
  modelnumber: string;
  category: string;
  subcategory: string;
  technicalspecification: string;
  approved: boolean | null;
  hsn_code: string;
  sac_code: string;
  created_at: string;
}

export default function MaterialSubmissionApproval() {
  const { toast } = useToast();
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("authToken");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (allIds: string[]) => {
    setSelectedIds((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    );
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkSubmitting(true);
    try {
      const response = await fetch("/api/material-submissions/bulk-approve", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) throw new Error("Bulk approve failed");
      const data = await response.json();

      toast({
        title: "Bulk approval complete",
        description: data.message,
      });

      clearSelection();
      setBulkApproving(false);
      queryClient.invalidateQueries({ queryKey: ["pending-material-submissions"] });
    } catch (error) {
      console.error("Error bulk approving submissions:", error);
      toast({
        title: "Error",
        description: "Failed to approve selected submissions",
        variant: "destructive",
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkRejectReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    setBulkSubmitting(true);
    try {
      const response = await fetch("/api/material-submissions/bulk-reject", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ids: Array.from(selectedIds), reason: bulkRejectReason }),
      });

      if (!response.ok) throw new Error("Bulk reject failed");
      const data = await response.json();

      toast({
        title: "Bulk rejection complete",
        description: `${data.message}. The submitters have been notified by email.`,
      });

      clearSelection();
      setBulkRejecting(false);
      setBulkRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["pending-material-submissions"] });
    } catch (error) {
      console.error("Error bulk rejecting submissions:", error);
      toast({
        title: "Error",
        description: "Failed to reject selected submissions",
        variant: "destructive",
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  const {
    data: submissions = [],
    isLoading: loading,
    isFetching: refreshing,
    refetch: refetchSubmissions,
  } = useQuery({
    queryKey: ["pending-material-submissions"],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const response = await fetch("/api/material-submissions-pending-approval", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error("Failed to load submissions");
      }

      const data = await response.json();
      return data.submissions.map((s: any) => s.submission) || [];
    },
    // Always treat this list as stale so newly submitted materials show up
    // as soon as the page is opened/revisited, instead of waiting out a
    // 5 minute cache window before a refetch is triggered.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    // Also poll in the background every 30s while this page stays open,
    // so pending submissions appear without the admin needing to refresh.
    refetchInterval: 30000,
  });

  const handleApprove = async (submissionId: string) => {
    setApproving(submissionId);
    try {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`/api/material-submissions/${submissionId}/approve`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to approve submission");
      }

      toast({
        title: "Success",
        description: "Material submission approved",
      });

      // Reload submissions
      queryClient.invalidateQueries({ queryKey: ["pending-material-submissions"] });
    } catch (error) {
      console.error("Error approving submission:", error);
      toast({
        title: "Error",
        description: "Failed to approve submission",
        variant: "destructive",
      });
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (submissionId: string) => {
    if (!rejectReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    setRejecting(submissionId);
    try {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`/api/material-submissions/${submissionId}/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject submission");
      }

      toast({
        title: "Success",
        description: "Material submission rejected. The submitter has been notified by email.",
      });

      setRejectReason("");
      // Reload submissions
      queryClient.invalidateQueries({ queryKey: ["pending-material-submissions"] });
    } catch (error) {
      console.error("Error rejecting submission:", error);
      toast({
        title: "Error",
        description: "Failed to reject submission",
        variant: "destructive",
      });
    } finally {
      setRejecting(null);
    }
  };

  return (
    <div className="w-full p-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Material Submission Approvals</h1>
          <p className="text-gray-600">
            Review and approve supplier material submissions
          </p>
        </div>
        <Button
          onClick={() => refetchSubmissions()}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500 py-12">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-600" />
              <p>No pending material submissions</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Bulk selection toolbar */}
          <div className="flex items-center justify-between bg-gray-50 border rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === submissions.length}
                onCheckedChange={() =>
                  toggleSelectAll(submissions.map((s: MaterialSubmission) => s.id))
                }
              />
              <span className="text-sm text-gray-700">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `Select all (${submissions.length})`}
              </span>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={() => setBulkApproving(true)}
                  disabled={bulkSubmitting}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Selected
                </Button>
                <Button
                  onClick={() => setBulkRejecting(true)}
                  disabled={bulkSubmitting}
                  variant="destructive"
                  className="gap-2"
                  size="sm"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Selected
                </Button>
                <Button onClick={clearSelection} variant="outline" size="sm">
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Bulk approve confirmation */}
          {bulkApproving && (
            <div className="p-4 bg-green-50 border border-green-200 rounded flex items-center justify-between">
              <p className="text-sm text-green-900">
                Approve <strong>{selectedIds.size}</strong> selected submission(s)? This will add them to the price list.
              </p>
              <div className="flex gap-2 shrink-0 ml-4">
                <Button
                  onClick={handleBulkApprove}
                  disabled={bulkSubmitting}
                  size="sm"
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  {bulkSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm Approve
                </Button>
                <Button onClick={() => setBulkApproving(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Bulk reject reason */}
          {bulkRejecting && (
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <Label className="text-red-900 font-semibold">
                Rejection Reason for {selectedIds.size} selected submission(s){" "}
                <span className="text-red-600">*</span>
              </Label>
              <p className="text-xs text-red-700 mb-2">
                This reason will be emailed to each submitter.
              </p>
              <Textarea
                placeholder="Explain why these submissions are being rejected"
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleBulkReject}
                  disabled={bulkSubmitting || !bulkRejectReason.trim()}
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                >
                  {bulkSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Confirm Rejection
                </Button>
                <Button
                  onClick={() => {
                    setBulkRejecting(false);
                    setBulkRejectReason("");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {submissions.map((submission: MaterialSubmission) => (
            <Card key={submission.id} className="border-l-4 border-l-yellow-500">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Selection checkbox */}
                  <div className="flex items-start gap-3 col-span-full md:col-span-1 lg:col-span-1">
                    <Checkbox
                      checked={selectedIds.has(submission.id)}
                      onCheckedChange={() => toggleSelect(submission.id)}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm text-gray-600">Material</p>
                      <p className="font-semibold text-lg">{submission.template_name}</p>
                      <p className="text-sm text-gray-500">{submission.template_code}</p>
                    </div>
                  </div>

                  {/* Supplier/Shop Info */}
                  <div>
                    <p className="text-sm text-gray-600">Supplier Shop</p>
                    <p className="font-semibold">{submission.shop_name}</p>
                  </div>

                  {/* Rate and Unit */}
                  <div>
                    <p className="text-sm text-gray-600">Rate</p>
                    <p className="font-semibold">
                      ₹{Number(submission.rate).toFixed(2)} / {submission.unit}
                    </p>
                  </div>

                  {/* Submitted Date + Price Age */}
                  <div>
                    <p className="text-sm text-gray-600">Price Added On</p>
                    <p className="font-semibold">
                      {new Date(submission.created_at).toLocaleDateString()}
                    </p>
                    {(() => {
                      const daysOld = Math.floor((Date.now() - new Date(submission.created_at).getTime()) / (1000 * 60 * 60 * 24));
                      if (daysOld > 90) return (
                        <p className="text-xs text-amber-600 font-semibold mt-1 flex items-center gap-1">
                          ⚠️ {daysOld} days old — Reconfirm price with vendor
                        </p>
                      );
                      return <p className="text-xs text-green-600 mt-1">{daysOld} day{daysOld !== 1 ? "s" : ""} ago — Recent</p>;
                    })()}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b">
                  {submission.brandname && (
                    <div>
                      <p className="text-sm text-gray-600">Brand</p>
                      <p className="font-semibold">{submission.brandname}</p>
                    </div>
                  )}
                  {submission.modelnumber && (
                    <div>
                      <p className="text-sm text-gray-600">Model Number</p>
                      <p className="font-semibold">{submission.modelnumber}</p>
                    </div>
                  )}
                  {submission.category && (
                    <div>
                      <p className="text-sm text-gray-600">Category</p>
                      <p className="font-semibold">{submission.category}</p>
                    </div>
                  )}
                  {submission.subcategory && (
                    <div>
                      <p className="text-sm text-gray-600">Subcategory</p>
                      <p className="font-semibold">{submission.subcategory}</p>
                    </div>
                  )}
                  {submission.hsn_code && (
                    <div>
                      <p className="text-sm text-gray-600">HSN Code</p>
                      <p className="font-semibold">{submission.hsn_code}</p>
                    </div>
                  )}
                  {submission.sac_code && (
                    <div>
                      <p className="text-sm text-gray-600">SAC Code</p>
                      <p className="font-semibold">{submission.sac_code}</p>
                    </div>
                  )}
                </div>

                {/* Technical Specification */}
                {submission.technicalspecification && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-2">Technical Specification</p>
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      {submission.technicalspecification}
                    </div>
                  </div>
                )}

                {/* Rejection Reason Section (if rejecting) */}
                {rejecting === submission.id && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
                    <Label className="text-red-900 font-semibold">
                      Rejection Reason <span className="text-red-600">*</span>
                    </Label>
                    <Textarea
                      placeholder="Explain why this submission is being rejected"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={4}
                      className="mt-2"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {rejecting === submission.id ? (
                    <>
                      <Button
                        onClick={() => handleReject(submission.id)}
                        variant="destructive"
                        disabled={!rejectReason.trim()}
                        className="gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Confirm Rejection
                      </Button>
                      <Button
                        onClick={() => {
                          setRejecting(null);
                          setRejectReason("");
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => handleApprove(submission.id)}
                        disabled={approving === submission.id}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {approving === submission.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        onClick={() => setRejecting(submission.id)}
                        variant="outline"
                        className="gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
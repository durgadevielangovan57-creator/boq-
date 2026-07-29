import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
  id: string;
  username: string;
  created_at: string;
}

export default function SupplierApproval() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const token = localStorage.getItem("token");

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pending-suppliers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch suppliers");
      }

      const data = await res.json();
      setSuppliers(data.suppliers || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load suppliers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/suppliers/${id}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Approve failed");
      }

      toast({
        title: "Approved",
        description: "Supplier approved successfully",
      });

      fetchSuppliers();
    } catch {
      toast({
        title: "Error",
        description: "Failed to approve supplier",
        variant: "destructive",
      });
    }
  };

  const reject = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/suppliers/${id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "Rejected by admin" }),
      });

      if (!res.ok) {
        throw new Error("Reject failed");
      }

      toast({
        title: "Rejected",
        description: "Supplier rejected successfully",
      });

      fetchSuppliers();
    } catch {
      toast({
        title: "Error",
        description: "Failed to reject supplier",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Supplier Approval</h1>

      {loading && <div>Loading...</div>}

      {!loading && suppliers.length === 0 && (
        <div className="text-gray-500">No pending suppliers</div>
      )}

      {suppliers.map((s) => (
        <Card
          key={s.id}
          className="p-4 flex justify-between items-center"
        >
          <div>
            <div className="font-medium">{s.username}</div>
            <div className="text-sm text-gray-500">
              Requested on{" "}
              {new Date(s.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => approve(s.id)}>
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => reject(s.id)}
            >
              Reject
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

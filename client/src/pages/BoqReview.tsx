import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import html2pdf from "html2pdf.js";
import { Download, Trash2 } from "lucide-react";

interface Step9Item {
  id?: string;
  session_id: string;
  material_id: string;
  shop_id: string;
  quantity: number;
  rate: number;
  description?: string;
  brand?: string;
  row_id?: string;
  batch_id?: string;
  material_name?: string;
  shop_name?: string;
}

export default function BoqReview() {
  const { toast } = useToast();
  const [step9Data, setStep9Data] = useState<Step9Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [estimator, setEstimator] = useState<"doors" | "flooring">("doors");

  // Load Step 9 data from database on mount
  useEffect(() => {
    loadStep9Data();
  }, []);

  const loadStep9Data = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/estimator-step9-items?estimator=${estimator}`,
      );

      if (!res.ok) {
        throw new Error("Failed to load data");
      }

      const data = await res.json();
      setStep9Data(data.items || []);
      setSelectedItems(new Set());

      if (!data.items || data.items.length === 0) {
        toast({
          title: "Info",
          description: "No Step 9 data found.",
        });
      } else {
        toast({
          title: "Success",
          description: `Loaded ${data.items.length} materials from database.`,
        });
      }
    } catch (err) {
      console.error("Load error:", err);
      toast({
        title: "Error",
        description: "Failed to load Step 9 data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const subTotal = step9Data.reduce((sum, item) => sum + (item.quantity * item.rate || 0), 0);
    const sgst = subTotal * 0.09;
    const cgst = subTotal * 0.09;
    const grandTotal = subTotal + sgst + cgst;
    return { subTotal, sgst, cgst, grandTotal };
  };

  const { subTotal, sgst, cgst, grandTotal } = calculateTotals();

  const toggleSelectItem = (idx: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === step9Data.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(step9Data.map((_, idx) => idx)));
    }
  };

  const handleDeleteSelected = () => {
    const newData = step9Data.filter((_, idx) => !selectedItems.has(idx));
    setStep9Data(newData);
    setSelectedItems(new Set());
    toast({
      title: "Success",
      description: `${selectedItems.size} item(s) deleted.`,
    });
  };

  const handleExportPDF = () => {
    const element = document.getElementById("boq-review-pdf");
    if (!element) return;

    const sessionId = step9Data[0]?.session_id || "BOM";
    html2pdf()
      .set({
        margin: 10,
        filename: `BOM_Review_${sessionId}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(element)
      .save();
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold">BOM Review - Step 9</h2>

        <Card>
          <CardContent className="pt-8 space-y-6">
            {/* Filter Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Filter by Estimator Type</h3>

              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label>Estimator Type</Label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={estimator}
                    onChange={(e) => {
                      setEstimator(e.target.value as "doors" | "flooring");
                      setStep9Data([]); // Clear data when changing estimator
                    }}
                  >
                    <option value="doors">Doors</option>
                    <option value="flooring">Flooring</option>
                  </select>
                </div>

                <Button onClick={loadStep9Data} disabled={loading}>
                  {loading ? "Loading..." : "Refresh Data"}
                </Button>
              </div>
            </div>

            {/* BOM Table */}
            {step9Data.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Add to BOM</h3>
                  {selectedItems.size > 0 && (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelected}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected ({selectedItems.size})
                      </Button>
                    </>
                  )}
                </div>

                <div id="boq-review-pdf" className="space-y-4">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-100">
                        <th className="border px-4 py-2 text-center w-12">
                          <input
                            type="checkbox"
                            checked={selectedItems.size === step9Data.length && step9Data.length > 0}
                            onChange={toggleSelectAll}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="border px-4 py-2 text-left">S.No</th>
                        <th className="border px-4 py-2 text-left">Item</th>
                        <th className="border px-4 py-2 text-left">Description</th>
                        <th className="border px-4 py-2 text-left">Unit</th>
                        <th className="border px-4 py-2 text-right">Qty</th>
                        <th className="border px-4 py-2 text-right">Rate</th>
                        <th className="border px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {step9Data.map((item, idx) => (
                        <tr key={item.id || idx} className="border-b">
                          <td className="border px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(idx)}
                              onChange={() => toggleSelectItem(idx)}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="border px-4 py-2">{idx + 1}</td>
                          <td className="border px-4 py-2 font-medium">{item.material_name || "N/A"}</td>
                          <td className="border px-4 py-2 text-xs">{item.description || "-"}</td>
                          <td className="border px-4 py-2 text-center">pcs</td>
                          <td className="border px-4 py-2 text-right">{item.quantity}</td>
                          <td className="border px-4 py-2 text-right">₹{(item.rate || 0).toFixed(2)}</td>
                          <td className="border px-4 py-2 text-right font-semibold">
                            ₹{((item.quantity || 0) * (item.rate || 0)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="border-t pt-4 space-y-2 ml-auto w-96">
                    <div className="flex justify-between px-4">
                      <span>Subtotal:</span>
                      <span>₹{subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between px-4">
                      <span>SGST (9%):</span>
                      <span>₹{sgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between px-4">
                      <span>CGST (9%):</span>
                      <span>₹{cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold px-4">
                      <span>Grand Total:</span>
                      <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={handleExportPDF} className="flex-1">
                    <Download className="mr-2 h-4 w-4" /> Export as PDF
                  </Button>
                </div>
              </div>
            )}

            {step9Data.length === 0 && !loading && (
              <div className="text-center text-muted-foreground py-8">
                No materials found. Loading data...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

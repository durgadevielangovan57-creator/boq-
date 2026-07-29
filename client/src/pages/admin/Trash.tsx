import React, { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { RefreshCw, Trash2, RotateCcw, AlertTriangle, Search } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface ArchiveItem {
  id: string;
  module: string;
  originId: string;
  data: any;
  status: "archived" | "trashed";
  archivedAt: string;
  trashedAt: string | null;
}

export default function Trash() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/trash");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSelected(new Set());
      }
    } catch (err) {
      console.error("Failed to fetch trash:", err);
      toast({
        title: "Error",
        description: "Could not load trashed items.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (id: string) => {
    try {
      const res = await apiFetch(`/api/archive/${id}/restore`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Item Restored", description: "The item has been restored successfully." });
        setItems(prev => prev.filter(item => item.id !== id));
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
      } else {
        throw new Error("Restore failed");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to restore item.", variant: "destructive" });
    }
  };

  const handleDeletePermanent = async (id: string, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm("Are you sure you want to permanently delete this item? This action CANNOT be undone.")) {
      return;
    }
    try {
      const res = await apiFetch(`/api/archive/${id}/permanent`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Deleted Permanently", description: "Item has been permanently deleted." });
        setItems(prev => prev.filter(item => item.id !== id));
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
      } else {
        throw new Error("Delete failed");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete item permanently.", variant: "destructive" });
    }
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selected);
    await Promise.all(ids.map(id => handleRestore(id)));
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete ${selected.size} item(s)? This action CANNOT be undone.`)) return;
    const ids = Array.from(selected);
    await Promise.all(ids.map(id => handleDeletePermanent(id, true)));
  };

  const getItemName = (item: ArchiveItem) => {
    if (!item.data) return "Unknown Item";
    const name = item.data.name || item.data.title || item.data.code;
    if (name) return name;

    if (item.module === "boq_items") {
      const td =
        typeof item.data.table_data === "string"
          ? JSON.parse(item.data.table_data)
          : item.data.table_data;
      return td?.product_name || item.data.estimator || "Unnamed BOM Product";
    }

    if (item.module === "boq_projects") return item.data.name || "Unnamed Project";

    return item.originId;
  };

  const getDaysLeft = (trashedAt: string | null) => {
    if (!trashedAt) return 30;
    const daysPassed = differenceInDays(new Date(), new Date(trashedAt));
    return Math.max(0, 30 - daysPassed);
  };

  const filteredItems = items.filter((item) => {
    const query = search.toLowerCase();
    return (
      getItemName(item).toLowerCase().includes(query) ||
      item.module.toLowerCase().includes(query)
    );
  });

  const allSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selected.has(item.id));
  const someSelected = filteredItems.some((item) => selected.has(item.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(prev => {
        const s = new Set(prev);
        filteredItems.forEach(item => s.delete(item.id));
        return s;
      });
    } else {
      setSelected(prev => {
        const s = new Set(prev);
        filteredItems.forEach(item => s.add(item.id));
        return s;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trash2 className="text-red-500 h-8 w-8" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Trash</h1>
          </div>
          <Button variant="outline" onClick={fetchTrash} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="border-red-100">
          <CardHeader className="border-b bg-red-50/50 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <h3 className="text-sm font-medium text-red-800">
                Items in Trash will be automatically and permanently deleted after 30 days.
              </h3>
            </div>

            {/* Search + item count row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  placeholder="Search by name or module…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
                {search && items.length !== filteredItems.length && (
                  <span className="text-gray-400"> of {items.length}</span>
                )}
              </span>
            </div>

            {/* Bulk action bar */}
            {someSelected && (
              <div className="flex items-center gap-3 py-2 px-3 bg-red-50 border border-red-200 rounded-md">
                <span className="text-sm font-medium text-red-700">
                  {selected.size} selected
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-300 hover:bg-green-50"
                    onClick={handleBulkRestore}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Restore Selected
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete Selected Forever
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {/* Scrollable box */}
            <div className="overflow-y-auto max-h-[480px]">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {loading
                    ? "Loading..."
                    : search
                      ? "No items match your search."
                      : "Trash is empty."}
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = !allSelected && someSelected;
                          }}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-3">Item Name</th>
                      <th className="px-6 py-3">Module</th>
                      <th className="px-6 py-3">Trashed Date</th>
                      <th className="px-6 py-3">Countdown</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const daysLeft = getDaysLeft(item.trashedAt);
                      return (
                        <tr
                          key={item.id}
                          className={`border-b hover:bg-gray-50 ${selected.has(item.id) ? "bg-red-50/40" : "bg-white"
                            }`}
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selected.has(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              className="h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {getItemName(item)}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="secondary" className="capitalize">
                              {item.module.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {item.trashedAt ? format(new Date(item.trashedAt), "PP") : "-"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`font-semibold ${daysLeft <= 3 ? "text-red-600" : "text-orange-500"
                                }`}
                            >
                              {daysLeft} days left
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => handleRestore(item.id)}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" /> Restore
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeletePermanent(item.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Delete Forever
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

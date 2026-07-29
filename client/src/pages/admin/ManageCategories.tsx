import React, { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getJSON, putJSON } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function ManageCategories() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const [categories, setCategories] = useState<string[]>([]);

  // Filtering UI state
  const [filterCategory, setFilterCategory] = useState<string>("all-categories");
  const [filterSubcategory, setFilterSubcategory] = useState<string>("all-subcategories");
  const [filterSubcategories, setFilterSubcategories] = useState<string[]>([]);

  // Assignment UI state
  const [assignCategory, setAssignCategory] = useState<string>("");
  const [assignSubcategory, setAssignSubcategory] = useState<string>("");
  const [assignSubcategories, setAssignSubcategories] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getJSON("/api/materials");
        setMaterials(data.materials || []);
      } catch (e) {
        console.error("Failed to load materials", e);
      }
    })();

    (async () => {
      try {
        const res = await getJSON("/api/material-categories");
        setCategories(res.categories || []);
      } catch (e) {
        console.error("Failed to load categories", e);
      }
    })();
  }, []);

  // Handle Filtering
  useEffect(() => {
    let filteredList = materials;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      filteredList = filteredList.filter((m) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.code || "").toLowerCase().includes(q)
      );
    }

    // Category filter
    if (filterCategory && filterCategory !== "all-categories") {
      filteredList = filteredList.filter(m => {
        if (filterCategory === "uncategorized") return !m.category;
        const cats = (m.category || "").split(",").map((s: string) => s.trim().toLowerCase());
        return cats.includes(filterCategory.toLowerCase());
      });
    }

    // Subcategory filter
    if (filterSubcategory && filterSubcategory !== "all-subcategories") {
      filteredList = filteredList.filter(m => {
        const currentSub = m.subcategory || m.subCategory || "";
        if (filterSubcategory === "uncategorized") return !currentSub;
        const subs = currentSub.split(",").map((s: string) => s.trim().toLowerCase());
        return subs.includes(filterSubcategory.toLowerCase());
      });
    }

    setFiltered(filteredList);
  }, [search, materials, filterCategory, filterSubcategory]);

  // Load subcategories for FILTER
  useEffect(() => {
    if (!filterCategory || filterCategory === "all-categories" || filterCategory === "uncategorized") {
      setFilterSubcategories([]);
      setFilterSubcategory("all-subcategories");
      return;
    }
    (async () => {
      try {
        const res = await getJSON(`/api/material-subcategories/${encodeURIComponent(filterCategory)}`);
        setFilterSubcategories(res.subcategories || []);
      } catch (e) {
        console.error("Failed to load filter subcategories", e);
        setFilterSubcategories([]);
      }
    })();
  }, [filterCategory]);

  // Load subcategories for ASSIGNMENT
  useEffect(() => {
    if (!assignCategory || assignCategory === "uncategorized") {
      setAssignSubcategories([]);
      setAssignSubcategory("");
      return;
    }
    (async () => {
      try {
        const res = await getJSON(`/api/material-subcategories/${encodeURIComponent(assignCategory)}`);
        setAssignSubcategories(res.subcategories || []);
      } catch (e) {
        console.error("Failed to load assign subcategories", e);
        setAssignSubcategories([]);
      }
    })();
  }, [assignCategory]);

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => ({ ...s, [id]: !s[id] }));
  };

  const toggleSelectAll = (checked: boolean) => {
    const newSelected: Record<string, boolean> = {};
    if (checked) {
      filtered.forEach(m => {
        newSelected[m.id] = true;
      });
    }
    setSelectedIds(newSelected);
  };

  const [conflictQueue, setConflictQueue] = useState<any[]>([]);
  const [conflictIndex, setConflictIndex] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inProgress, setInProgress] = useState(false);

  const assignCategories = async () => {
    const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
    if (ids.length === 0) {
      alert("Select at least one material");
      return;
    }
    if (!assignCategory) {
      alert("Select a category to assign first");
      return;
    }

    setInProgress(true);

    const immediate: string[] = [];
    const conflicts: any[] = [];

    const targetCat = assignCategory === "uncategorized" ? "" : assignCategory;
    const targetSub = assignSubcategory === "uncategorized" || !assignSubcategory ? "" : assignSubcategory;

    for (const id of ids) {
      const mat = materials.find((m) => m.id === id);
      if (!mat) continue;
      const existingCat = mat.category || "";
      const existingSub = mat.subcategory || mat.subCategory || "";

      // If we are resetting to uncategorized, go immediate
      if (!targetCat || !existingCat) {
        immediate.push(id);
      } else {
        conflicts.push({ id, mat, existingCat, existingSub });
      }
    }

    // Update immediate ones in parallel
    await Promise.all(immediate.map(async (id) => {
      try {
        await putJSON(`/api/materials/${id}`, { category: targetCat, subcategory: targetSub });
      } catch (e) {
        console.error(`Failed to update material ${id}`, e);
      }
    }));

    if (conflicts.length > 0) {
      setConflictQueue(conflicts);
      setConflictIndex(0);
      setDialogOpen(true);
    } else {
      finishAssignment();
    }
  };

  const finishAssignment = async () => {
    setInProgress(false);
    alert("Category assignment completed");
    try {
      const data = await getJSON("/api/materials");
      setMaterials(data.materials || []);
      setSelectedIds({});
    } catch (e) {
      console.error("Failed to reload materials", e);
    }
  };

  const processCurrentConflict = async (choice: "append" | "replace" | "cancel") => {
    const item = conflictQueue[conflictIndex];
    if (!item) return;

    if (choice === "cancel") {
      setDialogOpen(false);
      setConflictQueue([]);
      setConflictIndex(0);
      setInProgress(false);
      return;
    }

    const { id, mat, existingCat, existingSub } = item;
    let finalCat = assignCategory === "uncategorized" ? "" : assignCategory;
    let finalSub = assignSubcategory === "uncategorized" || !assignSubcategory ? "" : assignSubcategory;

    if (choice === "append" && finalCat) {
      const mergedCats = Array.from(new Set((existingCat + "," + finalCat).split(',').map((s: string) => s.trim()).filter(Boolean)));
      finalCat = mergedCats.join(",");

      if (finalSub && existingSub) {
        const mergedSubs = Array.from(new Set((existingSub + "," + finalSub).split(',').map((s: string) => s.trim()).filter(Boolean)));
        finalSub = mergedSubs.join(",");
      } else if (!finalSub) {
        finalSub = existingSub;
      }
    }

    try {
      await putJSON(`/api/materials/${id}`, { category: finalCat, subcategory: finalSub });
    } catch (e) {
      console.error(`Failed to update material ${id}`, e);
    }

    const next = conflictIndex + 1;
    if (next >= conflictQueue.length) {
      setDialogOpen(false);
      setConflictQueue([]);
      setConflictIndex(0);
      finishAssignment();
    } else {
      setConflictIndex(next);
    }
  };

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Manage Material Categories</h2>
        </div>

        {/* Top Section: Filters and Search */}
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Filter Materials
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search by name or item code..."
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                className="bg-muted/30 border-muted-foreground/20"
              />
            </div>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="bg-muted/30 border-muted-foreground/20">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all-categories">All Categories</SelectItem>
                <SelectItem value="uncategorized" className="font-semibold text-amber-600">Uncategorized</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSubcategory} onValueChange={setFilterSubcategory} disabled={filterCategory === "all-categories"}>
              <SelectTrigger className="bg-muted/30 border-muted-foreground/20">
                <SelectValue placeholder="All Subcategories" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all-subcategories">All Subcategories</SelectItem>
                <SelectItem value="uncategorized" className="font-semibold text-amber-600">Uncategorized</SelectItem>
                {filterSubcategories.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left/Main Column: Material List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={filtered.length > 0 && selectedCount === filtered.length}
                    onCheckedChange={(checked) => toggleSelectAll(checked as boolean)}
                  />
                  <label htmlFor="select-all" className="cursor-pointer">Select All Visible</label>
                </div>
                <span className="text-muted-foreground font-normal">
                  Showing {filtered.length} material{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
              {selectedCount > 0 && (
                <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                  {selectedCount} Selected
                </div>
              )}
            </div>

            <div className="border rounded-xl bg-card overflow-hidden shadow-sm min-h-[400px]">
              <div className="max-h-[600px] overflow-y-auto divide-y divide-border/50">
                {filtered.length === 0 ? (
                  <div className="p-20 text-center text-muted-foreground flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div>No materials matching your criteria</div>
                  </div>
                ) : (
                  filtered.map((m) => (
                    <div key={m.id} className={`flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors ${selectedIds[m.id] ? 'bg-blue-50/30' : ''}`}>
                      <div className="pt-1">
                        <Checkbox checked={!!selectedIds[m.id]} onCheckedChange={() => toggleSelect(m.id)} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{m.name || m.code}</span>
                          <span className="text-xs font-mono bg-muted/60 px-2 py-0.5 rounded text-muted-foreground">{m.code}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <div className={`text-[11px] px-2 py-0.5 rounded-full border ${m.category ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-50 text-amber-600 border-amber-100 font-medium'}`}>
                            Category: <span className="font-semibold">{m.category || "None"}</span>
                          </div>
                          <div className={`text-[11px] px-2 py-0.5 rounded-full border ${m.subcategory || m.subCategory ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-50 text-amber-600 border-amber-100 font-medium'}`}>
                            Sub: {m.subcategory || m.subCategory || "None"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Assignment Controls */}
          <div className="space-y-4">
            <div className="bg-card border rounded-xl p-5 shadow-sm sticky top-24 space-y-4">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Assign Category
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground px-1">Target Category</label>
                  <Select value={assignCategory} onValueChange={setAssignCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="uncategorized" className="font-semibold text-amber-600">Uncategorized (Clear)</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground px-1">Target Subcategory</label>
                  <Select value={assignSubcategory} onValueChange={setAssignSubcategory} disabled={!assignCategory || assignCategory === "uncategorized"}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Subcategory" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="uncategorized" className="font-semibold text-amber-600">Uncategorized (Clear)</SelectItem>
                      {assignSubcategories.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={assignCategories}
                    className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm py-6 text-base font-semibold transition-all hover:translate-y-[-1px] active:translate-y-[0px]"
                    disabled={selectedCount === 0 || inProgress}
                  >
                    {inProgress ? "Processing..." : `Assign to ${selectedCount} Item${selectedCount === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conflict resolution dialog */}
        <Dialog open={dialogOpen} onOpenChange={(o) => setDialogOpen(o)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Resolve Assignment Conflict
              </DialogTitle>
              <DialogDescription className="pt-2">
                {conflictQueue[conflictIndex] ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/40 rounded-lg border text-sm">
                      <div className="font-semibold mb-1">Item Details:</div>
                      <div className="text-foreground">{conflictQueue[conflictIndex].mat.name || conflictQueue[conflictIndex].mat.code}</div>
                    </div>

                    <div className="text-sm">
                      This item already belongs to:
                      <div className="mt-2 font-medium text-foreground italic">
                        Category: {conflictQueue[conflictIndex].existingCat} | Sub: {conflictQueue[conflictIndex].existingSub}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>All conflicts resolved</div>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-start gap-2 pt-4">
              <Button onClick={() => processCurrentConflict("append")} className="bg-green-600 hover:bg-green-700 flex-1">Append</Button>
              <Button onClick={() => processCurrentConflict("replace")} variant="outline" className="flex-1">Replace</Button>
              <Button variant="ghost" onClick={() => processCurrentConflict("cancel")} className="text-muted-foreground">Cancel All</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

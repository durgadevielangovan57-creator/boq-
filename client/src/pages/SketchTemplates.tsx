import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Copy, ArrowLeft, Layers, FileText, Search, LayoutGrid, List, Clock } from "lucide-react";
import apiFetch from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";

export default function SketchTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/sketch-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Failed to load templates", err);
      toast({ title: "Error", description: "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const deleteTemplate = async (action: 'archive' | 'trash') => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/api/sketch-templates/${deleteTarget}?action=${action}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Success", description: action === 'trash' ? "Template moved to Trash" : "Template archived" });
        loadTemplates();
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const useTemplate = async (templateId: string) => {
    try {
      const res = await apiFetch(`/api/sketch-templates/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem("sketch_template_data", JSON.stringify(data.template.template_data));
        setLocation("/create-sketch-plan");
      } else {
        toast({ title: "Error", description: "Failed to load template details", variant: "destructive" });
      }
    } catch (err) {
      console.error("Failed to load template data", err);
      toast({ title: "Error", description: "An error occurred while loading the template", variant: "destructive" });
    }
  };

  const filteredTemplates = templates.filter(t => (t.name || "").toLowerCase().includes(search.toLowerCase()));

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <React.Fragment>
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setLocation("/sketch-plans")} className="p-0 hover:bg-transparent">
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">Sketch Templates</h1>
            </div>
            
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <Button 
                variant={viewMode === "grid" ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setViewMode("grid")}
                className={`h-8 px-3 gap-2 ${viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm hover:bg-white" : "text-slate-500 hover:bg-slate-200"}`}
              >
                <LayoutGrid className="w-4 h-4" /> Grid
              </Button>
              <Button 
                variant={viewMode === "list" ? "default" : "ghost"} 
                size="sm" 
                onClick={() => setViewMode("list")}
                className={`h-8 px-3 gap-2 ${viewMode === "list" ? "bg-white text-indigo-600 shadow-sm hover:bg-white" : "text-slate-500 hover:bg-slate-200"}`}
              >
                <List className="w-4 h-4" /> List
              </Button>
            </div>
          </div>

          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="py-10 text-center text-muted-foreground italic">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-20 text-center space-y-4 border rounded-lg border-dashed border-slate-300">
              <Layers className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-slate-500">No templates found. Save a plan as a template to see it here.</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((t) => (
                <Card key={t.id} className="hover:border-indigo-300 transition-colors shadow-sm overflow-hidden group">
                  <CardHeader className="pb-2 bg-slate-50/50 group-hover:bg-indigo-50/30 transition-colors">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="truncate">{t.name}</span>
                      <Layers className="w-4 h-4 text-indigo-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{t.item_count || 0} items defined</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Created: {formatDate(t.last_updated)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-100 mt-4">
                      <Button onClick={() => useTemplate(t.id)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm">
                        <Copy className="w-4 h-4" /> Use Template
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteTarget(t.id)} className="text-red-500 hover:bg-red-50 border-slate-200">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Template Name</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Items</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Created Date & Time</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTemplates.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                              <Layers className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-slate-700">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-bold border border-slate-200">
                            {t.item_count || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formatDate(t.last_updated)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" onClick={() => useTemplate(t.id)} className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                              <Copy className="w-3.5 h-3.5" /> Use
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => setDeleteTarget(t.id)} className="h-8 w-8 text-red-500 hover:bg-red-50 border-slate-200">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </Layout>
      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={(action) => deleteTemplate(action)}
        itemName="sketch template"
      />
    </React.Fragment>
  );
}
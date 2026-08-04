import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Gavel, Database, FileText, Settings, Users, Link, Trash2, LayoutTemplate } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { TenderFormsDialog } from "@/components/admin/TenderFormsDialog";
import { FormRenderer } from "@/components/formbuilder/FormRenderer";
import { filterSchemaForAdmin, FormSchema } from "@/lib/formSchema";
import "../tenders-glass.css";

function InvitationsPanel() {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvitations = () => {
    apiFetch("/api/et/invitations")
      .then(res => res.json())
      .then(data => setInvitations(data.invitations || []))
      .catch(err => console.error("Failed to load invitations", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const [inviteRole, setInviteRole] = useState<"client" | "vendor">("vendor");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const openInvite = (role: "client" | "vendor") => {
    setInviteRole(role);
    setInviteEmail("");
    setIsInviteOpen(true);
  };

  const generateInvite = async (sendEmail: boolean) => {
    if (!sendEmail && !inviteEmail) {
      const genericLink = `${window.location.origin}/register/${inviteRole}/general`;
      navigator.clipboard.writeText(genericLink);
      toast({ title: "Link Copied", description: `A generic ${inviteRole} registration link has been copied to your clipboard.` });
      setIsInviteOpen(false);
      return;
    }

    if (!inviteEmail) {
      toast({ title: "Error", description: "Email is required to send an invitation", variant: "destructive" });
      return;
    }

    try {
      const res = await apiFetch("/api/et/invitations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, sendEmail })
      });

      if (!res.ok) throw new Error("Failed to generate invitation");

      const data = await res.json();

      if (sendEmail) {
        toast({ title: "Email Sent!", description: `The invitation was sent securely to ${inviteEmail}.` });
      } else {
        navigator.clipboard.writeText(data.link);
        toast({ title: "Link Copied", description: `The ${inviteRole} registration link has been copied to your clipboard.` });
      }

      setIsInviteOpen(false);
      loadInvitations();
    } catch (err) {
      toast({ title: "Error", description: "Failed to process invitation", variant: "destructive" });
    }
  };

  return (
    <Card className="tg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Registration & Invitations</CardTitle>
          <CardDescription>Generate secure links to onboard vendors and clients.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openInvite("client")}><Link className="h-4 w-4 mr-1" /> Invite Client</Button>
          <Button className="tg-create-btn" onClick={() => openInvite("vendor")}><Link className="h-4 w-4 mr-1" /> Invite Vendor</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 border rounded-lg bg-slate-50 flex items-center justify-between">
            <span className="font-semibold text-sm">Pending Invites</span>
            <span className="text-xl font-bold">{invitations.filter(i => i.status === 'Pending').length}</span>
          </div>
          <div className="p-4 border rounded-lg bg-slate-50 flex items-center justify-between">
            <span className="font-semibold text-sm">Total Invites</span>
            <span className="text-xl font-bold">{invitations.length}</span>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>
            ) : invitations.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No invitations sent yet.</TableCell></TableRow>
            ) : (
              invitations.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell className="capitalize">{inv.role}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.token}</TableCell>
                  <TableCell>{inv.status}</TableCell>
                  <TableCell>{new Date(inv.expires_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

      </CardContent>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite {inviteRole === "client" ? "Client" : "Vendor"}</DialogTitle>
            <CardDescription>Enter the email address of the {inviteRole} you want to invite.</CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                placeholder="vendor@company.com"
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
            <Button variant="secondary" onClick={() => generateInvite(false)}>
              <Link className="h-4 w-4 mr-2" /> Just Copy Link
            </Button>
            <Button className="tg-create-btn" onClick={() => generateInvite(true)}>
              Send Email Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MasterDataPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newVal, setNewVal] = useState("");

  const loadData = () => {
    setLoading(true);
    let url = "/api/et/master-data";
    if (categoryFilter) url += `?category=${categoryFilter}`;

    apiFetch(url)
      .then(res => res.json())
      .then(d => setData(d.data || []))
      .catch(err => console.error("Failed to load master data", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter]);

  const handleCreate = async () => {
    if (!newCat || !newCode || !newVal) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    try {
      const res = await apiFetch("/api/et/master-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCat, code: newCode, value: newVal })
      });

      if (!res.ok) {
        if (res.status === 409) throw new Error("Code already exists in this category");
        throw new Error("Failed to create entry");
      }

      toast({ title: "Success", description: "Master data entry added." });
      setCreateOpen(false);
      setNewCat(""); setNewCode(""); setNewVal("");
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add entry", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      const res = await apiFetch(`/api/et/master-data/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      toast({ title: "Success", description: "Entry deleted." });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="tg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Master Data Management</CardTitle>
          <CardDescription>Configure enterprise dictionaries (Currencies, Project Categories, Tax Types)</CardDescription>
        </div>
        <Button className="tg-create-btn" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Entry
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Button variant={categoryFilter === null ? "default" : "outline"} onClick={() => setCategoryFilter(null)} className="justify-start"><Database className="h-4 w-4 mr-2" /> All</Button>
          <Button variant={categoryFilter === "COMPANY_TYPE" ? "default" : "outline"} onClick={() => setCategoryFilter("COMPANY_TYPE")} className="justify-start"><Database className="h-4 w-4 mr-2" /> Company Types</Button>
          <Button variant={categoryFilter === "PROJECT_CATEGORY" ? "default" : "outline"} onClick={() => setCategoryFilter("PROJECT_CATEGORY")} className="justify-start"><Database className="h-4 w-4 mr-2" /> Project Categories</Button>
          <Button variant={categoryFilter === "CURRENCY" ? "default" : "outline"} onClick={() => setCategoryFilter("CURRENCY")} className="justify-start"><Database className="h-4 w-4 mr-2" /> Currencies</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-[100px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-4">Loading...</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No entries found.</TableCell></TableRow>
            ) : (
              data.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.category}</TableCell>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.value}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Master Data Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
              >
                <option value="">Select Category...</option>
                <option value="COMPANY_TYPE">Company Type</option>
                <option value="PROJECT_CATEGORY">Project Category</option>
                <option value="CURRENCY">Currency</option>
                <option value="TENDER_TYPE">Tender Type</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input placeholder="e.g. USD, CIVIL, etc." value={newCode} onChange={e => setNewCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Value / Display Name</Label>
              <Input placeholder="e.g. US Dollar, Civil Works" value={newVal} onChange={e => setNewVal(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}



function TendersListPanel({ onCreate, onEdit, refreshKey }: { onCreate: () => void, onEdit: (t: any) => void, refreshKey: number }) {
  const { toast } = useToast();
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [localRefresh, setLocalRefresh] = useState(0);

  // Dialog States
  const [selectedTender, setSelectedTender] = useState<any>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [visibilityConfig, setVisibilityConfig] = useState({ budget: false, location: false, clientInfo: false });
  const [tenderDocs, setTenderDocs] = useState<any[]>([]);
  const [docsToShare, setDocsToShare] = useState<string[]>([]);

  const [extendOpen, setExtendOpen] = useState(false);
  const [newEndDate, setNewEndDate] = useState("");

  const [formsTender, setFormsTender] = useState<any>(null);
  const [formsOpen, setFormsOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/et/admin/tenders")
      .then((res) => res.json())
      .then((data) => setTenders(data.tenders || []))
      .catch((err) => console.error("Failed to load tenders", err))
      .finally(() => setLoading(false));
  }, [refreshKey, localRefresh]);

  const openPublish = (tender: any) => {
    setSelectedTender(tender);
    setVisibilityConfig({ budget: false, location: false, clientInfo: false });
    setDocsToShare([]);
    apiFetch(`/api/et/admin/tenders/${tender.id}/documents`)
      .then(res => res.json())
      .then(data => setTenderDocs(data.documents || []))
      .catch(err => console.error("Docs fetch error", err));
    setPublishOpen(true);
  };

  const handlePublish = async () => {
    try {
      const response = await apiFetch(`/api/et/admin/tenders/${selectedTender.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibilityConfig, documentIdsToShare: docsToShare })
      });
      if (response.ok) {
        toast({ title: "Success", description: "Tender published successfully." });
        setPublishOpen(false);
        setLocalRefresh(prev => prev + 1);
      } else {
        toast({ title: "Error", description: "Failed to publish", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    }
  };

  const copyLink = async (tender: any) => {
    try {
      const res = await apiFetch(`/api/fb/tenders/${tender.id}/open-link`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { token } = await res.json();
      const link = `${window.location.origin}/t/open/${token}`;
      // navigator.clipboard requires HTTPS; fall back to execCommand for HTTP
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({ title: "Link copied", description: "Share it with any vendor — they'll fill the attached form and submit, no login needed." });
    } catch {
      toast({ title: "Error", description: "Failed to create/copy link", variant: "destructive" });
    }
  };

  const openExtend = (tender: any) => {
    setSelectedTender(tender);
    setNewEndDate(tender.end_date ? new Date(tender.end_date).toISOString().slice(0, 16) : "");
    setExtendOpen(true);
  };

  const handleDelete = async (tender: any) => {
    if (!confirm(`Are you sure you want to delete "${tender.title}" (${tender.tender_number})? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/api/et/admin/tenders/${tender.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tender");
      toast({ title: "Success", description: "Tender deleted." });
      setLocalRefresh(prev => prev + 1);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete tender", variant: "destructive" });
    }
  };

  const handleExtend = async () => {
    try {
      const response = await apiFetch(`/api/et/admin/tenders/${selectedTender.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEndDate })
      });
      if (response.ok) {
        toast({ title: "Success", description: "Timeline extended." });
        setExtendOpen(false);
        setLocalRefresh(prev => prev + 1);
      } else {
        toast({ title: "Error", description: "Failed to extend", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    }
  };

  return (
    <Card className="tg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Active Tenders</CardTitle>
          <CardDescription>Manage all procurement cycles across the organization.</CardDescription>
        </div>
        <Button className="tg-create-btn" onClick={onCreate}><Plus className="h-4 w-4 mr-1" /> Create Tender</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tender No</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading tenders...</TableCell>
              </TableRow>
            ) : tenders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No active tenders found. Create one to begin.</TableCell>
              </TableRow>
            ) : (
              tenders.map((tender) => (
                <TableRow key={tender.id}>
                  <TableCell className="font-medium">{tender.tender_number}</TableCell>
                  <TableCell>{tender.title}</TableCell>
                  <TableCell>{tender.category_name || "Uncategorized"}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${tender.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {tender.is_published ? (tender.status === 'Closed' ? 'Closed' : 'Published') : tender.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(tender)}>View</Button>
                    <Button variant="outline" size="sm" onClick={() => { setFormsTender(tender); setFormsOpen(true); }}>
                      <LayoutTemplate className="h-3.5 w-3.5 mr-1" /> Forms
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => copyLink(tender)}>
                      <Link className="h-3.5 w-3.5 mr-1" /> Copy Link
                    </Button>
                    {!tender.is_published && tender.status !== 'Closed' && (
                      <Button variant="default" size="sm" onClick={() => openPublish(tender)}>Publish</Button>
                    )}
                    {tender.is_published && (
                      <Button variant="secondary" size="sm" onClick={() => openExtend(tender)}>Extend</Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(tender)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Delete tender"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Publish Dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Publish Tender Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">Select the information you want to be visible to vendors.</p>

            <div className="space-y-4 border p-4 rounded-md">
              <h4 className="font-semibold text-sm">General Information</h4>
              <div className="flex items-center justify-between">
                <Label>Share Estimated Budget</Label>
                <Switch checked={visibilityConfig.budget} onCheckedChange={(c) => setVisibilityConfig(p => ({ ...p, budget: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Share Location Details</Label>
                <Switch checked={visibilityConfig.location} onCheckedChange={(c) => setVisibilityConfig(p => ({ ...p, location: c }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Share Client Information</Label>
                <Switch checked={visibilityConfig.clientInfo} onCheckedChange={(c) => setVisibilityConfig(p => ({ ...p, clientInfo: c }))} />
              </div>
            </div>

            {tenderDocs.length > 0 && (
              <div className="space-y-4 border p-4 rounded-md">
                <h4 className="font-semibold text-sm">Documents & Photos</h4>
                <div className="space-y-2">
                  {tenderDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between">
                      <span className="text-sm truncate w-2/3">{doc.name}</span>
                      <Switch
                        checked={docsToShare.includes(doc.id)}
                        onCheckedChange={(c) => setDocsToShare(p => c ? [...p, doc.id] : p.filter(id => id !== doc.id))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button onClick={handlePublish}>Confirm Publish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Timeline Dialog */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Extend Tender Timeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New End Date & Time</Label>
              <Input type="datetime-local" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">If the tender was automatically closed, extending the timeline will reopen it and set its status back to Published.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>Cancel</Button>
            <Button onClick={handleExtend}>Save Timeline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TenderFormsDialog tender={formsTender} open={formsOpen} onOpenChange={setFormsOpen} />
    </Card>
  );
}

export default function AdminTenders() {
  const [activeTab, setActiveTab] = useState("tenders");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  // Create Tender Form State
  const [editingTenderId, setEditingTenderId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [projectCategories, setProjectCategories] = useState<any[]>([]);

  useEffect(() => {
    if (createOpen) {
      apiFetch("/api/et/master-data?category=PROJECT_CATEGORY")
        .then(res => res.json())
        .then(d => {
          if (d.data && d.data.length > 0) {
            setProjectCategories(d.data);
            if (!category) setCategory(d.data[0].value);
          } else {
            setProjectCategories([]);
          }
        })
        .catch(err => console.error(err));
    }
  }, [createOpen]);
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [submissionStart, setSubmissionStart] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [visibility, setVisibility] = useState("Public");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [numDiscussions, setNumDiscussions] = useState(0);
  const [clientInfoEnabled, setClientInfoEnabled] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientInfoDetails, setClientInfoDetails] = useState("");
  const [documents, setDocuments] = useState<{ name: string, fileType: string, url: string }[]>([]);

  // Vendor Form selection (choose a saved Form template to attach, or "Default" for none)
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [formTemplateId, setFormTemplateId] = useState<string>("__default__");
  const [templateSchema, setTemplateSchema] = useState<FormSchema | null>(null);
  const [adminFormData, setAdminFormData] = useState<Record<string, any>>({});
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    if (createOpen) {
      apiFetch("/api/fb/templates?category=FORM")
        .then(res => res.json())
        .then(d => setFormTemplates(d.templates || []))
        .catch(err => console.error(err));
    }
  }, [createOpen]);

  // When a saved form is picked, pull its full schema so we can show the admin's
  // own fields (the ones NOT marked "Visible to Vendor") right here to fill in.
  useEffect(() => {
    if (formTemplateId === "__default__") {
      setTemplateSchema(null);
      setAdminFormData({});
      return;
    }
    setLoadingTemplate(true);
    apiFetch(`/api/fb/templates/${formTemplateId}`)
      .then(res => res.json())
      .then(d => {
        setTemplateSchema(d.template?.schema || { sections: [] });
        setAdminFormData({});
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingTemplate(false));
  }, [formTemplateId]);

  const adminSchema = templateSchema ? filterSchemaForAdmin(templateSchema) : null;
  const isDefaultForm = editingTenderId ? true : formTemplateId === "__default__";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newDocs = Array.from(e.target.files).map(f => {
      return new Promise<{ name: string, fileType: string, url: string }>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            name: f.name,
            fileType: f.type || 'application/octet-stream',
            url: reader.result as string
          });
        };
        reader.readAsDataURL(f);
      });
    });

    Promise.all(newDocs).then(docs => {
      setDocuments(prev => [...prev, ...docs]);
    });
  };

  const toLocalDatetimeString = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const handleEditTender = (tender: any) => {
    setEditingTenderId(tender.id);
    setTitle(tender.title || "");
    setDescription(tender.description || "");
    setCategory(tender.category_name || projectCategories[0]?.value || "");
    setEstimatedBudget(tender.estimated_budget?.toString() || "");
    setSubmissionStart(toLocalDatetimeString(tender.submission_start));
    setSubmissionDeadline(toLocalDatetimeString(tender.submission_deadline));
    setVisibility(tender.visibility || "Public");
    setLocation(tender.location || "");
    setAddress(tender.address || "");
    setStartDate(toLocalDatetimeString(tender.start_date));
    setEndDate(toLocalDatetimeString(tender.end_date));
    setClientInfoEnabled(tender.client_info_enabled || false);
    setClientName(tender.client_name || "");
    setClientInfoDetails(tender.client_info?.details || "");
    setDocuments([]); // we won't load existing docs into this simple array for now
    setFormTemplateId("__default__"); // manage attached forms for existing tenders via the "Forms" button
    setTemplateSchema(null);
    setAdminFormData({});
    setCreateOpen(true);
  };

  const handleCreateOpen = () => {
    setEditingTenderId(null);
    setTitle("");
    setDescription("");
    setCategory(projectCategories.length > 0 ? projectCategories[0].value : "");
    setEstimatedBudget("");
    setSubmissionStart("");
    setSubmissionDeadline("");
    setVisibility("Public");
    setLocation("");
    setAddress("");
    setStartDate("");
    setEndDate("");
    setNumDiscussions(0);
    setClientInfoEnabled(false);
    setClientName("");
    setClientInfoDetails("");
    setDocuments([]);
    setFormTemplateId("__default__");
    setTemplateSchema(null);
    setAdminFormData({});
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: "Error", description: "Tender Title is required", variant: "destructive" });
      return;
    }

    try {
      const isEdit = !!editingTenderId;
      const url = isEdit ? `/api/et/admin/tenders/${editingTenderId}` : "/api/et/admin/tenders";
      const method = isEdit ? "PUT" : "POST";

      const response = await apiFetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : null,
          submissionStart: submissionStart ? new Date(submissionStart).toISOString() : null,
          submissionDeadline: submissionDeadline ? new Date(submissionDeadline).toISOString() : null,
          visibility,
          location: location.trim(),
          address: address.trim(),
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: endDate ? new Date(endDate).toISOString() : null,
          numDiscussions: numDiscussions,
          clientInfoEnabled: clientInfoEnabled,
          clientName: clientName.trim(),
          clientInfo: { details: clientInfoDetails.trim() },
          documents: documents
        })
      });

      if (response.ok) {
        const savedTender = await response.json().catch(() => null);

        // If a saved Form template was chosen (anything other than "Default"), attach it
        // to the newly created tender so it's ready to fill immediately.
        if (!isEdit && formTemplateId !== "__default__" && savedTender?.id) {
          try {
            await apiFetch(`/api/fb/tenders/${savedTender.id}/forms`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ templateId: formTemplateId, visibleToVendor: true, adminData: adminFormData }),
            });
          } catch (err) {
            console.error("Failed to attach form template", err);
            toast({ title: "Tender created, but the form couldn't be attached", description: "Attach it from the Forms button.", variant: "destructive" });
          }
        }

        toast({ title: "Success", description: `Tender ${isEdit ? 'updated' : 'created'} successfully.` });
        setCreateOpen(false);
        setEditingTenderId(null);
        // Reset form
        setTitle("");
        setDescription("");
        setCategory(projectCategories.length > 0 ? projectCategories[0].value : "");
        setEstimatedBudget("");
        setSubmissionStart("");
        setSubmissionDeadline("");
        setVisibility("Public");
        setLocation("");
        setAddress("");
        setStartDate("");
        setEndDate("");
        setNumDiscussions(0);
        setClientInfoEnabled(false);
        setClientName("");
        setClientInfoDetails("");
        setDocuments([]);
        setFormTemplateId("__default__");
        setTemplateSchema(null);
        setAdminFormData({});
        setRefreshKey(prev => prev + 1); // trigger list refresh
      } else {
        toast({ title: "Error", description: "Failed to create tender.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="tenders-glass max-w-7xl mx-auto p-6 space-y-6">
        <div className="tg-header flex items-center justify-between tg-animate-in">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Gavel className="h-6 w-6 tg-gavel" /> Enterprise Procurement</h1>
            <p className="text-muted-foreground text-sm">Manage enterprise tenders, vendors, submissions, and master data.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="tg-animate-in tg-delay-1">
          <TabsList className="mb-4 bg-background/50 backdrop-blur-md border border-slate-200/20 shadow-sm">
            <TabsTrigger value="tenders" className="flex gap-2"><Gavel className="h-4 w-4" /> Tenders</TabsTrigger>
            <TabsTrigger value="master" className="flex gap-2"><Database className="h-4 w-4" /> Master Data</TabsTrigger>
            <TabsTrigger value="invitations" className="flex gap-2"><Users className="h-4 w-4" /> Invitations & Vendors</TabsTrigger>
          </TabsList>

          <TabsContent value="tenders" className="mt-0">
            <TendersListPanel onCreate={handleCreateOpen} onEdit={handleEditTender} refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="master" className="mt-0">
            <MasterDataPanel />
          </TabsContent>
          <TabsContent value="invitations" className="mt-0">
            <InvitationsPanel />
          </TabsContent>
        </Tabs>

      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="tg-dialog max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTenderId ? 'Edit Enterprise Tender' : 'Create New Enterprise Tender'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1">
              <Label>Tender Title / Project Name *</Label>
              <Input placeholder="e.g. Phase 2 Civil Works" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            {!editingTenderId && (
              <div className="col-span-2 border rounded-md p-4 space-y-2 mt-2">
                <h4 className="font-semibold text-sm">Vendor Form</h4>
                <p className="text-xs text-muted-foreground">Choose what vendors fill in when they submit this tender — the standard default fields, or one of your saved Form templates.</p>
                <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Choose a form..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default (standard quotation fields only)</SelectItem>
                    {formTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formTemplates.length === 0 && (
                  <p className="text-xs text-muted-foreground">No saved form templates yet — create one from Form Builder first.</p>
                )}

                {loadingTemplate && <p className="text-xs text-muted-foreground">Loading form...</p>}

                {!loadingTemplate && adminSchema && adminSchema.sections.length > 0 && (
                  <div className="border-t pt-4 mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground mb-2">
                      Fill in your fields below. Any field marked "Visible to Vendor" in this form isn't shown here — the vendor fills that part when they submit.
                    </p>
                    <FormRenderer schema={adminSchema} data={adminFormData} onChange={setAdminFormData} />
                  </div>
                )}

                {!loadingTemplate && templateSchema && adminSchema && adminSchema.sections.length === 0 && (
                  <p className="text-xs text-muted-foreground">Every field in this form is marked "Visible to Vendor" — nothing here for you to fill; the vendor will fill it all.</p>
                )}
              </div>
            )}

            {/* Everything below is the standard tender setup. It's hidden once a custom
                Form is chosen above, since that form replaces these fields entirely -
                only the Title (required) and the form's own fields are needed. */}
            {isDefaultForm && (
              <>
                <div className="col-span-2 space-y-1">
                  <Label>Detailed Description</Label>
                  <Textarea placeholder="Scope of work..." value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" value={category} onChange={e => setCategory(e.target.value)}>
                    {projectCategories.length === 0 ? (
                      <option value="">No categories defined</option>
                    ) : (
                      projectCategories.map((c) => (
                        <option key={c.id} value={c.value}>{c.value}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Estimated Budget</Label>
                  <Input type="number" placeholder="0.00" value={estimatedBudget} onChange={e => setEstimatedBudget(e.target.value)} />
                </div>

                <div className="col-span-2 border rounded-md p-4 space-y-4 mt-2">
                  <h4 className="font-semibold text-sm">Quotation Submission Window</h4>
                  <p className="text-xs text-muted-foreground">Vendors can only submit quotes during this time window. Outside this window, they can only save drafts.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Submission Start Date & Time</Label>
                      <Input type="datetime-local" value={submissionStart} onChange={e => setSubmissionStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Submission End Date & Time (Deadline) *</Label>
                      <Input type="datetime-local" value={submissionDeadline} onChange={e => setSubmissionDeadline(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Visibility</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" value={visibility} onChange={e => setVisibility(e.target.value)}>
                    <option value="Public">Public</option>
                    <option value="Private">Private (Invited Only)</option>
                  </select>
                </div>

                {/* Location Details */}
                <div className="col-span-2 border rounded-md p-4 space-y-4 mt-2">
                  <h4 className="font-semibold text-sm">Location Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Project Location</Label>
                      <Input placeholder="City / Area" value={location} onChange={e => setLocation(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Address</Label>
                      <Input placeholder="Detailed Address" value={address} onChange={e => setAddress(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Tender Start Date & Time</Label>
                  <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Tender End Date & Time</Label>
                  <Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>

                {/* Attachments Section */}
                <div className="col-span-2 border rounded-md p-4 space-y-4 mt-2">
                  <h4 className="font-semibold text-sm">Tender Attachments</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Upload Documents</Label>
                      <Input type="file" multiple onChange={handleFileUpload} />
                    </div>
                    <div className="space-y-2">
                      <Label>Upload Photos</Label>
                      <Input type="file" accept="image/*" multiple onChange={handleFileUpload} />
                    </div>
                  </div>

                  {documents.length > 0 && (
                    <div className="mt-4">
                      <Label className="mb-2 block">Attached Files</Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {documents.map((doc, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded border text-sm">
                            <span className="truncate">{doc.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Client Info Toggle */}
                <div className="col-span-2 border rounded-md p-4 space-y-4 mt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Client Info</h4>
                    <Switch checked={clientInfoEnabled} onCheckedChange={setClientInfoEnabled} />
                  </div>
                  {clientInfoEnabled && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="col-span-2 space-y-1">
                        <Label>Client Name</Label>
                        <Input placeholder="Enter client name" value={clientName} onChange={e => setClientName(e.target.value)} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label>Client Details</Label>
                        <Textarea placeholder="Additional client information..." value={clientInfoDetails} onChange={e => setClientInfoDetails(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Save Tender</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
import { useState, useEffect } from "react";
import { SupplierLayout } from "@/components/layout/SupplierLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Gavel, Save, Send, Clock, FileSpreadsheet, RefreshCw, FileText, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { TenderFormsPanel } from "@/components/supplier/TenderFormsPanel";
import "../tenders-glass.css";

function getTimeRemaining(endDate: string | null): string {
  if (!endDate) return "No deadline";
  const now = new Date().getTime();
  const end = new Date(endDate).getTime();
  const diff = end - now;
  if (diff <= 0) return "Closed";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m left`;
}

function TenderDetailView({ tender, onBack }: { tender: any; onBack: () => void }) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);

  // Quotation State
  const [deliveryTimeline, setDeliveryTimeline] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 Days Net");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const promises = newFiles.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          resolve({
            name: file.name,
            fileType: file.type || 'application/octet-stream',
            url: ev.target?.result as string
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const readFiles = await Promise.all(promises);
    setAttachments(prev => [...prev, ...readFiles]);
  };

  useEffect(() => {
    // Load shared documents
    apiFetch(`/api/et/vendor/tenders/${tender.id}/documents`)
      .then(res => res.json())
      .then(d => setDocuments(d.documents || []))
      .catch(() => { });

    // Load existing submission if any
    apiFetch(`/api/et/vendor/tenders/${tender.id}/my-submission`)
      .then(res => res.json())
      .then(d => {
        if (d.submission) {
          const sub = d.submission;
          setSubmissionStatus(sub.status);
          if (sub.attachments) {
            setAttachments(sub.attachments.map((a: any) => ({
              name: a.name,
              fileType: a.file_type,
              url: a.url
            })));
          }
          try {
            const remarks = JSON.parse(sub.remarks || "{}");
            if (remarks.deliveryTimeline) setDeliveryTimeline(remarks.deliveryTimeline);
            if (remarks.paymentTerms) setPaymentTerms(remarks.paymentTerms);
          } catch (e) { }
        }
      })
      .catch(() => { });
  }, [tender.id]);

  const handleSubmit = async (statusToSave: 'Draft' | 'Submitted') => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/et/vendor/tenders/${tender.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryTimeline,
          paymentTerms,
          status: statusToSave,
          attachments
        })
      });

      if (res.ok) {
        toast({ title: "Success", description: `Quotation ${statusToSave === 'Draft' ? 'saved as draft' : 'submitted'}!` });
        setSubmissionStatus(statusToSave);
        if (statusToSave === 'Submitted') {
          setTimeout(onBack, 1500); // go back after submitting
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        toast({ title: "Error", description: errData.error || errData.message || "Failed to save quotation", variant: "destructive" });
        console.error("Backend error:", errData);
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitted = submissionStatus === 'Submitted';

  const now = Date.now();
  const submissionStart = tender.submission_start ? new Date(tender.submission_start).getTime() : 0;
  const submissionEnd = tender.submission_deadline ? new Date(tender.submission_deadline).getTime() : Infinity;
  const isBeforeStart = now < submissionStart;
  const isAfterEnd = now > submissionEnd;
  const isSubmissionOpen = !isBeforeStart && !isAfterEnd;

  const getDurationText = (start: number, end: number) => {
    const diffMs = end - start;
    if (diffMs <= 0 || diffMs === Infinity) return "";
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} minutes`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'}`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
  };

  const durationText = tender.submission_start && tender.submission_deadline ? getDurationText(submissionStart, submissionEnd) : "";

  return (
    <Card className="tg-card tg-animate-in">
      <CardHeader className="flex flex-row items-start justify-between border-b pb-4">
        <div>
          <CardTitle className="text-xl">{tender.tender_number}: {tender.title}</CardTitle>
          <CardDescription className="flex items-center gap-2 mt-1">
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">{tender.status}</span>
            <span className="flex items-center text-xs text-muted-foreground">
              <Clock className="w-3 h-3 mr-1" />{getTimeRemaining(tender.submission_deadline)}
            </span>
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to List
        </Button>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Tender Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {tender.category_name && (
            <div>
              <span className="text-muted-foreground">Category:</span>
              <span className="ml-2 font-medium">{tender.category_name}</span>
            </div>
          )}
          {tender.client_name && (
            <div>
              <span className="text-muted-foreground">Client:</span>
              <span className="ml-2 font-medium">{tender.client_name}</span>
            </div>
          )}
          {tender.location && (
            <div>
              <span className="text-muted-foreground">Location:</span>
              <span className="ml-2 font-medium">{tender.location}</span>
            </div>
          )}
          {tender.estimated_budget && (
            <div>
              <span className="text-muted-foreground">Estimated Budget:</span>
              <span className="ml-2 font-medium">₹{Number(tender.estimated_budget).toLocaleString()}</span>
            </div>
          )}
          {tender.submission_deadline && (
            <div>
              <span className="text-muted-foreground">Submission Deadline:</span>
              <span className="ml-2 font-medium">{new Date(tender.submission_deadline).toLocaleString()}</span>
            </div>
          )}
        </div>

        {tender.description && (
          <div>
            <h4 className="font-semibold text-sm mb-1">Description</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tender.description}</p>
          </div>
        )}

        {/* Shared Documents */}
        {documents.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Shared Documents</h4>
            <div className="space-y-2">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-2 text-sm p-2 border rounded-md bg-slate-50">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>{doc.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{doc.file_type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Forms & Summary Sheets attached by Admin */}
        <TenderFormsPanel tenderId={tender.id} />

        {/* Quotation Section */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-sm">Submit Quotation</h4>
            {submissionStatus && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${isSubmitted ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                {submissionStatus}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Delivery Timeline</Label>
              <Input
                placeholder="e.g. 15 Days"
                value={deliveryTimeline}
                onChange={e => setDeliveryTimeline(e.target.value)}
                disabled={isSubmitted || isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                disabled={isSubmitted || isSubmitting}
              >
                <option value="30 Days Net">30 Days Net</option>
                <option value="Advance 20%">Advance 20%</option>
                <option value="Upon Delivery">Upon Delivery</option>
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Attachments</Label>
              {attachments.length > 0 && (
                <div className="space-y-2 mb-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 border rounded-md bg-slate-50">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="truncate max-w-[200px]">{att.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{att.fileType || att.file_type}</span>
                      {!isSubmitted && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-red-500" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isSubmitted && (
                <Input type="file" multiple className="cursor-pointer" onChange={handleFileChange} disabled={isSubmitting} />
              )}
            </div>
          </div>

          {!isSubmitted && (
            <>
              <div className="flex justify-end gap-2 pt-6">
                <Button
                  variant="outline"
                  onClick={() => handleSubmit('Draft')}
                  disabled={isSubmitting}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  onClick={() => handleSubmit('Submitted')}
                  disabled={isSubmitting || !isSubmissionOpen}
                  title={isBeforeStart ? `Submission opens at ${new Date(tender.submission_start).toLocaleString()}` : (isAfterEnd ? "Submission window has closed" : "")}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Submitting...' : 'Submit Final Quote'}
                </Button>
              </div>
              {isBeforeStart && (
                <p className="text-xs text-orange-600 mt-2 text-right">
                  Note: You can save drafts now. Submitting final quotes will unlock between <br className="hidden sm:block" />
                  <strong>{new Date(tender.submission_start).toLocaleString()}</strong> and <strong>{new Date(tender.submission_deadline).toLocaleString()}</strong>
                  {durationText && ` (a window of ${durationText})`}.
                </p>
              )}
              {isAfterEnd && (
                <p className="text-xs text-red-600 mt-2 text-right">
                  Note: The submission deadline has passed.
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VendorTenders() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("open");
  const [activeTender, setActiveTender] = useState<any | null>(null);
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTenders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/et/vendor/tenders");
      if (res.ok) {
        const data = await res.json();
        setTenders(data.tenders || []);
      } else {
        toast({ title: "Error", description: "Failed to load tenders", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error loading tenders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenders();
  }, []);

  return (
    <SupplierLayout>
      <div className="tenders-glass max-w-7xl mx-auto p-6 space-y-6">
        <div className="tg-header flex items-center justify-between tg-animate-in">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Gavel className="h-6 w-6 tg-gavel" /> Vendor Tender Portal</h1>
            <p className="text-muted-foreground text-sm">View invitations, submit quotes, and participate in negotiations.</p>
          </div>
        </div>

        {activeTender ? (
          <TenderDetailView tender={activeTender} onBack={() => setActiveTender(null)} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="tg-animate-in tg-delay-1">
            <TabsList className="mb-4 bg-background/50 backdrop-blur-md border border-slate-200/20">
              <TabsTrigger value="open">Open Tenders ({tenders.length})</TabsTrigger>
              <TabsTrigger value="submitted">Submitted</TabsTrigger>
              <TabsTrigger value="awarded">Awarded</TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="mt-0">
              <Card className="tg-card">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading tenders...</div>
                  ) : tenders.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No open tenders available at the moment.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tender No</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenders.map((tender: any) => {
                          const timeLeft = getTimeRemaining(tender.submission_deadline);
                          const isUrgent = tender.submission_deadline && (new Date(tender.submission_deadline).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;
                          return (
                            <TableRow key={tender.id}>
                              <TableCell className="font-mono text-xs">{tender.tender_number}</TableCell>
                              <TableCell className="font-medium">{tender.title}</TableCell>
                              <TableCell className="text-sm">{tender.category_name || '—'}</TableCell>
                              <TableCell className={`text-sm font-medium ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
                                {timeLeft}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" onClick={() => setActiveTender(tender)}>View & Quote</Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="submitted" className="mt-0">
              <Card className="tg-card">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No submitted quotations yet.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="awarded" className="mt-0">
              <Card className="tg-card">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No awarded tenders yet.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </SupplierLayout>
  );
}
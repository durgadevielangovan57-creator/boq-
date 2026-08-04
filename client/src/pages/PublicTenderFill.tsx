import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Send, Loader2, Gavel, Paperclip } from "lucide-react";
import apiFetch from "@/lib/api";
import { FormRenderer } from "@/components/formbuilder/FormRenderer";

// Fully public route (no login, no sidebar) - generic link (not tied to a vendor).
// Whoever opens it types in their company details, fills every attached Form, and submits.
export default function PublicTenderFill() {
    const { token } = useParams<{ token: string }>();
    const [tender, setTender] = useState<any>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [forms, setForms] = useState<any[]>([]);
    const [formData, setFormData] = useState<Record<string, any>>({});

    const [companyName, setCompanyName] = useState("");
    const [contactName, setContactName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const load = () => {
        setLoading(true);
        apiFetch(`/api/fb/public/tenders/${token}`)
            .then((r) => {
                if (!r.ok) throw new Error("invalid");
                return r.json();
            })
            .then((d) => {
                setTender(d.tender);
                setDocuments(d.documents || []);
                setForms(d.forms || []);
                const initial: Record<string, any> = {};
                (d.forms || []).forEach((f: any) => {
                    initial[f.id] = {};
                });
                setFormData(initial);
            })
            .catch(() => setError("This link is invalid or has expired."))
            .finally(() => setLoading(false));
    };

    useEffect(load, [token]);

    const submit = async () => {
        if (!companyName.trim()) {
            setError("Please enter your company / firm name before submitting.");
            return;
        }
        setError("");
        setSaving(true);
        try {
            const res = await apiFetch(`/api/fb/public/tenders/${token}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    companyName: companyName.trim(),
                    contactName: contactName.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    forms: formData,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.message || "Failed to submit");
            }
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || "Failed to submit. Please check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error && !tender) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <p className="text-sm text-muted-foreground">{error}</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <Card className="max-w-md w-full text-center">
                    <CardContent className="pt-10 pb-10 space-y-3">
                        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                        <h2 className="text-lg font-semibold">Tender Submitted</h2>
                        <p className="text-sm text-muted-foreground">Thank you, {companyName}. Your submission has been recorded.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-6">
            <div className="max-w-2xl mx-auto space-y-4">
                <Card>
                    <CardHeader className="text-center border-b pb-4">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                            <Gavel className="h-5 w-5" />
                            <span className="text-xs uppercase tracking-wide">Tender {tender?.tender_number}</span>
                        </div>
                        <CardTitle className="text-xl">{tender?.title}</CardTitle>
                        {tender?.description && <CardDescription>{tender.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 text-sm">
                        {tender?.location && (
                            <p><span className="text-muted-foreground">Location:</span> {tender.location}</p>
                        )}
                        {tender?.submission_deadline && (
                            <p><span className="text-muted-foreground">Submission Deadline:</span> {new Date(tender.submission_deadline).toLocaleString()}</p>
                        )}
                        {documents.length > 0 && (
                            <div className="pt-2">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Tender Documents</p>
                                <div className="space-y-1">
                                    {documents.map((d) => (
                                        <div key={d.id} className="flex items-center gap-2 text-xs">
                                            <Paperclip className="h-3.5 w-3.5" /> {d.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Your Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label>Company / Firm Name *</Label>
                            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Enter your company name" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Contact Person</Label>
                            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Optional" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Phone</Label>
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label>Email</Label>
                            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
                        </div>
                    </CardContent>
                </Card>

                {forms.map((f) => (
                    <Card key={f.id}>
                        <CardHeader>
                            <CardTitle className="text-base">{f.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FormRenderer
                                schema={f.schema}
                                data={formData[f.id] || {}}
                                onChange={(data) => setFormData((prev) => ({ ...prev, [f.id]: data }))}
                            />
                        </CardContent>
                    </Card>
                ))}

                {forms.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center">No form has been attached to this tender yet.</p>
                )}

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <Button className="w-full" size="lg" onClick={submit} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Submit Tender
                </Button>
            </div>
        </div>
    );
}
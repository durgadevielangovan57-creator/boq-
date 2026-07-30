import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, LayoutTemplate, Save, Send, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiFetch from "@/lib/api";
import { FormRenderer } from "@/components/formbuilder/FormRenderer";

export function TenderFormsPanel({ tenderId }: { tenderId: string }) {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [forms, setForms] = useState<any[]>([]);
    const [values, setValues] = useState<Record<string, any>>({});
    const [saving, setSaving] = useState<string | null>(null);

    const load = () => {
        apiFetch(`/api/fb/vendor/tenders/${tenderId}/forms`)
            .then((r) => r.json())
            .then((d) => {
                setForms(d.forms || []);
                const v: Record<string, any> = {};
                (d.forms || []).forEach((f: any) => { v[f.id] = f.my_data || {}; });
                setValues(v);
            })
            .catch(() => { });
    };

    useEffect(() => { load(); }, [tenderId]);

    const save = async (linkId: string, submit: boolean) => {
        setSaving(linkId);
        try {
            const res = await apiFetch(`/api/fb/tender-links/${linkId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: values[linkId] || {}, submit }),
            });
            if (!res.ok) throw new Error();
            toast({ title: submit ? "Submitted" : "Saved", description: submit ? "Your response has been submitted." : "Draft saved." });
            load();
        } catch {
            toast({ title: "Error", description: "Failed to save your response", variant: "destructive" });
        } finally {
            setSaving(null);
        }
    };

    if (forms.length === 0) return null;

    return (
        <div className="space-y-4">
            {forms.map((f) => {
                const isSubmitted = f.my_status === "Submitted";
                const isSummarySheet = f.category !== "FORM";
                return (
                    <Card key={f.id} className="tg-card">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                {isSummarySheet ? <FileSpreadsheet className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
                                {f.name}
                                {isSubmitted && <Badge>Submitted</Badge>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isSummarySheet ? (
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">A summary report for this tender.</p>
                                    <Button variant="outline" size="sm" onClick={() => setLocation(`/supplier/summary-print/${f.id}`)}>
                                        <FileDown className="h-4 w-4 mr-1" /> View / Download PDF
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <FormRenderer
                                        schema={f.schema}
                                        data={values[f.id] || {}}
                                        onChange={(d) => setValues((prev) => ({ ...prev, [f.id]: d }))}
                                        readOnly={isSubmitted}
                                    />
                                    {!isSubmitted && (
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" disabled={saving === f.id} onClick={() => save(f.id, false)}>
                                                <Save className="h-4 w-4 mr-1" /> Save Draft
                                            </Button>
                                            <Button size="sm" disabled={saving === f.id} onClick={() => save(f.id, true)}>
                                                <Send className="h-4 w-4 mr-1" /> Submit
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
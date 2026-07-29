import { useState } from "react";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Building2 } from "lucide-react";
import "./tenders-glass.css";

export default function ClientRegistration() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [organizationName, setOrganizationName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submitRegistration = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/et/register-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName, contactPerson, email, password, token
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to register");
      }
      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 tenders-glass">
        <Card className="w-full max-w-md text-center tg-animate-in tg-card">
          <CardContent className="pt-12 pb-12 flex flex-col items-center">
            <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Registration Complete</h2>
            <p className="text-muted-foreground mb-6">
              Your client profile has been registered securely. You can now access your customized dashboard to track procurement progress.
            </p>
            <Button onClick={() => window.location.href = "/login"}>Go to Client Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center tenders-glass">
      <Card className="w-full max-w-lg tg-animate-in tg-card">
        <CardHeader className="text-center pb-2 relative">
          <div className="absolute right-4 top-4 hidden md:block">
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/login"}>
              Login
            </Button>
          </div>
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Client Portal Access</CardTitle>
          <CardDescription>Register to track your assigned tenders and evaluations.</CardDescription>
          <div className="md:hidden mt-2">
            <Button variant="link" onClick={() => window.location.href = "/login"} className="text-sm h-auto p-0">
              Already registered? Login here
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <Input placeholder="Enter your organization name" value={organizationName} onChange={e => setOrganizationName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contact Person</Label>
            <Input placeholder="Full Name" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input type="email" placeholder="email@organization.com" value={email} onChange={e => setEmail(e.target.value)} />

          </div>
          <div className="space-y-2">
            <Label>Set Password</Label>
            <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          
          <Button className="w-full mt-4" onClick={submitRegistration} disabled={loading}>
            {loading ? "Processing..." : "Complete Registration"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

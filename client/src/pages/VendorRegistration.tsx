import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building, MapPin, Briefcase, FileCheck, CheckCircle2 } from "lucide-react";
import apiFetch from "@/lib/api";
import "./tenders-glass.css";

export default function VendorRegistration() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [registerName, setRegisterName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [companyTypesData, setCompanyTypesData] = useState<any[]>([]);
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [cin, setCin] = useState("");

  // Step 2 – Location & Address
  const [regAddress, setRegAddress] = useState("");
  const [country, setCountry] = useState("India");
  const [stateProvince, setStateProvince] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Step 3 – Business Capabilities
  const [workCategories, setWorkCategories] = useState<string[]>([]);
  const [annualTurnover, setAnnualTurnover] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");

  // Step 4 – Compliance & Docs (store File objects in state)
  const [files, setFiles] = useState<Record<string, File | File[] | null>>({
    panCard: null,
    taxCert: null,
    coi: null,
    msme: null,
    lut: null,
    iso: null,
    cancelledCheque: null,
  });

  const handleFileChange = (key: string, fileList: FileList | null, multiple = false) => {
    if (!fileList || fileList.length === 0) return;
    setFiles(prev => ({
      ...prev,
      [key]: multiple ? Array.from(fileList) : fileList[0],
    }));
  };

  const getFileName = (key: string): string => {
    const f = files[key];
    if (!f) return "";
    if (Array.isArray(f)) return f.map(x => x.name).join(", ");
    return (f as File).name;
  };

  useEffect(() => {
    apiFetch("/api/et/master-data?category=COMPANY_TYPE")
      .then(res => res.json())
      .then(d => {
        if (d.data) {
          setCompanyTypesData(d.data);
        }
      })
      .catch(err => console.error(err));
  }, []);

  // In a real implementation, this would be driven by the JSON schema from et_dynamic_forms
  const steps = [
    { id: 1, title: "Company Details", icon: <Building className="h-4 w-4" /> },
    { id: 2, title: "Location & Address", icon: <MapPin className="h-4 w-4" /> },
    { id: 3, title: "Business Capabilities", icon: <Briefcase className="h-4 w-4" /> },
    { id: 4, title: "Compliance & Docs", icon: <FileCheck className="h-4 w-4" /> },
  ];

  const submitRegistration = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/et/register-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerName, phone, email, password,
          companyName, tradeName, companyType, gstNumber, panNumber, cin
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to register");
      }
      setStep((s) => s + 1); // move to success screen
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  const handleNext = () => {
    if (step === steps.length) {
      submitRegistration();
    } else {
      setStep((s) => Math.min(s + 1, steps.length + 1));
    }
  };
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  if (step > steps.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 tenders-glass">
        <Card className="w-full max-w-md text-center tg-animate-in tg-card">
          <CardContent className="pt-12 pb-12 flex flex-col items-center">
            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Registration Complete</h2>
            <p className="text-muted-foreground mb-6">
              Your profile has been submitted successfully. You will receive an email once it is approved by the procurement team.
            </p>
            <Button onClick={() => window.location.href = "/login"}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 tenders-glass">
      <div className="max-w-4xl mx-auto space-y-8 tg-animate-in">
        
        <div className="text-center space-y-2 relative">
          <div className="absolute right-0 top-0 hidden md:block">
            <Button variant="outline" onClick={() => window.location.href = "/login"}>
              Already registered? Login
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Vendor Registration</h1>
          <p className="text-muted-foreground">Complete your profile to access tender opportunities.</p>
          <div className="md:hidden mt-2">
            <Button variant="link" onClick={() => window.location.href = "/login"} className="text-sm">
              Already registered? Login here
            </Button>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="flex justify-between items-center relative before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-0.5 before:bg-slate-200 before:z-0">
          {steps.map((s) => (
            <div key={s.id} className="relative z-10 flex flex-col items-center gap-2 bg-slate-50 px-2">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors border-2 ${
                step >= s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-white text-muted-foreground border-slate-200'
              }`}>
                {s.icon}
              </div>
              <span className={`text-xs font-medium ${step >= s.id ? 'text-primary' : 'text-muted-foreground'}`}>{s.title}</span>
            </div>
          ))}
        </div>

        {/* Form Container */}
        <Card className="tg-card">
          <CardHeader>
            <CardTitle>{steps[step - 1].title}</CardTitle>
            <CardDescription>Please provide accurate information for verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {step === 1 && (
              <div className="grid grid-cols-2 gap-4 tg-animate-in">
                <div className="col-span-2 space-y-2 border-b pb-4 mb-2">
                  <h3 className="font-semibold text-lg">Account Administrator</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Registering Person Name *</Label>
                      <Input placeholder="Full Name" value={registerName} onChange={e => setRegisterName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <Input placeholder="+91 9876543210" value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email ID (Login Username) *</Label>
                      <Input type="email" placeholder="email@company.com" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Legal Company Name *</Label>
                  <Input placeholder="Acme Corp Ltd." value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Trade Name / DBA</Label>
                  <Input placeholder="Acme Supplies" value={tradeName} onChange={e => setTradeName(e.target.value)} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Company Type *</Label>
                  <select value={companyType} onChange={e => setCompanyType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="">Select Company Type...</option>
                    {companyTypesData.map(c => (
                      <option key={c.id} value={c.value}>{c.value}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tax/GST Number *</Label>
                  <Input placeholder="22AAAAA0000A1Z5" value={gstNumber} onChange={e => setGstNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>PAN Number *</Label>
                  <Input placeholder="ABCDE1234F" value={panNumber} onChange={e => setPanNumber(e.target.value)} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Registration Number (CIN)</Label>
                  <Input placeholder="U12345DL2024PTC123456" value={cin} onChange={e => setCin(e.target.value)} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-2 gap-4 tg-animate-in">
                <div className="space-y-2 col-span-2">
                  <Label>Registered Address *</Label>
                  <Input placeholder="123 Business Avenue, Suite 400" value={regAddress} onChange={e => setRegAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Country *</Label>
                  <select value={country} onChange={e => setCountry(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <option>India</option>
                    <option>United States</option>
                    <option>UAE</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>State/Province *</Label>
                  <Input placeholder="e.g. Maharashtra" value={stateProvince} onChange={e => setStateProvince(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input placeholder="e.g. Mumbai" value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Postal / Zip Code *</Label>
                  <Input placeholder="400001" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-2 gap-4 tg-animate-in">
                <div className="space-y-2 col-span-2">
                  <Label>Primary Work Categories *</Label>
                  <select multiple value={workCategories} onChange={e => setWorkCategories(Array.from(e.target.selectedOptions, o => o.value))} className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <option>Civil Works</option>
                    <option>MEP (Mechanical, Electrical, Plumbing)</option>
                    <option>Interior Fit-outs</option>
                    <option>IT & Networking</option>
                    <option>HVAC</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Hold Ctrl/Cmd to select multiple from Master Data list.</p>
                </div>
                <div className="space-y-2">
                  <Label>Annual Turnover (Last FY) *</Label>
                  <Input type="number" placeholder="In USD" value={annualTurnover} onChange={e => setAnnualTurnover(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Years in Business *</Label>
                  <Input type="number" placeholder="e.g. 10" value={yearsInBusiness} onChange={e => setYearsInBusiness(e.target.value)} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 tg-animate-in">
                {[
                  { key: "panCard", label: "PAN Card Upload *", multiple: false },
                  { key: "taxCert", label: "Tax Certificate (GST/VAT) *", multiple: false },
                  { key: "coi", label: "Company Registration Certificate (COI) *", multiple: false },
                  { key: "msme", label: "MSME Certificate", multiple: false },
                  { key: "lut", label: "LUT (Letter of Undertaking) Upload", multiple: false },
                  { key: "iso", label: "ISO Certifications (Optional)", multiple: true },
                ].map(({ key, label, multiple }) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      type="file"
                      className="cursor-pointer"
                      multiple={multiple}
                      onChange={e => handleFileChange(key, e.target.files, multiple)}
                    />
                    {getFileName(key) && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {getFileName(key)}
                      </p>
                    )}
                  </div>
                ))}
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label>Cancelled Cheque (For Payment Processing) *</Label>
                  <Input
                    type="file"
                    className="cursor-pointer"
                    onChange={e => handleFileChange("cancelledCheque", e.target.files)}
                  />
                  {getFileName("cancelledCheque") && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {getFileName("cancelledCheque")}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6 border-t mt-8">
              <Button variant="outline" onClick={handlePrev} disabled={step === 1}>Back</Button>
              <div className="space-x-2">
                <Button variant="ghost" disabled={loading}>Save Draft</Button>
                <Button onClick={handleNext} disabled={loading}>
                  {loading ? "Processing..." : (step === steps.length ? "Submit Registration" : "Continue")}
                </Button>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

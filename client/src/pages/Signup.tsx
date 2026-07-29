import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Users, Settings, ShoppingCart, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

/* =========================
   ROLE DEFINITIONS
========================= */
const ROLES = [
  { id: "user", label: "Client/Interior Designer", icon: User },
  { id: "admin", label: "Admin", icon: Settings },
  { id: "supplier", label: "Vendor/Manufacturer", icon: ShoppingCart },
  { id: "software_team", label: "Software Team", icon: Building2 },
  { id: "purchase_team", label: "Purchase Team", icon: Users },
  { id: "pre_sales", label: "Pre-Sales", icon: Users },
  { id: "contractor", label: "Contractor", icon: Users },
  { id: "site_engineer", label: "Site Engineer", icon: Users },
  { id: "finance_team", label: "Finance Team", icon: Users },
];

export default function Signup() {
  const { signup } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [selectedRole, setSelectedRole] = useState("user");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    mobileNumber: "",
    department: "",
    employeeCode: "",
    companyName: "",
    gstNumber: "",
    businessAddress: "",
  });

  const [confirmInfo, setConfirmInfo] = useState(false);
  // Track if vendor was warned about existing shop
  const [shopExistsWarning, setShopExistsWarning] = useState<string | null>(null);
  const [isCheckingShop, setIsCheckingShop] = useState(false);

  // When companyName changes (for vendor), check if shop already exists
  const checkShopExists = async (name: string) => {
    if (!name.trim() || selectedRole !== "supplier") {
      setShopExistsWarning(null);
      return;
    }
    setIsCheckingShop(true);
    try {
      const res = await fetch("/api/shops");
      if (res.ok) {
        const data = await res.json();
        const shops: any[] = data.shops || [];
        const match = shops.find(
          (s: any) => (s.name || "").trim().toLowerCase() === name.trim().toLowerCase()
        );
        if (match) {
          setShopExistsWarning(match.name);
        } else {
          setShopExistsWarning(null);
        }
      }
    } catch (e) {
      // Silently ignore network errors during check
    } finally {
      setIsCheckingShop(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!confirmInfo) {
      toast({
        title: "Error",
        description: "Please confirm that your information is correct",
        variant: "destructive",
      });
      return;
    }

    // Basic password validation
    if (formData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }


    // ℹ️ SHOP EXISTS CHECK (informational only — don't block signup)
    // If the shop already exists in DB (admin added it manually), the vendor still
    // needs to create their account. After login, they won't need to add a new shop.
    let shopAlreadyExists = false;
    if (selectedRole === "supplier" && formData.companyName.trim()) {
      try {
        const res = await fetch("/api/shops");
        if (res.ok) {
          const data = await res.json();
          const shops: any[] = data.shops || [];
          const match = shops.find(
            (s: any) =>
              (s.name || "").trim().toLowerCase() ===
              formData.companyName.trim().toLowerCase()
          );
          if (match) {
            shopAlreadyExists = true;
          }
        }
      } catch (e) {
        // Ignore — allow signup to proceed
      }
    }


    try {
      await signup(
        formData.email,
        formData.password,
        selectedRole as any,
        formData.fullName,
        formData.mobileNumber,
        formData.department,
        formData.employeeCode,
        formData.companyName,
        formData.gstNumber,
        formData.businessAddress
      );

      if (selectedRole === "supplier") {
        if (shopAlreadyExists) {
          // Shop is already in system — account created, but they don't need to add a new shop
          toast({
            title: "Account Created ✓",
            description: `Your login account is ready! Your shop "${formData.companyName}" is already registered in the system. Please login and contact admin to link your account to the existing shop — do NOT add a new shop.`,
          });
        } else {
          toast({
            title: "Account Created",
            description: "Your vendor account is ready. Please login.",
          });
        }
        setLocation("/");
        return;
      }

      toast({
        title: "Success",
        description: "Account created successfully. Please login.",
      });

      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Signup failed",
        variant: "destructive",
      });
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Create Account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Join the BOQ Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>
              Choose your role and fill in your details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-6">
              <div className="space-y-2">
                <Label>What is your role?</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-full h-12 rounded-xl bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-[280px] overflow-y-auto">
                    {ROLES.map((role) => {
                      const Icon = role.icon;
                      return (
                        <SelectItem key={role.id} value={role.id} className="py-3 focus:bg-blue-50 focus:text-blue-700 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Icon size={18} strokeWidth={2} className="text-slate-400 group-hover:text-blue-600" />
                            <span className="font-semibold text-slate-700">{role.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    placeholder="Full Name"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Mobile Number"
                    value={formData.mobileNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, mobileNumber: e.target.value })
                    }
                  />
                </div>

                <Input
                  type="email"
                  placeholder="Email Address (Username)"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />

                {/* ROLE SPECIFIC FIELDS */}
                {(selectedRole === "admin" ||
                  selectedRole === "software_team" ||
                  selectedRole === "purchase_team" ||
                  selectedRole === "finance_team") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      placeholder="Department"
                      value={formData.department}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Employee Code"
                      value={formData.employeeCode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          employeeCode: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                {/* VENDOR ONLY */}
                {selectedRole === "supplier" && (
                  <>
                    <div className="space-y-1">
                      <Input
                        placeholder="Company Name / Shop Name"
                        value={formData.companyName}
                        onChange={(e) => {
                          setFormData({ ...formData, companyName: e.target.value });
                          setShopExistsWarning(null);
                        }}
                        onBlur={(e) => checkShopExists(e.target.value)}
                        className={shopExistsWarning ? "border-amber-400 focus:border-amber-500" : ""}
                      />
                      {isCheckingShop && (
                        <p className="text-xs text-slate-500 animate-pulse">Checking if shop exists...</p>
                      )}
                      {shopExistsWarning && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 space-y-1">
                          <p className="text-xs font-semibold text-amber-800">⚠️ Shop Already in System</p>
                          <p className="text-xs text-amber-700">
                            A shop named <strong>"{shopExistsWarning}"</strong> is already registered by an admin.
                          </p>
                          <p className="text-xs text-amber-700">
                            ✅ <strong>You can still sign up</strong> to create your login account.
                            After logging in, <strong>do not add a new shop</strong> — contact the admin to link your account to the existing shop.
                          </p>
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="GST Number"
                      value={formData.gstNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, gstNumber: e.target.value })
                      }
                    />
                    <Textarea
                      placeholder="Business Address"
                      value={formData.businessAddress}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          businessAddress: e.target.value,
                        })
                      }
                    />
                  </>
                )}
              </div>

              <div className="flex items-start space-x-2 border-t pt-4">
                <Checkbox
                  id="confirm"
                  checked={confirmInfo}
                  onCheckedChange={(checked) => setConfirmInfo(!!checked)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="confirm"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Confirm Information
                  </label>
                  <p className="text-xs text-muted-foreground">
                    I confirm that the information provided is correct and
                    complete.
                  </p>
                </div>
              </div>

              <Button type="submit" className="w-full">
                Create Account
              </Button>

              <div className="text-center text-sm">
                <span className="text-slate-600">Already have an account? </span>
                <Button
                  variant="link"
                  className="p-0 h-auto font-semibold"
                  onClick={() => setLocation("/")}
                >
                  Login Here
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


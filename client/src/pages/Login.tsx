import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { useData } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: setLocalUser } = useData();
  const { login } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  /* =========================
     SUBMIT HANDLER
  ========================= */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      /**
       * 🔐 BACKEND LOGIN
       */
      const { user, token } = await login(email, password, rememberMe);

      /**
       * ✅ SET LOCAL USER STATE
       */
      setLocalUser({
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        approved: user.approved,
        shopId: user.role === "supplier" ? user.shopId : undefined,
      });

      if (user.username === "VoltAmpele@gmail.com") {
        setLocation("/admin/manage-product");
        setIsLoading(false);
        return;
      }

      /**
       * ✅ ROLE-BASED REDIRECTION
       */
      switch (user.role) {
        case "admin":
          setLocation("/admin/dashboard");
          break;
        case "software_team":
          setLocation("/software/dashboard");
          break;
        case "purchase_team":
          setLocation("/admin/dashboard");
          break;
        case "supplier":
          setLocation("/supplier/dashboard");
          break;
        case "pre_sales":
          setLocation("/create-project");
          break;
        case "vendor":
          setLocation("/supplier/tenders");
          break;
        case "client":
          setLocation("/client/tenders");
          break;
        default:
          setLocation("/dashboard");
      }
    } catch (err: any) {
      const msg =
        err?.message || "Invalid email or password. Account must exist.";

      // ✅ If supplier is pending/rejected -> go to supplier pending page
      const lower = String(msg).toLowerCase();
      if (
        lower.includes("under review") ||
        lower.includes("wait for approval") ||
        lower.includes("rejected")
      ) {
        setLocation("/supplier-pending"); // ✅ FIXED ROUTE
        setIsLoading(false);
        return;
      }

      /**
       * ❌ NORMAL LOGIN FAILED TOAST
       */
      toast({
        title: "Login Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-100 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-2 border-gray-200 shadow-2xl bg-white">
          <CardHeader className="space-y-2 pb-6 border-b border-gray-100">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <Building2 className="h-6 w-6" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl font-bold text-gray-900">
              BOQ Management System
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Login to access your dashboard
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <Label htmlFor="remember-me" className="text-sm font-normal text-gray-700 cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  Forgot Password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 border-t border-gray-100 pt-6 bg-gray-50/50">
            <div className="text-center text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-blue-600 hover:underline font-medium"
              >
                Sign Up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
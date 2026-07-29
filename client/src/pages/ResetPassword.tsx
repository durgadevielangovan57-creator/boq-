import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import axios from "axios";
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
import { Label } from "@/components/ui/label";
import { KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    // Initialize token from URL query params
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const tokenParam = searchParams.get("token");
        if (!tokenParam) {
            setError("Reset token is missing from the URL. Please use the link sent to your email.");
        } else {
            setToken(tokenParam);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Basic Validation
        if (!token) {
            setError("Invalid or missing reset token.");
            return;
        }

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);

        try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
            const response = await axios.post(`${apiBaseUrl}/auth/reset-password`, {
                token,
                newPassword,
            });

            if (response.status === 200) {
                setIsSuccess(true);
                toast({
                    title: "Success",
                    description: "Your password has been reset successfully.",
                });

                // Redirect to login after a brief delay
                setTimeout(() => {
                    setLocation("/");
                }, 3000);
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to reset password. The link may have expired.";
            setError(msg);
            toast({
                title: "Error",
                description: msg,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-100 rounded-full blur-3xl" />

                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative z-10 text-center">
                    <Card className="border-2 border-green-200 shadow-2xl bg-white p-8">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
                                <CheckCircle2 className="h-10 w-10" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Password Reset Successful</h2>
                            <p className="text-gray-600">Your password has been updated. You will be redirected to the login page in a few seconds...</p>
                            <Button onClick={() => setLocation("/")} className="mt-4 bg-blue-600 hover:bg-blue-700">
                                Go to Login Now
                            </Button>
                        </div>
                    </Card>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-100 rounded-full blur-3xl" />

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative z-10">
                <Card className="border-2 border-gray-200 shadow-2xl bg-white">
                    <CardHeader className="space-y-2 pb-6 border-b border-gray-100">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                                <KeyRound className="h-6 w-6" />
                            </div>
                        </div>
                        <CardTitle className="text-center text-2xl font-bold text-gray-900">Reset Password</CardTitle>
                        <CardDescription className="text-center text-gray-600">
                            Enter your new password below to regain access to your account.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-6">
                        {error && (
                            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 flex gap-3 text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">New Password</Label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    disabled={!token || isLoading}
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">Confirm New Password</Label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={!token || isLoading}
                                    className="h-11"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-semibold bg-blue-600 hover:bg-blue-700"
                                disabled={!token || isLoading}
                            >
                                {isLoading ? "Resetting Password..." : "Update Password"}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="justify-center border-t border-gray-100 pt-6 bg-gray-50/50">
                        <Button variant="link" onClick={() => setLocation("/")} className="text-blue-600 hover:underline font-medium p-0 h-auto">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Login
                        </Button>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    );
}

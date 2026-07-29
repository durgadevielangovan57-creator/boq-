import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Building2, Clock, ArrowLeft } from "lucide-react";

export default function PendingApproval() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-100 rounded-full blur-3xl" />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative z-10">
        <Card className="border-2 border-gray-200 shadow-2xl bg-white">
          <CardHeader className="space-y-2 pb-6 border-b border-gray-100">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-lg bg-yellow-500 flex items-center justify-center text-white">
                <Clock className="h-6 w-6" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl font-bold text-gray-900">Account Under Verification</CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>

              <div className="space-y-2">
                <p className="text-gray-700 leading-relaxed">
                  Your account is currently under review. You will be able to access the system once your account is approved by the BOQ team.
                </p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <p className="text-sm text-yellow-800">
                    <strong>What happens next?</strong><br />
                    • Our team will review your application<br />
                    • You will receive an email notification once approved<br />
                    • Approval typically takes 1-2 business days
                  </p>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="justify-center border-t border-gray-100 pt-6 bg-gray-50/50">
            <Link href="/" className="flex items-center gap-2 text-blue-600 hover:underline font-medium">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
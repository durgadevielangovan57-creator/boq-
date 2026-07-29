import { useEffect } from "react";
import { useLocation } from "wouter";
import { useData } from "@/lib/store";

export default function SoftwareDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useData();

  useEffect(() => {
    if (!user || user.role !== 'software_team') {
      setLocation("/");
      return;
    }
    // Redirect to admin dashboard for now (software team has similar permissions)
    setLocation("/admin/dashboard");
  }, [user, setLocation]);

  return null;
}
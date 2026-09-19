import { useEffect, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FolderKanban, AlertCircle, ShieldCheck, Eye } from "lucide-react";
import { useData } from "@/lib/store";
import apiFetch from "@/lib/api";

export type OverviewTabKey = "dashboard" | "project-dashboard" | "alerts" | "access-control" | "spy";

/**
 * Tabs of the Overview flow, in the order they should appear:
 *   1. Dashboard  2. Project Dashboard  3. Alerts  4. Access Control  5. Spy (Activity Log)
 *
 * `moduleKey` matches the permission module key used by the sidebar so the same
 * admin-managed per-user permissions decide which tabs a user can see (where the
 * sidebar applied that gating — Access Control and Spy were role-only there, so
 * they stay role-only here too).
 */
export const OVERVIEW_TABS: {
    key: OverviewTabKey;
    label: string;
    href: string;
    icon: any;
    moduleKey: string;
}[] = [
        { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
        { key: "project-dashboard", label: "Project Dashboard", href: "/project-dashboard", icon: FolderKanban, moduleKey: "project_dashboard" },
        { key: "alerts", label: "Alerts", href: "/admin/dashboard?tab=alerts", icon: AlertCircle, moduleKey: "alerts" },
        { key: "access-control", label: "Access Control", href: "/admin/access-control", icon: ShieldCheck, moduleKey: "access_control" },
        { key: "spy", label: "Spy (Activity Log)", href: "/admin/spy", icon: Eye, moduleKey: "spy" },
    ];

/** Same default role conditions the sidebar used for each of the five links. */
export function overviewDefaultCondition(moduleKey: string, role?: string | null, isVoltAmpele?: boolean): boolean {
    const isAdminOrSoftware = role === "admin" || role === "software_team";
    const isContractor = role === "contractor";
    const isProductManager = role === "product_manager";
    const isAdminOnly = role === "admin";
    switch (moduleKey) {
        case "dashboard":
            return !isContractor && role !== "supplier" && !isProductManager;
        case "project_dashboard":
            return isAdminOrSoftware;
        case "alerts":
            return isAdminOnly;
        // Access Control and Spy bypassed per-user module permissions in the sidebar
        // (plain role checks), so they keep that behavior here.
        case "access_control":
            return isAdminOnly;
        case "spy":
            return isAdminOrSoftware;
        default:
            return false;
    }
}

/**
 * Pill-style tab bar shown at the top of the Dashboard / Project Dashboard / Alerts /
 * Access Control / Spy pages, so they behave like tabs of one "Overview" flow (same
 * visual language as BoqTabBar / ProcurementTabBar).
 *
 * Switching tabs is a normal route navigation (each tab is its own page/route under
 * the hood), so it behaves exactly like clicking the old separate sidebar links.
 */
export default function OverviewTabBar({ active, alertsCount }: { active: OverviewTabKey; alertsCount?: number }) {
    const { user, customModules, isCustomManaged, permsLoaded } = useData();

    const isVoltAmpele = user?.username === "VoltAmpele@gmail.com";

    const isVisible = (moduleKey: string): boolean => {
        if (user?.role === "client") return false;
        if (user?.role === "admin" || user?.role === "software_team") return true;
        if (!permsLoaded) return false;
        // Access Control and Spy stayed role-only (no isVisible gating) in the sidebar.
        if (moduleKey === "access_control" || moduleKey === "spy") {
            return overviewDefaultCondition(moduleKey, user?.role, isVoltAmpele);
        }
        if (isCustomManaged) return customModules.has(moduleKey);
        return overviewDefaultCondition(moduleKey, user?.role, isVoltAmpele);
    };

    // Always keep the current tab visible, even if permissions are still loading.
    const tabs = OVERVIEW_TABS.filter((tab) => tab.key === active || isVisible(tab.moduleKey));

    if (tabs.length < 2) return null;

    return (
        <div className="flex items-center gap-1.5 rounded-xl p-1.5 bg-[#F3F1FB] w-full max-w-3xl mb-4 flex-wrap sm:flex-nowrap">
            {tabs.map((tab) => {
                const isActive = tab.key === active;
                const Icon = tab.icon;
                return (
                    <Link key={tab.key} href={tab.href} className="flex-1 min-w-0">
                        <span
                            className={cn(
                                "flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs sm:text-sm cursor-pointer transition-all text-center select-none whitespace-nowrap",
                                isActive
                                    ? "bg-white shadow-sm font-bold text-indigo-700"
                                    : "font-medium text-slate-500 hover:bg-black/5"
                            )}
                        >
                            <Icon className="h-4 w-4 flex-shrink-0" style={{ color: isActive ? "#4338CA" : "#94A3B8" }} />
                            <span className="truncate">{tab.label}</span>
                            {tab.key === "alerts" && !!alertsCount && alertsCount > 0 && (
                                <span className="bg-[#EF4444] text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                                    {alertsCount}
                                </span>
                            )}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}
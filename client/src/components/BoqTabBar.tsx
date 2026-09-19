import { useEffect, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { ShoppingCart, CheckCircle2, FileText, Hammer } from "lucide-react";
import { useData } from "@/lib/store";
import apiFetch from "@/lib/api";

export type BoqTabKey = "sketch" | "bom" | "boq" | "po";

/**
 * Tabs of the BOQ / Projects flow, in the order they should appear:
 *   1. Sketch a Plan  2. BOM  3. BOQ  4. PO
 *
 * `moduleKey` matches the permission module key used by the sidebar so the same
 * admin-managed per-user permissions decide which tabs a user can see.
 *
 * "sketch_plan" doesn't have its own sidebar module key — the sidebar shows the
 * whole "BOQ / Projects" section if any of the three (generate_bom, finalize_boq,
 * generate_po) are allowed.  For the tab bar we treat sketch_plan as visible to
 * anyone who can reach the section at all (same OR of all three module keys).
 */
export const BOQ_TABS: {
    key: BoqTabKey;
    label: string;
    href: string;
    icon: any;
    moduleKey: string;
}[] = [
        { key: "sketch", label: "Sketch a Plan", href: "/sketch-plans", icon: Hammer, moduleKey: "sketch_plan" },
        { key: "bom", label: "BOM", href: "/create-bom", icon: ShoppingCart, moduleKey: "generate_bom" },
        { key: "boq", label: "BOQ", href: "/finalize-bom", icon: CheckCircle2, moduleKey: "finalize_boq" },
        { key: "po", label: "PO", href: "/generate-po", icon: FileText, moduleKey: "generate_po" },
    ];

/** Same default role conditions the sidebar uses for each of the BOQ links. */
export function boqDefaultCondition(
    moduleKey: string,
    role?: string | null,
): boolean {
    const isAdminOrSoftware = role === "admin" || role === "software_team";
    const isPreSales = role === "pre_sales";
    const isProductManager = role === "product_manager";
    const isPurchaseTeam = role === "purchase_team";
    const isFinance = role === "finance";

    switch (moduleKey) {
        case "sketch_plan":
            // Sketch is visible to anyone who can see any of the three BOQ modules
            return isAdminOrSoftware || isPreSales || isProductManager || isPurchaseTeam || isFinance;
        case "generate_bom":
            return isAdminOrSoftware || isPreSales || isProductManager || isPurchaseTeam || isFinance;
        case "generate_po":
            return (isAdminOrSoftware || isPreSales || isPurchaseTeam) && !isProductManager;
        case "finalize_boq":
            return isAdminOrSoftware || isFinance;
        default:
            return false;
    }
}

/**
 * Pill-style tab bar shown at the top of the Sketch a Plan / Generate BOM /
 * Finalize BOQ / Generate PO pages, so the four pages behave like tabs of one
 * "BOQ / Projects" flow (same visual language as ProcurementTabBar / ManagementTabBar).
 *
 * Each tab checks the user's permissions (via /api/my-permissions) and only
 * renders if the user is allowed to see it. If a user has custom-managed
 * permissions and only one tab is assigned, only that tab will show.
 *
 * Switching tabs is a normal route navigation (each tab is its own page/route under
 * the hood), so it's the same as clicking between the old separate sidebar links —
 * just framed as tabs now.
 */
export default function BoqTabBar({ active }: { active: BoqTabKey }) {
    const { user, customModules, isCustomManaged, permsLoaded } = useData();

    const isVisible = (moduleKey: string): boolean => {
        if (user?.role === "client") return false;
        if (user?.role === "admin" || user?.role === "software_team") return true;
        if (!permsLoaded) return false;
        if (isCustomManaged) {
            // "sketch_plan" may not be an explicit module key in the admin panel.
            // If the user has ANY of the three BOQ module keys, let them see sketch too.
            if (moduleKey === "sketch_plan") {
                return customModules.has("sketch_plan") ||
                    customModules.has("generate_bom") ||
                    customModules.has("finalize_boq") ||
                    customModules.has("generate_po");
            }
            return customModules.has(moduleKey);
        }
        return boqDefaultCondition(moduleKey, user?.role);
    };

    // Always keep the current tab visible, even if permissions are still loading.
    const tabs = BOQ_TABS.filter((tab) => tab.key === active || isVisible(tab.moduleKey));

    if (tabs.length < 2) return null;

    return (
        <div className="flex items-center gap-1.5 rounded-xl p-1.5 bg-[#F3F1FB] w-full max-w-2xl mb-4 flex-wrap sm:flex-nowrap">
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
                            <Icon className="h-4 w-4 flex-shrink-0" style={{ color: isActive ? '#4338CA' : '#94A3B8' }} />
                            <span className="truncate">{tab.label}</span>
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Package, Tags } from "lucide-react";
import { useData } from "@/lib/store";
import apiFetch from "@/lib/api";

export type ManagementTabKey = "manage-product" | "manage-materials" | "manage-categories" | "bulk-upload";

/**
 * Tabs of the Management flow, in the order they should appear:
 *   1. Manage Product  2. Manage Materials  3. Manage Categories
 *
 * "Bulk Upload" is hidden for now — its entry is commented out below rather than
 * deleted, so it can be brought back by uncommenting it. The route, permission key
 * and ManagementTabBar wiring on its page are untouched.
 *
 * "Manage Shops" used to live here too; it's been renamed "Create Shops" and moved
 * to the Creations tab bar, next to Vendor Category (see CreationsTabBar).
 *
 * `moduleKey` matches the permission module key used by the sidebar so the same
 * admin-managed per-user permissions decide which tabs a user can see.
 */
export const MANAGEMENT_TABS: {
    key: ManagementTabKey;
    label: string;
    href: string;
    icon: any;
    moduleKey: string;
}[] = [
        { key: "manage-product", label: "Manage Product", href: "/admin/manage-product", icon: Package, moduleKey: "manage_product" },
        { key: "manage-materials", label: "Manage Materials", href: "/admin/manage-materials", icon: Package, moduleKey: "manage_materials" },
        { key: "manage-categories", label: "Manage Categories", href: "/admin/manage-categories", icon: Tags, moduleKey: "manage_categories" },
        // { key: "bulk-upload", label: "Bulk Upload", href: "/admin/bulk-material-upload", icon: Upload, moduleKey: "bulk_upload" },
    ];

/** Same default role conditions the sidebar used for each of the four links. */
export function managementDefaultCondition(
    moduleKey: string,
    role?: string | null,
    isVoltAmpele = false
): boolean {
    const isAdminOrSoftware = role === "admin" || role === "software_team";
    const isPreSales = role === "pre_sales";
    const isContractor = role === "contractor";
    const isProductManager = role === "product_manager";

    switch (moduleKey) {
        case "manage_product":
            return isAdminOrSoftware;
        case "manage_materials":
        case "manage_categories":
        case "bulk_upload":
            return !isVoltAmpele && isAdminOrSoftware && !isPreSales && !isContractor && !isProductManager;
        default:
            return false;
    }
}

/**
 * Pill-style tab bar shown at the top of the Manage Product / Manage Materials /
 * Manage Categories / Bulk Upload pages, so those pages behave like tabs of one
 * "Management" flow under the sidebar (same visual language as CreationsTabBar /
 * BoqTabBar / ProcurementTabBar).
 *
 * Switching tabs is a normal route navigation (each tab is its own page/route under
 * the hood), so it behaves exactly like clicking the old separate sidebar links.
 */
export default function ManagementTabBar({ active }: { active: ManagementTabKey }) {
    const { user, customModules, isCustomManaged, permsLoaded } = useData();

    const isVoltAmpele = user?.username === "VoltAmpele@gmail.com";

    const isVisible = (moduleKey: string): boolean => {
        if (user?.role === "client") return false;
        if (user?.role === "admin" || user?.role === "software_team") return true;
        if (!permsLoaded) return false;
        if (isCustomManaged) return customModules.has(moduleKey);
        return managementDefaultCondition(moduleKey, user?.role, isVoltAmpele);
    };

    // Always keep the current tab visible, even if permissions are still loading.
    const tabs = MANAGEMENT_TABS.filter((tab) => tab.key === active || isVisible(tab.moduleKey));

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
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}
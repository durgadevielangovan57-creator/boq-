import { useEffect, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Package, Boxes, Tags, Building2, Store } from "lucide-react";
import { useData } from "@/lib/store";
import apiFetch from "@/lib/api";

export type CreationsTabKey = "item" | "product" | "vendor-category" | "create-shops" | "create-project";

/**
 * Tabs of the Creations flow, in the order they should appear:
 *   1. Create Project  2. Item  3. Product  4. Vendor Category  5. Create Shops
 *
 * "Create Shops" is the old "Manage Shops" link (Management section), renamed and
 * moved here as a tab next to Vendor Category; its href, moduleKey and permission
 * behavior are unchanged so admin-managed per-user permissions keep working.
 *
 * `moduleKey` matches the permission module key used by the sidebar so the same
 * admin-managed per-user permissions decide which tabs a user can see.
 */
export const CREATIONS_TABS: {
    key: CreationsTabKey;
    label: string;
    href: string;
    icon: any;
    moduleKey: string;
}[] = [
        { key: "create-project", label: "Create Project", href: "/create-project", icon: Building2, moduleKey: "create_project" },
        { key: "item", label: "Item", href: "/admin/dashboard?tab=materials", icon: Package, moduleKey: "create_item" },
        { key: "product", label: "Product", href: "/admin/dashboard?tab=create-product", icon: Boxes, moduleKey: "create_product" },
        { key: "vendor-category", label: "Vendor Category", href: "/admin/vendor-categories", icon: Tags, moduleKey: "create_vendor_category" },
        { key: "create-shops", label: "Create Shops", href: "/admin/dashboard?tab=shops", icon: Store, moduleKey: "manage_shops" },
    ];

/** Same default role conditions the sidebar used for each of the four links. */
export function creationsDefaultCondition(
    moduleKey: string,
    role?: string | null,
    isVoltAmpele = false
): boolean {
    const isAdminOrSoftware = role === "admin" || role === "software_team";
    const isAdminOrSoftwareOrPurchaseTeam = isAdminOrSoftware || role === "purchase_team";
    const isPreSales = role === "pre_sales";
    const isContractor = role === "contractor";
    const isProductManager = role === "product_manager";
    // Sidebar: Create Project is for admin / software team / pre-sales.
    const canCreateBOQAndProject = role === "admin" || role === "software_team" || isPreSales;

    switch (moduleKey) {
        case "create_item":
            return isAdminOrSoftwareOrPurchaseTeam && !isPreSales && !isContractor && !isProductManager && !isVoltAmpele;
        case "create_product":
            return isAdminOrSoftwareOrPurchaseTeam || isPreSales || isProductManager || isVoltAmpele;
        case "create_vendor_category":
            return isAdminOrSoftwareOrPurchaseTeam && !isPreSales && !isContractor && !isProductManager;
        case "manage_shops":
            // Same rule "Manage Shops" used in the old Management section.
            return !isVoltAmpele && isAdminOrSoftware && !isPreSales && !isContractor && !isProductManager;
        case "create_project":
            return canCreateBOQAndProject && !isProductManager && !isVoltAmpele;
        default:
            return false;
    }
}

/**
 * Pill-style tab bar shown at the top of the Create Item / Create Product /
 * Vendor Categories / Create Project pages, so those pages behave like tabs of one
 * "Create" flow under the Creations sidebar section (same visual language as
 * BoqTabBar's BOM / BOQ / PO tabs and ProcurementTabBar).
 *
 * Switching tabs is a normal route navigation (each tab is its own page/route under
 * the hood), so it behaves exactly like clicking the old separate sidebar links.
 */
export default function CreationsTabBar({ active }: { active: CreationsTabKey }) {
    const { user, customModules, isCustomManaged, permsLoaded } = useData();

    const isVoltAmpele = user?.username === "VoltAmpele@gmail.com";

    const isVisible = (moduleKey: string): boolean => {
        if (user?.role === "client") return false;
        if ((moduleKey === "create_project" || moduleKey === "manage_shops") && isVoltAmpele) return false;
        if (user?.role === "admin" || user?.role === "software_team") return true;
        if (!permsLoaded) return false;
        if (isCustomManaged) return customModules.has(moduleKey);
        return creationsDefaultCondition(moduleKey, user?.role, isVoltAmpele);
    };

    // Always keep the current tab visible, even if permissions are still loading.
    const tabs = CREATIONS_TABS.filter((tab) => tab.key === active || isVisible(tab.moduleKey));

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
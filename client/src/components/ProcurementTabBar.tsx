import { useEffect, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { FileText, Truck, LayoutTemplate, Gavel, ClipboardCheck } from "lucide-react";
import { useData } from "@/lib/store";
import apiFetch from "@/lib/api";

export type ProcurementTabKey = "purchase-orders" | "delivery-tracker" | "form-builder" | "tenders" | "raise-po-request" | "my-po-requests";

/**
 * Tabs of the Procurement flow, in the order they should appear:
 *   1. Purchase Orders  2. Delivery Tracker  3. Form Builder  4. Tenders
 *   5. Raise PO Request  6. My Requests
 *
 * `moduleKey` matches the permission module key used by the sidebar so the same
 * admin-managed per-user permissions decide which tabs a user can see.
 */
export const PROCUREMENT_TABS: {
    key: ProcurementTabKey;
    label: string;
    href: string;
    icon: any;
    moduleKey: string;
}[] = [
        { key: "purchase-orders", label: "Purchase Orders", href: "/purchase-orders", icon: FileText, moduleKey: "purchase_orders" },
        { key: "delivery-tracker", label: "Delivery Tracker", href: "/delivery-tracker", icon: Truck, moduleKey: "delivery_tracker" },
        { key: "form-builder", label: "Form Builder", href: "/admin/form-builder", icon: LayoutTemplate, moduleKey: "form_builder" },
        { key: "tenders", label: "Tenders", href: "/admin/tenders", icon: Gavel, moduleKey: "tenders" },
        { key: "raise-po-request", label: "Raise PO Request", href: "/raise-po-request", icon: FileText, moduleKey: "raise_po_request" },
        { key: "my-po-requests", label: "My Requests", href: "/my-po-requests", icon: ClipboardCheck, moduleKey: "my_po_requests" },
    ];

/** Same default role conditions the sidebar used for each of the six links. */
export function procurementDefaultCondition(moduleKey: string, role?: string | null): boolean {
    const isAdminOrSoftware = role === "admin" || role === "software_team";
    const isPurchaseTeam = role === "purchase_team";
    const isPreSales = role === "pre_sales";
    const isContractor = role === "contractor";
    switch (moduleKey) {
        case "purchase_orders":
            return isAdminOrSoftware || isPurchaseTeam;
        case "delivery_tracker":
            return isAdminOrSoftware || isPurchaseTeam || role === "site_engineer";
        case "form_builder":
            return isAdminOrSoftware || isPurchaseTeam || isPreSales;
        case "tenders":
            return isAdminOrSoftware || isPurchaseTeam;
        case "raise_po_request":
        case "my_po_requests":
            // Sidebar excluded VoltAmpele separately; that's handled by the caller/page,
            // not by role, so it isn't modeled here.
            return !isContractor && role !== "supplier";
        default:
            return false;
    }
}

/**
 * Pill-style tab bar shown at the top of the Purchase Orders / Delivery Tracker /
 * Form Builder / Tenders pages, so the four pages behave like tabs of one
 * "Procurement" flow (same visual language as BoqTabBar's BOM / BOQ / PO tabs).
 *
 * Switching tabs is a normal route navigation (each tab is its own page/route under
 * the hood), so it behaves exactly like clicking the old separate sidebar links.
 */
export default function ProcurementTabBar({ active }: { active: ProcurementTabKey }) {
    const { user, customModules, isCustomManaged, permsLoaded } = useData();

    const isVoltAmpele = user?.username === "VoltAmpele@gmail.com";

    const isVisible = (moduleKey: string): boolean => {
        if (user?.role === "client") return false;
        if ((moduleKey === "raise_po_request" || moduleKey === "my_po_requests") && isVoltAmpele) return false;
        if (user?.role === "admin" || user?.role === "software_team") return true;
        if (!permsLoaded) return false;
        if (isCustomManaged) return customModules.has(moduleKey);
        return procurementDefaultCondition(moduleKey, user?.role);
    };

    // Always keep the current tab visible, even if permissions are still loading.
    const tabs = PROCUREMENT_TABS.filter((tab) => tab.key === active || isVisible(tab.moduleKey));

    if (tabs.length < 2) return null;

    return (
        <div className="flex items-center gap-1.5 rounded-xl p-1.5 bg-[#F3F1FB] w-full max-w-4xl mb-4 flex-wrap sm:flex-nowrap">
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
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Package, BookOpen } from "lucide-react";

export type ResourcesTabKey = "subscription" | "user-manual";

/**
 * Tabs of the Resources flow, in the order they should appear:
 *   1. Subscription  2. User Manual
 *
 * `moduleKey` matches the permission module key used by the sidebar so the same
 * admin-managed per-user permissions decide which tabs a user can see.
 */
export const RESOURCES_TABS: {
    key: ResourcesTabKey;
    label: string;
    href: string;
    icon: any;
    moduleKey: string;
}[] = [
        { key: "subscription", label: "Subscription", href: "/subscription", icon: Package, moduleKey: "subscription" },
        { key: "user-manual", label: "User Manual", href: "/user-manual", icon: BookOpen, moduleKey: "user_manual" },
    ];

/** Same default role condition the sidebar used for both links (they shared one rule). */
export function resourcesDefaultCondition(
    role?: string | null,
    isVoltAmpele = false,
    isPreSales = false,
    isContractor = false
): boolean {
    return !isVoltAmpele && !isPreSales && !isContractor;
}

/**
 * Pill-style tab bar shown at the top of the Subscription / User Manual pages, so the
 * two pages behave like tabs of one "Resources" flow under the sidebar (same visual
 * language as CreationsTabBar / BoqTabBar / ProcurementTabBar).
 *
 * Switching tabs is a normal route navigation (each tab is its own page/route under
 * the hood), so it behaves exactly like clicking the old separate sidebar links.
 */
export default function ResourcesTabBar({
    active,
    isVisible,
}: {
    active: ResourcesTabKey;
    // Optional override for which tabs are visible; falls back to showing both.
    // Pages that already have role info in scope (e.g. from useAuth/useData) can
    // pass this in; otherwise both tabs are shown, matching the previous default
    // where these two links had no per-user permission split of their own.
    isVisible?: (moduleKey: string) => boolean;
}) {
    const tabs = RESOURCES_TABS.filter(
        (tab) => tab.key === active || !isVisible || isVisible(tab.moduleKey)
    );

    if (tabs.length < 2) return null;

    return (
        <div className="flex items-center gap-1.5 rounded-xl p-1.5 bg-[#F3F1FB] w-full max-w-md mb-4">
            {tabs.map((tab) => {
                const isActive = tab.key === active;
                const Icon = tab.icon;
                return (
                    <Link key={tab.key} href={tab.href} className="flex-1 min-w-0">
                        <span
                            className={cn(
                                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm sm:text-base cursor-pointer transition-all text-center select-none",
                                isActive
                                    ? "bg-white shadow-sm font-bold text-indigo-700"
                                    : "font-medium text-slate-500 hover:bg-black/5"
                            )}
                        >
                            <Icon className="h-4 w-4 flex-shrink-0" style={{ color: isActive ? "#4338CA" : "#94A3B8" }} />
                            {tab.label}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

export type SiteManagementTabKey = "site-reports";

/**
 * Tab bar for the Site Management flow. Only has one tab today (Site Reports), but
 * shown as a tab bar anyway — same visual language as BoqTabBar / ProcurementTabBar /
 * OverviewTabBar / StorageTabBar — so it's clear this page lives under "Site
 * Management" and stays consistent if more site-management tabs are added later.
 */
export const SITE_MANAGEMENT_TABS: { key: SiteManagementTabKey; label: string; href: string; icon: any }[] = [
    { key: "site-reports", label: "Site Reports", href: "/site-reports", icon: FileText },
];

export default function SiteManagementTabBar({ active }: { active: SiteManagementTabKey }) {
    return (
        <div className="flex items-center gap-1.5 rounded-xl p-1.5 bg-[#F3F1FB] w-full max-w-xs mb-4">
            {SITE_MANAGEMENT_TABS.map((tab) => {
                const isActive = tab.key === active;
                const Icon = tab.icon;
                return (
                    <Link key={tab.key} href={tab.href} className="flex-1 min-w-0">
                        <span
                            className={cn(
                                "flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-sm cursor-pointer transition-all text-center select-none whitespace-nowrap",
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
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Archive, Trash2 } from "lucide-react";

export type StorageTabKey = "archive" | "trash";

/**
 * Tabs of the Storage flow, in the order they should appear:
 *   1. Archive  2. Trash
 *
 * Both routes are admin/software_team only, same as the old sidebar section, so
 * there's no per-module permission gating here (unlike Procurement/Overview/BOQ).
 */
export const STORAGE_TABS: { key: StorageTabKey; label: string; href: string; icon: any }[] = [
    { key: "archive", label: "Archive", href: "/admin/archive", icon: Archive },
    { key: "trash", label: "Trash", href: "/admin/trash", icon: Trash2 },
];

/**
 * Pill-style tab bar shown at the top of the Archive / Trash pages, so they behave
 * like tabs of one "Storage" flow (same visual language as BoqTabBar / ProcurementTabBar
 * / OverviewTabBar).
 *
 * Switching tabs is a normal route navigation (each tab is its own page/route under
 * the hood), so it behaves exactly like clicking the old separate sidebar links.
 */
export default function StorageTabBar({ active }: { active: StorageTabKey }) {
    return (
        <div className="flex items-center gap-1.5 rounded-xl p-1.5 bg-[#F3F1FB] w-full max-w-md mb-4">
            {STORAGE_TABS.map((tab) => {
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
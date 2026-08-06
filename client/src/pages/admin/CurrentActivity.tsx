import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { Radio, Users, RefreshCw, List, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import apiFetch from "@/lib/api";

interface OnlineUser {
    user_id: string;
    username: string;
    role: string;
    action: string;
    module: string;
    page: string;
    last_active: string;
}

// Deterministic color per username so the same person always gets the same avatar color
const AVATAR_COLORS = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-lime-600",
    "bg-orange-500", "bg-indigo-500",
];

function colorForUsername(username: string) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(username: string) {
    const parts = username.replace(/[._-]+/g, " ").trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Turn a route like "/admin/manage-materials" or "/api/boq-projects/123" into "Manage Materials"
function friendlyPage(page: string | null, module: string | null) {
    if (!page) return module || "Unknown";
    const clean = page.replace(/^\/api\//, "").replace(/^\//, "");
    const segments = clean.split("/").filter((s) => s && !/^[0-9a-f-]{8,}$/i.test(s));
    const last = segments[segments.length - 1] || module || "Home";
    return last
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLE_COLORS: Record<string, string> = {
    admin: "bg-rose-500/15 text-rose-600 border-rose-500/20",
    software_team: "bg-violet-500/15 text-violet-600 border-violet-500/20",
};

export function CurrentActivity() {
    const [users, setUsers] = useState<OnlineUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"list" | "card">("list"); // List view by default
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchOnlineUsers = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const response = await apiFetch("/api/audit/online-users");
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error("Failed to fetch online users", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOnlineUsers(true);
        // Poll every 15s to keep "who's online" fresh
        intervalRef.current = setInterval(() => fetchOnlineUsers(false), 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return (
        <Card className="shadow-md">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Radio className="h-4 w-4 text-emerald-500" /> Current Activity
                        </CardTitle>
                        <CardDescription>Users currently online and what they're working on</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {users.length > 0 && (
                            <Badge variant="outline" className="bg-white border-emerald-200 text-emerald-600">
                                <Users className="h-3 w-3 mr-1" /> {users.length} Online
                            </Badge>
                        )}
                        <div className="flex items-center rounded-md border border-slate-200 bg-white p-0.5">
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
                                title="List view"
                            >
                                <List className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode("card")}
                                className={`p-1.5 rounded transition-colors ${viewMode === "card" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
                                title="Card view"
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <button
                            onClick={() => fetchOnlineUsers(true)}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className={viewMode === "list" ? "p-0" : "p-6"}>
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center">
                        <Users className="h-8 w-8 animate-spin mx-auto text-emerald-500 mb-2" />
                        <p className="text-muted-foreground">Checking who's online...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center">
                        <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-muted-foreground">No one is currently online</p>
                    </div>
                ) : viewMode === "list" ? (
                    <div className="divide-y divide-slate-100">
                        {users.map((u) => (
                            <div
                                key={u.user_id || u.username}
                                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/80 transition-colors"
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback className={`${colorForUsername(u.username)} text-white font-bold text-xs`}>
                                            {initials(u.username)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                                </div>
                                <div className="min-w-0 flex-1 flex items-center gap-3">
                                    <p className="font-bold text-slate-900 truncate w-48 shrink-0">{u.username}</p>
                                    {u.role && (
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] h-5 font-bold uppercase border shrink-0 ${ROLE_COLORS[u.role] || "bg-slate-500/15 text-slate-600 border-slate-500/20"}`}
                                        >
                                            {u.role.replace(/_/g, " ")}
                                        </Badge>
                                    )}
                                    <p className="text-xs text-slate-500 truncate">
                                        Currently on <span className="font-semibold text-slate-700">{friendlyPage(u.page, u.module)}</span>
                                    </p>
                                </div>
                                <p className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                                    Active {formatDistanceToNow(new Date(u.last_active), { addSuffix: true })}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map((u) => (
                            <div
                                key={u.user_id || u.username}
                                className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 hover:border-emerald-200 hover:shadow-sm transition-all bg-white"
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-11 w-11">
                                        <AvatarFallback className={`${colorForUsername(u.username)} text-white font-bold text-sm`}>
                                            {initials(u.username)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-slate-900 truncate">{u.username}</p>
                                    </div>
                                    {u.role && (
                                        <Badge
                                            variant="outline"
                                            className={`mt-0.5 text-[10px] h-5 font-bold uppercase border ${ROLE_COLORS[u.role] || "bg-slate-500/15 text-slate-600 border-slate-500/20"}`}
                                        >
                                            {u.role.replace(/_/g, " ")}
                                        </Badge>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1.5">
                                        Currently on <span className="font-semibold text-slate-700">{friendlyPage(u.page, u.module)}</span>
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Active {formatDistanceToNow(new Date(u.last_active), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PageRefreshButtonProps {
    /** Re-fetches only the data the current page needs. */
    onRefresh: () => Promise<unknown> | unknown;
    title?: string;
    className?: string;
}

/**
 * Small page-header icon button. Runs `onRefresh`, spins while it is in
 * flight, and ignores extra clicks until it finishes. It refreshes data in
 * place (no page reload).
 */
export function PageRefreshButton({ onRefresh, title = "Refresh data", className }: PageRefreshButtonProps) {
    const [refreshing, setRefreshing] = useState(false);
    const { toast } = useToast();

    const handleClick = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await onRefresh();
        } catch (e) {
            console.warn("[PageRefreshButton] refresh failed", e);
            toast({ title: "Refresh failed", description: "Could not load the latest data. Please try again.", variant: "destructive" });
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleClick}
            disabled={refreshing}
            title={refreshing ? "Refreshing…" : title}
            aria-label={title}
            aria-busy={refreshing}
            className={className ?? "h-8 w-8 shrink-0"}
        >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
    );
}

export default PageRefreshButton;
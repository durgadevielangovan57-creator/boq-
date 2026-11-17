import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { X, PackagePlus, ExternalLink } from "lucide-react";
import apiFetch from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface PoNotification {
  id: string;
  poId: string;
  poNumber: string;
  projectName: string;
  vendorName?: string;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  itemCount: number;
  items: { item: string; qty: number | string; unit?: string; rate: number | string }[];
  newItems: { item: string; qty: number | string; unit?: string; rate: number | string }[];
  newItemsReason?: string | null;
  createdByName?: string;
  createdAt: string;
  read: boolean;
}

const inr = (n: unknown) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Data hook used by the Header bell: polls the PO notification feed for
 * Admin / Presales users only. Other roles never call the API.
 */
export function usePoNotifications(enabled: boolean) {
  const [list, setList] = useState<PoNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await apiFetch("/api/po-notifications");
      if (!res.ok) return;
      const data = await res.json();
      setList(data.notifications || []);
      setUnread(data.unread || 0);
    } catch (e) {
      console.warn("load PO notifications failed", e);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [enabled, load]);

  return { list, unread, reload: load, setList, setUnread };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PoNotificationsPanel({
  list,
  setList,
  setUnread,
  onClose,
  open,
}: {
  open: boolean;
  list: PoNotification[];
  setList: (l: PoNotification[]) => void;
  setUnread: (n: number) => void;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<PoNotification | null>(null);

  const markRead = async (n: PoNotification) => {
    if (n.read) return;
    const next = list.map((x) => (x.id === n.id ? { ...x, read: true } : x));
    setList(next);
    setUnread(next.filter((x) => !x.read).length);
    try {
      await apiFetch(`/api/po-notifications/${n.id}/read`, { method: "POST" });
    } catch {
      /* ignore */
    }
  };

  const markAll = async () => {
    setList(list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await apiFetch("/api/po-notifications/read-all", { method: "POST" });
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {open && (
      <div className="absolute right-0 top-10 w-[360px] max-w-[92vw] bg-white border border-[#E5E7EB] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-50">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#F3F4F6]">
          <span className="text-[13px] font-semibold text-[#111827]">Purchase Order Notifications</span>
          <div className="flex items-center gap-2">
            {list.some((n) => !n.read) && (
              <button onClick={markAll} className="text-[11px] text-[#6366f1] hover:underline">
                Mark all read
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="text-[#9CA3AF] hover:text-[#111827]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {list.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-[#9CA3AF]">No new Purchase Orders yet</div>
          ) : (
            list.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  markRead(n);
                  setSelected(n);
                }}
                className={`w-full text-left px-3 py-2.5 border-b border-[#F3F4F6] hover:bg-[#F9FAFB] flex gap-2 ${
                  n.read ? "" : "bg-[#EEF2FF]/60"
                }`}
              >
                <PackagePlus className="h-4 w-4 mt-0.5 shrink-0 text-[#6366f1]" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-[13px] font-medium text-[#111827] truncate">
                      {n.poNumber} · {n.projectName}
                    </span>
                    <span className="text-[11px] text-[#9CA3AF] shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                  <div className="text-[12px] text-[#6B7280] truncate">
                    {n.newItems?.length > 0
                      ? `${n.newItems.length} new item${n.newItems.length > 1 ? "s" : ""}: ${n.newItems
                          .map((i) => i.item)
                          .join(", ")}`
                      : `${n.itemCount} items · ${inr(n.total)}`}
                  </div>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#6366f1] mt-1.5 shrink-0" />}
              </button>
            ))
          )}
        </div>
      </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>New PO {selected.poNumber}</DialogTitle>
                <DialogDescription>
                  {selected.projectName} · created by {selected.createdByName || "—"} ·{" "}
                  {new Date(selected.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-500">Vendor</span>
                <span>{selected.vendorName || "—"}</span>
                <span className="text-slate-500">Items</span>
                <span>{selected.itemCount}</span>
                <span className="text-slate-500">Subtotal</span>
                <span>{inr(selected.subtotal)}</span>
                <span className="text-slate-500">Tax</span>
                <span>{inr(selected.tax)}</span>
                <span className="text-slate-500">Total</span>
                <span className="font-semibold">{inr(selected.total)}</span>
              </div>

              {selected.newItems?.length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="font-semibold text-amber-800 mb-1">Newly added items ({selected.newItems.length})</p>
                  <ul className="list-disc pl-5 text-amber-900">
                    {selected.newItems.map((i, idx) => (
                      <li key={idx}>
                        {i.item} — {i.qty} {i.unit || ""} @ {inr(i.rate)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-amber-900">
                    <span className="font-semibold">Reason:</span> {selected.newItemsReason || "Not provided"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No new items were added in this PO.</p>
              )}

              <div>
                <p className="text-sm font-semibold mb-1">All PO items</p>
                <div className="border rounded-md overflow-hidden text-sm">
                  {selected.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between gap-3 px-3 py-1.5 border-b last:border-b-0">
                      <span className="truncate">{i.item}</span>
                      <span className="shrink-0 text-slate-600">
                        {i.qty} {i.unit || ""} · {inr(i.rate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  const id = selected.poId;
                  setSelected(null);
                  onClose();
                  setLocation(`/purchase-orders/${id}`);
                }}
                className="inline-flex items-center gap-1 text-sm text-[#6366f1] hover:underline self-start"
              >
                Open Purchase Order <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
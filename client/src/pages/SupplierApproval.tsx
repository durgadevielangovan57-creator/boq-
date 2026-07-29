import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getJSON, postJSON } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface Supplier {
  id: string;
  username: string;
  created_at: string;
}

type SupplierUIStatus = "pending" | "accepted" | "rejected";

type SupplierRow = Supplier & {
  uiStatus: SupplierUIStatus;
  busy?: boolean;
};

export default function SupplierApproval() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<null | { type: "success" | "error"; text: string }>(null);

  const showBanner = (type: "success" | "error", text: string) => {
    setBanner({ type, text });
    window.setTimeout(() => setBanner(null), 2500);
  };

  const loadSuppliers = async () => {
    try {
      const data = await getJSON("/api/admin/pending-suppliers");
      const list: Supplier[] = data?.suppliers || [];

      // Keep already accepted/rejected items in UI if they exist locally,
      // but merge/freshen pending list from backend.
      setRows((prev) => {
        const prevById = new Map(prev.map((p) => [p.id, p]));
        const next: SupplierRow[] = [];

        // Pending from server
        for (const s of list) {
          const existing = prevById.get(s.id);
          next.push({
            ...s,
            uiStatus: existing?.uiStatus && existing.uiStatus !== "pending" ? existing.uiStatus : "pending",
            busy: false,
          });
        }

        // Keep any accepted/rejected items that were in UI but no longer returned
        // (this makes "after approve it should show accepted and not go away")
        for (const p of prev) {
          if (!list.find((x) => x.id === p.id) && (p.uiStatus === "accepted" || p.uiStatus === "rejected")) {
            next.push(p);
          }
        }

        // Sort newest first (by created_at)
        next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return next;
      });
    } catch (err: any) {
      console.error("Failed to load suppliers", err);
      showBanner("error", err?.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
    // optional: refresh every 20s for admin live updates
    const t = window.setInterval(loadSuppliers, 20000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.uiStatus === "pending").length,
    [rows]
  );

  const approve = async (id: string) => {
    // optimistic UI: mark accepted and keep visible
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, uiStatus: "accepted", busy: true } : r
      )
    );

    try {
      await postJSON(`/api/admin/suppliers/${id}/approve`, {});
      showBanner("success", "Supplier accepted.");
    } catch (err: any) {
      // rollback on failure
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, uiStatus: "pending" } : r
        )
      );
      showBanner("error", err?.message || "Approve failed");
    } finally {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, busy: false } : r)));
      // refresh from backend in case server state differs
      loadSuppliers();
    }
  };

  const reject = async (id: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, uiStatus: "rejected", busy: true } : r
      )
    );

    try {
      await postJSON(`/api/admin/suppliers/${id}/reject`, {
        reason: "Rejected by admin",
      });
      showBanner("success", "Supplier rejected.");
    } catch (err: any) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, uiStatus: "pending" } : r
        )
      );
      showBanner("error", err?.message || "Reject failed");
    } finally {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, busy: false } : r)));
      loadSuppliers();
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)]">
      {/* Animated gradient background */}
      <div className="relative overflow-hidden rounded-2xl border bg-white">
        <div className="absolute inset-0">
          <motion.div
            className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-3xl opacity-30"
            style={{
              background:
                "radial-gradient(circle at center, #2563eb 0%, rgba(37,99,235,0) 60%)",
            }}
            animate={{ x: [0, 40, 0], y: [0, 25, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full blur-3xl opacity-25"
            style={{
              background:
                "radial-gradient(circle at center, #60a5fa 0%, rgba(96,165,250,0) 60%)",
            }}
            animate={{ x: [0, -35, 0], y: [0, -20, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Header */}
        <div className="relative px-6 py-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Supplier Approval
            </h1>
            <p className="text-sm text-slate-600">
              Review new supplier requests and approve or reject with a single click.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
              <span className="font-semibold">{pendingCount}</span>
              <span>Pending</span>
            </div>
          </div>

          {/* Banner */}
          <AnimatePresence>
            {banner && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                  banner.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {banner.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Body */}
        <div className="relative px-6 pb-8">
          {loading ? (
            <div className="space-y-3">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : rows.length === 0 ? (
            <Card className="p-6">
              <div className="text-slate-700 font-semibold">No pending suppliers</div>
              <div className="text-sm text-slate-500 mt-1">
                All supplier requests have been processed.
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {rows.map((s) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Card className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-900 truncate">
                            {s.username}
                          </div>

                          <StatusPill status={s.uiStatus} />
                        </div>

                        <div className="text-sm text-slate-500 mt-1">
                          Requested on{" "}
                          {new Date(s.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => approve(s.id)}
                          disabled={s.uiStatus !== "pending" || !!s.busy}
                          className="bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600"
                        >
                          {s.busy && s.uiStatus === "accepted" ? "Accepting…" : "Approve"}
                        </Button>

                        <Button
                          variant="destructive"
                          onClick={() => reject(s.id)}
                          disabled={s.uiStatus !== "pending" || !!s.busy}
                        >
                          {s.busy && s.uiStatus === "rejected" ? "Rejecting…" : "Reject"}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: SupplierUIStatus }) {
  if (status === "accepted") {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        Accepted
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
        Rejected
      </span>
    );
  }
  return (
    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
      Pending
    </span>
  );
}

function SkeletonRow() {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="h-4 w-48 rounded bg-slate-200 animate-pulse" />
          <div className="mt-2 h-3 w-64 rounded bg-slate-200 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded bg-slate-200 animate-pulse" />
          <div className="h-9 w-24 rounded bg-slate-200 animate-pulse" />
        </div>
      </div>
    </Card>
  );
}

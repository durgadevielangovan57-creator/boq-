import { query } from "./db/client";

/**
 * =====================================================================
 * DIRECT (MANUAL) PURCHASE ORDER — DRAFT & ADMIN APPROVAL GUARDS
 * ---------------------------------------------------------------------
 * Additive helper module. It introduces NO new approval system: it only
 * enforces the lifecycle of POs created through "Create Purchase Order"
 * (purchase_orders.source = 'manual') on top of the EXISTING statuses and
 * the EXISTING endpoints:
 *
 *   draft ──submit──▶ pending_approval ──approve──▶ approved ─▶ ordered ─▶ delivered
 *     ▲                     │
 *     └──── edit ◀── rejected ◀──reject (reason kept in approval_comments)
 *
 *  - Editable only while status is draft or rejected.
 *  - Zoho sync only after approval.
 *  - Locked while pending_approval and permanently once approved.
 *  - Only an Admin may approve / reject.
 *
 * Every helper returns null / "not applicable" for POs whose source is
 * not 'manual', so BOM-generated, merged, revised and every other
 * existing PO workflow is completely unaffected.
 * =====================================================================
 */

export const MANUAL_PO_EDITABLE_STATUSES = ["draft", "rejected"] as const;
const SUBMIT_ROLES = ["admin", "software_team", "purchase_team"];
const APPROVER_ROLES = ["admin"];

export interface ManualPoGuardError {
    code: number;
    message: string;
}

const norm = (s: any) => String(s ?? "").trim().toLowerCase();

/** Can a direct PO with this status still be edited? (null status == draft) */
export function isManualPoEditable(status: any): boolean {
    const s = norm(status) || "draft";
    return (MANUAL_PO_EDITABLE_STATUSES as readonly string[]).includes(s);
}

/**
 * Loads source/status/item-count for a PO. Returns null when the PO does not
 * exist, is not a direct PO, or the `source` column is unavailable — in all
 * of those cases the caller must behave exactly as it did before this feature.
 */
export async function loadManualPo(
    poId: string
): Promise<{ id: string; status: string; itemCount: number } | null> {
    try {
        const r = await query(
            `SELECT po.id::text AS id, po.status,
                    (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.id)::int AS item_count
               FROM purchase_orders po
              WHERE po.id::text = $1 AND po.source = 'manual'`,
            [poId]
        );
        if (r.rows.length === 0) return null;
        return {
            id: r.rows[0].id,
            status: norm(r.rows[0].status) || "draft",
            itemCount: Number(r.rows[0].item_count) || 0,
        };
    } catch {
        // e.g. column "source" not present yet -> no direct POs can exist.
        return null;
    }
}

/**
 * Guard for PATCH /api/purchase-orders/:id/status (the existing
 * "Submit for Approval" / "Confirm Order Sent" / "Mark Delivered" endpoint).
 * Returns an error for a direct PO that attempts an illegal transition.
 */
export async function guardManualPoStatusChange(
    poId: string,
    targetStatus: string,
    user: { role?: string } | undefined
): Promise<ManualPoGuardError | null> {
    const po = await loadManualPo(poId);
    if (!po) return null; // not a direct PO -> untouched behaviour

    const target = norm(targetStatus);
    const current = po.status;

    switch (target) {
        case "pending_approval": {
            if (!SUBMIT_ROLES.includes(String(user?.role))) {
                return { code: 403, message: "You do not have permission to submit this Purchase Order for approval." };
            }
            if (!isManualPoEditable(current)) {
                return {
                    code: 409,
                    message:
                        current === "pending_approval"
                            ? "This Purchase Order is already submitted and awaiting approval."
                            : `A Purchase Order in "${current}" status cannot be submitted for approval.`,
                };
            }
            if (po.itemCount === 0) {
                return { code: 400, message: "Add at least one item before submitting for approval." };
            }
            return null;
        }
        case "ordered":
            return current === "approved"
                ? null
                : { code: 409, message: "Only an approved Purchase Order can be marked as ordered." };
        case "delivered":
            return current === "approved" || current === "ordered" || current === "delivered"
                ? null
                : { code: 409, message: "Only an approved Purchase Order can be marked as delivered." };
        case "approved":
        case "rejected":
            return {
                code: 403,
                message: "Direct Purchase Orders can only be approved or rejected from PO Approvals by an Admin.",
            };
        default:
            return {
                code: 409,
                message: `A direct Purchase Order cannot be moved to "${targetStatus}" this way.`,
            };
    }
}

/**
 * Guard for POST /api/purchase-orders/:id/approve (the existing Admin
 * approve / reject endpoint) when the PO is a direct PO.
 */
export async function guardManualPoDecision(
    poId: string,
    approve: boolean,
    comment: any,
    user: { role?: string } | undefined
): Promise<ManualPoGuardError | null> {
    const po = await loadManualPo(poId);
    if (!po) return null;

    if (!APPROVER_ROLES.includes(String(user?.role))) {
        return { code: 403, message: "Only an Admin can approve or reject a direct Purchase Order." };
    }
    if (po.status !== "pending_approval") {
        return {
            code: 409,
            message: `This Purchase Order is not awaiting approval (current status: ${po.status}).`,
        };
    }
    if (!approve && !String(comment ?? "").trim()) {
        return { code: 400, message: "A reason is required to reject a Purchase Order." };
    }
    return null;
}

/** Direct POs can only be changed through Edit (draft/rejected) — never revised. */
export async function guardManualPoRevise(poId: string): Promise<ManualPoGuardError | null> {
    const po = await loadManualPo(poId);
    if (!po) return null;
    return {
        code: 409,
        message:
            "Direct Purchase Orders cannot be revised. Edit them while in Draft/Rejected status; approved POs are locked.",
    };
}

/** Rate-reduction requests would alter rates of a locked/approved direct PO. */
export async function guardManualPoRateChange(poId: string): Promise<ManualPoGuardError | null> {
    const po = await loadManualPo(poId);
    if (!po) return null;
    return { code: 409, message: "Rates of a direct Purchase Order can only be changed by editing it in Draft/Rejected status." };
}

/**
 * Direct POs may only be synced to Zoho Books after Admin approval
 * (approved / ordered / delivered). Draft, Rejected and Pending POs cannot sync.
 */
export async function guardManualPoZohoSync(poId: string): Promise<ManualPoGuardError | null> {
    const po = await loadManualPo(poId);
    if (!po) return null;
    if (po.status === "approved" || po.status === "ordered" || po.status === "delivered") return null;
    return {
        code: 409,
        message:
            po.status === "pending_approval"
                ? "This Purchase Order is awaiting Admin approval. It can be synced to Zoho Books once approved."
                : "A direct Purchase Order can be synced to Zoho Books only after it is approved by an Admin.",
    };
}

/**
 * For the merge tool: direct POs that are locked (pending/approved/ordered/
 * delivered) must not have items moved out of them.
 */
export async function findLockedManualPos(poIds: string[]): Promise<string[]> {
    try {
        const r = await query(
            `SELECT po_number, status FROM purchase_orders
              WHERE id::text = ANY($1) AND source = 'manual'`,
            [poIds.map(String)]
        );
        return r.rows
            .filter((row: any) => !isManualPoEditable(row.status))
            .map((row: any) => row.po_number);
    } catch {
        return [];
    }
}
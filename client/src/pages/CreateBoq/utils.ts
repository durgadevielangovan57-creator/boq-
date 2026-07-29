import { Project, BOMVersion, BOMItem, Product, Step11Item, BOMHistory, BOMComment, User } from './types';

// ─── Helpers ───────────────────────────────────────────────────────

export const parseTableData = (raw: any): any => {
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
  return raw || {};
};

export const parseImages = (imageField: string | null | undefined): string[] => {
  if (!imageField) return [];
  try {
    if (imageField.startsWith('[')) return JSON.parse(imageField);
    return [imageField];
  } catch (e) {
    return [imageField];
  }
};

export const safeJson = async (res: Response): Promise<any> => {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();
  if (res.status === 204 || !text.trim()) return {};
  if (ct.includes("application/json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try { return JSON.parse(text); } catch { throw new Error("Invalid JSON from server"); }
  }
  throw new Error(`Non-JSON response (${res.status})`);
};

export const VERSION_LABEL: Record<string, string> = {
  submitted: "Locked", pending_approval: "Pending Approval", approved: "Approved", rejected: "Rejected", draft: "Draft", edit_requested: "Edit Requested"
};

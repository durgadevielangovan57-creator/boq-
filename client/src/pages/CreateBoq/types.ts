// ─── Types ─────────────────────────────────────────────────────────────────────

export type Project = { id: string; name: string; client: string; budget: string; location?: string; status?: string; project_status?: string };

export const PROJECT_STATUSES: { value: string; label: string; color: string }[] = [
  { value: 'started', label: 'Started', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'bom_stage', label: 'BOM Stage', color: 'bg-blue-100 text-blue-700' },
  { value: 'boq_stage', label: 'BOQ Stage', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'client_approval', label: 'Client Approval', color: 'bg-amber-100 text-amber-700' },
  { value: 'work_in_execution', label: 'Work in Execution', color: 'bg-green-100 text-green-700' },
  { value: 'finance', label: 'Finance', color: 'bg-purple-100 text-purple-700' },
  { value: 'hold', label: 'On Hold', color: 'bg-orange-100 text-orange-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-200 text-gray-600' },
];

export const getProjectStatusMeta = (s?: string) => PROJECT_STATUSES.find(x => x.value === s) ?? { label: s || 'Started', color: 'bg-slate-100 text-slate-700' };
export type BOMVersion = { id: string; project_id: string; version_number: number; status: "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "edit_requested"; created_at: string; rejection_reason?: string; updated_at: string; project_name?: string; project_client?: string; project_location?: string };
export type BOMItem = { id: string; estimator: string; session_id: string; table_data: any; created_at: string };
export type Product = { id: string; name: string; code: string; image?: string; category?: string; subcategory?: string; description?: string; category_name?: string; subcategory_name?: string; tax_code_type?: string; tax_code_value?: string; hsn_code?: string; sac_code?: string };
export type Step11Item = { id?: string; s_no?: number; title?: string; description?: string; unit?: string; qty?: number; supply_rate?: number; install_rate?: number;[key: string]: any };
export type BOMHistory = { id: string; version_id: string; user_id: string; user_full_name: string; action: string; reason?: string; created_at: string };
export type BOMComment = { id: string; version_id: string; product_id?: string; item_id?: string; user_id: string; user_full_name: string; comment_text: string; version_number: number; visible_to: string[]; read_by?: string[]; parent_id?: string; reply_to_text?: string; reply_to_user?: string; created_at: string; updated_at: string };
export type User = { id: string; username: string; fullName?: string; role: string; department?: string };

import type { Express, Request, Response } from "express";
import { query } from "./db/client";
import { authMiddleware, requireRole } from "./middleware";

/**
 * Builds SQL condition for date filtering safely.
 * Uses created_at which contains the true chronological timestamps of system activities.
 * Supports:
 * - Specific months: "month_2026-10", "2026-10", "month_2026-09", etc.
 * - Specific years: "year_2026", "2026", "year_2025", "2025", etc.
 * - Presets: "today", "yesterday", "7days", "this_week", "30days", "this_month", "last_month", "last3months", "90days", "last6months", "this_year", "last_year", "all"
 * - Custom ranges: startDate / endDate
 */
function getDateCondition(
  column: string,
  dateRange?: string,
  startDate?: string,
  endDate?: string,
  paramStartIndex = 1
): { condition: string; params: any[]; nextIndex: number } {
  const params: any[] = [];
  let nextIndex = paramStartIndex;

  const range = (dateRange || "").trim().toLowerCase();

  // 1. Custom Date Range (Explicit startDate or endDate takes precedence)
  if (range === "custom" || startDate || endDate) {
    let cond = "";
    if (startDate) {
      cond += ` AND ${column} >= $${nextIndex}::timestamp`;
      params.push(startDate);
      nextIndex++;
    }
    if (endDate) {
      cond += ` AND ${column} < ($${nextIndex}::date + INTERVAL '1 day')`;
      params.push(endDate);
      nextIndex++;
    }
    if (cond) {
      return { condition: cond, params, nextIndex };
    }
  }

  // 2. Specific Month: e.g. "month_2026-10", "2026-10", "2026_10"
  const monthMatch = range.match(/^(?:month_)?(\d{4})[-_](\d{1,2})$/);
  if (monthMatch) {
    const y = monthMatch[1];
    const m = monthMatch[2].padStart(2, "0");
    const firstDay = `${y}-${m}-01`;
    params.push(firstDay);
    const cond = ` AND ${column} >= $${nextIndex}::date AND ${column} < ($${nextIndex}::date + INTERVAL '1 month')`;
    nextIndex++;
    return { condition: cond, params, nextIndex };
  }

  // 3. Specific Year: e.g. "year_2026", "2026", "year_2025"
  const yearMatch = range.match(/^(?:year_)?(\d{4})$/);
  if (yearMatch) {
    const y = yearMatch[1];
    const firstDay = `${y}-01-01`;
    params.push(firstDay);
    const cond = ` AND ${column} >= $${nextIndex}::date AND ${column} < ($${nextIndex}::date + INTERVAL '1 year')`;
    nextIndex++;
    return { condition: cond, params, nextIndex };
  }

  // 4. Standard Relative Presets
  if (range === "today") {
    return { condition: ` AND ${column} >= CURRENT_DATE`, params: [], nextIndex };
  }
  if (range === "yesterday") {
    return {
      condition: ` AND ${column} >= CURRENT_DATE - INTERVAL '1 day' AND ${column} < CURRENT_DATE`,
      params: [],
      nextIndex,
    };
  }
  if (range === "7days" || range === "this_week") {
    return { condition: ` AND ${column} >= CURRENT_DATE - INTERVAL '7 days'`, params: [], nextIndex };
  }
  if (range === "30days") {
    return { condition: ` AND ${column} >= CURRENT_DATE - INTERVAL '30 days'`, params: [], nextIndex };
  }
  if (range === "this_month") {
    return { condition: ` AND ${column} >= DATE_TRUNC('month', CURRENT_DATE)`, params: [], nextIndex };
  }
  if (range === "last_month") {
    return {
      condition: ` AND ${column} >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND ${column} < DATE_TRUNC('month', CURRENT_DATE)`,
      params: [],
      nextIndex,
    };
  }
  if (range === "last3months" || range === "90days") {
    return { condition: ` AND ${column} >= CURRENT_DATE - INTERVAL '3 months'`, params: [], nextIndex };
  }
  if (range === "last6months") {
    return { condition: ` AND ${column} >= CURRENT_DATE - INTERVAL '6 months'`, params: [], nextIndex };
  }
  if (range === "this_year") {
    return { condition: ` AND ${column} >= DATE_TRUNC('year', CURRENT_DATE)`, params: [], nextIndex };
  }
  if (range === "last_year") {
    return {
      condition: ` AND ${column} >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year') AND ${column} < DATE_TRUNC('year', CURRENT_DATE)`,
      params: [],
      nextIndex,
    };
  }

  // Default: "all" or unrecognized -> All Time (no date restriction)
  return { condition: "", params: [], nextIndex };
}

export async function registerReportsRoutes(app: Express) {
  console.log("[reports] Registering Reports routes (Admin & Software Team)...");

  // 1. Filter Options (Projects, Vendors, Categories, Statuses)
  app.get("/api/reports/filters", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const [projectsRes, vendorsRes, categoriesRes] = await Promise.all([
        query(`SELECT id, name, client, status FROM boq_projects ORDER BY name ASC`),
        query(`SELECT id, name, city, vendor_category FROM shops ORDER BY name ASC`),
        query(`SELECT DISTINCT category FROM materials WHERE category IS NOT NULL AND category != '' ORDER BY category ASC`)
      ]);

      const statuses = [
        { id: "draft", label: "Draft" },
        { id: "pending_approval", label: "Pending Approval" },
        { id: "approved", label: "Approved" },
        { id: "ordered", label: "Ordered" },
        { id: "delivered", label: "Delivered" },
        { id: "rejected", label: "Rejected" },
      ];

      res.json({
        projects: projectsRes.rows,
        vendors: vendorsRes.rows,
        categories: categoriesRes.rows.map(r => r.category),
        statuses,
      });
    } catch (err: any) {
      console.error("[reports] /api/reports/filters error:", err);
      res.status(500).json({ error: "Failed to load report filters", details: err.message });
    }
  });

  // 2. Executive Dashboard Summary
  app.get("/api/reports/dashboard-summary", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const { dateRange = "last3months", startDate, endDate, projectId, vendorId } = req.query as Record<string, string>;

      // 1. KPI query parameters and filters
      const kpiParams: any[] = [];
      let bpProjectFilter = "";
      if (projectId && projectId !== "all") {
        kpiParams.push(projectId);
        bpProjectFilter = ` WHERE id = $${kpiParams.length}`;
      }

      const dateFilterKpi = getDateCondition("po.created_at", dateRange, startDate, endDate, kpiParams.length + 1);
      kpiParams.push(...dateFilterKpi.params);

      let poProjectFilterKpi = "";
      if (projectId && projectId !== "all") {
        kpiParams.push(projectId);
        poProjectFilterKpi = ` AND po.project_id = $${kpiParams.length}`;
      }

      let poVendorFilterKpi = "";
      if (vendorId && vendorId !== "all") {
        kpiParams.push(vendorId);
        poVendorFilterKpi = ` AND po.vendor_id = $${kpiParams.length}`;
      }

      // 2. Sub-chart parameters and filters (for monthly, status, top lists)
      const subParams: any[] = [];
      const dateFilterSub = getDateCondition("po.created_at", dateRange, startDate, endDate, 1);
      subParams.push(...dateFilterSub.params);

      let poProjectFilterSub = "";
      if (projectId && projectId !== "all") {
        subParams.push(projectId);
        poProjectFilterSub = ` AND po.project_id = $${subParams.length}`;
      }

      let poVendorFilterSub = "";
      if (vendorId && vendorId !== "all") {
        subParams.push(vendorId);
        poVendorFilterSub = ` AND po.vendor_id = $${subParams.length}`;
      }

      // High-level aggregates
      const [kpiRes, monthlyRes, poStatusRes, topVendorsRes, topProjectsRes, exceedRes] = await Promise.all([
        query(`
          SELECT 
            (SELECT COUNT(*) FROM boq_projects ${bpProjectFilter}) as total_projects,
            (SELECT COUNT(*) FROM boq_projects ${bpProjectFilter ? bpProjectFilter + " AND" : "WHERE"} LOWER(status) NOT IN ('completed', 'cancelled', 'trash')) as active_projects,
            (SELECT COALESCE(SUM(NULLIF(regexp_replace(budget, '[^0-9.]', '', 'g'), '')::numeric), 0) FROM boq_projects ${bpProjectFilter}) as total_budget,
            (SELECT COUNT(*) FROM purchase_orders po WHERE 1=1 ${dateFilterKpi.condition} ${poProjectFilterKpi} ${poVendorFilterKpi}) as filtered_po_count,
            (SELECT COALESCE(SUM(po.total), 0) FROM purchase_orders po WHERE 1=1 ${dateFilterKpi.condition} ${poProjectFilterKpi} ${poVendorFilterKpi}) as filtered_po_total,
            (SELECT COALESCE(SUM(po.total), 0) FROM purchase_orders po WHERE po.status = 'delivered' ${dateFilterKpi.condition} ${poProjectFilterKpi} ${poVendorFilterKpi}) as delivered_po_total,
            (SELECT COUNT(DISTINCT po.vendor_id) FROM purchase_orders po WHERE 1=1 ${dateFilterKpi.condition} ${poProjectFilterKpi}) as total_vendors,
            (SELECT COUNT(*) FROM materials) as total_materials,
            (SELECT COUNT(*) FROM proposals) as total_proposals
        `, kpiParams),

        // Monthly Spend Trend
        query(`
          SELECT 
            TO_CHAR(po.created_at, 'YYYY-MM') as month,
            COUNT(*) as po_count,
            COALESCE(SUM(po.total), 0) as amount
          FROM purchase_orders po
          WHERE 1=1 ${dateFilterSub.condition} ${poProjectFilterSub} ${poVendorFilterSub}
          GROUP BY TO_CHAR(po.created_at, 'YYYY-MM')
          ORDER BY month ASC
        `, subParams),

        // PO Status distribution
        query(`
          SELECT 
            COALESCE(po.status, 'draft') as status,
            COUNT(*) as count,
            COALESCE(SUM(po.total), 0) as total_amount
          FROM purchase_orders po
          WHERE 1=1 ${dateFilterSub.condition} ${poProjectFilterSub} ${poVendorFilterSub}
          GROUP BY COALESCE(po.status, 'draft')
          ORDER BY total_amount DESC
        `, subParams),

        // Top 5 Vendors by Spend
        query(`
          SELECT 
            po.vendor_name,
            COUNT(*) as po_count,
            COALESCE(SUM(po.total), 0) as total_spend
          FROM purchase_orders po
          WHERE po.vendor_name IS NOT NULL AND po.vendor_name != ''
          ${dateFilterSub.condition} ${poProjectFilterSub} ${poVendorFilterSub}
          GROUP BY po.vendor_name
          ORDER BY total_spend DESC
          LIMIT 5
        `, subParams),

        // Top 5 Projects by Spend
        query(`
          SELECT 
            COALESCE(p.name, po.project_name, 'Unknown Project') as project_name,
            COUNT(po.id) as po_count,
            COALESCE(SUM(po.total), 0) as total_spend
          FROM purchase_orders po
          LEFT JOIN boq_projects p ON p.id = po.project_id
          WHERE 1=1 ${dateFilterSub.condition} ${poProjectFilterSub} ${poVendorFilterSub}
          GROUP BY COALESCE(p.name, po.project_name, 'Unknown Project')
          ORDER BY total_spend DESC
          LIMIT 5
        `, subParams),

        // Budget exceed events count
        query(`
          SELECT COUNT(*) as exceed_count, COALESCE(SUM(exceeded_amount), 0) as total_exceeded
          FROM budget_exceed_logs
          ${projectId && projectId !== "all" ? "WHERE project_id = $1" : ""}
        `, projectId && projectId !== "all" ? [projectId] : [])
      ]);

      res.json({
        kpis: kpiRes.rows[0],
        monthlySpend: monthlyRes.rows,
        poStatusDistribution: poStatusRes.rows,
        topVendors: topVendorsRes.rows,
        topProjects: topProjectsRes.rows,
        budgetExceedSummary: exceedRes.rows[0]
      });
    } catch (err: any) {
      console.error("[reports] /api/reports/dashboard-summary error:", err);
      res.status(500).json({ error: "Failed to generate dashboard summary", details: err.message });
    }
  });

  // 3. Budget vs Actual Spend Report
  app.get("/api/reports/financial/budget-vs-actual", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const { projectId, search, dateRange, startDate, endDate } = req.query as Record<string, string>;
      const dateFilter = getDateCondition("po.created_at", dateRange, startDate, endDate, 1);
      
      let whereClause = "WHERE 1=1";
      const params = [...dateFilter.params];

      if (projectId && projectId !== "all") {
        whereClause += ` AND p.id = $${params.length + 1}`;
        params.push(projectId);
      }
      if (search) {
        whereClause += ` AND (p.name ILIKE $${params.length + 1} OR p.client ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const sql = `
        SELECT 
          p.id,
          p.name as project_name,
          p.client as client_name,
          p.status as project_status,
          p.location,
          p.project_sqft,
          COALESCE(NULLIF(regexp_replace(p.budget, '[^0-9.]', '', 'g'), '')::numeric, 0) as allocated_budget,
          COALESCE(po_agg.actual_po_spend, 0) as actual_po_spend,
          COALESCE(po_agg.po_count, 0) as po_count,
          COALESCE(po_agg.delivered_spend, 0) as delivered_spend,
          COALESCE(po_agg.pending_spend, 0) as pending_spend,
          COALESCE(exceed_agg.exceed_count, 0) as exceed_count,
          COALESCE(exceed_agg.total_exceeded, 0) as total_exceeded,
          (COALESCE(NULLIF(regexp_replace(p.budget, '[^0-9.]', '', 'g'), '')::numeric, 0) - COALESCE(po_agg.actual_po_spend, 0)) as variance_amount,
          CASE 
            WHEN COALESCE(NULLIF(regexp_replace(p.budget, '[^0-9.]', '', 'g'), '')::numeric, 0) > 0 
            THEN ROUND((COALESCE(po_agg.actual_po_spend, 0) / NULLIF(regexp_replace(p.budget, '[^0-9.]', '', 'g'), '')::numeric) * 100, 2)
            ELSE 0 
          END as budget_utilization_pct
        FROM boq_projects p
        LEFT JOIN (
          SELECT 
            po.project_id,
            SUM(po.total) as actual_po_spend,
            COUNT(po.id) as po_count,
            SUM(CASE WHEN po.status = 'delivered' THEN po.total ELSE 0 END) as delivered_spend,
            SUM(CASE WHEN po.status != 'delivered' AND po.status != 'rejected' THEN po.total ELSE 0 END) as pending_spend
          FROM purchase_orders po
          WHERE 1=1 ${dateFilter.condition}
          GROUP BY po.project_id
        ) po_agg ON po_agg.project_id = p.id
        LEFT JOIN (
          SELECT 
            project_id,
            COUNT(*) as exceed_count,
            SUM(exceeded_amount) as total_exceeded
          FROM budget_exceed_logs
          GROUP BY project_id
        ) exceed_agg ON exceed_agg.project_id = p.id
        ${whereClause}
        ORDER BY actual_po_spend DESC
      `;

      const result = await query(sql, params);
      res.json({ records: result.rows });
    } catch (err: any) {
      console.error("[reports] /api/reports/financial/budget-vs-actual error:", err);
      res.status(500).json({ error: "Failed to generate Budget vs Actual report", details: err.message });
    }
  });

  // 4. Purchase Orders Register & Detailed Report
  app.get("/api/reports/procurement/purchase-orders", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const {
        dateRange = "last3months",
        startDate,
        endDate,
        projectId,
        vendorId,
        status,
        search,
        limit = "500",
        offset = "0"
      } = req.query as Record<string, string>;

      const dateFilter = getDateCondition("po.created_at", dateRange, startDate, endDate, 1);
      let whereClause = `WHERE 1=1 ${dateFilter.condition}`;
      const params = [...dateFilter.params];

      if (projectId && projectId !== "all") {
        whereClause += ` AND po.project_id = $${params.length + 1}`;
        params.push(projectId);
      }
      if (vendorId && vendorId !== "all") {
        whereClause += ` AND po.vendor_id = $${params.length + 1}`;
        params.push(vendorId);
      }
      if (status && status !== "all") {
        whereClause += ` AND po.status = $${params.length + 1}`;
        params.push(status);
      }
      if (search) {
        whereClause += ` AND (po.po_number ILIKE $${params.length + 1} OR COALESCE(p.name, po.project_name) ILIKE $${params.length + 1} OR po.vendor_name ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const listSql = `
        SELECT 
          po.id,
          po.po_number,
          po.project_id,
          COALESCE(p.name, po.project_name, 'N/A') as project_name,
          po.vendor_id,
          po.vendor_name,
          po.subtotal,
          po.tax,
          po.total,
          po.status,
          po.payment_status,
          po.delivery_status,
          po.po_date,
          po.delivery_date,
          po.requested_by,
          po.approved_by,
          po.zoho_sync_status,
          po.created_at,
          COALESCE(item_counts.total_items, 0) as total_items
        FROM purchase_orders po
        LEFT JOIN boq_projects p ON p.id = po.project_id
        LEFT JOIN (
          SELECT po_id, COUNT(*) as total_items
          FROM purchase_order_items
          GROUP BY po_id
        ) item_counts ON item_counts.po_id = po.id
        ${whereClause}
        ORDER BY po.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const summarySql = `
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(po.total), 0) as grand_total,
          COALESCE(SUM(po.subtotal), 0) as total_subtotal,
          COALESCE(SUM(po.tax), 0) as total_tax,
          COALESCE(AVG(po.total), 0) as avg_po_value
        FROM purchase_orders po
        LEFT JOIN boq_projects p ON p.id = po.project_id
        ${whereClause}
      `;

      const [listRes, summaryRes] = await Promise.all([
        query(listSql, [...params, limit, offset]),
        query(summarySql, params)
      ]);

      res.json({
        records: listRes.rows,
        summary: summaryRes.rows[0],
      });
    } catch (err: any) {
      console.error("[reports] /api/reports/procurement/purchase-orders error:", err);
      res.status(500).json({ error: "Failed to generate PO report", details: err.message });
    }
  });

  // 5. Vendor Spend & Procurement Distribution
  app.get("/api/reports/procurement/vendor-spend", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const {
        dateRange = "last3months",
        startDate,
        endDate,
        projectId,
        vendorId,
        search
      } = req.query as Record<string, string>;

      const dateFilter = getDateCondition("po.created_at", dateRange, startDate, endDate, 1);
      let whereClause = `WHERE po.vendor_name IS NOT NULL AND po.vendor_name != '' ${dateFilter.condition}`;
      const params = [...dateFilter.params];

      if (projectId && projectId !== "all") {
        whereClause += ` AND po.project_id = $${params.length + 1}`;
        params.push(projectId);
      }
      if (vendorId && vendorId !== "all") {
        whereClause += ` AND po.vendor_id = $${params.length + 1}`;
        params.push(vendorId);
      }
      if (search) {
        whereClause += ` AND po.vendor_name ILIKE $${params.length + 1}`;
        params.push(`%${search}%`);
      }

      const sql = `
        SELECT 
          po.vendor_id,
          po.vendor_name,
          s.city,
          s.state,
          s.vendor_category,
          s.rating,
          s.gstno,
          COUNT(po.id) as total_orders,
          COALESCE(SUM(po.total), 0) as total_spent,
          COALESCE(AVG(po.total), 0) as avg_order_value,
          MIN(po.created_at) as first_order_date,
          MAX(po.created_at) as last_order_date,
          SUM(CASE WHEN po.status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
          SUM(CASE WHEN po.status = 'approved' OR po.status = 'ordered' THEN 1 ELSE 0 END) as active_orders
        FROM purchase_orders po
        LEFT JOIN shops s ON s.id::text = po.vendor_id::text
        ${whereClause}
        GROUP BY po.vendor_id, po.vendor_name, s.city, s.state, s.vendor_category, s.rating, s.gstno
        ORDER BY total_spent DESC
      `;

      const result = await query(sql, params);
      res.json({ records: result.rows });
    } catch (err: any) {
      console.error("[reports] /api/reports/procurement/vendor-spend error:", err);
      res.status(500).json({ error: "Failed to generate vendor spend report", details: err.message });
    }
  });

  // 6. Rate Reduction & Cost Savings History
  app.get("/api/reports/procurement/rate-savings", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const { dateRange, startDate, endDate, projectId } = req.query as Record<string, string>;
      const dateFilter = getDateCondition("r.changed_at", dateRange, startDate, endDate, 1);
      let whereClause = `WHERE 1=1 ${dateFilter.condition}`;
      const params = [...dateFilter.params];

      if (projectId && projectId !== "all") {
        whereClause += ` AND r.po_id IN (SELECT id FROM purchase_orders WHERE project_id = $${params.length + 1})`;
        params.push(projectId);
      }

      const sql = `
        SELECT 
          r.id,
          r.po_number,
          r.project_name,
          r.vendor_name,
          r.item_name,
          r.original_rate,
          r.reduced_rate,
          r.reduction_amount,
          r.reason,
          r.status,
          r.changed_by_name,
          r.changed_at,
          r.approved_by_name,
          r.approved_at,
          r.admin_comments
        FROM po_rate_change_history r
        ${whereClause}
        ORDER BY r.changed_at DESC
      `;

      const result = await query(sql, params);
      const totalSavings = result.rows
        .filter(r => r.status === "approved")
        .reduce((sum, r) => sum + Number(r.reduction_amount || 0), 0);

      res.json({ records: result.rows, totalSavings });
    } catch (err: any) {
      console.error("[reports] /api/reports/procurement/rate-savings error:", err);
      res.status(500).json({ error: "Failed to generate Rate Savings report", details: err.message });
    }
  });

  // 7. PO Requests vs Fulfillment Pipeline
  app.get("/api/reports/procurement/po-requests", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const { status, projectId, dateRange, startDate, endDate } = req.query as Record<string, string>;
      const dateFilter = getDateCondition("r.created_at", dateRange, startDate, endDate, 1);
      let whereClause = `WHERE 1=1 ${dateFilter.condition}`;
      const params = [...dateFilter.params];

      if (status && status !== "all") {
        whereClause += ` AND r.status = $${params.length + 1}`;
        params.push(status);
      }
      if (projectId && projectId !== "all") {
        whereClause += ` AND r.project_id = $${params.length + 1}`;
        params.push(projectId);
      }

      const sql = `
        SELECT 
          r.id,
          r.project_id,
          r.project_name,
          r.requester_name,
          r.employee_id,
          r.department,
          r.status,
          r.created_at,
          r.updated_at,
          COALESCE(item_agg.item_count, 0) as items_count,
          COALESCE(item_agg.total_qty, 0) as total_qty
        FROM po_requests r
        LEFT JOIN (
          SELECT po_request_id, COUNT(*) as item_count, SUM(qty) as total_qty
          FROM po_request_items
          GROUP BY po_request_id
        ) item_agg ON item_agg.po_request_id = r.id
        ${whereClause}
        ORDER BY r.created_at DESC
      `;

      const result = await query(sql, params);
      res.json({ records: result.rows });
    } catch (err: any) {
      console.error("[reports] /api/reports/procurement/po-requests error:", err);
      res.status(500).json({ error: "Failed to generate PO Requests report", details: err.message });
    }
  });

  // 8. Project Portfolio Performance & Profitability
  app.get("/api/reports/projects/performance", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const { status, search, projectId, dateRange, startDate, endDate } = req.query as Record<string, string>;
      const dateFilter = getDateCondition("p.created_at", dateRange, startDate, endDate, 1);
      let whereClause = `WHERE 1=1 ${dateFilter.condition}`;
      const params = [...dateFilter.params];

      if (projectId && projectId !== "all") {
        whereClause += ` AND p.id = $${params.length + 1}`;
        params.push(projectId);
      }
      if (status && status !== "all") {
        whereClause += ` AND p.status = $${params.length + 1}`;
        params.push(status);
      }
      if (search) {
        whereClause += ` AND (p.name ILIKE $${params.length + 1} OR p.client ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const sql = `
        SELECT 
          p.id,
          p.name,
          p.client,
          p.location,
          p.status,
          p.sales_person_name,
          p.project_sqft,
          p.created_at,
          COALESCE(NULLIF(regexp_replace(p.budget, '[^0-9.]', '', 'g'), '')::numeric, 0) as allocated_budget,
          COALESCE(latest_ver.version_count, 0) as total_versions,
          COALESCE(latest_ver.final_revenue, 0) as contract_revenue,
          COALESCE(latest_ver.final_profit, 0) as estimated_profit,
          COALESCE(latest_ver.final_margin, 0) as profit_margin_pct,
          COALESCE(po_agg.actual_po_spend, 0) as actual_spend,
          COALESCE(po_agg.po_count, 0) as total_pos
        FROM boq_projects p
        LEFT JOIN (
          SELECT 
            project_id,
            COUNT(id) as version_count,
            MAX(final_revenue) as final_revenue,
            MAX(final_profit) as final_profit,
            MAX(final_margin) as final_margin
          FROM boq_versions
          GROUP BY project_id
        ) latest_ver ON latest_ver.project_id = p.id
        LEFT JOIN (
          SELECT 
            project_id,
            SUM(total) as actual_po_spend,
            COUNT(id) as po_count
          FROM purchase_orders
          GROUP BY project_id
        ) po_agg ON po_agg.project_id = p.id
        ${whereClause}
        ORDER BY p.created_at DESC
      `;

      const result = await query(sql, params);
      res.json({ records: result.rows });
    } catch (err: any) {
      console.error("[reports] /api/reports/projects/performance error:", err);
      res.status(500).json({ error: "Failed to generate project performance report", details: err.message });
    }
  });

  // 9. Material Catalog & Procurement Spend
  app.get("/api/reports/materials/catalog-and-spend", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const { category, search, projectId, dateRange, startDate, endDate, limit = "200" } = req.query as Record<string, string>;
      const dateFilter = getDateCondition("po.created_at", dateRange, startDate, endDate, 1);
      
      let whereClause = "WHERE m.disabled IS NOT TRUE";
      const params: any[] = [...dateFilter.params];

      if (category && category !== "all") {
        whereClause += ` AND m.category = $${params.length + 1}`;
        params.push(category);
      }
      if (search) {
        whereClause += ` AND (m.name ILIKE $${params.length + 1} OR m.code ILIKE $${params.length + 1} OR m.subcategory ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      let poItemProjectFilter = "";
      if (projectId && projectId !== "all") {
        poItemProjectFilter = ` AND po.project_id = $${params.length + 1}`;
        params.push(projectId);
      }

      const sql = `
        SELECT 
          m.id,
          m.name,
          m.code,
          m.category,
          m.subcategory,
          m.brandname,
          m.unit,
          m.rate as catalog_rate,
          m.hsn_code,
          m.sac_code,
          s.name as vendor_name,
          COALESCE(po_spend.total_qty_bought, 0) as total_qty_bought,
          COALESCE(po_spend.total_amount_spent, 0) as total_amount_spent,
          COALESCE(po_spend.order_count, 0) as order_count
        FROM materials m
        LEFT JOIN shops s ON s.id = m.shop_id
        LEFT JOIN (
          SELECT 
            poi.material_id,
            SUM(poi.qty) as total_qty_bought,
            SUM(poi.amount) as total_amount_spent,
            COUNT(DISTINCT poi.po_id) as order_count
          FROM purchase_order_items poi
          JOIN purchase_orders po ON po.id = poi.po_id
          WHERE poi.material_id IS NOT NULL AND poi.material_id != ''
          ${dateFilter.condition}
          ${poItemProjectFilter}
          GROUP BY poi.material_id
        ) po_spend ON po_spend.material_id = m.id::text
        ${whereClause}
        ORDER BY total_amount_spent DESC, m.name ASC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await query(sql, params);
      res.json({ records: result.rows });
    } catch (err: any) {
      console.error("[reports] /api/reports/materials/catalog-and-spend error:", err);
      res.status(500).json({ error: "Failed to generate materials report", details: err.message });
    }
  });

  // 10. Client Proposals & Revenue Pipeline
  app.get("/api/reports/sales/proposals", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const { status, search, projectId, dateRange, startDate, endDate } = req.query as Record<string, string>;
      const dateFilter = getDateCondition("p.created_at", dateRange, startDate, endDate, 1);
      let whereClause = `WHERE 1=1 ${dateFilter.condition}`;
      const params = [...dateFilter.params];

      if (projectId && projectId !== "all") {
        whereClause += ` AND p.project_id = $${params.length + 1}`;
        params.push(projectId);
      }
      if (status && status !== "all") {
        whereClause += ` AND p.status = $${params.length + 1}`;
        params.push(status);
      }
      if (search) {
        whereClause += ` AND (p.project_name ILIKE $${params.length + 1} OR p.vendor_name ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const sql = `
        SELECT 
          p.id,
          p.project_id,
          p.project_name,
          p.vendor_name,
          p.version_number,
          p.status,
          p.created_at,
          p.updated_at,
          bp.client as client_name,
          bp.budget as project_budget
        FROM proposals p
        LEFT JOIN boq_projects bp ON bp.id = p.project_id
        ${whereClause}
        ORDER BY p.created_at DESC
      `;

      const result = await query(sql, params);
      res.json({ records: result.rows });
    } catch (err: any) {
      console.error("[reports] /api/reports/sales/proposals error:", err);
      res.status(500).json({ error: "Failed to generate proposals report", details: err.message });
    }
  });

  // 11. Site Reports & Project Progress
  app.get("/api/reports/site/progress", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const { projectId, dateRange, startDate, endDate } = req.query as Record<string, string>;
      const dateFilter = getDateCondition("sr.report_date", dateRange, startDate, endDate, 1);
      let whereClause = `WHERE 1=1 ${dateFilter.condition}`;
      const params = [...dateFilter.params];

      if (projectId && projectId !== "all") {
        whereClause += ` AND sr.project_id = $${params.length + 1}`;
        params.push(projectId);
      }

      const sql = `
        SELECT 
          sr.id,
          sr.project_id,
          sr.project_name,
          sr.user_id,
          u.username as engineer_username,
          u.full_name as engineer_name,
          sr.report_date,
          sr.summary,
          sr.status,
          sr.created_at,
          COALESCE(task_counts.total_tasks, 0) as total_tasks,
          COALESCE(task_counts.completed_tasks, 0) as completed_tasks
        FROM site_reports sr
        LEFT JOIN users u ON u.id::text = sr.user_id::text
        LEFT JOIN (
          SELECT 
            site_report_id,
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'Completed' OR completion_percentage = 100 THEN 1 ELSE 0 END) as completed_tasks
          FROM site_report_tasks
          GROUP BY site_report_id
        ) task_counts ON task_counts.site_report_id = sr.id
        ${whereClause}
        ORDER BY sr.report_date DESC
      `;

      const result = await query(sql, params);
      res.json({ records: result.rows });
    } catch (err: any) {
      console.error("[reports] /api/reports/site/progress error:", err);
      res.status(500).json({ error: "Failed to generate site progress report", details: err.message });
    }
  });

  // 12. System Audit & User Activity
  app.get("/api/reports/audit/activity", authMiddleware, requireRole("admin", "software_team"), async (req: Request, res: Response) => {
    try {
      const { module, action, dateRange = "7days", startDate, endDate, limit = "200" } = req.query as Record<string, string>;
      const dateFilter = getDateCondition("COALESCE(requested_at, created_at)", dateRange, startDate, endDate, 1);
      let whereClause = `WHERE 1=1 ${dateFilter.condition}`;
      const params = [...dateFilter.params];

      if (module && module !== "all") {
        whereClause += ` AND module = $${params.length + 1}`;
        params.push(module);
      }
      if (action && action !== "all") {
        whereClause += ` AND action = $${params.length + 1}`;
        params.push(action);
      }

      const sql = `
        SELECT 
          id,
          COALESCE(username, user_id) as username,
          COALESCE(user_role, role) as role,
          action,
          module,
          COALESCE(description, details) as details,
          page,
          ip_address,
          COALESCE(requested_at, created_at) as created_at
        FROM audit_logs
        ${whereClause}
        ORDER BY COALESCE(requested_at, created_at) DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await query(sql, params);
      res.json({ records: result.rows });
    } catch (err: any) {
      console.error("[reports] /api/reports/audit/activity error:", err);
      res.status(500).json({ error: "Failed to generate audit report", details: err.message });
    }
  });

  console.log("[reports] Reports routes registered successfully ✓");
}

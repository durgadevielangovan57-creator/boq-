import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import { hashPassword } from "./auth";
import bcryptjs from "bcryptjs";
import pg from "pg";
import { pool } from "./db/client";

/* ================= INTERFACE ================= */

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword?(id: string, newPasswordHash: string): Promise<void>;
  getAllUsers?(): Promise<User[]>;
  logActivity?(data: any): Promise<void>;
  getAuditLogs?(): Promise<any[]>;
}

/* ================= POSTGRES STORAGE (SUPABASE) ================= */

export class PostgresStorage implements IStorage {
  private pool: pg.Pool;

  constructor() {
    this.pool = pool;
    console.log("[storage] Using Shared Supabase PostgreSQL Pool");

    // Ensure approval columns exist (best-effort)
    this.ensureUserApprovalColumns().catch((err) => {
      console.warn(
        "[storage] Could not ensure users approval columns:",
        (err as any)?.message || err
      );
    });

    this.ensureShopsColumns().catch((err) => {
      console.warn(
        "[storage] Could not ensure shops columns:",
        (err as any)?.message || err
      );
    });

    this.ensureDeliveryTrackerColumns().catch((err) => {
      console.warn(
        "[storage] Could not ensure delivery tracker columns:",
        (err as any)?.message || err
      );
    });

    this.ensureAuditLogsTable().catch((err) => {
      console.warn(
        "[storage] Could not ensure audit_logs table:",
        (err as any)?.message || err
      );
    });

    // Comment this if you don't want demo users
    this.seedDemoUsers().catch(console.error);
  }

  private async ensureAuditLogsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36),
        username TEXT,
        user_role TEXT,
        action TEXT NOT NULL,
        module TEXT,
        description TEXT,
        metadata JSONB,
        ip_address TEXT,
        requested_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_requested_at ON audit_logs(requested_at)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
    console.log("[storage] audit_logs table verified/created");
  }

  async logActivity(data: {
    userId?: string;
    username?: string;
    userRole?: string;
    action: string;
    module?: string;
    description?: string;
    metadata?: any;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (user_id, username, user_role, action, module, description, metadata, ip_address) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          data.userId || null,
          data.username || null,
          data.userRole || null,
          data.action,
          data.module || null,
          data.description || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.ipAddress || null,
        ]
      );
    } catch (err) {
      console.error("[storage] logActivity failed:", err);
    }
  }

  private async ensureShopsColumns(): Promise<void> {
    await this.pool.query(
      `ALTER TABLE shops ADD COLUMN IF NOT EXISTS vendor_category text`
    );
  }

  private async ensureDeliveryTrackerColumns(): Promise<void> {
    // Purchase orders: fields needed to power the Delivery Tracker feature
    await this.pool.query(
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS dc_number text`
    );
    await this.pool.query(
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS dc_date date`
    );
    await this.pool.query(
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS moved_to_delivery_tracker boolean DEFAULT false`
    );
    await this.pool.query(
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS moved_to_tracker_at timestamptz`
    );
    await this.pool.query(
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS client_delivery_date date`
    );
    await this.pool.query(
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_status text DEFAULT 'pending'`
    );
    await this.pool.query(
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending'`
    );
    await this.pool.query(
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS comparison_status text DEFAULT 'pending'`
    );
    await this.pool.query(
      `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending'`
    );

    // Dedicated delivery-tracker materials table (snapshot of PO items, tracked independently)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS po_delivery_materials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        item_name TEXT NOT NULL,
        description TEXT,
        unit TEXT,
        qty NUMERIC,
        is_delivered BOOLEAN DEFAULT false,
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS idx_po_delivery_materials_po_id ON po_delivery_materials(po_id)`
    );
  }

  private async ensureUserApprovalColumns(): Promise<void> {
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS approved text DEFAULT 'approved'`
    );
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_reason text`
    );
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_categories text`
    );
  }

  private mapDbUser(row: any): User {
    // Map snake_case DB columns -> camelCase app fields
    // (keep all other properties if schema expects them)
    const mapped: any = {
      ...row,
      approvalReason: row.approval_reason ?? row.approvalReason ?? null,
      fullName: row.full_name ?? row.fullName ?? null,
      mobileNumber: row.mobile_number ?? row.mobileNumber ?? null,
      employeeCode: row.employee_code ?? row.employeeCode ?? null,
      companyName: row.company_name ?? row.companyName ?? null,
      gstNumber: row.gst_number ?? row.gstNumber ?? null,
      businessAddress: row.business_address ?? row.businessAddress ?? null,
      vendorCategories: row.vendor_categories ?? row.vendorCategories ?? null,
      createdAt: row.created_at ?? row.createdAt ?? null,
      updatedAt: row.updated_at ?? row.updatedAt ?? null,
    };

    // Ensure approved always has a usable value
    if (mapped.approved == null || mapped.approved === "") {
      mapped.approved = "pending";
    }

    return mapped as User;
  }

  private async seedDemoUsers(): Promise<void> {
    console.log("[storage] Initializing demo users...");

    const demoUsers: InsertUser[] = [
      { username: "admin@example.com", password: "DemoPass123!", role: "admin" },
      {
        username: "software@example.com",
        password: "DemoPass123!",
        role: "software_team",
      },
      {
        username: "purchase@example.com",
        password: "DemoPass123!",
        role: "purchase_team",
      },
      // New demo roles
      {
        username: "presales@example.com",
        password: "DemoPass123!",
        role: "pre_sales",
      },
      {
        username: "contractor@example.com",
        password: "DemoPass123!",
        role: "contractor",
      },
      { username: "user@example.com", password: "DemoPass123!", role: "user" },
      {
        username: "supplier@example.com",
        password: "DemoPass123!",
        role: "supplier",
      },
      {
        username: "kamali@ctint.in",
        password: "admin123",
        role: "product_manager",
      },
    ];

    for (const u of demoUsers) {
      const existing = await this.getUserByUsername(u.username);
      if (!existing) {
        await this.createUser(u);
        console.log(`[storage] Seeded ${u.username}`);
      }
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.pool.query(
      `
      SELECT
        id,
        username,
        password,
        role,
        approved,
        approval_reason,
        full_name,
        mobile_number,
        department,
        employee_code,
        company_name,
        gst_number,
        business_address,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      `,
      [id]
    );

    if (!result.rows[0]) {
      return undefined;
    }
    return this.mapDbUser(result.rows[0]);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.pool.query(
      `
      SELECT
        id,
        username,
        password,
        role,
        approved,
        approval_reason,
        full_name,
        mobile_number,
        department,
        employee_code,
        company_name,
        gst_number,
        business_address,
        created_at,
        updated_at
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    if (!result.rows[0]) {
      return undefined;
    }
    return this.mapDbUser(result.rows[0]);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await hashPassword(user.password);

    // suppliers must start pending, everyone else approved
    const approved = "approved";

    // Ensure columns exist (in case first run)
    await this.ensureUserApprovalColumns();

    const insertResult = await this.pool.query(
      `
      INSERT INTO users (
        id,
        username,
        password,
        role,
        approved,
        approval_reason,
        full_name,
        mobile_number,
        department,
        employee_code,
        company_name,
        gst_number,
        business_address
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING
        id,
        username,
        password,
        role,
        approved,
        approval_reason,
        full_name,
        mobile_number,
        department,
        employee_code,
        company_name,
        gst_number,
        business_address,
        created_at,
        updated_at
      `,
      [
        id,
        user.username,
        hashedPassword,
        user.role || "user",
        approved,
        (user as any).approvalReason ?? null,
        (user as any).fullName ?? null,
        (user as any).mobileNumber ?? null,
        (user as any).department ?? null,
        (user as any).employeeCode ?? null,
        (user as any).companyName ?? null,
        (user as any).gstNumber ?? null,
        (user as any).businessAddress ?? null,
      ]
    );

    return this.mapDbUser(insertResult.rows[0]);
  }

  async updateUserPassword(id: string, newPasswordHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET password = $1 WHERE id = $2`,
      [newPasswordHash, id]
    );
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.pool.query(
      `
      SELECT
        id,
        username,
        password,
        role,
        approved,
        approval_reason,
        full_name,
        mobile_number,
        department,
        employee_code,
        company_name,
        gst_number,
        business_address,
        created_at,
        updated_at
      FROM users
      `
    );
    return result.rows.map((r) => this.mapDbUser(r));
  }

  async getAuditLogs(): Promise<any[]> {
    const result = await this.pool.query(
      "SELECT id::text, user_id, username, user_role, action, module, description, metadata, ip_address, requested_at FROM audit_logs ORDER BY requested_at DESC LIMIT 1000"
    );
    return result.rows;
  }
}

/* ================= IN-MEMORY STORAGE ================= */

export class MemStorage implements IStorage {
  private users = new Map<string, User>();

  constructor() {
    this.seedDemoUsers();
  }

  private seedDemoUsers(): void {
    const demoUsers: InsertUser[] = [
      { username: "admin@example.com", password: "DemoPass123!", role: "admin" },
      { username: "user@example.com", password: "DemoPass123!", role: "user" },
      // ensure demo presales/contractor exist for mem storage too
      { username: "presales@example.com", password: "DemoPass123!", role: "pre_sales" },
      { username: "contractor@example.com", password: "DemoPass123!", role: "contractor" },
      { username: "kamali@ctint.in", password: "admin123", role: "product_manager" },
    ];

    for (const u of demoUsers) {
      const id = randomUUID();
      const hashed = bcryptjs.hashSync(u.password, 10);
      const approved = u.role === "supplier" ? "pending" : "approved";

      this.users.set(id, {
        id,
        username: u.username,
        password: hashed,
        role: u.role || "user",
        approved,
        approvalReason: null,
        fullName: null,
        mobileNumber: null,
        department: null,
        employeeCode: null,
        companyName: null,
        gstNumber: null,
        businessAddress: null,
        createdAt: null,
      } as any);
    }
  }

  async getUser(id: string) {
    return this.users.get(id);
  }

  async getUserByUsername(username: string) {
    return [...this.users.values()].find((u) => u.username === username);
  }

  async updateUserPassword(id: string, newPasswordHash: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.password = newPasswordHash;
      this.users.set(id, user);
    }
  }

  async getAllUsers() {
    return [...this.users.values()];
  }

  // suppliers start pending
  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const hashed = await hashPassword(user.password);

    const approved = "approved";

    const newUser: User = {
      id,
      username: user.username,
      password: hashed,
      role: user.role || "user",
      approved,
      approvalReason: (user as any).approvalReason ?? null,
      fullName: (user as any).fullName ?? null,
      mobileNumber: (user as any).mobileNumber ?? null,
      department: (user as any).department ?? null,
      employeeCode: (user as any).employeeCode ?? null,
      companyName: (user as any).companyName ?? null,
      gstNumber: (user as any).gstNumber ?? null,
      businessAddress: (user as any).businessAddress ?? null,
      createdAt: null,
    } as any;

    this.users.set(id, newUser);
    return newUser;
  }

  private auditLogs: any[] = [];
  async logActivity(data: any): Promise<void> {
    this.auditLogs.push({
      id: randomUUID(),
      requested_at: new Date(),
      ...data
    });
    if (this.auditLogs.length > 1000) this.auditLogs.shift();
  }

  async getAuditLogs(): Promise<any[]> {
    return [...this.auditLogs].reverse();
  }
}

/* ================= EXPORT ================= */

const storageKind = process.env.STORAGE || "postgres";

export const storage: IStorage =
  storageKind === "postgres" ? new PostgresStorage() : new MemStorage();
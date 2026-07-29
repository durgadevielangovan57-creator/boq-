import { query } from "./db/client";
import { randomUUID } from "crypto";

export interface ArchiveItem {
  id: string;
  module: string;
  originId: string;
  data: any;
  status: "archived" | "trashed";
  archivedAt: string | null;
  trashedAt: string | null;
}

export class ArchiveService {
  private archivedCache: Record<string, { timestamp: number; data: string[] }> = {};
  private trashedCache: Record<string, { timestamp: number; data: string[] }> = {};
  private readonly CACHE_TTL = 30000; // 30 seconds

  private clearCache(module?: string) {
    if (module) {
      delete this.archivedCache[module];
      delete this.trashedCache[module];
    } else {
      this.archivedCache = {};
      this.trashedCache = {};
    }
  }

  /**
   * Returns an array of origin IDs that are archived for a specific module
   */
  public async getArchivedItemIds(module: string): Promise<string[]> {
    const now = Date.now();
    if (this.archivedCache[module] && now - this.archivedCache[module].timestamp < this.CACHE_TTL) {
      return this.archivedCache[module].data;
    }
    const result = await query(
      `SELECT origin_id FROM archive_records WHERE module = $1 AND status = 'archived'`,
      [module]
    );
    const data = result.rows.map((r: any) => r.origin_id);
    this.archivedCache[module] = { timestamp: now, data };
    return data;
  }

  /**
   * Returns an array of origin IDs that are trashed for a specific module
   */
  public async getTrashedItemIds(module: string): Promise<string[]> {
    const now = Date.now();
    if (this.trashedCache[module] && now - this.trashedCache[module].timestamp < this.CACHE_TTL) {
      return this.trashedCache[module].data;
    }
    const result = await query(
      `SELECT origin_id FROM archive_records WHERE module = $1 AND status = 'trashed'`,
      [module]
    );
    const data = result.rows.map((r: any) => r.origin_id);
    this.trashedCache[module] = { timestamp: now, data };
    return data;
  }

  public async getArchived(): Promise<ArchiveItem[]> {
    const result = await query(
      `SELECT * FROM archive_records WHERE status = 'archived' ORDER BY archived_at DESC`
    );
    return result.rows.map(this.mapRecordToItem);
  }

  public async getTrashed(): Promise<ArchiveItem[]> {
    const result = await query(
      `SELECT * FROM archive_records WHERE status = 'trashed' ORDER BY trashed_at DESC`
    );
    return result.rows.map(this.mapRecordToItem);
  }

  /**
   * Archives an item explicitly (replacing standard delete)
   */
  public async archiveItem(moduleName: string, originId: string, data: any): Promise<ArchiveItem> {
    // If it already exists, update it
    const existing = await query(
      `SELECT id FROM archive_records WHERE module = $1 AND origin_id = $2 LIMIT 1`,
      [moduleName, originId]
    );

    if (existing.rows.length > 0) {
      const updated = await query(
        `UPDATE archive_records SET status = 'archived', archived_at = NOW(), trashed_at = NULL, data = $1
         WHERE id = $2 RETURNING *`,
        [JSON.stringify(data), existing.rows[0].id]
      );
      this.clearCache(moduleName);
      return this.mapRecordToItem(updated.rows[0]);
    }

    const id = randomUUID();
    const inserted = await query(
      `INSERT INTO archive_records (id, module, origin_id, data, status, archived_at, trashed_at)
       VALUES ($1, $2, $3, $4, 'archived', NOW(), NULL) RETURNING *`,
      [id, moduleName, originId, JSON.stringify(data)]
    );

    this.clearCache(moduleName);
    return this.mapRecordToItem(inserted.rows[0]);
  }

  /**
   * Moves an item from "Archive" to "Trash"
   */
  public async trashArchiveItem(id: string): Promise<ArchiveItem | null> {
    const updated = await query(
      `UPDATE archive_records SET status = 'trashed', trashed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    this.clearCache();
    return updated.rows.length > 0 ? this.mapRecordToItem(updated.rows[0]) : null;
  }

  /**
   * Restores an item back to its origin module (removes the archive entry)
   */
  public async restoreArchiveItem(id: string): Promise<boolean> {
    const deleted = await query(
      `DELETE FROM archive_records WHERE id = $1 RETURNING id`,
      [id]
    );
    this.clearCache();
    return deleted.rows.length > 0;
  }

  /**
   * Restores an item by its original database ID and module name
   */
  public async restoreByOriginId(moduleName: string, originId: string): Promise<boolean> {
    const deleted = await query(
      `DELETE FROM archive_records WHERE module = $1 AND origin_id = $2 RETURNING id`,
      [moduleName, originId]
    );
    this.clearCache(moduleName);
    return deleted.rows.length > 0;
  }

  /**
   * Permanently deletes an archive entry, returning the item so the caller
   * can also cascade-delete from the actual DB tables.
   */
  public async permanentlyDelete(id: string): Promise<ArchiveItem | null> {
    const deleted = await query(
      `DELETE FROM archive_records WHERE id = $1 RETURNING *`,
      [id]
    );
    this.clearCache();
    return deleted.rows.length > 0 ? this.mapRecordToItem(deleted.rows[0]) : null;
  }

  private mapRecordToItem(record: any): ArchiveItem {
    let parsedData = {};
    try {
      if (record.data) parsedData = JSON.parse(record.data);
    } catch (e) {
      console.error("Failed to parse archive data for id", record.id);
    }

    return {
      id: record.id,
      module: record.module,
      originId: record.origin_id,
      data: parsedData,
      status: record.status as "archived" | "trashed",
      archivedAt: record.archived_at ? new Date(record.archived_at).toISOString() : null,
      trashedAt: record.trashed_at ? new Date(record.trashed_at).toISOString() : null,
    };
  }
}

export const archiveService = new ArchiveService();

import { query } from "../db/client";
import { convertSketchToBoqItems } from "./sketch_converter";

const FEATURE_FLAG = process.env.FEATURE_BOM_SKETCH_SYNC_ENABLED !== 'false';

const isVersionEditable = async (versionId: string) => {
  try {
    const res = await query("SELECT status, is_locked FROM boq_versions WHERE id = $1 LIMIT 1", [versionId]);
    if (res.rows.length === 0) return false;
    const v = res.rows[0];
    if (v.is_locked) return false;
    if (v.status && ['approved', 'submitted', 'final'].includes(String(v.status))) return false;
    return true;
  } catch (err) {
    console.error("[bom_sketch_sync] isVersionEditable error", err);
    return false;
  }
};

export async function linkVersionToSketchPlan(versionId: string, sketchPlanId: string, userId?: string) {
  if (!FEATURE_FLAG) {
    console.log("[bom_sketch_sync] Feature disabled; skipping link");
    return;
  }
  try {
    const linkId = `bsl-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
    // Enforce 1-to-1 active relationship from BOTH sides:
    // 1. Deactivate any previous BOM links for this Sketch Plan
    await query(`UPDATE bom_sketch_links SET is_active = FALSE WHERE sketch_plan_id = $1`, [sketchPlanId]);
    // 2. Deactivate any previous Sketch Plan links for this BOM Version
    await query(`UPDATE bom_sketch_links SET is_active = FALSE WHERE bom_version_id = $1`, [versionId]);

    await query(
      `INSERT INTO bom_sketch_links (id, bom_version_id, sketch_plan_id, linked_at, is_active, created_by)
       VALUES ($1, $2, $3, NOW(), TRUE, $4)
       ON CONFLICT (bom_version_id, sketch_plan_id) DO UPDATE SET is_active = TRUE, linked_at = NOW(), created_by = $4`,
      [linkId, versionId, sketchPlanId, userId || null]
    );

    // Create mapping entries for any BOQ items that already have sketch_item_id in their table_data
    const itemsRes = await query(`SELECT id, table_data FROM boq_items WHERE version_id = $1`, [versionId]);
    for (const row of itemsRes.rows) {
      let td = row.table_data;
      if (typeof td === 'string') {
        try { td = JSON.parse(td); } catch { td = {}; }
      }
      const sketchItemId = td?.sketch_item_id;
      if (sketchItemId) {
        const mapId = `bm-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
        try {
          await query(
            `INSERT INTO bom_item_sketch_item_map (id, boq_item_id, sketch_item_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (sketch_item_id) DO UPDATE SET boq_item_id = EXCLUDED.boq_item_id, created_at = NOW()`,
            [mapId, row.id, sketchItemId]
          );
        } catch (e) {
          // ignore individual mapping errors
          console.error("[bom_sketch_sync] mapping error:", e);
        }
      }
    }

    console.log(`[bom_sketch_sync] Linked version ${versionId} to sketch ${sketchPlanId}`);
  } catch (err) {
    console.error("[bom_sketch_sync] linkVersionToSketchPlan error", err);
  }
}

export async function syncSketchPlanToBoq(sketchPlanId: string) {
  if (!FEATURE_FLAG) {
    console.log("[bom_sketch_sync] Feature flag disabled, skipping syncSketchPlanToBoq");
    return;
  }
  try {
    console.log(`[bom_sketch_sync] syncSketchPlanToBoq called for sketch: ${sketchPlanId}`);
    const linkRes = await query("SELECT * FROM bom_sketch_links WHERE sketch_plan_id = $1 AND is_active = TRUE ORDER BY linked_at DESC LIMIT 1", [sketchPlanId]);
    if (linkRes.rows.length === 0) {
      console.log(`[bom_sketch_sync] No active link found for sketch ${sketchPlanId}; skipping`);
      return;
    }
    const link = linkRes.rows[0];
    const versionId = link.bom_version_id;
    console.log(`[bom_sketch_sync] Found link to BOM version: ${versionId}`);
    const editable = await isVersionEditable(versionId);
    if (!editable) {
      console.log(`[bom_sketch_sync] Target version ${versionId} not editable; skipping sync`);
      return;
    }

    const verRes = await query("SELECT project_id FROM boq_versions WHERE id = $1 LIMIT 1", [versionId]);
    if (verRes.rows.length === 0) {
      console.log(`[bom_sketch_sync] BOM version ${versionId} not found in boq_versions; skipping`);
      return;
    }
    const projectId = verRes.rows[0].project_id;

    // Convert entire sketch to BOQ-format items and apply per-item diffs
    const boqDatas = await convertSketchToBoqItems(sketchPlanId);
    console.log(`[bom_sketch_sync] convertSketchToBoqItems returned ${boqDatas.length} items`);

    let synced = 0, inserted = 0;
    for (const tData of boqDatas) {
      const sketchItemId = tData.sketch_item_id;
      if (!sketchItemId) {
        console.log(`[bom_sketch_sync] Skipping item with no sketch_item_id: ${tData.product_name}`);
        continue;
      }
      const mapRes = await query(
        `SELECT m.boq_item_id 
         FROM bom_item_sketch_item_map m
         JOIN boq_items b ON m.boq_item_id = b.id
         WHERE m.sketch_item_id = $1 AND b.version_id = $2 LIMIT 1`, 
         [sketchItemId, versionId]
      );
      if (mapRes.rows.length > 0) {
        const boqItemId = mapRes.rows[0].boq_item_id;
        // Update only shared fields: product_name, targetRequiredQty, requiredUnitType, category, remarks
        const existingRes = await query(`SELECT table_data, computed_value FROM boq_items WHERE id = $1 LIMIT 1`, [boqItemId]);
        if (existingRes.rows.length === 0) continue;
        let existing = existingRes.rows[0].table_data;
        const compVal = existingRes.rows[0].computed_value || 0;
        if (typeof existing === 'string') {
          try { existing = JSON.parse(existing); } catch { existing = {}; }
        }
        const newTd = { ...existing };
        newTd.product_name = tData.product_name;
        newTd.targetRequiredQty = tData.targetRequiredQty;
        newTd.requiredUnitType = tData.requiredUnitType;
        newTd.category = tData.category || tData.category_name || newTd.category;
        
        if (tData.remarks !== undefined) newTd.remarks = tData.remarks;
        if (tData.finalize_description) newTd.finalize_description = tData.finalize_description;

        await query(`UPDATE boq_items SET table_data = $1, computed_value = $2 WHERE id = $3`, [JSON.stringify(newTd), compVal, boqItemId]);
        synced++;
      } else {
        // Insert new BOQ item for this sketch item
        const newItemId = `item-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
        console.log(`[bom_sketch_sync] Inserting new BOQ item ${newItemId} for sketch item ${sketchItemId} (${tData.product_name})`);
        await query(
          `INSERT INTO boq_items (id, project_id, estimator, table_data, version_id, user_added, sort_order, computed_value, created_at)
           VALUES ($1, $2, $3, $4, $5, true, $6, $7, NOW())`,
          [newItemId, projectId, (tData.product_name || 'Sketch Item').substring(0,50), JSON.stringify(tData), versionId, 99999, 0]
        );
        const mapId = `bm-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
        try {
          await query(
            `INSERT INTO bom_item_sketch_item_map (id, boq_item_id, sketch_item_id, created_at) VALUES ($1, $2, $3, NOW())
             ON CONFLICT (sketch_item_id) DO UPDATE SET boq_item_id = EXCLUDED.boq_item_id, created_at = NOW()`, 
            [mapId, newItemId, sketchItemId]
          );
        } catch (e) {
          console.error(`[bom_sketch_sync] Failed to insert mapping for ${newItemId} -> ${sketchItemId}`, e);
        }
        inserted++;
      }
    }

    // Cleanup: If there are BOQ items in this version mapped to sketch items that no longer exist, delete them
    const currentSketchItemIds = boqDatas.map((t: any) => t.sketch_item_id).filter(Boolean);
    const existingMappings = await query(`
      SELECT bm.boq_item_id, bm.sketch_item_id 
      FROM bom_item_sketch_item_map bm
      JOIN boq_items bi ON bi.id = bm.boq_item_id
      WHERE bi.version_id = $1
    `, [versionId]);

    let deleted = 0;
    for (const row of existingMappings.rows) {
      if (!currentSketchItemIds.includes(row.sketch_item_id)) {
        console.log(`[bom_sketch_sync] Deleting BOQ item ${row.boq_item_id} because its sketch item ${row.sketch_item_id} is no longer in the plan`);
        await query(`DELETE FROM boq_items WHERE id = $1`, [row.boq_item_id]);
        deleted++;
      }
    }

    console.log(`[bom_sketch_sync] Synced sketch ${sketchPlanId} → BOQ version ${versionId} (updated: ${synced}, inserted: ${inserted}, deleted: ${deleted})`);
  } catch (err) {
    console.error("[bom_sketch_sync] syncSketchPlanToBoq error", err);
  }
}

export async function syncBoqItemToSketch(boqItemId: string, tableData: any) {
  console.log(`[bom_sketch_sync] === syncBoqItemToSketch called for boqItemId=${boqItemId} ===`);
  if (!FEATURE_FLAG) { console.log(`[bom_sketch_sync] FEATURE_FLAG is off, returning`); return; }
  try {
    if (!tableData) {
      const r = await query(`SELECT table_data FROM boq_items WHERE id = $1 LIMIT 1`, [boqItemId]);
      if (r.rows.length === 0) { console.log(`[bom_sketch_sync] No boq_item found for id=${boqItemId}`); return; }
      tableData = r.rows[0].table_data;
      if (typeof tableData === 'string') {
        try { tableData = JSON.parse(tableData); } catch { tableData = {}; }
      }
    }

    let sketchItemId = tableData?.sketch_item_id;
    console.log(`[bom_sketch_sync] tableData.sketch_item_id = ${sketchItemId}`);
    console.log(`[bom_sketch_sync] tableData.targetRequiredQty = ${tableData?.targetRequiredQty}`);
    console.log(`[bom_sketch_sync] tableData.finalize_description = ${tableData?.finalize_description}`);

    if (!sketchItemId) {
      // Try to find it in the mapping table first
      const mapRes = await query(`SELECT sketch_item_id FROM bom_item_sketch_item_map WHERE boq_item_id = $1 LIMIT 1`, [boqItemId]);
      console.log(`[bom_sketch_sync] Mapping table lookup: found ${mapRes.rows.length} rows`);
      if (mapRes.rows.length > 0) {
        sketchItemId = mapRes.rows[0].sketch_item_id;
        console.log(`[bom_sketch_sync] Found sketch_item_id from mapping: ${sketchItemId}`);
      }
    }

    // If this BOQ item has no linked sketch item, but the BOQ version is linked
    // to a sketch plan and the version is editable, create a matching sketch item
    // and mapping so subsequent edits will sync.
    if (!sketchItemId) {
      console.log(`[bom_sketch_sync] No sketch_item_id found, will try to create new sketch item`);
      // Find the BOQ item's version and linked sketch plan
      const itemVerRes = await query(`SELECT version_id FROM boq_items WHERE id = $1 LIMIT 1`, [boqItemId]);
      if (itemVerRes.rows.length === 0) { console.log(`[bom_sketch_sync] No version found for boq_item`); return; }
      const versionId = itemVerRes.rows[0].version_id;
      console.log(`[bom_sketch_sync] versionId = ${versionId}`);
      const linkRes = await query(`SELECT * FROM bom_sketch_links WHERE bom_version_id = $1 AND is_active = TRUE LIMIT 1`, [versionId]);
      if (linkRes.rows.length === 0) { console.log(`[bom_sketch_sync] No active bom_sketch_link found for version ${versionId}`); return; }
      const sketchPlanId = linkRes.rows[0].sketch_plan_id;
      console.log(`[bom_sketch_sync] Linked sketch plan: ${sketchPlanId}`);

      const editable = await isVersionEditable(versionId);
      if (!editable) { console.log(`[bom_sketch_sync] Version ${versionId} is NOT editable, returning`); return; }

      // Create a new sketch_plan_items row mapped from tableData
      const newSketchItemId = `ski-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
      try {
        // Determine next sort_order
        const maxSortRes = await query(`SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM sketch_plan_items WHERE plan_id = $1`, [sketchPlanId]);
        const nextSort = (maxSortRes.rows[0]?.max_sort || 0) + 1;

        const itemName = tableData.product_name || tableData.item_name || tableData.name || null;
        const qty = tableData.targetRequiredQty !== undefined ? tableData.targetRequiredQty : (tableData.qty || 1);
        const unit = tableData.requiredUnitType || tableData.unit || null;
        const category = tableData.category || tableData.category_name || null;
        const remarks = tableData.remarks || null;

        await query(
          `INSERT INTO sketch_plan_items (id, plan_id, item_name, description, length, width, height, qty, unit, remarks, material_id, dimension_unit, assigned_vendor_id, vendor_name, dimensions, assigned_user_id, assigned_user_name, user_task_status, category, sort_order, item_description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'unassigned', $11, $12, NULL, NOW())`,
          [newSketchItemId, sketchPlanId, itemName, tableData.finalize_description || tableData.description || null, null, null, null, qty, unit, remarks, category, nextSort]
        );

        // Insert mapping row
        const mapId = `bm-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
        await query(`INSERT INTO bom_item_sketch_item_map (id, boq_item_id, sketch_item_id, created_at) VALUES ($1, $2, $3, NOW())`, [mapId, boqItemId, newSketchItemId]);

        // Update BOQ item's table_data to include sketch_item_id so further edits will sync
        const updatedTd = { ...(typeof tableData === 'string' ? JSON.parse(tableData) : tableData), sketch_item_id: newSketchItemId };
        await query(`UPDATE boq_items SET table_data = $1, created_at = NOW() WHERE id = $2`, [JSON.stringify(updatedTd), boqItemId]);

        console.log(`[bom_sketch_sync] Created sketch item ${newSketchItemId} for BOQ item ${boqItemId} and linked to plan ${sketchPlanId}`);
      } catch (err) {
        console.error("[bom_sketch_sync] Failed to create sketch item for BOQ item", err);
      }

      return;
    }

    // Ensure version is linked and editable
    const itemVerRes = await query(`SELECT version_id FROM boq_items WHERE id = $1 LIMIT 1`, [boqItemId]);
    if (itemVerRes.rows.length === 0) { console.log(`[bom_sketch_sync] No boq_item row found`); return; }
    const versionId = itemVerRes.rows[0].version_id;
    console.log(`[bom_sketch_sync] versionId = ${versionId}`);
    const linkRes = await query(`SELECT * FROM bom_sketch_links WHERE bom_version_id = $1 AND is_active = TRUE LIMIT 1`, [versionId]);
    if (linkRes.rows.length === 0) { console.log(`[bom_sketch_sync] No active link found for version ${versionId}`); return; }
    const editable = await isVersionEditable(versionId);
    if (!editable) { console.log(`[bom_sketch_sync] Version ${versionId} is NOT editable, skipping update`); return; }

    // Update only fields that exist on both sides: item_name, qty, unit, category, remarks, description
    const updates: any = {};
    if (tableData.product_name !== undefined) updates.item_name = tableData.product_name;
    if (tableData.targetRequiredQty !== undefined) updates.qty = tableData.targetRequiredQty;
    if (tableData.requiredUnitType !== undefined) updates.unit = tableData.requiredUnitType;
    if (tableData.category !== undefined) updates.category = tableData.category;
    
    if (tableData.remarks !== undefined) updates.description = tableData.remarks;
    if (tableData.finalize_description !== undefined) updates.description = updates.description ?? tableData.finalize_description;

    console.log(`[bom_sketch_sync] Updates to apply:`, JSON.stringify(updates));

    const setKeys = Object.keys(updates);
    if (setKeys.length === 0) { console.log(`[bom_sketch_sync] No fields to update, returning`); return; }

    const params = setKeys.map(k => updates[k]);
    const setSql = setKeys.map((k, idx) => `${k} = $${idx+1}`).join(', ');
    const updateSql = `UPDATE sketch_plan_items SET ${setSql} WHERE id = $${setKeys.length+1}`;
    console.log(`[bom_sketch_sync] SQL: ${updateSql}`);
    console.log(`[bom_sketch_sync] Params: ${JSON.stringify([...params, sketchItemId])}`);
    const result = await query(updateSql, [...params, sketchItemId]);
    console.log(`[bom_sketch_sync] Update result rowCount: ${result.rowCount}`);

    console.log(`[bom_sketch_sync] Synced BOQ item ${boqItemId} → sketch ${sketchItemId}`);
  } catch (err) {
    console.error("[bom_sketch_sync] syncBoqItemToSketch error", err);
  }
}

export async function unlinkVersionAndSketch(versionId: string, sketchPlanId: string) {
  if (!FEATURE_FLAG) return;
  try {
    await query(`UPDATE bom_sketch_links SET is_active = FALSE WHERE bom_version_id = $1 AND sketch_plan_id = $2`, [versionId, sketchPlanId]);
    console.log(`[bom_sketch_sync] Unlinked version ${versionId} and sketch ${sketchPlanId}`);
  } catch (err) { console.error("[bom_sketch_sync] unlink error", err); }
}

export default {
  linkVersionToSketchPlan,
  syncSketchPlanToBoq,
  syncBoqItemToSketch,
  unlinkVersionAndSketch
};

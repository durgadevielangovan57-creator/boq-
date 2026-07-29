import { query } from "../db/client";

/**
 * Shared utility to convert Sketch Plan items into BOQ-ready "tableData" objects.
 * This logic mirrors the production load-to-boq flow exactly.
 */
export async function convertSketchToBoqItems(sketchId: string) {
  console.log(`[convertSketchToBoqItems] Processing sketchId: ${sketchId}`);
  // 1. Fetch Sketch Plan Items
  const sketchItemsResult = await query(
    "SELECT * FROM sketch_plan_items WHERE plan_id = $1 ORDER BY sort_order ASC, created_at ASC",
    [sketchId]
  );

  console.log(`[convertSketchToBoqItems] Found ${sketchItemsResult.rows.length} items in DB for sketchId: ${sketchId}`);

  if (sketchItemsResult.rows.length === 0) {
    console.warn(`[convertSketchToBoqItems] No items found for sketchId: ${sketchId}. This might happen if the plan hasn't been saved yet.`);
    throw new Error("Sketch plan has no items in the database. Please save your changes first.");
  }

  // 2. Pre-fetch materials for rate/HSN lookup on manual/unmatched items
  const materialsResult = await query(
    "SELECT m.id, m.name, m.rate, m.unit, m.hsn_code, m.sac_code, m.tax_code_type, m.tax_code_value, m.shop_id, s.name AS shop_name FROM materials m LEFT JOIN shops s ON m.shop_id = s.id"
  );
  const materialsByIdMap = new Map<string, any>();
  const materialsByNameMap = new Map<string, any>();
  materialsResult.rows.forEach((m: any) => {
    if (m.id) materialsByIdMap.set(String(m.id), m);
    const nameKey = (m.name || "").toLowerCase().trim();
    if (nameKey && !materialsByNameMap.has(nameKey)) materialsByNameMap.set(nameKey, m);
  });

  // 3. Prepare BOQ items
  const boqItems = [];

  for (const sItem of sketchItemsResult.rows) {
    const productName = (sItem.item_name || "").trim();
    const sketchQty = (sItem.qty !== null && sItem.qty !== undefined && Number(sItem.qty) > 0)
      ? Number(sItem.qty) : 1;
    const sketchUnit = sItem.unit || "Nos";
    const sketchCategory = sItem.category || "";
    const sketchMaterialId = sItem.material_id ? String(sItem.material_id) : null;

    const dims = [sItem.length, sItem.width, sItem.height]
      .filter((v: any) => v && v !== "0" && v !== "")
      .join(" x ");
    const desc = `${sItem.description || ""} ${dims ? `(Dims: ${dims} ${sItem.dimension_unit || ""})` : ""}`.trim();

    let tableData: any = {
      product_name: productName,
      targetRequiredQty: sketchQty,
      requiredUnitType: sketchUnit,
      category: sketchCategory,
      category_name: sketchCategory,
      sketch_item_id: sItem.id,
      isEngineBased: false,
      step11_items: [],
      materialLines: [],
      finalize_description: desc || productName,
      created_at: new Date().toISOString()
    };

    // --- STEP A: Try Step3 config (modern engine-based product) ---
    const isUUID = (str: string | null) => str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    let configResult: any = null;

    if (sketchMaterialId && isUUID(sketchMaterialId)) {
      const byId = await query(
        "SELECT * FROM product_step3_config WHERE product_id = $1 ORDER BY updated_at DESC LIMIT 1",
        [sketchMaterialId]
      );
      if (byId.rows.length > 0) configResult = byId;
    }

    if (!configResult || configResult.rows.length === 0) {
      const byName = productName ? await query(
        "SELECT * FROM product_step3_config WHERE TRIM(product_name) ILIKE $1 ORDER BY updated_at DESC LIMIT 1",
        [productName]
      ) : { rows: [] };
      if (byName.rows.length > 0) configResult = byName;
    }

    if (configResult && configResult.rows.length > 0) {
      const config = configResult.rows[0];
      const linesResult = await query(
        "SELECT * FROM product_step3_config_items WHERE step3_config_id = $1 ORDER BY id ASC",
        [config.id]
      );

      if (linesResult.rows.length > 0) {
        tableData.isEngineBased = true;
        tableData.product_id = sketchMaterialId || config.product_id;
        tableData.product_name = config.product_name || productName;
        tableData.finalize_description = config.description || desc || tableData.product_name;
        tableData.configBasis = {
          requiredUnitType: config.required_unit_type || "Sqft",
          baseRequiredQty: Number(config.base_required_qty) || 1,
          wastagePctDefault: Number(config.wastage_pct_default || 0)
        };
        tableData.requiredUnitType = config.required_unit_type || "Sqft";

        tableData.materialLines = linesResult.rows.map((line: any) => {
          const rawBaseQty = line.base_qty != null ? line.base_qty : (line.qty != null ? line.qty : null);
          const baseQty = rawBaseQty != null ? Number(rawBaseQty) : 0;
          
          // Live rate lookup
          const liveMat = materialsByIdMap.get(String(line.material_id));
          const supplyRate = liveMat ? Number(liveMat.rate || 0) : Number(line.supply_rate || line.rate || 0);
          
          return {
            id: line.material_id,
            name: line.material_name,
            materialId: line.material_id,
            materialName: line.material_name,
            unit: line.unit,
            baseQty,
            wastagePct: line.wastage_pct != null ? Number(line.wastage_pct) : undefined,
            supplyRate: supplyRate,
            installRate: Number(line.install_rate || 0),
            shop_id: (liveMat ? liveMat.shop_id : null) || line.shop_id,
            shop_name: (liveMat ? liveMat.shop_name : null) || line.shop_name,
            applyWastage: line.apply_wastage !== false,
            applyRounding: line.apply_rounding !== undefined ? !!line.apply_rounding : (line.applyRounding !== undefined ? !!line.applyRounding : true),
            freeze_and_edit: !!(line.freeze_and_edit || line.freezeAndEdit),
            location: sketchCategory,
            category: sketchCategory
          };
        });
        boqItems.push(tableData);
        continue;
      }
    }

    // --- STEP B: Try legacy step11_products fallback ---
    let step11Product: any = null;
    if (sketchMaterialId && isUUID(sketchMaterialId)) {
      const byProdId = await query(
        "SELECT * FROM step11_products WHERE product_id = $1 ORDER BY updated_at DESC LIMIT 1",
        [sketchMaterialId]
      );
      if (byProdId.rows.length > 0) step11Product = byProdId.rows[0];
    }
    if (!step11Product && productName) {
      const byName = await query(
        "SELECT * FROM step11_products WHERE LOWER(TRIM(product_name)) = LOWER(TRIM($1)) ORDER BY updated_at DESC LIMIT 1",
        [productName]
      );
      if (byName.rows.length > 0) step11Product = byName.rows[0];
    }

    if (step11Product) {
      const linesResult = await query(
        "SELECT * FROM step11_product_items WHERE step11_product_id = $1",
        [step11Product.id]
      );

      if (linesResult.rows.length > 0) {
        tableData.isEngineBased = true;
        tableData.product_id = sketchMaterialId || step11Product.product_id || step11Product.id;
        tableData.product_name = step11Product.product_name || productName;
        tableData.configBasis = {
          requiredUnitType: sketchUnit,
          baseRequiredQty: 1,
          wastagePctDefault: 0
        };
        tableData.requiredUnitType = sketchUnit;
        tableData.materialLines = linesResult.rows.map((line: any) => {
          // Live rate lookup
          const liveMat = materialsByIdMap.get(String(line.material_id));
          const supplyRate = liveMat ? Number(liveMat.rate || 0) : Number(line.supply_rate || line.rate || 0);

          return {
            id: line.material_id,
            name: line.material_name,
            materialId: line.material_id,
            materialName: line.material_name,
            unit: line.unit,
            baseQty: Number(line.qty || 0),
            supplyRate: supplyRate,
            installRate: Number(line.install_rate || 0),
            applyWastage: true,
            applyRounding: true, // Default true for legacy
            freeze_and_edit: false,
            location: sketchCategory,
            category: sketchCategory,
            shop_id: liveMat ? liveMat.shop_id : null,
            shop_name: liveMat ? liveMat.shop_name : null
          };
        });
        boqItems.push(tableData);
        continue;
      }
    }

    // --- STEP C: Pure material / manual fallback ---
    const matchedMat = (sketchMaterialId && materialsByIdMap.get(sketchMaterialId))
      || materialsByNameMap.get(productName.toLowerCase().trim());

    let rate = 0, hsn = "", sac = "", taxType = null, taxValue = "";
    if (matchedMat) {
      rate = Number(matchedMat.supply_rate || matchedMat.rate || 0);
      hsn = matchedMat.hsn_code || "";
      sac = matchedMat.sac_code || "";
      taxType = matchedMat.tax_code_type || (hsn ? "hsn" : (sac ? "sac" : null));
      taxValue = matchedMat.tax_code_value || hsn || sac || "";
    }

    tableData.isEngineBased = false;
    tableData.material_id = sketchMaterialId;
    tableData.hsn_code = hsn;
    tableData.sac_code = sac;
    tableData.hsn_sac_type = taxType;
    tableData.hsn_sac_code = taxValue;
    tableData.finalize_qty = sketchQty;
    tableData.finalize_rate = rate;
    tableData.unit = sketchUnit;
    tableData.step11_items = [{
      s_no: 1,
      id: `man-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: productName,
      name: productName,
      description: desc,
      unit: sketchUnit,
      qty: sketchQty,
      supply_rate: rate,
      install_rate: 0,
      rate: rate,
      amount: sketchQty * rate,
      material_id: sketchMaterialId,
      manual: true,
      category: sketchCategory,
      shop_id: (matchedMat ? matchedMat.shop_id : null) || sItem.assigned_vendor_id,
      shop_name: (matchedMat ? matchedMat.shop_name : null) || sItem.vendor_name
    }];

    boqItems.push(tableData);
  }

  return boqItems;
}

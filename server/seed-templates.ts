// This file seeds default material templates if they don't exist
import { query } from "./db/client";
import { randomUUID } from "crypto";

export async function seedMaterialTemplates() {
  try {
    // Check if templates already exist
    const result = await query("SELECT COUNT(*) as count FROM material_templates");
    const count = parseInt(result.rows[0].count);

    if (count > 0) {
      console.log("[seed] Material templates already exist, skipping seed");
      return;
    }

    console.log("[seed] Seeding default material templates...");

    const templates = [
      { name: "Industrial Paint", code: "TPL-PAINT-001", category: "Paint" },
      { name: "Hydraulic Cement", code: "TPL-CEMENT-001", category: "Concrete" },
      { name: "Stainless Steel Bolt M10", code: "TPL-BOLT-M10", category: "Fasteners" },
      { name: "Wooden Door Frame", code: "TPL-DOOR-001", category: "Doors" },
      { name: "Electrical Wire 2.5mm", code: "TPL-WIRE-2.5", category: "Electrical" },
      { name: "PVC Pipe 50mm", code: "TPL-PIPE-50", category: "Plumbing" },
    ];

    for (const template of templates) {
      const id = randomUUID();
      await query(
        `INSERT INTO material_templates (id, name, code, category, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [id, template.name, template.code, template.category]
      );
      console.log(`[seed] Created template: ${template.name}`);
    }

    console.log(`[seed] Successfully seeded ${templates.length} material templates`);
  } catch (err: unknown) {
    console.error("[seed] Error seeding material templates:", err as any);
    // Don't throw - if seeding fails, the app should still work
  }
}

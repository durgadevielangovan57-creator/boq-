import fs from "fs";
import { query } from "./server/db/client";
import { randomUUID } from "crypto";

async function runMigration() {
  const filePath = "deployed_archives.json";
  
  if (!fs.existsSync(filePath)) {
    console.error("==================================================");
    console.error("ERROR: deployed_archives.json not found!");
    console.error("Please create a file named 'deployed_archives.json' in the root directory");
    console.error("and paste the contents of your deployed JSON file into it.");
    console.error("Then run this script again.");
    console.error("==================================================");
    process.exit(1);
  }

  console.log("Reading deployed_archives.json...");
  let records;
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    records = JSON.parse(fileContent);
  } catch (e) {
    console.error("Failed to parse JSON file. Please ensure it is valid JSON.");
    process.exit(1);
  }

  // Handle both array and dictionary formats
  let itemsToInsert: any[] = [];
  if (Array.isArray(records)) {
    itemsToInsert = records;
  } else if (typeof records === "object" && records !== null) {
    for (const [moduleName, moduleItems] of Object.entries(records)) {
      if (Array.isArray(moduleItems)) {
        // If the old format grouped by module, ensure each item has the module attached
        itemsToInsert.push(...moduleItems.map(item => ({ ...item, module: moduleName })));
      }
    }
  }

  console.log(`Found ${itemsToInsert.length} archive records to migrate.`);

  let insertedCount = 0;
  let skippedCount = 0;

  for (const item of itemsToInsert) {
    try {
      const moduleName = item.module || item.moduleName || "unknown";
      const originId = item.originId || item.origin_id || item.id;
      const status = item.status || "archived";
      const data = item.data || item;
      
      // Check if it already exists to avoid duplicates
      const existing = await query(
        "SELECT id FROM archive_records WHERE origin_id = $1 AND module = $2 LIMIT 1",
        [originId, moduleName]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO archive_records (id, module, origin_id, data, status, archived_at, trashed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            item.id || randomUUID(), 
            moduleName, 
            originId, 
            JSON.stringify(data), 
            status,
            item.archivedAt || item.archived_at || new Date().toISOString(),
            item.trashedAt || item.trashed_at || null
          ]
        );
        insertedCount++;
      } else {
        skippedCount++;
      }
    } catch (e) {
      console.error(`Failed to insert item with originId: ${item.originId}`, e);
    }
  }
  
  console.log("==================================================");
  console.log(`Migration Complete!`);
  console.log(`- Successfully inserted: ${insertedCount}`);
  console.log(`- Skipped (already existed): ${skippedCount}`);
  console.log("==================================================");
  process.exit(0);
}

runMigration().catch(console.error);

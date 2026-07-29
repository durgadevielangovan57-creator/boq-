import { query } from './db/client';

export async function seedMaterialCategories(): Promise<void> {
  try {
    console.log('[seed-categories] Creating material_categories table if not exists...');

    await query(`
      CREATE TABLE IF NOT EXISTS material_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255)
      )
    `);

    console.log('[seed-categories] ✓ material_categories table ready');

    console.log('[seed-categories] Creating material_subcategories table if not exists...');

    await query(`
      CREATE TABLE IF NOT EXISTS material_subcategories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255),
        UNIQUE(name, category)
      )
    `);

    console.log('[seed-categories] Migrating products table...');

    // Check if products table has the old schema and migrate it
    try {
      const result = await query(`
        SELECT column_name, is_nullable, data_type
        FROM information_schema.columns
        WHERE table_name = 'products' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);

      const hasCodeColumn = result.rows.some((row: any) => row.column_name === 'code');
      const hasDescriptionColumn = result.rows.some((row: any) => row.column_name === 'description');

      if (hasCodeColumn || hasDescriptionColumn) {
        console.log('[seed-categories] Products table has old schema, migrating...');

        // Rename old table
        await query('ALTER TABLE products RENAME TO products_old');

        // Create new table with simplified schema
        await query(`
          CREATE TABLE products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(255)
          )
        `);

        // Copy data from old table (only name and created_by if they exist)
        try {
          await query(`
            INSERT INTO products (name, created_at, created_by)
            SELECT DISTINCT name, created_at, created_by
            FROM products_old
            WHERE name IS NOT NULL
          `);
        } catch (copyErr) {
          console.warn('[seed-categories] Could not copy data from old table:', copyErr);
        }

        // Drop old table
        await query('DROP TABLE products_old CASCADE');

        console.log('[seed-categories] ✓ Products table migrated successfully');
      } else {
        console.log('[seed-categories] Products table already has correct schema');
      }
    } catch (checkErr) {
      console.log('[seed-categories] Products table does not exist, creating new one...');
    }

    // Create products table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        subcategory TEXT NOT NULL,
        tax_code_type VARCHAR(10) DEFAULT NULL CHECK (tax_code_type IN ('hsn', 'sac')),
        tax_code_value VARCHAR(255) DEFAULT NULL,
        hsn_code VARCHAR(255) DEFAULT NULL,
        sac_code VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255)
      )
    `);

    // Add subcategory column if it doesn't exist (for existing tables)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT`);
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_code_type VARCHAR(10) DEFAULT NULL`);
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_code_value VARCHAR(255) DEFAULT NULL`);
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(255) DEFAULT NULL`);
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sac_code VARCHAR(255) DEFAULT NULL`);

    // Migration: Populate hsn_code and sac_code from tax_code_type/value if they are null
    // Use smaller batch updates to avoid timeouts
    console.log('[seed-categories] Migrating HSN/SAC codes...');
    await query(`
      UPDATE products 
      SET hsn_code = tax_code_value 
      WHERE id IN (
        SELECT id FROM products 
        WHERE hsn_code IS NULL AND tax_code_type = 'hsn' AND tax_code_value IS NOT NULL
        LIMIT 1000
      )
    `);
    await query(`
      UPDATE products 
      SET sac_code = tax_code_value 
      WHERE id IN (
        SELECT id FROM products 
        WHERE sac_code IS NULL AND tax_code_type = 'sac' AND tax_code_value IS NOT NULL
        LIMIT 1000
      )
    `);

    console.log('[seed-categories] ✓ products table ready');

    // Create materials table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS materials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(255),
        rate DECIMAL(10,2),
        shop_id UUID,
        unit VARCHAR(50),
        category VARCHAR(255),
        brandname VARCHAR(255),
        modelnumber VARCHAR(255),
        subcategory VARCHAR(255),
        product VARCHAR(255),
        technicalspecification TEXT,
        image VARCHAR(500),
        attributes JSONB,
        master_material_id UUID,
        template_id UUID,
        approved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('[seed-categories] ✓ materials table ready');
  } catch (error) {
    console.error('[seed-categories] Error seeding categories:', error);
    throw error;
  }
}

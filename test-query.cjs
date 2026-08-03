const { Client } = require('pg');

async function test() {
  const client = new Client({
    connectionString: "postgresql://postgres:Rebecasuji%4013@db.xvrkjroaktockgjxzned.supabase.co:5432/postgres"
  });
  
  await client.connect();

  const newQueryStr = `
            WITH latest_approved AS (
              SELECT DISTINCT ON (pa.product_id, pa.config_name) pa.*
              FROM product_approvals pa
              WHERE pa.status = 'approved'
              ORDER BY pa.product_id, pa.config_name, pa.created_at DESC
            )
           SELECT DISTINCT ON (p.product_id, p.config_name)
              p.*, pr.name as live_product_name,
              COALESCE(pr.name, p.product_name) as final_product_name,
              COALESCE(vc.name, f_vc.name, p.category_id) as category_name,
              COALESCE(vsc.name, pr.subcategory, p.subcategory_id) as subcategory_name
           FROM latest_approved p
           LEFT JOIN products pr ON p.product_id = pr.id
           LEFT JOIN vendor_categories vc ON p.category_id = vc.name
           LEFT JOIN material_subcategories vsc ON p.subcategory_id = vsc.name AND (p.category_id = vsc.category OR p.category_id IS NULL)
           LEFT JOIN material_subcategories f_vsc ON pr.subcategory = f_vsc.name
           LEFT JOIN material_categories f_vc ON f_vsc.category = f_vc.name
           ORDER BY p.product_id, p.config_name, p.created_at DESC
  `;
  
  const res2 = await client.query(newQueryStr);
  const rows = res2.rows;
  
  const counts = {};
  for (const r of rows) {
      const key = r.final_product_name + " | " + r.config_name;
      counts[key] = (counts[key] || 0) + 1;
  }
  
  for (const key in counts) {
      if (counts[key] > 1) {
          console.log(`DUPLICATE FOUND: ${key} appears ${counts[key]} times`);
          const dups = rows.filter(r => r.final_product_name + " | " + r.config_name === key);
          for (const d of dups) {
              console.log(`  - product_id: ${d.product_id}`);
          }
      }
  }
  
  await client.end();
}

test().catch(console.error);

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// A few representative shops to seed (no explicit UUIDs; Postgres will generate them)
const shops = [
  { name: 'City Hardware', location: 'Downtown', city: 'New York', state: 'NY', country: 'USA', pincode: '10001', rating: 4.5, categories: ['Civil', 'Gypsum', 'Plywood', 'Flooring', 'Painting', 'Doors', 'Blinds', 'Electrical', 'Plumbing'], gstNo: '12AABCT1234H1Z1' },
  { name: "Builder's Haven", location: 'Mall Area', city: 'Los Angeles', state: 'CA', country: 'USA', pincode: '90001', rating: 4.2, categories: ['Civil', 'Plywood', 'Glass', 'Flooring', 'Painting', 'Doors', 'Electrical'], gstNo: '12AABCT1234H1Z2' },
  { name: 'BuildMart Standard', location: 'City Center', city: 'Chicago', state: 'IL', country: 'USA', pincode: '60601', rating: 4.2, categories: ['Civil', 'Gypsum', 'Plywood', 'Flooring', 'Painting', 'Doors', 'Blinds'], gstNo: '12AABCT1234H1Z3' }
];

// Scan client files to extract hardcoded material objects (code + label/name)
function extractMaterialsFromClient() {
  const clientDir = path.resolve(__dirname, '..', '..', 'client', 'src');
  const exts = ['.tsx', '.ts', '.js', '.jsx'];
  const results = new Map();

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!exts.includes(path.extname(e.name))) continue;
      const txt = fs.readFileSync(full, 'utf8');
      const objBlocks = txt.match(/\{[^}]{0,400}\}/g);
      if (!objBlocks) continue;
      for (const b of objBlocks) {
        const codeMatch = b.match(/code\s*:\s*["']([^"']+)["']/);
        if (!codeMatch) continue;
        const code = codeMatch[1].trim();
        let nameMatch = b.match(/(?:label|name)\s*:\s*["']([^"']+)["']/);
        const name = nameMatch ? nameMatch[1].trim() : null;
        if (!results.has(code)) {
          results.set(code, { code, name });
        } else {
          // prefer non-empty name
          const existing = results.get(code);
          if (!existing.name && name) existing.name = name;
        }
      }
    }
  }

  if (fs.existsSync(clientDir)) walk(clientDir);
  // also scan admin dashboard if present (some material defs live there)
  try {
    const adminPath = path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'admin', 'AdminDashboard.tsx');
    if (fs.existsSync(adminPath)) {
      const txt = fs.readFileSync(adminPath, 'utf8');
      const matches = txt.match(/\{[^}]{0,400}\}/g) || [];
      for (const b of matches) {
        const codeMatch = b.match(/code\s*:\s*["']([^"']+)["']/);
        const nameMatch = b.match(/name\s*:\s*["']([^"']+)["']/);
        if (codeMatch) {
          const code = codeMatch[1].trim();
          const name = nameMatch ? nameMatch[1].trim() : null;
          if (!results.has(code)) results.set(code, { code, name });
        }
      }
    }
  } catch (e) { }

  // return as array
  return Array.from(results.values()).map((r) => ({ name: r.name || r.code, code: r.code }));
}

async function seed() {
  const client = await pool.connect();
  try {
    const materials = extractMaterialsFromClient();
    console.log(`Found ${materials.length} unique material codes in client sources`);

    await client.query('BEGIN');

    // Insert shops (if not exists) and collect a representative shop id for default mapping
    for (const s of shops) {
      const res = await client.query('SELECT id FROM shops WHERE name = $1 LIMIT 1', [s.name]);
      if (res.rowCount === 0) {
        await client.query('INSERT INTO shops (name,location,city,state,country,pincode,rating,categories,gstno,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())', [s.name, s.location, s.city, s.state, s.country, s.pincode, s.rating, JSON.stringify(s.categories), s.gstNo]);
      }
    }

    // Insert materials if code not present.
    // Try to link to a material_template if possible.
    for (const m of materials) {
      const check = await client.query('SELECT id FROM materials WHERE code = $1 LIMIT 1', [m.code]);
      if (check.rowCount === 0) {
        // Find matching template
        let templateId = null;
        const tplCheck = await client.query('SELECT id FROM material_templates WHERE code = $1 OR name = $2 LIMIT 1', [m.code, m.name]);
        if (tplCheck.rowCount > 0) {
          templateId = tplCheck.rows[0].id;
        }

        await client.query(
          'INSERT INTO materials (name, code, template_id, rate, unit, category, brandname, approved, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())',
          [m.name || m.code, m.code, templateId, 0, null, null, null, true]
        );
      }
    }

    await client.query('COMMIT');
    console.log('Seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed', err);
  } finally {
    client.release();
    pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((e) => { console.error(e); process.exit(1); });
}

export { seed };

require('dotenv').config({path:'../.env'});
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    const res = await client.query('SELECT id FROM et_tenders ORDER BY created_at DESC LIMIT 1');
    const tenderId = res.rows[0].id;
    console.log('Tender ID:', tenderId);
    await client.query(
      `INSERT INTO et_submissions (tender_id, vendor_id, round_number, bid_type, remarks, status, submitted_at) VALUES ($1, $2, 0, 'Commercial', $3, $4, $5) RETURNING id`,
      [tenderId, '3ed12d36-5aa4-4e5e-bcd5-898c29de69d1', '{}', 'Draft', null]
    );
    console.log('INSERT SUCCESS');
  } catch(e) {
    console.error('INSERT ERROR:', e.message);
  }
  client.end();
}).catch(console.error);

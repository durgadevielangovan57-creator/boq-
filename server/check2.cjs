require('dotenv').config({path:'../.env'});
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    const res = await client.query(`UPDATE et_submissions SET 
            remarks = $1, status = $2, updated_at = NOW(),
            submitted_at = CASE WHEN $2 = 'Submitted' THEN NOW() ELSE submitted_at END
           WHERE id = $3`, [JSON.stringify({}), 'Draft', 'baa37d33-50a5-4d28-9ff5-c741d7c0c129']);
    console.log('UPDATE SUCCESS', res.rowCount);
  } catch(e) {
    console.error('UPDATE ERROR:', e.message);
  }
  client.end();
}).catch(console.error);

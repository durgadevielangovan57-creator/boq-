require('dotenv').config({path: '../.env'});
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'et_tenders'");
    console.log(res.rows.map(r => r.column_name));
  } catch (e) {
    console.error(e);
  } finally {
    client.end();
  }
});

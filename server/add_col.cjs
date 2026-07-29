require('dotenv').config({path: '../.env'});
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    await client.query("ALTER TABLE et_tenders ADD COLUMN IF NOT EXISTS submission_start TIMESTAMPTZ");
    console.log("Added submission_start column");
  } catch (e) {
    console.error(e);
  } finally {
    client.end();
  }
});

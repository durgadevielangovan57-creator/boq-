require('dotenv').config({path:'../.env'});
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  const res = await client.query('SELECT * FROM et_submissions ORDER BY created_at DESC LIMIT 5');
  console.log(res.rows);
  client.end();
}).catch(console.error);

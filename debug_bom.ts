import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const columns = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'materials'`);
    console.log("Materials table columns:");
    columns.rows.forEach((r) => console.log(r.column_name));


    await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

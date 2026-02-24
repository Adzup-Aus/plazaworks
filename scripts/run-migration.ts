/**
 * Run a SQL migration file against DATABASE_URL.
 * Usage: npm run db:migrate:remove-multi-org
 *    or: npx tsx scripts/run-migration.ts migrations/003_remove_multi_org.sql
 */
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

const { Pool } = pg;

const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error("Usage: npx tsx scripts/run-migration.ts <path-to.sql>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const fullPath = resolve(process.cwd(), migrationPath);
const sql = readFileSync(fullPath, "utf-8");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    console.log("Migration completed:", migrationPath);
  } catch (err: any) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

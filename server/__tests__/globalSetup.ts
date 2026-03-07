/**
 * Runs migrations required for tests when DATABASE_URL is set.
 * Ensures the test database has the same schema as the app (e.g. activities.icon).
 */
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

const { Pool } = pg;

const MIGRATIONS_TO_RUN = ["migrations/006_activities_icon.sql"];

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const rel of MIGRATIONS_TO_RUN) {
      const fullPath = resolve(process.cwd(), rel);
      try {
        const sql = readFileSync(fullPath, "utf-8");
        await pool.query(sql);
      } catch (e: any) {
        if (e.code === "ENOENT") continue;
        throw e;
      }
    }
  } finally {
    await pool.end();
  }
}

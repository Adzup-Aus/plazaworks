/**
 * Clear the database (drop public schema) and re-initialize: push schema, then run seeds.
 * Destructive: all data is lost.
 * Run: npm run db:reset (requires DATABASE_URL in .env)
 */
import "dotenv/config";
import { execSync } from "child_process";
import pg from "pg";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Use .env or run with node -r dotenv/config.");
  }

  console.log("Dropping public schema (all tables)...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await pool.query("GRANT ALL ON SCHEMA public TO public");
  } finally {
    await pool.end();
  }
  console.log("Schema cleared.");

  console.log("Pushing schema (drizzle-kit push)...");
  execSync("npm run db:push", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  console.log("Seeding admin...");
  execSync("npm run seed:admin", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  console.log("Seeding default activities...");
  execSync("npm run seed:activities", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  console.log("Seeding roles...");
  execSync("npm run seed:roles", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  console.log("Seeding integration scopes...");
  execSync("npm run seed:integration-scopes", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  console.log("Database reset and initialized.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

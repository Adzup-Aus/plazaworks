/**
 * Seed default activities (Travel, Admin, Sales) when none exist. Single-tenant.
 * Idempotent: only inserts if there are no activities.
 * Run: npx tsx scripts/seed-default-activities.ts (requires DATABASE_URL in .env)
 */
import "dotenv/config";
import { db } from "../server/db";
import { activities } from "@shared/schema";

const DEFAULT_ACTIVITIES = [
  { name: "Travel", sortOrder: 0 },
  { name: "Admin", sortOrder: 1 },
  { name: "Sales", sortOrder: 2 },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set.");
  }

  const existing = await db.select().from(activities).limit(1);
  if (existing.length > 0) {
    console.log("Activities already exist, skipping seed.");
    return;
  }

  for (const a of DEFAULT_ACTIVITIES) {
    await db.insert(activities).values({
      name: a.name,
      sortOrder: a.sortOrder,
    });
  }
  console.log("Seeded default activities: Travel, Admin, Sales");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Seed default activities (Travel, Admin, Sales) for the owner/first organization when empty.
 * Idempotent: only inserts if the org has no activities.
 * Run: npx tsx scripts/seed-default-activities.ts (requires DATABASE_URL in .env)
 */
import "dotenv/config";
import { db } from "../server/db";
import { AuthTenantRepository } from "../server/repositories/AuthTenantRepository";
import { activities } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_ACTIVITIES = [
  { name: "Travel", sortOrder: 0 },
  { name: "Admin", sortOrder: 1 },
  { name: "Sales", sortOrder: 2 },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set.");
  }

  const repo = new AuthTenantRepository(db);
  const ownerOrg = await repo.getOwnerOrganization();
  if (!ownerOrg) {
    const all = await repo.getOrganizations();
    const first = all[0];
    if (!first) {
      console.log("No organization found. Create an org first (e.g. run seed:admin).");
      return;
    }
    const orgId = first.id;
    const existing = await db.select().from(activities).where(eq(activities.organizationId, orgId));
    if (existing.length > 0) {
      console.log("Activities already exist for org, skipping seed.");
      return;
    }
    for (const a of DEFAULT_ACTIVITIES) {
      await db.insert(activities).values({
        organizationId: orgId,
        name: a.name,
        sortOrder: a.sortOrder,
      });
    }
    console.log("Seeded default activities: Travel, Admin, Sales");
    return;
  }

  const orgId = ownerOrg.id;
  const existing = await db.select().from(activities).where(eq(activities.organizationId, orgId));
  if (existing.length > 0) {
    console.log("Activities already exist for org, skipping seed.");
    return;
  }

  for (const a of DEFAULT_ACTIVITIES) {
    await db.insert(activities).values({
      organizationId: orgId,
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

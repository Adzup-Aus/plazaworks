/**
 * Seed the scopes table with default API permission scopes.
 * Run: npx tsx scripts/seed-integration-scopes.ts (requires DATABASE_URL in .env)
 */
import "dotenv/config";
import { db } from "../server/db";
import { scopes } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_SCOPES = [
  { name: "jobs:read", resource: "jobs", actions: ["read"], description: "View jobs and job details" },
  { name: "jobs:write", resource: "jobs", actions: ["read", "write"], description: "Create and update jobs" },
  { name: "clients:read", resource: "clients", actions: ["read"], description: "View client information" },
  { name: "clients:write", resource: "clients", actions: ["read", "write"], description: "Manage clients" },
  { name: "quotes:read", resource: "quotes", actions: ["read"], description: "View quotes" },
  { name: "quotes:write", resource: "quotes", actions: ["read", "write"], description: "Create and manage quotes" },
  { name: "invoices:read", resource: "invoices", actions: ["read"], description: "View invoices" },
  { name: "invoices:write", resource: "invoices", actions: ["read", "write"], description: "Create and manage invoices" },
  { name: "schedule:read", resource: "schedule", actions: ["read"], description: "View schedule" },
  { name: "schedule:write", resource: "schedule", actions: ["read", "write"], description: "Modify schedule" },
];

async function seed() {
  for (const scope of DEFAULT_SCOPES) {
    const [existing] = await db.select().from(scopes).where(eq(scopes.name, scope.name));
    if (!existing) {
      await db.insert(scopes).values(scope);
      console.log("Inserted scope:", scope.name);
    }
  }
  console.log("Integration scopes seed complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

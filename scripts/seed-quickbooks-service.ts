/**
 * Seed the QuickBooks service in the services table (Integrations → Services tab).
 * Run: npx tsx scripts/seed-quickbooks-service.ts (requires DATABASE_URL in .env)
 */
import "dotenv/config";
import { db } from "../server/db";
import { services } from "@shared/schema";
import { eq } from "drizzle-orm";

const QUICKBOOKS_SERVICE = {
  name: "QuickBooks",
  type: "quickbooks",
  description: "Sync invoices and customers to QuickBooks Online. Configure with your Intuit Developer app credentials.",
  configurationFields: [
    {
      name: "clientId",
      type: "text" as const,
      label: "Client ID",
      required: true,
      placeholder: "Intuit app Client ID",
      helpText: "From developer.intuit.com → Keys & OAuth",
    },
    {
      name: "clientSecret",
      type: "password" as const,
      label: "Client Secret",
      required: true,
      placeholder: "Intuit app Client Secret",
      helpText: "From developer.intuit.com → Keys & OAuth",
    },
  ],
  isActive: true,
};

async function seed() {
  const [existing] = await db
    .select()
    .from(services)
    .where(eq(services.type, "quickbooks"));
  if (existing) {
    console.log("QuickBooks service already exists:", existing.id);
    return;
  }
  const [inserted] = await db.insert(services).values(QUICKBOOKS_SERVICE).returning();
  console.log("Inserted QuickBooks service:", inserted?.id);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

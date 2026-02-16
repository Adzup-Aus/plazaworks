/**
 * Seed the fixed admin user (cliff@gmail.com / secret1234).
 * Idempotent: skips if admin identity already exists.
 * Run: npm run seed:admin (requires DATABASE_URL in .env)
 */
import "dotenv/config";
import { db } from "../server/db";
import { AuthTenantRepository } from "../server/repositories/AuthTenantRepository";
import { authStorage } from "../server/replit_integrations/auth";
import { organizations } from "@shared/schema";

const ADMIN_EMAIL = "cliff@gmail.com";
const ADMIN_PASSWORD = "secret1234";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Use .env or run with node -r dotenv/config.");
  }

  const repo = new AuthTenantRepository(db);

  const existing = await repo.getAuthIdentityByIdentifier("email", ADMIN_EMAIL);
  if (existing) {
    console.log("Admin user already exists:", ADMIN_EMAIL);
    return;
  }

  let ownerOrg = await repo.getOwnerOrganization();
  if (!ownerOrg) {
    const slug = "plaza-works";
    const [created] = await db
      .insert(organizations)
      .values({
        name: "Plaza Works",
        slug,
        type: "owner",
        isOwner: true,
        isActive: true,
      })
      .returning();
    ownerOrg = created;
    await repo.createOrganizationSubscription({
      organizationId: ownerOrg.id,
      tier: "professional",
      status: "active",
    });
    console.log("Created owner organization:", ownerOrg.name);
  }

  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const adminUserId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  await authStorage.upsertUser({
    id: adminUserId,
    email: ADMIN_EMAIL,
  });

  await repo.createAuthIdentity({
    userId: adminUserId,
    type: "email",
    identifier: ADMIN_EMAIL,
    passwordHash,
    isVerified: true,
    isPrimary: true,
  });

  await repo.createOrganizationMember({
    organizationId: ownerOrg.id,
    userId: adminUserId,
    role: "owner",
  });

  console.log("Admin user created:", ADMIN_EMAIL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

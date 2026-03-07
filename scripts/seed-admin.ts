/**
 * Seed the fixed admin user (cliffcoelho@gmail.com / secret1234).
 * Single-tenant: creates auth identity + staff profile with admin role (no organization).
 * Idempotent: skips if admin identity already exists; ensures staff profile has admin role.
 * Run: npm run seed:admin (requires DATABASE_URL in .env)
 */
import "dotenv/config";
import { db } from "../server/db";
import { AuthTenantRepository } from "../server/repositories/AuthTenantRepository";
import { authStorage } from "../server/replit_integrations/auth";
import { staffProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = "cliffcoelho@gmail.com";
const ADMIN_PASSWORD = "secret1234";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Use .env or run with node -r dotenv/config.");
  }

  const repo = new AuthTenantRepository(db);

  let existing = await repo.getAuthIdentityByIdentifier("email", ADMIN_EMAIL);
  let adminUserId: string;

  if (existing) {
    console.log("Admin user already exists:", ADMIN_EMAIL);
    adminUserId = existing.userId;
  } else {
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    adminUserId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

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
    console.log("Admin user created:", ADMIN_EMAIL);
  }

  const [existingProfile] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, adminUserId));

  if (existingProfile) {
    const hasAdmin = existingProfile.roles?.includes("admin");
    if (!hasAdmin) {
      await db
        .update(staffProfiles)
        .set({
          roles: [...(existingProfile.roles || []), "admin"],
          updatedAt: new Date(),
        })
        .where(eq(staffProfiles.id, existingProfile.id));
      console.log("Added admin role to existing staff profile");
    }
  } else {
    await db.insert(staffProfiles).values({
      userId: adminUserId,
      roles: ["admin"],
      employmentType: "permanent",
      permissions: ["admin_settings"],
      isActive: true,
    });
    console.log("Admin staff profile created");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

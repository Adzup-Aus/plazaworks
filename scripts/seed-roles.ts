/**
 * Seed the roles table with the legacy user roles (plumber, admin, etc.)
 * and assign sensible permissions to each. Idempotent: skips roles that already exist.
 * Run: npm run seed:roles (requires DATABASE_URL in .env)
 */
import "dotenv/config";
import { db } from "../server/db";
import { roles, rolePermissions } from "@shared/schema";
import { userRoles, userPermissions, type UserPermission } from "@shared/schema";
import { eq } from "drizzle-orm";

/** Display name for each legacy role key */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Full system access",
  plumber: "Field plumber – view jobs and schedule",
  plumbing_manager: "Manages plumbing team and assignments",
  project_manager: "Manages projects, schedule, and team",
  carpenter: "Field carpenter – view jobs and schedule",
  waterproofer: "Field waterproofer – view jobs and schedule",
  tiler: "Field tiler – view jobs and schedule",
  electrician: "Field electrician – view jobs and schedule",
};

/** Permissions per role (only the extra keys; view_* implied by create/edit/delete where applicable) */
const ROLE_PERMISSIONS: Record<string, UserPermission[]> = {
  admin: [...userPermissions],
  project_manager: [
    "view_dashboard",
    "view_jobs", "create_jobs", "edit_jobs", "delete_jobs",
    "view_quotes", "create_quotes", "edit_quotes", "delete_quotes",
    "view_invoices", "create_invoices", "edit_invoices", "delete_invoices",
    "view_schedule", "manage_schedule",
    "view_activities",
    "view_users", "create_users", "edit_users", "delete_users",
    "view_clients", "create_clients", "edit_clients", "delete_clients",
    "view_reports",
  ],
  plumbing_manager: [
    "view_dashboard",
    "view_jobs", "create_jobs", "edit_jobs",
    "view_quotes", "create_quotes", "edit_quotes",
    "view_invoices", "create_invoices", "edit_invoices",
    "view_schedule", "manage_schedule",
    "view_activities",
    "view_users", "view_clients",
    "view_reports",
  ],
  plumber: [
    "view_dashboard",
    "view_jobs",
    "view_schedule",
    "view_activities",
  ],
  carpenter: [
    "view_dashboard",
    "view_jobs",
    "view_schedule",
    "view_activities",
  ],
  waterproofer: [
    "view_dashboard",
    "view_jobs",
    "view_schedule",
    "view_activities",
  ],
  tiler: [
    "view_dashboard",
    "view_jobs",
    "view_schedule",
    "view_activities",
  ],
  electrician: [
    "view_dashboard",
    "view_jobs",
    "view_schedule",
    "view_activities",
  ],
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Use .env or run with node -r dotenv/config.");
  }

  for (const roleKey of userRoles) {
    const [existing] = await db.select().from(roles).where(eq(roles.name, roleKey));
    if (existing) {
      console.log("Role already exists:", roleKey);
      continue;
    }

    const [inserted] = await db
      .insert(roles)
      .values({
        name: roleKey,
        description: ROLE_DESCRIPTIONS[roleKey] ?? null,
        isSystem: roleKey === "admin",
      })
      .returning();

    if (!inserted) {
      console.warn("Failed to insert role:", roleKey);
      continue;
    }

    const perms = ROLE_PERMISSIONS[roleKey] ?? [];
    if (perms.length > 0) {
      await db.insert(rolePermissions).values(
        perms.map((permission) => ({ roleId: inserted.id, permission }))
      );
    }
    console.log("Created role:", roleKey, "with", perms.length, "permissions");
  }
}

main()
  .then(() => {
    console.log("Seed roles done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

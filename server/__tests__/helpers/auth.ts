import request from "supertest";
import type { Express } from "express";
import { storage } from "../../routes/shared";
import type { UserPermission } from "@shared/schema";

/**
 * Register a unique user, log in, and ensure they have an admin staff profile
 * so permission middleware allows all actions. Returns the auth cookie for use in tests.
 */
export async function loginAsAdmin(app: Express, prefix = "api-test"): Promise<{ authCookie: string[]; userId: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  await request(app).post("/api/auth/register").send({
    email,
    password: "password123",
  });
  const loginRes = await request(app).post("/api/auth/login").send({
    email,
    password: "password123",
  });
  const authCookie = loginRes.headers["set-cookie"] ?? [];
  const userId = loginRes.body?.userId;
  if (!userId) {
    throw new Error("Login did not return userId");
  }
  const profile = await storage.getStaffProfileByUserId(userId);
  if (!profile) {
    await storage.createStaffProfile({
      userId,
      roles: ["admin"],
      employmentType: "permanent",
      isActive: true,
    });
  } else {
    await storage.updateStaffProfile(profile.id, { roles: ["admin"] });
  }
  return { authCookie, userId };
}

/**
 * Register a unique user, log in, and ensure they have a non-admin staff profile
 * with the given permissions. Use to test 403 when permission is missing.
 */
export async function loginAsStaff(
  app: Express,
  permissions: UserPermission[],
  prefix = "api-test-staff"
): Promise<{ authCookie: string[]; userId: string; profileId: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  await request(app).post("/api/auth/register").send({
    email,
    password: "password123",
  });
  const loginRes = await request(app).post("/api/auth/login").send({
    email,
    password: "password123",
  });
  const authCookie = loginRes.headers["set-cookie"] ?? [];
  const userId = loginRes.body?.userId;
  if (!userId) {
    throw new Error("Login did not return userId");
  }
  const profile = await storage.getStaffProfileByUserId(userId);
  if (!profile) {
    const created = await storage.createStaffProfile({
      userId,
      roles: [], // no role so effective permissions = only direct `permissions`
      employmentType: "permanent",
      isActive: true,
      permissions,
    });
    return { authCookie, userId, profileId: created.id };
  }
  await storage.updateStaffProfile(profile.id, { roles: [], permissions });
  return { authCookie, userId, profileId: profile.id };
}

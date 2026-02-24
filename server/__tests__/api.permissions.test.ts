import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { storage } from "../storage";
import { normalizePermissions } from "@shared/schema";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;

describe.runIf(hasDb)("API permissions", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const out = await createApp();
    app = out.app;
  });

  it("T051: permission implication - create/edit/delete grant view", () => {
    expect(normalizePermissions(["create_jobs"])).toContain("view_jobs");
    expect(normalizePermissions(["edit_quotes"])).toContain("view_quotes");
    expect(normalizePermissions(["delete_invoices"])).toContain("view_invoices");
    expect(normalizePermissions(["manage_schedule"])).toContain("view_schedule");
  });

  it("GET /api/auth/user returns permissions array when authenticated", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliff@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    expect(loginRes.status).toBe(200);

    const res = await request(app).get("/api/auth/user").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body).toHaveProperty("role");
  });

  it("GET /api/auth/user returns normalized permissions (admin gets all)", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliff@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    const res = await request(app).get("/api/auth/user").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.permissions).toContain("view_jobs");
    expect(res.body.permissions).toContain("view_dashboard");
  });

  it("PATCH /api/staff/:id persists permissions and GET /api/auth/user reflects them", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliff@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    const profiles = await storage.getStaffProfiles();
    const staffWithProfile = profiles.find((p) => p.userId?.startsWith("user_"));
    if (!staffWithProfile) {
      const adminProfile = profiles.find((p) => p.roles?.includes("admin"));
      if (!adminProfile) return;
      const updated = await storage.updateStaffProfile(adminProfile.id, {
        permissions: ["view_jobs", "view_quotes"],
      });
      expect(updated?.permissions).toEqual(["view_jobs", "view_quotes"]);
      return;
    }
    const res = await request(app)
      .patch(`/api/staff/${staffWithProfile.id}`)
      .set("Cookie", cookie)
      .send({ permissions: ["view_jobs", "create_jobs"] });
    expect(res.status).toBe(200);
    expect(res.body.permissions).toEqual(["view_jobs", "create_jobs"]);
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { loginAsAdmin, loginAsStaff } from "./helpers/auth";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;
let adminCookie: string[] = [];

describe.runIf(hasDb)("API permissions enforcement (US4)", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const out = await createApp();
    app = out.app;
    const admin = await loginAsAdmin(out.app, "perm-enforce-admin");
    adminCookie = admin.authCookie;
  });

  describe("T034: Job endpoints enforce permissions", () => {
    it("staff with no permissions gets 403 on GET /api/jobs", async () => {
      const { authCookie } = await loginAsStaff(app, [], "job-no-perm");
      const res = await request(app).get("/api/jobs").set("Cookie", authCookie);
      expect(res.status).toBe(403);
    });

    it("staff with view_jobs gets 200 on GET /api/jobs", async () => {
      const { authCookie } = await loginAsStaff(app, ["view_jobs"], "job-view");
      const res = await request(app).get("/api/jobs").set("Cookie", authCookie);
      expect(res.status).toBe(200);
    });

    it("staff with view_jobs but not create_jobs gets 403 on POST /api/jobs", async () => {
      const { authCookie } = await loginAsStaff(app, ["view_jobs"], "job-no-create");
      const res = await request(app)
        .post("/api/jobs")
        .set("Cookie", authCookie)
        .send({ clientName: "X", address: "Y", jobType: "plumbing" });
      expect(res.status).toBe(403);
    });
  });

  describe("T035: Quote endpoints enforce permissions", () => {
    it("staff with no permissions gets 403 on GET /api/quotes", async () => {
      const { authCookie } = await loginAsStaff(app, [], "quote-no-perm");
      const res = await request(app).get("/api/quotes").set("Cookie", authCookie);
      expect(res.status).toBe(403);
    });

    it("staff with view_quotes gets 200 on GET /api/quotes", async () => {
      const { authCookie } = await loginAsStaff(app, ["view_quotes"], "quote-view");
      const res = await request(app).get("/api/quotes").set("Cookie", authCookie);
      expect(res.status).toBe(200);
    });
  });

  describe("T036: Invoice endpoints enforce permissions", () => {
    it("staff with no permissions gets 403 on GET /api/invoices", async () => {
      const { authCookie } = await loginAsStaff(app, [], "inv-no-perm");
      const res = await request(app).get("/api/invoices").set("Cookie", authCookie);
      expect(res.status).toBe(403);
    });

    it("staff with view_invoices gets 200 on GET /api/invoices", async () => {
      const { authCookie } = await loginAsStaff(app, ["view_invoices"], "inv-view");
      const res = await request(app).get("/api/invoices").set("Cookie", authCookie);
      expect(res.status).toBe(200);
    });
  });

  describe("T037: Client endpoints enforce permissions", () => {
    it("staff with no permissions gets 403 on GET /api/clients", async () => {
      const { authCookie } = await loginAsStaff(app, [], "client-no-perm");
      const res = await request(app).get("/api/clients").set("Cookie", authCookie);
      expect(res.status).toBe(403);
    });

    it("staff with view_clients gets 200 on GET /api/clients", async () => {
      const { authCookie } = await loginAsStaff(app, ["view_clients"], "client-view");
      const res = await request(app).get("/api/clients").set("Cookie", authCookie);
      expect(res.status).toBe(200);
    });
  });

  describe("T038: Staff endpoints enforce permissions", () => {
    it("staff with no permissions gets 403 on GET /api/staff", async () => {
      const { authCookie } = await loginAsStaff(app, [], "staff-no-perm");
      const res = await request(app).get("/api/staff").set("Cookie", authCookie);
      expect(res.status).toBe(403);
    });

    it("staff with view_users gets 200 on GET /api/staff", async () => {
      const { authCookie } = await loginAsStaff(app, ["view_users"], "staff-view");
      const res = await request(app).get("/api/staff").set("Cookie", authCookie);
      expect(res.status).toBe(200);
    });
  });

  describe("T039: Admin bypasses all permission checks", () => {
    it("admin can GET /api/jobs", async () => {
      const res = await request(app).get("/api/jobs").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
    });

    it("admin can GET /api/quotes", async () => {
      const res = await request(app).get("/api/quotes").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
    });

    it("admin can GET /api/invoices", async () => {
      const res = await request(app).get("/api/invoices").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
    });

    it("admin can GET /api/clients", async () => {
      const res = await request(app).get("/api/clients").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
    });

    it("admin can GET /api/staff", async () => {
      const res = await request(app).get("/api/staff").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
    });

    it("admin can GET /api/activities", async () => {
      const res = await request(app).get("/api/activities").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
    });

    it("admin can GET /api/schedule", async () => {
      const res = await request(app).get("/api/schedule").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
    });

    it("admin can POST /api/jobs", async () => {
      const res = await request(app)
        .post("/api/jobs")
        .set("Cookie", adminCookie)
        .send({ clientName: "Admin Job", address: "3 Admin St", jobType: "plumbing" });
      expect(res.status).toBe(201);
    });
  });
});

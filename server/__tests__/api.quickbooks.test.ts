import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;
let authCookie: string;

describe.runIf(hasDb)("API QuickBooks", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const out = await createApp();
    app = out.app;
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    authCookie = loginRes.headers["set-cookie"]?.[0] ?? "";
    expect(loginRes.status).toBe(200);
  });

  it("GET /api/quickbooks/connection returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/quickbooks/connection");
    expect(res.status).toBe(401);
  });

  it("PUT /api/quickbooks/connection returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .put("/api/quickbooks/connection")
      .send({ clientId: "test", clientSecret: "secret" });
    expect(res.status).toBe(401);
  });

  it("GET /api/quickbooks/oauth/start returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/quickbooks/oauth/start");
    expect(res.status).toBe(401);
  });

  it("POST /api/quickbooks/disconnect returns 401 when unauthenticated", async () => {
    const res = await request(app).post("/api/quickbooks/disconnect");
    expect(res.status).toBe(401);
  });

  it("PUT /api/quickbooks/connection returns 400 for invalid body (missing clientSecret)", async () => {
    const res = await request(app)
      .put("/api/quickbooks/connection")
      .set("Cookie", authCookie)
      .send({ clientId: "test" });
    expect(res.status).toBe(400);
  });

  it("PUT /api/quickbooks/connection returns 400 for invalid body (empty clientId)", async () => {
    const res = await request(app)
      .put("/api/quickbooks/connection")
      .set("Cookie", authCookie)
      .send({ clientId: "", clientSecret: "secret" });
    expect(res.status).toBe(400);
  });

  it("GET /api/quickbooks/connection returns 200 with status when authenticated", async () => {
    const res = await request(app).get("/api/quickbooks/connection").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("configured");
    expect(res.body).toHaveProperty("connected");
    expect(typeof res.body.configured).toBe("boolean");
    expect(typeof res.body.connected).toBe("boolean");
  });

  it("PUT /api/quickbooks/connection saves credentials and returns oauthStartUrl", async () => {
    const res = await request(app)
      .put("/api/quickbooks/connection")
      .set("Cookie", authCookie)
      .send({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("saved", true);
    expect(res.body).toHaveProperty("oauthStartUrl");
    expect(typeof res.body.oauthStartUrl).toBe("string");
  });

  it("GET /api/quickbooks/sync-log returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/quickbooks/sync-log");
    expect(res.status).toBe(401);
  });

  it("GET /api/quickbooks/sync-log with auth returns 200 and array", async () => {
    const res = await request(app).get("/api/quickbooks/sync-log").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("entity_type");
      expect(res.body[0]).toHaveProperty("entity_id");
      expect(res.body[0]).toHaveProperty("status");
      expect(res.body[0]).toHaveProperty("created_at");
    }
  });

  it("GET /api/quickbooks/sync-log?status=succeeded returns 200 and array", async () => {
    const res = await request(app)
      .get("/api/quickbooks/sync-log?status=succeeded")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;
let authCookie: string;

describe.runIf(hasDb)("API integrations", () => {
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

  it("GET /api/integrations returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/integrations");
    expect(res.status).toBe(401);
  });

  it("GET /api/integrations returns list (admin)", async () => {
    const res = await request(app).get("/api/integrations").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/scopes returns scopes list", async () => {
    const res = await request(app).get("/api/scopes").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/integrations creates integration and returns token once", async () => {
    const scopesRes = await request(app).get("/api/scopes").set("Cookie", authCookie);
    const scopes = scopesRes.body as { name: string }[];
    if (scopes.length === 0) {
      console.warn("Skipping: run npm run seed:integration-scopes first");
      return;
    }
    const res = await request(app)
      .post("/api/integrations")
      .set("Cookie", authCookie)
      .send({
        name: "Test Integration " + Date.now(),
        description: "E2E test",
        scopes: [scopes[0].name],
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("name");
    expect(res.body).toHaveProperty("scopes");
    expect(res.body).toHaveProperty("apiToken");
    expect(res.body).toHaveProperty("status", "active");
  });

  it("POST /api/integrations validates at least one scope", async () => {
    const res = await request(app)
      .post("/api/integrations")
      .set("Cookie", authCookie)
      .send({ name: "No scopes", scopes: [] });
    expect(res.status).toBe(400);
  });

  it("GET /api/integrations/:id returns 404 for unknown id", async () => {
    const res = await request(app)
      .get("/api/integrations/00000000-0000-0000-0000-000000000000")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
  });
});

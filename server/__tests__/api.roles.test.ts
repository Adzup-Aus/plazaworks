import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;
let authCookie: string;

describe.runIf(hasDb)("API roles", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const out = await createApp();
    app = out.app;
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliff@gmail.com",
      password: "secret1234",
    });
    authCookie = loginRes.headers["set-cookie"]?.[0] ?? "";
    expect(loginRes.status).toBe(200);
  });

  it("GET /api/roles returns roles list (empty or with data)", async () => {
    const res = await request(app).get("/api/roles").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/roles creates new role", async () => {
    const res = await request(app)
      .post("/api/roles")
      .set("Cookie", authCookie)
      .send({ name: "Test Role " + Date.now(), description: "E2E test role" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("name");
    expect(res.body).toHaveProperty("description");
    expect(res.body).toHaveProperty("isSystem", false);
  });

  it("POST /api/roles validates name is required", async () => {
    const res = await request(app)
      .post("/api/roles")
      .set("Cookie", authCookie)
      .send({ description: "No name" });
    expect(res.status).toBe(400);
  });

  it("POST /api/roles enforces unique name", async () => {
    const name = "Unique Role " + Date.now();
    await request(app).post("/api/roles").set("Cookie", authCookie).send({ name });
    const res = await request(app)
      .post("/api/roles")
      .set("Cookie", authCookie)
      .send({ name });
    expect(res.status).toBe(409);
  });

  it("GET /api/roles returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/roles");
    expect(res.status).toBe(401);
  });

  it("GET /api/roles/:id/permissions returns role permissions", async () => {
    const listRes = await request(app).get("/api/roles").set("Cookie", authCookie);
    const roles = listRes.body as { id: string }[];
    if (roles.length === 0) return;
    const res = await request(app)
      .get(`/api/roles/${roles[0].id}/permissions`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("roleId");
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });

  it("PUT /api/roles/:id/permissions sets role permissions", async () => {
    const listRes = await request(app).get("/api/roles").set("Cookie", authCookie);
    const roles = listRes.body as { id: string }[];
    if (roles.length === 0) return;
    const res = await request(app)
      .put(`/api/roles/${roles[0].id}/permissions`)
      .set("Cookie", authCookie)
      .send({ permissions: ["view_jobs", "create_jobs"] });
    expect(res.status).toBe(200);
    expect(res.body.permissions).toContain("view_jobs");
    expect(res.body.permissions).toContain("create_jobs");
  });

  it("GET /api/permissions returns all available permissions with metadata", async () => {
    const res = await request(app).get("/api/permissions").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("permissions");
    expect(res.body).toHaveProperty("categories");
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions.length).toBeGreaterThan(0);
    expect(res.body.permissions[0]).toHaveProperty("key");
    expect(res.body.permissions[0]).toHaveProperty("displayName");
    expect(res.body.permissions[0]).toHaveProperty("category");
  });

  it("GET /api/roles/:id returns single role", async () => {
    const listRes = await request(app).get("/api/roles").set("Cookie", authCookie);
    const roles = listRes.body as { id: string }[];
    if (roles.length === 0) return;
    const res = await request(app).get(`/api/roles/${roles[0].id}`).set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(roles[0].id);
    expect(res.body).toHaveProperty("name");
  });

  it("PATCH /api/roles/:id updates role", async () => {
    const listRes = await request(app).get("/api/roles").set("Cookie", authCookie);
    const roles = listRes.body as { id: string }[];
    if (roles.length === 0) return;
    const newName = "Updated Role " + Date.now();
    const res = await request(app)
      .patch(`/api/roles/${roles[0].id}`)
      .set("Cookie", authCookie)
      .send({ name: newName });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(newName);
  });

  it("DELETE /api/roles/:id deletes role with no staff", async () => {
    const createRes = await request(app)
      .post("/api/roles")
      .set("Cookie", authCookie)
      .send({ name: "To Delete " + Date.now() });
    const id = createRes.body.id;
    const res = await request(app).delete(`/api/roles/${id}`).set("Cookie", authCookie);
    expect(res.status).toBe(204);
    const getRes = await request(app).get(`/api/roles/${id}`).set("Cookie", authCookie);
    expect(getRes.status).toBe(404);
  });
});

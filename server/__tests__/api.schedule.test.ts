import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;
let authCookie: string[] = [];
let jobId: string = "";

describe.runIf(hasDb)("API schedule", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const out = await createApp();
    app = out.app;
    const email = `api-schedule-${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({
      email,
      password: "password123",
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password: "password123",
    });
    authCookie = loginRes.headers["set-cookie"] ?? [];
    await request(app).get("/api/jobs").set("Cookie", authCookie);
    const createJobRes = await request(app)
      .post("/api/jobs")
      .set("Cookie", authCookie)
      .send({
        clientName: "Schedule Job Client",
        address: "100 Schedule St",
        jobType: "plumbing",
      });
    jobId = createJobRes.body?.id;
  });

  it("GET /api/schedule returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/schedule");
    expect(res.status).toBe(401);
  });

  it("GET /api/schedule with auth returns array", async () => {
    const res = await request(app).get("/api/schedule").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/schedule with auth and valid body returns 201", async () => {
    if (!jobId) return;
    const res = await request(app)
      .post("/api/schedule")
      .set("Cookie", authCookie)
      .send({
        jobId,
        scheduledDate: "2025-12-01",
        status: "scheduled",
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.jobId).toBe(jobId);
    expect(res.body.staffId).toBeDefined();
    expect(res.body.scheduledDate).toBe("2025-12-01");
  });

  it("GET /api/schedule/:id with auth returns entry", async () => {
    if (!jobId) return;
    const createRes = await request(app)
      .post("/api/schedule")
      .set("Cookie", authCookie)
      .send({
        jobId,
        scheduledDate: "2025-12-15",
        status: "scheduled",
      });
    const entryId = createRes.body?.id;
    if (!entryId) return;
    const res = await request(app)
      .get(`/api/schedule/${entryId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(entryId);
    expect(res.body.jobId).toBe(jobId);
  });

  it("GET /api/schedule/:id returns 404 for non-existent id", async () => {
    const res = await request(app)
      .get("/api/schedule/non-existent-schedule-id-12345")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("PATCH /api/schedule/:id with auth updates entry", async () => {
    if (!jobId) return;
    const createRes = await request(app)
      .post("/api/schedule")
      .set("Cookie", authCookie)
      .send({
        jobId,
        scheduledDate: "2025-12-20",
        status: "scheduled",
      });
    const entryId = createRes.body?.id;
    if (!entryId) return;
    const res = await request(app)
      .patch(`/api/schedule/${entryId}`)
      .set("Cookie", authCookie)
      .send({ status: "completed" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
  });

  it("DELETE /api/schedule/:id with auth removes entry", async () => {
    if (!jobId) return;
    const createRes = await request(app)
      .post("/api/schedule")
      .set("Cookie", authCookie)
      .send({
        jobId,
        scheduledDate: "2025-12-25",
        status: "scheduled",
      });
    const entryId = createRes.body?.id;
    if (!entryId) return;
    const res = await request(app)
      .delete(`/api/schedule/${entryId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const getRes = await request(app)
      .get(`/api/schedule/${entryId}`)
      .set("Cookie", authCookie);
    expect(getRes.status).toBe(404);
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;
let authCookie: string[] = [];

describe.runIf(hasDb)("API jobs", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const out = await createApp();
    app = out.app;
    const email = `api-jobs-${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({
      email,
      password: "password123",
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password: "password123",
    });
    authCookie = loginRes.headers["set-cookie"] ?? [];
  });

  it("GET /api/jobs returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/jobs");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/unauthorized/i);
  });

  it("GET /api/jobs with auth returns array", async () => {
    const res = await request(app).get("/api/jobs").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/jobs with auth and valid body returns 201 and job shape", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set("Cookie", authCookie)
      .send({
        clientName: "API Test Client",
        address: "123 Test St",
        jobType: "plumbing",
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.clientName).toBe("API Test Client");
    expect(res.body.address).toBe("123 Test St");
    expect(res.body.jobType).toBe("plumbing");
  });

  it("GET /api/jobs/:id with auth returns job", async () => {
    const createRes = await request(app)
      .post("/api/jobs")
      .set("Cookie", authCookie)
      .send({
        clientName: "Get Job Client",
        address: "456 Get St",
        jobType: "electrical",
      });
    const jobId = createRes.body?.id;
    expect(jobId).toBeDefined();
    const res = await request(app).get(`/api/jobs/${jobId}`).set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
    expect(res.body.clientName).toBe("Get Job Client");
  });

  it("GET /api/jobs/:id returns 404 for non-existent id", async () => {
    const res = await request(app)
      .get("/api/jobs/non-existent-job-id-12345")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("PATCH /api/jobs/:id with auth updates job", async () => {
    const createRes = await request(app)
      .post("/api/jobs")
      .set("Cookie", authCookie)
      .send({
        clientName: "Patch Client",
        address: "789 Patch Ave",
        jobType: "carpentry",
      });
    const jobId = createRes.body?.id;
    const res = await request(app)
      .patch(`/api/jobs/${jobId}`)
      .set("Cookie", authCookie)
      .send({ status: "in_progress" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
  });

  it("DELETE /api/jobs/:id with auth removes job", async () => {
    const createRes = await request(app)
      .post("/api/jobs")
      .set("Cookie", authCookie)
      .send({
        clientName: "Delete Client",
        address: "999 Delete Rd",
        jobType: "general",
      });
    const jobId = createRes.body?.id;
    const res = await request(app).delete(`/api/jobs/${jobId}`).set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    const getRes = await request(app).get(`/api/jobs/${jobId}`).set("Cookie", authCookie);
    expect(getRes.status).toBe(404);
  });

  it("POST /api/jobs returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set("Cookie", authCookie)
      .send({ clientName: "Only name" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });
});

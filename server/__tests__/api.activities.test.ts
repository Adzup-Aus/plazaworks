import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { loginAsAdmin } from "./helpers/auth";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;
let authCookie: string[] = [];
let activityId: string = "";

describe.runIf(hasDb)("API activities", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const out = await createApp();
    app = out.app;
    const { authCookie: c } = await loginAsAdmin(out.app, "api-activities");
    authCookie = c;
    const listRes = await request(app).get("/api/activities").set("Cookie", authCookie);
    if (listRes.status === 200 && Array.isArray(listRes.body) && listRes.body.length > 0) {
      activityId = listRes.body[0].id;
    } else {
      const createRes = await request(app)
        .post("/api/activities")
        .set("Cookie", authCookie)
        .send({ name: "Test Activity" });
      if (createRes.status === 201 && createRes.body?.id) {
        activityId = createRes.body.id;
      }
    }
  });

  it("GET /api/activities returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/activities");
    expect(res.status).toBe(401);
  });

  it("GET /api/activities with auth returns array", async () => {
    const res = await request(app).get("/api/activities").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/activities with auth and valid body returns 201", async () => {
    const res = await request(app)
      .post("/api/activities")
      .set("Cookie", authCookie)
      .send({ name: "New Activity", sortOrder: 10 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe("New Activity");
  });

  it("POST /api/activities with empty name returns 400", async () => {
    const res = await request(app)
      .post("/api/activities")
      .set("Cookie", authCookie)
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("GET /api/activities/:id with auth returns activity", async () => {
    if (!activityId) return;
    const res = await request(app)
      .get(`/api/activities/${activityId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(activityId);
  });

  it("GET /api/activities/:id returns 404 for non-existent id", async () => {
    const res = await request(app)
      .get("/api/activities/non-existent-activity-id-12345")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("PATCH /api/activities/:id with auth updates activity", async () => {
    if (!activityId) return;
    const res = await request(app)
      .patch(`/api/activities/${activityId}`)
      .set("Cookie", authCookie)
      .send({ name: "Updated Activity Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Activity Name");
  });

  it("DELETE /api/activities/:id with auth removes activity", async () => {
    const createRes = await request(app)
      .post("/api/activities")
      .set("Cookie", authCookie)
      .send({ name: "To Delete Activity" });
    const id = createRes.body?.id;
    if (!id) return;
    const res = await request(app)
      .delete(`/api/activities/${id}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const getRes = await request(app)
      .get(`/api/activities/${id}`)
      .set("Cookie", authCookie);
    expect(getRes.status).toBe(404);
  });
});

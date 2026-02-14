import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;
let authCookie: string[] = [];
let clientId: string = "";

describe.runIf(hasDb)("API quotes", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const { storage } = await import("../storage");
    const out = await createApp();
    app = out.app;
    const email = `api-quotes-${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({
      email,
      password: "password123",
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password: "password123",
    });
    authCookie = loginRes.headers["set-cookie"] ?? [];
    const userId = loginRes.body.userId;
    await request(app).get("/api/clients").set("Cookie", authCookie);
    const memberships = await storage.getUserMemberships(userId);
    const orgId = memberships[0]?.organizationId;
    if (orgId) {
      const client = await storage.createClient({
        organizationId: orgId,
        firstName: "Quote",
        lastName: "TestClient",
        email: "client@example.com",
        streetAddress: "456 Client Ave",
      });
      clientId = client.id;
    }
  });

  it("GET /api/quotes returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/quotes");
    expect(res.status).toBe(401);
  });

  it("GET /api/quotes with auth returns array", async () => {
    const res = await request(app).get("/api/quotes").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/quotes with auth and valid body returns 201", async () => {
    if (!clientId) return;
    const res = await request(app)
      .post("/api/quotes")
      .set("Cookie", authCookie)
      .send({
        clientId,
        clientName: "Quote Test Client",
        clientAddress: "456 Client Ave",
        jobType: "plumbing",
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("quoteNumber");
    expect(res.body.clientName).toBe("Quote Test Client");
  });

  it("GET /api/quotes/:id with auth returns quote", async () => {
    if (!clientId) return;
    const createRes = await request(app)
      .post("/api/quotes")
      .set("Cookie", authCookie)
      .send({
        clientId,
        clientName: "Quote Test Client",
        clientAddress: "456 Client Ave",
        jobType: "electrical",
      });
    const quoteId = createRes.body?.id;
    if (!quoteId) return;
    const res = await request(app)
      .get(`/api/quotes/${quoteId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(quoteId);
  });

  it("GET /api/quotes/:id returns 404 for non-existent id", async () => {
    const res = await request(app)
      .get("/api/quotes/non-existent-quote-id-12345")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("PATCH /api/quotes/:id with auth updates quote", async () => {
    if (!clientId) return;
    const createRes = await request(app)
      .post("/api/quotes")
      .set("Cookie", authCookie)
      .send({
        clientId,
        clientName: "Patch Quote Client",
        clientAddress: "789 Patch St",
        jobType: "tiling",
      });
    const quoteId = createRes.body?.id;
    if (!quoteId) return;
    const res = await request(app)
      .patch(`/api/quotes/${quoteId}`)
      .set("Cookie", authCookie)
      .send({ status: "sent" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("sent");
  });

  it("POST /api/quotes/:id/send with auth returns sent quote", async () => {
    if (!clientId) return;
    const createRes = await request(app)
      .post("/api/quotes")
      .set("Cookie", authCookie)
      .send({
        clientId,
        clientName: "Send Quote Client",
        clientAddress: "111 Send St",
        jobType: "general",
      });
    const quoteId = createRes.body?.id;
    if (!quoteId) return;
    const res = await request(app)
      .post(`/api/quotes/${quoteId}/send`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("sent");
    expect(res.body.sentAt).toBeDefined();
  });

  it("POST /api/quotes/:id/accept with auth returns accepted quote", async () => {
    if (!clientId) return;
    const createRes = await request(app)
      .post("/api/quotes")
      .set("Cookie", authCookie)
      .send({
        clientId,
        clientName: "Accept Quote Client",
        clientAddress: "222 Accept St",
        jobType: "plumbing",
      });
    const quoteId = createRes.body?.id;
    if (!quoteId) return;
    await request(app).post(`/api/quotes/${quoteId}/send`).set("Cookie", authCookie);
    const res = await request(app)
      .post(`/api/quotes/${quoteId}/accept`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
    expect(res.body.acceptedAt).toBeDefined();
  });

  it("DELETE /api/quotes/:id with auth removes quote", async () => {
    if (!clientId) return;
    const createRes = await request(app)
      .post("/api/quotes")
      .set("Cookie", authCookie)
      .send({
        clientId,
        clientName: "Delete Quote Client",
        clientAddress: "333 Delete St",
        jobType: "carpentry",
      });
    const quoteId = createRes.body?.id;
    if (!quoteId) return;
    const res = await request(app)
      .delete(`/api/quotes/${quoteId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const getRes = await request(app)
      .get(`/api/quotes/${quoteId}`)
      .set("Cookie", authCookie);
    expect(getRes.status).toBe(404);
  });
});

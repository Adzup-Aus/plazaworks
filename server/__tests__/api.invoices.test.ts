import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;
let authCookie: string[] = [];
let invoiceId: string = "";

describe.runIf(hasDb)("API invoices", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const { storage } = await import("../storage");
    const out = await createApp();
    app = out.app;
    const email = `api-invoices-${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({
      email,
      password: "password123",
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password: "password123",
    });
    authCookie = loginRes.headers["set-cookie"] ?? [];
    const client = await storage.createClient({
      firstName: "Invoice",
      lastName: "TestClient",
      email: "inv@example.com",
      streetAddress: "100 Invoice Ave",
    });
    const invoice = await storage.createInvoice({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      clientAddress: client.streetAddress ?? "100 Invoice Ave",
      status: "draft",
    });
    invoiceId = invoice.id;
  });

  it("GET /api/invoices returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/invoices");
    expect(res.status).toBe(401);
  });

  it("GET /api/invoices with auth returns array", async () => {
    const res = await request(app).get("/api/invoices").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/invoices with auth and valid body returns 201", async () => {
    const { storage } = await import("../storage");
    const client = await storage.createClient({
      firstName: "API",
      lastName: "InvoiceClient",
      email: `api-inv-${Date.now()}@example.com`,
      streetAddress: "200 API St",
    });
    const res = await request(app)
      .post("/api/invoices")
      .set("Cookie", authCookie)
      .send({
        clientId: client.id,
        clientName: "API Invoice Client",
        clientAddress: "200 API St",
        status: "draft",
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("invoiceNumber");
    expect(res.body.clientName).toBe("API Invoice Client");
  });

  it("GET /api/invoices/:id with auth returns invoice with details", async () => {
    if (!invoiceId) return;
    const res = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(invoiceId);
    expect(res.body).toHaveProperty("lineItems");
    expect(res.body).toHaveProperty("payments");
  });

  it("GET /api/invoices/:id returns 404 for non-existent id", async () => {
    const res = await request(app)
      .get("/api/invoices/non-existent-invoice-id-12345")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("PATCH /api/invoices/:id with auth updates invoice", async () => {
    if (!invoiceId) return;
    const res = await request(app)
      .patch(`/api/invoices/${invoiceId}`)
      .set("Cookie", authCookie)
      .send({ status: "sent" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("sent");
  });

  it("GET /api/invoices/:invoiceId/payments with auth returns list", async () => {
    if (!invoiceId) return;
    const res = await request(app)
      .get(`/api/invoices/${invoiceId}/payments`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/invoices/:invoiceId/payments returns 401 when unauthenticated", async () => {
    if (!invoiceId) return;
    const res = await request(app).get(`/api/invoices/${invoiceId}/payments`);
    expect(res.status).toBe(401);
  });

  it("POST /api/invoices/:invoiceId/payments with auth and valid body returns 201", async () => {
    if (!invoiceId) return;
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set("Cookie", authCookie)
      .send({
        amount: "150.00",
        paymentMethod: "bank_transfer",
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("payment");
    expect(res.body.payment).toHaveProperty("id");
    expect(res.body.payment.amount).toBe("150.00");
  });
});

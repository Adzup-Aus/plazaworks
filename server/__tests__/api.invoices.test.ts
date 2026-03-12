import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { loginAsAdmin } from "./helpers/auth";

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
    const { authCookie: c } = await loginAsAdmin(out.app, "api-invoices");
    authCookie = c;
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
        subtotal: "100.00",
        taxRate: "10",
        taxAmount: "10.00",
        total: "110.00",
        amountPaid: "0",
        amountDue: "110.00",
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

  it("POST /api/invoices/:id/payment-link with auth returns invoice", async () => {
    if (!invoiceId) return;
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payment-link`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", invoiceId);
    expect(res.body).toHaveProperty("invoiceNumber");
  });

  it("POST /api/invoices/:id/payment-link returns 401 when unauthenticated", async () => {
    if (!invoiceId) return;
    const res = await request(app).post(`/api/invoices/${invoiceId}/payment-link`);
    expect(res.status).toBe(401);
  });

  it("invoice process: generate from job with no quote returns 400 and does not persist zero-total invoice", async () => {
    const jobRes = await request(app)
      .post("/api/jobs")
      .set("Cookie", authCookie)
      .send({
        clientName: "Invoice Process Client",
        address: "300 Invoice St",
        jobType: "plumbing",
      });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body?.id;
    expect(jobId).toBeDefined();

    const invRes = await request(app)
      .post(`/api/invoices/generate/job/${jobId}`)
      .set("Cookie", authCookie);
    expect(invRes.status).toBe(400);
    expect(invRes.body).toHaveProperty("message");
    expect(invRes.body.message).toMatch(/line item with an amount greater than zero/i);
    const { storage } = await import("../storage");
    const job = await storage.getJob(jobId);
    expect(job?.invoiceId).toBeNull();
  });

  it("invoice process: POST /api/invoices creates invoice and returns 201", async () => {
    const { storage } = await import("../storage");
    const client = await storage.createClient({
      firstName: "Direct",
      lastName: "InvoiceClient",
      email: `direct-inv-${Date.now()}@example.com`,
      streetAddress: "400 Direct St",
    });
    const res = await request(app)
      .post("/api/invoices")
      .set("Cookie", authCookie)
      .send({
        clientId: client.id,
        clientName: "Direct Invoice Client",
        clientAddress: "400 Direct St",
        status: "draft",
        subtotal: "50.00",
        taxRate: "10",
        taxAmount: "5.00",
        total: "55.00",
        amountPaid: "0",
        amountDue: "55.00",
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.invoiceNumber).toBeDefined();
    expect(res.body.clientName).toBe("Direct Invoice Client");
  });

  it("POST /api/invoices with zero total returns 400", async () => {
    const { storage } = await import("../storage");
    const client = await storage.createClient({
      firstName: "Zero",
      lastName: "TotalClient",
      email: `zero-${Date.now()}@example.com`,
      streetAddress: "500 Zero St",
    });
    const res = await request(app)
      .post("/api/invoices")
      .set("Cookie", authCookie)
      .send({
        clientId: client.id,
        clientName: "Zero Total Client",
        clientAddress: "500 Zero St",
        status: "draft",
        subtotal: "0",
        total: "0",
        amountDue: "0",
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/line item with an amount greater than zero/i);
  });
});

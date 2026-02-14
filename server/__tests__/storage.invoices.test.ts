import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { IStorage } from "../storage";

const hasDb = !!process.env.DATABASE_URL;
let storage: IStorage;

describe.runIf(hasDb)("storage (invoices)", () => {
  beforeAll(async () => {
    const m = await import("../storage");
    storage = m.storage;
  });

  const createdOrgIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdInvoiceIds: string[] = [];

  afterEach(async () => {
    for (const id of createdInvoiceIds) {
      await storage.deleteInvoice(id);
    }
    createdInvoiceIds.length = 0;
    for (const id of createdClientIds) {
      await storage.deleteClient(id);
    }
    createdClientIds.length = 0;
    for (const id of createdOrgIds) {
      await storage.deleteOrganization(id);
    }
    createdOrgIds.length = 0;
  });

  async function createTestOrg() {
    const slug = `org-inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await storage.createOrganization({ name: "Invoice Test Org", slug });
    createdOrgIds.push(org.id);
    return org;
  }

  async function createTestClient(organizationId: string) {
    const client = await storage.createClient({
      organizationId,
      firstName: "Invoice",
      lastName: "Client",
      email: `invoice-${Date.now()}@example.com`,
    });
    createdClientIds.push(client.id);
    return client;
  }

  it("createInvoice returns invoice with invoiceNumber", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      clientAddress: "100 Invoice St",
      status: "draft",
    });
    createdInvoiceIds.push(invoice.id);
    expect(invoice.id).toBeDefined();
    expect(invoice.invoiceNumber).toBeDefined();
    expect(invoice.clientName).toBeDefined();
    expect(invoice.status).toBe("draft");
  });

  it("getInvoice returns invoice by id", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: "Get Invoice Client",
      clientAddress: "111 Get St",
      status: "draft",
    });
    createdInvoiceIds.push(invoice.id);
    const found = await storage.getInvoice(invoice.id);
    expect(found?.id).toBe(invoice.id);
    expect(found?.clientName).toBe("Get Invoice Client");
  });

  it("getInvoice returns undefined for non-existent id", async () => {
    const found = await storage.getInvoice("non-existent-invoice-id");
    expect(found).toBeUndefined();
  });

  it("getInvoiceWithDetails returns invoice with lineItems and payments", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: "Details Client",
      clientAddress: "222 Details St",
      status: "draft",
    });
    createdInvoiceIds.push(invoice.id);
    const withDetails = await storage.getInvoiceWithDetails(invoice.id);
    expect(withDetails?.id).toBe(invoice.id);
    expect(Array.isArray(withDetails?.lineItems)).toBe(true);
    expect(Array.isArray(withDetails?.payments)).toBe(true);
  });

  it("getInvoices returns all invoices", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: "List Client",
      clientAddress: "333 List St",
      status: "sent",
    });
    createdInvoiceIds.push(invoice.id);
    const all = await storage.getInvoices();
    expect(Array.isArray(all)).toBe(true);
    expect(all.some((i) => i.id === invoice.id)).toBe(true);
  });

  it("getInvoicesByStatus filters by status", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: "Status Client",
      clientAddress: "444 Status St",
      status: "paid",
    });
    createdInvoiceIds.push(invoice.id);
    const paid = await storage.getInvoicesByStatus("paid");
    expect(paid.some((i) => i.id === invoice.id)).toBe(true);
  });

  it("updateInvoice updates fields", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: "Update Client",
      clientAddress: "555 Update St",
      status: "draft",
    });
    createdInvoiceIds.push(invoice.id);
    const updated = await storage.updateInvoice(invoice.id, { status: "sent" });
    expect(updated?.status).toBe("sent");
  });

  it("sendInvoice updates status to sent", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: "Send Client",
      clientAddress: "666 Send St",
      status: "draft",
    });
    createdInvoiceIds.push(invoice.id);
    const sent = await storage.sendInvoice(invoice.id);
    expect(sent?.status).toBe("sent");
    expect(sent?.sentAt).toBeDefined();
  });

  it("getPaymentsByInvoice returns payments for invoice", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: "Payments Client",
      clientAddress: "777 Payments St",
      status: "draft",
    });
    createdInvoiceIds.push(invoice.id);
    const payments = await storage.getPaymentsByInvoice(invoice.id);
    expect(Array.isArray(payments)).toBe(true);
    expect(payments).toHaveLength(0);
  });

  it("createPayment adds payment to invoice", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: "Payment Client",
      clientAddress: "888 Payment St",
      status: "draft",
    });
    createdInvoiceIds.push(invoice.id);
    const payment = await storage.createPayment({
      invoiceId: invoice.id,
      amount: "100.00",
      paymentMethod: "bank_transfer",
    });
    const payments = await storage.getPaymentsByInvoice(invoice.id);
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe("100.00");
  });

  it("deleteInvoice removes invoice", async () => {
    const org = await createTestOrg();
    const client = await createTestClient(org.id);
    const invoice = await storage.createInvoice({
      organizationId: org.id,
      clientId: client.id,
      clientName: "Delete Client",
      clientAddress: "999 Delete St",
      status: "draft",
    });
    const deleted = await storage.deleteInvoice(invoice.id);
    expect(deleted).toBe(true);
    createdInvoiceIds.push(invoice.id);
    const afterDelete = await storage.getInvoice(invoice.id);
    expect(afterDelete).toBeUndefined();
    createdInvoiceIds.pop();
  });
});

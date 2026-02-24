import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { IStorage } from "../storage";

const hasDb = !!process.env.DATABASE_URL;
let storage: IStorage;

describe.runIf(hasDb)("storage (quotes)", () => {
  beforeAll(async () => {
    const m = await import("../storage");
    storage = m.storage;
  });

  const createdClientIds: string[] = [];
  const createdQuoteIds: string[] = [];
  const createdLineItemIds: string[] = [];

  afterEach(async () => {
    for (const id of createdLineItemIds) {
      await storage.deleteLineItem(id);
    }
    createdLineItemIds.length = 0;
    for (const id of createdQuoteIds) {
      await storage.deleteQuote(id);
    }
    createdQuoteIds.length = 0;
    for (const id of createdClientIds) {
      await storage.deleteClient(id);
    }
    createdClientIds.length = 0;
  });

  async function createTestClient() {
    const client = await storage.createClient({
      firstName: "Quote",
      lastName: "Client",
      email: `quote-${Date.now()}@example.com`,
    });
    createdClientIds.push(client.id);
    return client;
  }

  it("createQuote returns quote with quoteNumber", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      clientAddress: "789 Quote St",
      jobType: "plumbing",
    });
    createdQuoteIds.push(quote.id);
    expect(quote.id).toBeDefined();
    expect(quote.quoteNumber).toBeDefined();
    expect(quote.clientName).toBeDefined();
    expect(quote.jobType).toBe("plumbing");
    expect(quote.status).toBeDefined();
  });

  it("getQuote returns quote by id", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: "Get Quote Client",
      clientAddress: "111 Get St",
      jobType: "electrical",
    });
    createdQuoteIds.push(quote.id);
    const found = await storage.getQuote(quote.id);
    expect(found?.id).toBe(quote.id);
    expect(found?.clientName).toBe("Get Quote Client");
  });

  it("getQuote returns undefined for non-existent id", async () => {
    const found = await storage.getQuote("non-existent-quote-id");
    expect(found).toBeUndefined();
  });

  it("getQuoteWithLineItems returns quote with lineItems array", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: "With Items Client",
      clientAddress: "222 Items St",
      jobType: "carpentry",
    });
    createdQuoteIds.push(quote.id);
    const withItems = await storage.getQuoteWithLineItems(quote.id);
    expect(withItems?.id).toBe(quote.id);
    expect(Array.isArray(withItems?.lineItems)).toBe(true);
    expect(withItems!.lineItems).toHaveLength(0);
  });

  it("getQuotesByStatus filters by status", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: "Status Client",
      clientAddress: "333 Status St",
      jobType: "plumbing",
      status: "sent",
    });
    createdQuoteIds.push(quote.id);
    const sent = await storage.getQuotesByStatus("sent");
    expect(sent.some((q) => q.id === quote.id)).toBe(true);
  });

  it("getQuotesByClient returns quotes for client", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: "Client Quotes",
      clientAddress: "444 Client St",
      jobType: "general",
    });
    createdQuoteIds.push(quote.id);
    const byClient = await storage.getQuotesByClient(client.id);
    expect(byClient.some((q) => q.id === quote.id)).toBe(true);
  });

  it("updateQuote updates fields", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: "Update Client",
      clientAddress: "555 Update St",
      jobType: "tiling",
    });
    createdQuoteIds.push(quote.id);
    const updated = await storage.updateQuote(quote.id, { status: "sent" });
    expect(updated?.status).toBe("sent");
  });

  it("sendQuote updates status to sent", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: "Send Client",
      clientAddress: "666 Send St",
      jobType: "plumbing",
    });
    createdQuoteIds.push(quote.id);
    const sent = await storage.sendQuote(quote.id);
    expect(sent?.status).toBe("sent");
    expect(sent?.sentAt).toBeDefined();
  });

  it("acceptQuote updates status to accepted", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: "Accept Client",
      clientAddress: "777 Accept St",
      jobType: "plumbing",
      status: "sent",
    });
    createdQuoteIds.push(quote.id);
    await storage.sendQuote(quote.id);
    const accepted = await storage.acceptQuote(quote.id);
    expect(accepted?.status).toBe("accepted");
    expect(accepted?.acceptedAt).toBeDefined();
  });

  it("createLineItem and getLineItemsByQuote", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: "LineItem Client",
      clientAddress: "888 Line St",
      jobType: "plumbing",
    });
    createdQuoteIds.push(quote.id);
    const lineItem = await storage.createLineItem({
      quoteId: quote.id,
      description: "Test item",
      unitPrice: "100",
      amount: "100",
    });
    createdLineItemIds.push(lineItem.id);
    const items = await storage.getLineItemsByQuote(quote.id);
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe("Test item");
  });

  it("deleteQuote removes quote", async () => {
    const client = await createTestClient();
    const quote = await storage.createQuote({
      clientId: client.id,
      clientName: "Delete Client",
      clientAddress: "999 Delete St",
      jobType: "general",
    });
    const deleted = await storage.deleteQuote(quote.id);
    expect(deleted).toBe(true);
    createdQuoteIds.push(quote.id);
    const afterDelete = await storage.getQuote(quote.id);
    expect(afterDelete).toBeUndefined();
    createdQuoteIds.pop();
  });
});

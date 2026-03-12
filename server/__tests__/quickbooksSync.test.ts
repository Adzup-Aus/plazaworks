/**
 * QuickBooks sync service tests (T024, T028).
 * Uses real storage/DB; mocks quickbooksClient to avoid calling QuickBooks API.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

const createInvoiceMock = vi.fn();
const createCustomerMock = vi.fn();

vi.mock("../services/quickbooksClient", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue({ access_token: "new-token", expires_in: 3600 }),
  createCustomer: (...args: unknown[]) => createCustomerMock(...args),
  createInvoice: (...args: unknown[]) => createInvoiceMock(...args),
  createPayment: vi.fn().mockResolvedValue("qb-pay-1"),
  voidInvoice: vi.fn().mockResolvedValue(undefined),
  getInvoice: vi.fn().mockResolvedValue({ Id: "1", SyncToken: "0" }),
  getServiceItemRef: vi.fn().mockResolvedValue({ value: "1", name: "Services" }),
  getTaxCodeRef: vi.fn().mockResolvedValue({ value: "TAX" }),
  getNonTaxableTaxCodeRef: vi.fn().mockResolvedValue({ value: "NON" }),
  findCustomerByEmail: vi.fn().mockResolvedValue(null),
  findCustomerByPhone: vi.fn().mockResolvedValue(null),
}));

describe.runIf(hasDb)("QuickBooks sync service", () => {
  let storage: typeof import("../storage").storage;
  let encrypt: (plain: string) => string;
  let conn: { id: string };
  const createdClientIds: string[] = [];
  const createdInvoiceIds: string[] = [];

  beforeAll(async () => {
    const storageMod = await import("../storage");
    storage = storageMod.storage;
    const encryptMod = await import("../lib/encrypt");
    encrypt = encryptMod.encrypt;

    conn = await storage.upsertQuickBooksConnection({
      realm_id: "test-realm-sync",
      encrypted_client_id: encrypt("test-client-id"),
      encrypted_client_secret: encrypt("test-client-secret"),
      encrypted_access_token: encrypt("test-access-token"),
      encrypted_refresh_token: encrypt("test-refresh-token"),
      token_expires_at: new Date(Date.now() + 3600 * 1000),
      enabled_at: new Date(Date.now() - 86400000), // yesterday: invoices created "now" are after this
    });
    createCustomerMock.mockResolvedValue("qb-cust-123");
    createInvoiceMock.mockResolvedValue("qb-inv-123");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    createCustomerMock.mockResolvedValue("qb-cust-123");
    createInvoiceMock.mockResolvedValue("qb-inv-123");
  });

  afterEach(async () => {
    for (const id of createdInvoiceIds) {
      try {
        await storage.deleteInvoice(id);
      } catch {
        // ignore
      }
    }
    createdInvoiceIds.length = 0;
    for (const id of createdClientIds) {
      try {
        await storage.deleteClient(id);
      } catch {
        // ignore
      }
    }
    createdClientIds.length = 0;
  });

  async function createTestClient() {
    const client = await storage.createClient({
      firstName: "Sync",
      lastName: "Test",
      email: `sync-${Date.now()}@example.com`,
    });
    createdClientIds.push(client.id);
    return client;
  }

  async function createTestInvoice(clientId: string) {
    const invoice = await storage.createInvoice({
      clientId,
      clientName: "Sync Test",
      clientAddress: "100 Sync St",
      status: "draft",
    });
    createdInvoiceIds.push(invoice.id);
    return invoice;
  }

  it("T028: does not sync invoice when createdAt < enabled_at (no mapping, createInvoice not called)", async () => {
    const { syncInvoice } = await import("../services/quickbooksSync");
    await storage.upsertQuickBooksConnection({
      enabled_at: new Date(Date.now() + 86400000), // tomorrow: invoice created now is before this
    });
    const client = await createTestClient();
    const invoice = await createTestInvoice(client.id);

    await syncInvoice(conn.id, invoice.id);

    const mapping = await storage.getQuickBooksInvoiceMapping(conn.id, invoice.id);
    expect(mapping).toBeUndefined();
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  it("T024: syncs invoice when createdAt >= enabled_at and creates mapping", async () => {
    await storage.upsertQuickBooksConnection({
      enabled_at: new Date(Date.now() - 86400000), // yesterday
    });
    const client = await createTestClient();
    const invoice = await createTestInvoice(client.id);

    const { syncInvoice } = await import("../services/quickbooksSync");
    await syncInvoice(conn.id, invoice.id);

    expect(createCustomerMock).toHaveBeenCalled();
    expect(createInvoiceMock).toHaveBeenCalled();
    const mapping = await storage.getQuickBooksInvoiceMapping(conn.id, invoice.id);
    expect(mapping).toBeDefined();
    expect(mapping?.quickbooks_invoice_id).toBe("qb-inv-123");
  });

  it("T017: proactiveRefreshQuickBooksToken refreshes token and does not clear connection on transient error", async () => {
    const { storage: storageMod } = await import("../storage");
    const { encrypt: encryptFn } = await import("../lib/encrypt");
    const { proactiveRefreshQuickBooksToken } = await import("../services/quickbooksSync");
    const storageLocal = storageMod;

    // Seed a connection with an access/refresh token and an expiry in the near future
    await storageLocal.upsertQuickBooksConnection({
      realm_id: "test-realm-proactive",
      encrypted_client_id: encryptFn("test-client-id"),
      encrypted_client_secret: encryptFn("test-client-secret"),
      encrypted_access_token: encryptFn("about-to-expire-token"),
      encrypted_refresh_token: encryptFn("refresh-token"),
      token_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      enabled_at: new Date(),
    });

    // First run: should refresh successfully using the mocked refreshAccessToken above.
    await proactiveRefreshQuickBooksToken();
    const afterSuccess = await storageLocal.getQuickBooksConnection();
    expect(afterSuccess?.encrypted_access_token).not.toBeNull();
    expect(afterSuccess?.encrypted_refresh_token).not.toBeNull();

    // Next, simulate a transient error by having refreshAccessToken reject once.
    const quickbooksClient = await import("../services/quickbooksClient");
    const originalRefresh = quickbooksClient.refreshAccessToken;
    (quickbooksClient.refreshAccessToken as unknown as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET: transient network error"))
      .mockImplementation(originalRefresh as never);

    await proactiveRefreshQuickBooksToken();
    const afterTransient = await storageLocal.getQuickBooksConnection();
    // Connection should still be present; transient error should not clear credentials.
    expect(afterTransient?.encrypted_client_id).not.toBeNull();
    expect(afterTransient?.encrypted_client_secret).not.toBeNull();
  });
});

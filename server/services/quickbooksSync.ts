/**
 * QuickBooks sync service: ensure customer, sync invoice, sync payment.
 * One-way sync only: platform → QuickBooks. No data is pulled from QuickBooks to update the platform.
 * Only invoices created after the integration is enabled (invoice.createdAt >= connection.enabled_at) are synced; no historical sync.
 */
import { decrypt, encrypt } from "../lib/encrypt";
import { storage } from "../storage";
import {
  refreshAccessToken,
  createCustomer,
  createInvoice,
  createPayment,
  voidInvoice,
  getServiceItemRef,
  getTaxCodeRef,
  findCustomerByEmail,
  findCustomerByPhone,
  type QBCustomerPayload,
  type QBInvoicePayload,
  type QBLineItem,
  type QBPaymentPayload,
} from "./quickbooksClient";

// When using the connection for an API call, refresh the access token shortly before it expires.
// Long idle periods are handled separately by proactiveRefreshQuickBooksToken (see below).
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000; // refresh ~1 minute before expiry
/** Buffer for proactive refresh: refresh when token expires within this many ms (24h) so integration stays valid without sync traffic. */
const PROACTIVE_REFRESH_BUFFER_MS = 24 * 60 * 60 * 1000;

const INTUIT_ACCESS_TOKEN_MAX_LENGTH = 4096;

function isAuthError(msg: string): boolean {
  return /401|403|AuthenticationFailed|unauthorized|forbidden/i.test(msg);
}

/** T030: Retry once on transient QB API failure (5xx, network). Never retry on 401/403. */
function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|403|AuthenticationFailed|unauthorized|forbidden/i.test(msg)) return false;
  if (/5\d{2}|50\d/.test(msg)) return true;
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(msg)) return true;
  return false;
}

async function createInvoiceWithRetry(
  realmId: string,
  accessToken: string,
  payload: QBInvoicePayload
): Promise<string> {
  try {
    return await createInvoice(realmId, accessToken, payload);
  } catch (err) {
    if (isTransientError(err)) {
      console.warn("QuickBooks createInvoice retry after transient error:", err);
      return await createInvoice(realmId, accessToken, payload);
    }
    throw err;
  }
}

async function createPaymentWithRetry(
  realmId: string,
  accessToken: string,
  payload: QBPaymentPayload
): Promise<string> {
  try {
    return await createPayment(realmId, accessToken, payload);
  } catch (err) {
    if (isTransientError(err)) {
      console.warn("QuickBooks createPayment retry after transient error:", err);
      return await createPayment(realmId, accessToken, payload);
    }
    throw err;
  }
}

export interface ValidConnection {
  connectionId: string;
  realmId: string;
  accessToken: string;
  enabledAt: Date | null;
}

/**
 * Get the single QuickBooks connection with decrypted tokens.
 *
 * - If the access token is close to or past its expiry, this will attempt a refresh using the stored refresh token
 *   and persist the new access token/expiry.
 * - The connection is only cleared (and thus treated as disconnected) when we either cannot refresh the token
 *   or detect an obviously invalid token value (e.g. too long), never merely because the previous access token expired.
 *
 * Returns null if not configured, not connected, or missing enabled_at for sync.
 */
export async function getValidQuickBooksConnection(): Promise<ValidConnection | null> {
  const conn = await storage.getQuickBooksConnection();
  if (!conn?.realm_id || !conn.encrypted_access_token || !conn.encrypted_refresh_token) {
    return null;
  }
  if (!conn.encrypted_client_id || !conn.encrypted_client_secret) {
    return null;
  }

  let accessToken = decrypt(conn.encrypted_access_token);
  const refreshToken = decrypt(conn.encrypted_refresh_token);
  const clientId = decrypt(conn.encrypted_client_id);
  const clientSecret = decrypt(conn.encrypted_client_secret);
  const realmId = conn.realm_id;

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  if (expiresAt && expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS < Date.now()) {
    try {
      const refreshed = await refreshAccessToken(clientId, clientSecret, refreshToken);
      accessToken = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
      const trimmedAccess = typeof refreshed.access_token === "string" ? refreshed.access_token.trim() : "";
      const trimmedRefresh = refreshed.refresh_token && typeof refreshed.refresh_token === "string" ? refreshed.refresh_token.trim() : undefined;
      await storage.upsertQuickBooksConnection({
        encrypted_access_token: encrypt(trimmedAccess),
        token_expires_at: newExpiresAt,
        ...(trimmedRefresh ? { encrypted_refresh_token: encrypt(trimmedRefresh) } : {}),
      });
    } catch (err) {
      console.error("QuickBooks token refresh failed in sync:", err);
      // T029: clear tokens so connection shows as disconnected and user can reconnect
      await storage.upsertQuickBooksConnection({
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        realm_id: null,
        token_expires_at: null,
        enabled_at: null,
      });
      return null;
    }
  }

  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!token || token.length > INTUIT_ACCESS_TOKEN_MAX_LENGTH) {
    await storage.upsertQuickBooksConnection({
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      realm_id: null,
      token_expires_at: null,
      enabled_at: null,
    });
    return null;
  }

  return {
    connectionId: conn.id,
    realmId,
    accessToken: token,
    enabledAt: conn.enabled_at ?? null,
  };
}

/**
 * Force refresh the access token (e.g. after 401 "Malformed bearer token") and return a valid connection.
 * Use when getValidQuickBooksConnection() returned a connection but the API rejected the token.
 */
export async function forceRefreshAndGetValidConnection(): Promise<ValidConnection | null> {
  const conn = await storage.getQuickBooksConnection();
  if (
    !conn?.realm_id ||
    !conn.encrypted_refresh_token ||
    !conn.encrypted_client_id ||
    !conn.encrypted_client_secret
  ) {
    return null;
  }
  const refreshToken = decrypt(conn.encrypted_refresh_token);
  const clientId = decrypt(conn.encrypted_client_id);
  const clientSecret = decrypt(conn.encrypted_client_secret);
  let trimmedAccess: string;
  try {
    const refreshed = await refreshAccessToken(clientId, clientSecret, refreshToken);
    trimmedAccess = typeof refreshed.access_token === "string" ? refreshed.access_token.trim() : "";
    const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
    const trimmedRefresh =
      refreshed.refresh_token && typeof refreshed.refresh_token === "string"
        ? refreshed.refresh_token.trim()
        : undefined;
    await storage.upsertQuickBooksConnection({
      encrypted_access_token: encrypt(trimmedAccess),
      token_expires_at: newExpiresAt,
      ...(trimmedRefresh ? { encrypted_refresh_token: encrypt(trimmedRefresh) } : {}),
    });
  } catch (err) {
    console.warn("QuickBooks force refresh failed:", err instanceof Error ? err.message : err);
    await storage.upsertQuickBooksConnection({
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      realm_id: null,
      token_expires_at: null,
      enabled_at: null,
    });
    return null;
  }
  if (!trimmedAccess || trimmedAccess.length > INTUIT_ACCESS_TOKEN_MAX_LENGTH) return null;
  return {
    connectionId: conn.id,
    realmId: conn.realm_id,
    accessToken: trimmedAccess,
    enabledAt: conn.enabled_at ?? null,
  };
}

/**
 * Proactively refresh the QuickBooks access token when it expires within PROACTIVE_REFRESH_BUFFER_MS (e.g. 24h).
 * Call on a schedule (e.g. every 12h) or on startup so the integration stays valid even when no syncs run.
 */
export async function proactiveRefreshQuickBooksToken(): Promise<void> {
  const conn = await storage.getQuickBooksConnection();
  if (!conn?.encrypted_access_token || !conn.encrypted_refresh_token || !conn.encrypted_client_id || !conn.encrypted_client_secret) {
    return;
  }
  if (!conn.enabled_at) return;

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  const shouldRefresh = !expiresAt || expiresAt.getTime() - PROACTIVE_REFRESH_BUFFER_MS < Date.now();
  if (!shouldRefresh) return;

  const refreshToken = decrypt(conn.encrypted_refresh_token);
  const clientId = decrypt(conn.encrypted_client_id);
  const clientSecret = decrypt(conn.encrypted_client_secret);
  try {
    const refreshed = await refreshAccessToken(clientId, clientSecret, refreshToken);
    const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
    const trimmedAccess = typeof refreshed.access_token === "string" ? refreshed.access_token.trim() : "";
    const trimmedRefresh = refreshed.refresh_token && typeof refreshed.refresh_token === "string" ? refreshed.refresh_token.trim() : undefined;
    await storage.upsertQuickBooksConnection({
      encrypted_access_token: encrypt(trimmedAccess),
      token_expires_at: newExpiresAt,
      ...(trimmedRefresh ? { encrypted_refresh_token: encrypt(trimmedRefresh) } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isInvalidClient = /invalid_client|401/.test(msg);
    if (isInvalidClient) {
      console.warn("QuickBooks proactive refresh skipped: connection credentials invalid or expired. Reconnect in Integrations to fix.");
    } else {
      console.error("QuickBooks proactive token refresh failed:", err);
    }
  }
}

/**
 * Ensure the platform client exists in QuickBooks; create and map if missing.
 * Returns QuickBooks customer Id.
 */
export async function ensureCustomer(connectionId: string, platformClientId: string): Promise<string | null> {
  const valid = await getValidQuickBooksConnection();
  if (!valid || valid.connectionId !== connectionId) return null;

  const client = await storage.getClient(platformClientId);
  if (!client) return null;

  // Prefer QuickBooks lookup by email or phone (per QB API: query by PrimaryEmailAddr / PrimaryPhone)
  const email = client.email?.trim();
  const phone = (client.phone || client.mobilePhone)?.trim();
  if (email) {
    const qbIdByEmail = await findCustomerByEmail(valid.realmId, valid.accessToken, email);
    if (qbIdByEmail) {
      await storage.upsertQuickBooksCustomerMapping({
        quickbooks_connection_id: connectionId,
        platform_client_id: platformClientId,
        quickbooks_customer_id: qbIdByEmail,
      });
      return qbIdByEmail;
    }
  }
  if (phone) {
    const qbIdByPhone = await findCustomerByPhone(valid.realmId, valid.accessToken, phone);
    if (qbIdByPhone) {
      await storage.upsertQuickBooksCustomerMapping({
        quickbooks_connection_id: connectionId,
        platform_client_id: platformClientId,
        quickbooks_customer_id: qbIdByPhone,
      });
      return qbIdByPhone;
    }
  }

  // Fallback: existing mapping (e.g. client had no email/phone when first synced)
  const existing = await storage.getQuickBooksCustomerMapping(connectionId, platformClientId);
  if (existing) return existing.quickbooks_customer_id;

  // T031: require at least a display name for QuickBooks customer
  const displayName = [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || client.company || null;
  if (!displayName || !displayName.trim()) {
    console.warn("QuickBooks ensureCustomer skipped: client has no name or company", { platformClientId });
    return null;
  }

  const payload: QBCustomerPayload = {
    DisplayName: displayName.trim(),
    CompanyName: client.company ?? undefined,
    PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
    PrimaryPhone: client.phone || client.mobilePhone ? { FreeFormNumber: (client.phone || client.mobilePhone) ?? "" } : undefined,
    BillAddr:
      client.streetAddress || client.city
        ? {
            Line1: client.streetAddress ?? undefined,
            City: client.city ?? undefined,
            CountrySubDivisionCode: client.state ?? undefined,
            PostalCode: client.postalCode ?? undefined,
            Country: client.country ?? undefined,
          }
        : undefined,
  };

  try {
    const qbCustomerId = await createCustomer(valid.realmId, valid.accessToken, payload);
    await storage.upsertQuickBooksCustomerMapping({
      quickbooks_connection_id: connectionId,
      platform_client_id: platformClientId,
      quickbooks_customer_id: qbCustomerId,
    });
    return qbCustomerId;
  } catch (err: unknown) {
    console.error("QuickBooks ensureCustomer failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("403") || /unauthorized|forbidden/i.test(msg)) {
      await storage.upsertQuickBooksConnection({
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        realm_id: null,
        token_expires_at: null,
        enabled_at: null,
      });
    }
    return null;
  }
}

/**
 * Map platform invoice (and line items) to QuickBooks payload. Uses invoice snapshot for customer display.
 * itemRef and taxCodeRef must be from the QuickBooks company (GST companies need company tax codes).
 */
function buildQBInvoicePayload(
  qbCustomerId: string,
  itemRef: { value: string; name?: string },
  taxCodeRef: { value: string },
  invoice: { invoiceNumber: string; dueDate?: string | null; clientName: string; lineItems?: Array<{ description: string; quantity: string | number; unitPrice: string; amount: string }> }
): QBInvoicePayload {
  const txnDate = new Date().toISOString().slice(0, 10);
  const dueDate = invoice.dueDate ? String(invoice.dueDate).slice(0, 10) : txnDate;
  const lines: QBLineItem[] = (invoice.lineItems ?? []).map((item) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const amount = Number(item.amount) || qty * unitPrice;
    return {
      Amount: amount,
      DetailType: "SalesItemLineDetail",
      Description: item.description || "Line item",
      SalesItemLineDetail: {
        Qty: qty,
        UnitPrice: unitPrice,
        ItemRef: itemRef,
        TaxCodeRef: taxCodeRef,
      },
    };
  });
  if (lines.length === 0) {
    lines.push({
      Amount: 0,
      DetailType: "SalesItemLineDetail",
      Description: "No line items",
      SalesItemLineDetail: { Qty: 1, UnitPrice: 0, ItemRef: itemRef, TaxCodeRef: taxCodeRef },
    });
  }
  return {
    CustomerRef: { value: qbCustomerId },
    TxnDate: txnDate,
    DueDate: dueDate,
    DocNumber: invoice.invoiceNumber,
    Line: lines,
  };
}

/**
 * Sync a single platform invoice to QuickBooks: ensure customer, create invoice if not yet mapped, upsert mapping.
 * Only runs when connection.enabled_at is set and invoice.createdAt >= connection.enabled_at (one-way, no historical).
 */
export async function syncInvoice(connectionId: string, platformInvoiceId: string): Promise<void> {
  const valid = await getValidQuickBooksConnection();
  if (!valid || valid.connectionId !== connectionId || !valid.enabledAt) {
    return;
  }

  const invoice = await storage.getInvoiceWithDetails(platformInvoiceId);
  if (!invoice) return;

  const enabledAt = valid.enabledAt;
  const createdAt = invoice.createdAt ? new Date(invoice.createdAt) : null;
  if (createdAt && createdAt < enabledAt) return;

  const clientId = invoice.clientId ?? null;
  if (!clientId) return;

  const qbCustomerId = await ensureCustomer(connectionId, clientId);
  if (!qbCustomerId) return;

  const existingMapping = await storage.getQuickBooksInvoiceMapping(connectionId, platformInvoiceId);
  if (existingMapping) return;

  const itemRef = await getServiceItemRef(valid.realmId, valid.accessToken);
  const taxCodeRef = await getTaxCodeRef(valid.realmId, valid.accessToken);
  const payload = buildQBInvoicePayload(qbCustomerId, itemRef, taxCodeRef, {
    invoiceNumber: invoice.invoiceNumber,
    dueDate: invoice.dueDate,
    clientName: invoice.clientName,
    lineItems: invoice.lineItems?.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
    })),
  });

  let lastErr: unknown;
  let validToUse: ValidConnection | null = valid;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!validToUse) break;
    try {
      const qbInvoiceId = await createInvoiceWithRetry(validToUse.realmId, validToUse.accessToken, payload);
      await storage.upsertQuickBooksInvoiceMapping({
        quickbooks_connection_id: connectionId,
        platform_invoice_id: platformInvoiceId,
        quickbooks_invoice_id: qbInvoiceId,
      });
      await storage.insertQuickBooksSyncLog({
        quickbooks_connection_id: connectionId,
        entity_type: "invoice",
        entity_id: platformInvoiceId,
        status: "succeeded",
      });
      console.log("QuickBooks syncInvoice OK:", { platformInvoiceId, qbInvoiceId, invoiceNumber: invoice.invoiceNumber });
      return;
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === 0 && isAuthError(msg)) {
        validToUse = await forceRefreshAndGetValidConnection();
        if (validToUse?.connectionId === connectionId && validToUse.enabledAt) continue;
      }
      break;
    }
  }
  await storage.insertQuickBooksSyncLog({
    quickbooks_connection_id: connectionId,
    entity_type: "invoice",
    entity_id: platformInvoiceId,
    status: "failed",
    error_message: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
  console.error("QuickBooks syncInvoice failed:", lastErr);
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (isAuthError(msg)) {
    await storage.upsertQuickBooksConnection({
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      realm_id: null,
      token_expires_at: null,
      enabled_at: null,
    });
  }
  throw lastErr;
}

/**
 * Sync a payment to QuickBooks: create a Payment in QB linked to the existing QB invoice.
 * Call after recording a platform payment; amountPaid is the amount of this payment.
 */
export async function syncPayment(connectionId: string, platformInvoiceId: string, amountPaid: number): Promise<void> {
  if (amountPaid <= 0) return;

  const valid = await getValidQuickBooksConnection();
  if (!valid || valid.connectionId !== connectionId) return;

  const mapping = await storage.getQuickBooksInvoiceMapping(connectionId, platformInvoiceId);
  if (!mapping) return;

  const invoice = await storage.getInvoice(platformInvoiceId);
  if (!invoice?.clientId) return;

  const qbCustomerId = await ensureCustomer(connectionId, invoice.clientId);
  if (!qbCustomerId) return;

  const payload: QBPaymentPayload = {
    TotalAmt: amountPaid,
    CustomerRef: { value: qbCustomerId },
    Line: [
      {
        Amount: amountPaid,
        LinkedTxn: [{ TxnId: mapping.quickbooks_invoice_id, TxnType: "Invoice" }],
      },
    ],
  };

  let lastErr: unknown;
  let validToUse: ValidConnection | null = valid;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!validToUse) break;
    try {
      await createPaymentWithRetry(validToUse.realmId, validToUse.accessToken, payload);
      await storage.insertQuickBooksSyncLog({
        quickbooks_connection_id: connectionId,
        entity_type: "payment",
        entity_id: platformInvoiceId,
        status: "succeeded",
      });
      return;
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === 0 && isAuthError(msg)) {
        validToUse = await forceRefreshAndGetValidConnection();
        if (validToUse?.connectionId === connectionId) continue;
      }
      break;
    }
  }
  await storage.insertQuickBooksSyncLog({
    quickbooks_connection_id: connectionId,
    entity_type: "payment",
    entity_id: platformInvoiceId,
    status: "failed",
    error_message: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
  console.error("QuickBooks syncPayment failed:", lastErr);
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (isAuthError(msg)) {
    await storage.upsertQuickBooksConnection({
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      realm_id: null,
      token_expires_at: null,
      enabled_at: null,
    });
  }
  throw lastErr;
}

/**
 * Fire-and-forget: sync invoice to QuickBooks if connection is enabled. Safe to call from request handlers.
 */
export function triggerSyncInvoice(platformInvoiceId: string): void {
  void (async () => {
    try {
      const valid = await getValidQuickBooksConnection();
      if (valid?.enabledAt) await syncInvoice(valid.connectionId, platformInvoiceId);
    } catch (err) {
      console.error("QuickBooks triggerSyncInvoice failed:", err);
    }
  })();
}

/**
 * Fire-and-forget: sync a payment to QuickBooks. Safe to call from request handlers.
 */
export function triggerSyncPayment(platformInvoiceId: string, amountPaid: number): void {
  if (amountPaid <= 0) return;
  void (async () => {
    try {
      const valid = await getValidQuickBooksConnection();
      if (valid) await syncPayment(valid.connectionId, platformInvoiceId, amountPaid);
    } catch (err) {
      console.error("QuickBooks triggerSyncPayment failed:", err);
    }
  })();
}

/**
 * Void the QuickBooks invoice when the platform invoice is deleted. Call before or after storage.deleteInvoice.
 * Fire-and-forget: safe to call from request handlers.
 */
export function triggerVoidInvoiceInQuickBooks(platformInvoiceId: string): void {
  void (async () => {
    try {
      const mapping = await storage.getQuickBooksInvoiceMappingByInvoiceId(platformInvoiceId);
      if (!mapping) return;
      const valid = await getValidQuickBooksConnection();
      if (!valid || valid.connectionId !== mapping.quickbooks_connection_id) return;
      await voidInvoice(valid.realmId, valid.accessToken, mapping.quickbooks_invoice_id);
    } catch (err) {
      console.error("QuickBooks void on delete failed:", err);
    }
  })();
}

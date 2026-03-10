/**
 * QuickBooks Online API v3 client: token refresh, Customer, Invoice, Payment, void.
 * Uses realm_id (company id) and access token. Caller is responsible for providing valid token.
 */
const INTUIT_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API_BASE_PRODUCTION = "https://quickbooks.api.intuit.com/v3/company";
const QB_API_BASE_SANDBOX = "https://sandbox-quickbooks.api.intuit.com/v3/company";

function getQBClientBase(): string {
  return process.env.QUICKBOOKS_ENVIRONMENT === "production" ? QB_API_BASE_PRODUCTION : QB_API_BASE_SANDBOX;
}

export interface QBConnectionTokens {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date | null;
}

export interface QBCustomerPayload {
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  CompanyName?: string;
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
}

export interface QBItemRef {
  value: string;
  name?: string;
}

export interface QBLineItem {
  Amount: number;
  DetailType: "SalesItemLineDetail";
  Description: string;
  SalesItemLineDetail: {
    ItemRef: QBItemRef;
    Qty: number;
    UnitPrice: number;
    TaxCodeRef?: { value: string }; // TAX=taxable, NON=non-taxable; required for GST-enabled companies
  };
}

export interface QBInvoicePayload {
  CustomerRef: { value: string };
  TxnDate?: string;
  DueDate?: string;
  DocNumber?: string;
  PrivateNote?: string;
  Line: QBLineItem[];
  AllowOnlineACHPayment?: boolean;
}

export interface QBPaymentPayload {
  TotalAmt: number;
  CustomerRef: { value: string };
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{ TxnId: string; TxnType: string }>;
  }>;
}

async function qbRequest(
  realmId: string,
  accessToken: string,
  method: string,
  path: string,
  body?: object
): Promise<{ data?: unknown; status: number }> {
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!token) {
    throw new Error("QuickBooks API requires a non-empty access token");
  }
  const base = getQBClientBase();
  const sep = path.includes("?") ? "&" : "?";
  const url = path.startsWith("http") ? path : `${base}/${realmId}/${path}${sep}minorversion=75`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    return { data, status: res.status };
  }
  return { data, status: res.status };
}

/** Token response from Intuit token endpoint (auth code or refresh). */
export interface IntuitTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Exchange refresh_token for new access_token. Returns tokens and expiry.
 * Use the returned access_token for QuickBooks API; Intuit Accounting API may reject the
 * token from the auth-code exchange (e.g. "Malformed bearer token: too long") but accept
 * the token from this refresh endpoint.
 */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<IntuitTokenResponse> {
  const res = await fetch(INTUIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QuickBooks token refresh failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  const access_token = (data.access_token && typeof data.access_token === "string" ? data.access_token.trim() : "") || "";
  const refresh_token = data.refresh_token && typeof data.refresh_token === "string" ? data.refresh_token.trim() : undefined;
  if (!access_token || access_token.length > 4096) {
    throw new Error(`QuickBooks token refresh returned invalid access_token length (0 or > 4096)`);
  }
  return {
    access_token,
    expires_in: data.expires_in ?? 3600,
    refresh_token,
  };
}

/**
 * Query QuickBooks entities. Returns QueryResponse data.
 */
export async function qbQuery(
  realmId: string,
  accessToken: string,
  selectStatement: string
): Promise<{ data?: unknown; status: number }> {
  const encoded = encodeURIComponent(selectStatement);
  return qbRequest(realmId, accessToken, "GET", `query?query=${encoded}`);
}

/**
 * Get a Service Item for invoice line items. Sandbox companies may not have item id "1".
 * Queries for a Service-type item; falls back to "1"/"Services" if query fails.
 */
export async function getServiceItemRef(
  realmId: string,
  accessToken: string
): Promise<{ value: string; name: string }> {
  const { data, status } = await qbQuery(realmId, accessToken, "select * from Item where Type = 'Service' maxresults 1");
  if (status === 200 && data && typeof data === "object") {
    const items = (data as { QueryResponse?: { Item?: Array<{ Id: string; Name: string }> } }).QueryResponse?.Item;
    if (items?.length && items[0]?.Id) {
      return { value: items[0].Id, name: items[0].Name ?? "Services" };
    }
  }
  return { value: "1", name: "Services" };
}

/**
 * Get a TaxCode for invoice line items. GST-enabled companies (AU/CA) require a company tax code; "TAX"/"NON" may not exist.
 * Queries TaxCode list and returns the first one (or one named GST/taxable); falls back to "TAX" then "NON".
 */
export async function getTaxCodeRef(
  realmId: string,
  accessToken: string
): Promise<{ value: string }> {
  const { data, status } = await qbQuery(realmId, accessToken, "select * from TaxCode maxresults 10");
  if (status === 200 && data && typeof data === "object") {
    const codes = (data as { QueryResponse?: { TaxCode?: Array<{ Id: string; Name?: string }> } }).QueryResponse?.TaxCode;
    if (codes?.length) {
      const gst = codes.find((c) => /GST|tax|Tax/i.test(c.Name ?? ""));
      return { value: (gst ?? codes[0]).Id };
    }
  }
  return { value: "TAX" };
}

/**
 * Create a Customer in QuickBooks. Returns the created Customer Id.
 */
export async function createCustomer(
  realmId: string,
  accessToken: string,
  payload: QBCustomerPayload
): Promise<string> {
  const { data, status } = await qbRequest(realmId, accessToken, "POST", "customer", payload);
  if (status !== 200 || !data || typeof (data as any).Customer?.Id !== "string") {
    throw new Error(`QuickBooks createCustomer failed: ${status} ${JSON.stringify(data)}`);
  }
  return (data as { Customer: { Id: string } }).Customer.Id;
}

/**
 * Create an Invoice. Returns the created Invoice Id.
 */
export async function createInvoice(
  realmId: string,
  accessToken: string,
  payload: QBInvoicePayload
): Promise<string> {
  const { data, status } = await qbRequest(realmId, accessToken, "POST", "invoice", payload);
  if (status !== 200 || !data || typeof (data as any).Invoice?.Id !== "string") {
    throw new Error(`QuickBooks createInvoice failed: ${status} ${JSON.stringify(data)}`);
  }
  return (data as { Invoice: { Id: string } }).Invoice.Id;
}

/**
 * Read an Invoice by Id (to get SyncToken for update/void).
 */
export async function getInvoice(
  realmId: string,
  accessToken: string,
  invoiceId: string
): Promise<{ Id: string; SyncToken: string } | null> {
  const { data, status } = await qbRequest(realmId, accessToken, "GET", `invoice/${invoiceId}`);
  if (status !== 200 || !data) return null;
  const inv = (data as { Invoice?: { Id: string; SyncToken: string } }).Invoice;
  return inv ? { Id: inv.Id, SyncToken: inv.SyncToken } : null;
}

/**
 * Void an Invoice in QuickBooks (invoice remains but is marked void).
 */
export async function voidInvoice(
  realmId: string,
  accessToken: string,
  invoiceId: string
): Promise<void> {
  const existing = await getInvoice(realmId, accessToken, invoiceId);
  if (!existing) {
    throw new Error(`QuickBooks invoice ${invoiceId} not found for void`);
  }
  const path = `invoice?operation=update&include=void`;
  const { status, data } = await qbRequest(realmId, accessToken, "POST", path, {
    Id: existing.Id,
    SyncToken: existing.SyncToken,
    sparse: true,
  });
  if (status !== 200) {
    throw new Error(`QuickBooks voidInvoice failed: ${status} ${JSON.stringify(data)}`);
  }
}

/**
 * Create a Payment in QuickBooks linked to an invoice.
 */
export async function createPayment(
  realmId: string,
  accessToken: string,
  payload: QBPaymentPayload
): Promise<string> {
  const { data, status } = await qbRequest(realmId, accessToken, "POST", "payment", payload);
  if (status !== 200 || !data || typeof (data as any).Payment?.Id !== "string") {
    throw new Error(`QuickBooks createPayment failed: ${status} ${JSON.stringify(data)}`);
  }
  return (data as { Payment: { Id: string } }).Payment.Id;
}

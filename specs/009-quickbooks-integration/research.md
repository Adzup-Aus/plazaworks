# Research: QuickBooks Integration

**Feature**: 009-quickbooks-integration  
**Date**: 2025-03-09

## 1. QuickBooks Online Authentication (OAuth 2.0)

**Decision**: Use Intuit OAuth 2.0 with authorization-code flow. Store Client ID and Client Secret (encrypted) for the app; after user authorizes, store access token, refresh token, and realm ID (QuickBooks company ID) encrypted.

**Rationale**:
- QuickBooks Online only supports OAuth 2.0 for third-party apps; no long-lived API keys.
- Client ID and Client Secret identify the app; the admin enters these in our config. We then redirect the admin to Intuit to authorize the app for one company (realm); we receive an authorization code and exchange it for access_token and refresh_token.
- Access tokens are short-lived; refresh tokens are used to obtain new access tokens without re-authorization.

**Alternatives considered**:
- Storing only Client ID/Secret and doing token exchange on every request: not supported; we must persist tokens and refresh when expired.
- Skipping OAuth and using a “key” auth: not available for QuickBooks Online.

**Implementation notes**:
- Redirect URL must be registered in Intuit Developer Portal.
- Scopes: at least `com.intuit.quickbooks.accounting` for Customer and Invoice APIs.
- Store: encrypted access_token, refresh_token, realm_id, expires_at; decrypt only in memory when calling QB API; refresh when expires_at is near.

---

## 2. QuickBooks Invoice and Customer API

**Decision**: Use QuickBooks Online REST API (v3) for Customer and Invoice. Before creating an invoice, look up Customer by a stable platform identifier (e.g. store `platform_client_id` in QB Customer display name or custom field, or use a mapping table); if not found, create Customer, then create Invoice linked to that Customer.

**Rationale**:
- Spec requires “ensure customer exists in QuickBooks; if not, create then create invoice.” QB API requires a Customer reference (ID) on the Invoice.
- QB Customer create: `POST /v3/company/{realmId}/customer`. Invoice create: `POST /v3/company/{realmId}/invoice` with `CustomerRef.value` set to the QB Customer id.
- We need a stable way to map platform client → QB customer: either a local mapping table (platform client_id → quickbooks_customer_id) or a QB custom field / display name convention. Mapping table is more reliable and avoids QB schema limits.

**Alternatives considered**:
- Syncing all clients upfront: out of scope; spec says sync only when needed for an invoice.
- Using QB Customer “DisplayName” or “CompanyName” to match: possible but fragile (duplicates, renames); mapping table preferred.

**Implementation notes**:
- Base URL: production `https://quickbooks.api.intuit.com/v3/company/{realmId}/...`; sandbox equivalent for testing.
- Invoice entity: line items (Line), CustomerRef, TxnDate, DueDate, TotalAmt, etc. Map our invoice fields (subtotal, tax, total, dueDate, status) to QB fields.
- Payment status: QB has Payment types; when we record a payment on the platform, create a Payment in QB linked to the Invoice or update invoice status as per QB API behavior.

---

## 3. Secure Storage of Credentials

**Decision**: Encrypt Client ID, Client Secret, access token, and refresh token at rest using a project-standard method (e.g. AES-256 with a key from environment or secrets manager). Do not log or return these values in API responses after save; return only “configured”/“connected” and masked hints if needed.

**Rationale**:
- Spec FR-003 and SC-004 require secure storage and no exposure in logs/URLs/non-admin views.
- Align with existing patterns: if the project already has an encryption helper or env-based key, use it; otherwise introduce a single shared utility and store ciphertext in the database.

**Alternatives considered**:
- Store plaintext in DB with restricted DB access: not acceptable for compliance and spec.
- External secrets manager only: acceptable but adds dependency; at minimum encrypt in DB; secrets manager can hold the encryption key.

**Implementation notes**:
- New table columns: e.g. `encrypted_client_id`, `encrypted_client_secret`, `encrypted_access_token`, `encrypted_refresh_token`, `realm_id` (realm_id can be non-secret), `token_expires_at`.
- Or single jsonb `encrypted_credentials` with structured contents; decrypt in backend only when performing QB API calls or token refresh.

---

## 4. Sync Trigger and Failure Handling

**Decision**: Trigger sync on invoice create/update/status change and on payment create. Implement sync in backend (invoice module or dedicated quickbooks sync service). On failure (invalid/expired credentials, QB API down): log, optionally enqueue for retry; surface a clear “reconnect QuickBooks” or “credentials invalid” message in the Integrations UI so the admin can re-authorize or fix credentials.

**Rationale**:
- Spec FR-008, FR-009: sync when invoice is created, updated, status changed, or payment recorded.
- Edge case: invalid/expired credentials or API unavailable — spec says surface a clear message and handle gracefully (retry or manual fix).
- Sync can be synchronous (in request) or asynchronous (job/queue); async reduces request latency and allows retries. Decision can be made in implementation; spec allows either.

**Alternatives considered**:
- Polling QB for changes to push to platform: explicitly out of scope (one-way platform → QB only).
- No retry: would leave invoices out of sync; at least one retry or a “sync status” for manual retry is better.

---

## 5. “Historical” vs “New” Invoices

**Decision**: Store an “integration enabled at” timestamp (e.g. on the QuickBooks connection record). When processing an invoice for sync, only sync if `invoice.createdAt >= integration_enabled_at`. Do not sync invoices created before that time.

**Rationale**:
- Spec FR-007: only invoices created after the integration is enabled must be synced.
- Clear rule: one timestamp on the connection row; no need to mark individual invoices as “eligible.”

---

## 6. Invoice deleted in platform

**Decision**: When an invoice is deleted in the platform, void the corresponding invoice in QuickBooks (if a mapping exists). Use QuickBooks “void” semantics; do not delete the QB invoice record.

**Rationale**: Spec edge case and FR-012. Void keeps audit trail in QB and matches typical accounting practice.

**Implementation**: On invoice delete, look up `quickbooks_invoice_mappings` by platform_invoice_id; if found, call QB API to void that invoice (e.g. update invoice with Void attribute or use QB void endpoint).

---

## Summary Table

| Topic | Decision | Key detail |
|-------|----------|------------|
| Auth | OAuth 2.0 | Store encrypted Client ID/Secret; after authorize, store access/refresh tokens and realm_id |
| Customer/Invoice API | QB REST v3 | Create customer if missing (with mapping table); then create/update invoice |
| Credential storage | Encrypt at rest | AES or project-standard; no plaintext in DB; no exposure in responses/logs |
| Sync trigger | Invoice + payment events | Backend hook or service; optional queue for retry |
| Historical invoices | Enabled-at timestamp | Only sync invoices with createdAt >= connection.enabledAt |
| Invoice deleted | Void in QuickBooks | If mapping exists, void QB invoice; do not delete QB record |

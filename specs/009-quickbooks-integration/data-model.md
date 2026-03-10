# Data Model: QuickBooks Integration

**Feature**: 009-quickbooks-integration  
**Date**: 2025-03-09

## Entity Relationship Overview

```
┌─────────────────────────────┐     ┌──────────────────────────────────┐
│  quickbooks_connections     │     │  quickbooks_customer_mappings      │
├─────────────────────────────┤     ├──────────────────────────────────┤
│ id (PK)                     │     │ id (PK)                           │
│ encrypted_client_id         │     │ quickbooks_connection_id (FK)     │
│ encrypted_client_secret     │     │ platform_client_id (FK → clients)  │
│ encrypted_access_token     │     │ quickbooks_customer_id (QB id)     │
│ encrypted_refresh_token    │     │ createdAt                          │
│ realm_id                    │     └──────────────────────────────────┘
│ token_expires_at            │                  │
│ enabled_at                  │                  │
│ created_at / updated_at     │     ┌──────────────────────────────────┐
└─────────────────────────────┘     │  quickbooks_invoice_mappings      │
         │                           ├──────────────────────────────────┤
         │                           │ id (PK)                           │
         └──────────────────────────>│ quickbooks_connection_id (FK)    │
                                     │ platform_invoice_id (FK→invoices) │
                                     │ quickbooks_invoice_id (QB id)     │
                                     │ createdAt / updatedAt             │
                                     └──────────────────────────────────┘
```

- One `quickbooks_connections` row per platform (single-tenant: one row; multi-tenant later: one per org).
- `quickbooks_customer_mappings`: platform client → QuickBooks Customer ID (so we reuse QB customer for future invoices).
- `quickbooks_invoice_mappings`: platform invoice → QuickBooks Invoice ID (for updates and payment sync).

## Entities

### quickbooks_connections

Stores one QuickBooks company connection per platform account. Credentials and tokens are stored encrypted.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | varchar/uuid | PK, default gen_random_uuid() | Unique identifier |
| encrypted_client_id | text | NOT NULL when configured | Encrypted Client ID from Intuit |
| encrypted_client_secret | text | NOT NULL when configured | Encrypted Client Secret |
| encrypted_access_token | text | nullable | Encrypted OAuth access token |
| encrypted_refresh_token | text | nullable | Encrypted OAuth refresh token |
| realm_id | varchar(64) | nullable | QuickBooks company (realm) ID from OAuth |
| token_expires_at | timestamp | nullable | When the access token expires |
| enabled_at | timestamp | nullable | When integration was enabled; invoices created before this are not synced |
| created_at | timestamp | NOT NULL, default now() | |
| updated_at | timestamp | NOT NULL, default now() | |

**Validation**: At least one row; only one row if single-tenant. When OAuth is completed, realm_id, encrypted_access_token, encrypted_refresh_token, token_expires_at must be set. enabled_at set when admin completes connection (or on first successful token use).

**Indexes**: None required beyond PK (single row or few rows per tenant).

---

### quickbooks_customer_mappings

Maps platform client to QuickBooks Customer so we reuse the same QB customer for multiple invoices.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | varchar/uuid | PK, default gen_random_uuid() | |
| quickbooks_connection_id | varchar | NOT NULL, FK → quickbooks_connections.id | Which connection |
| platform_client_id | varchar | NOT NULL, FK → clients.id | Platform client |
| quickbooks_customer_id | varchar(64) | NOT NULL | QuickBooks Customer ID (from QB API) |
| created_at | timestamp | NOT NULL, default now() | |

**Uniqueness**: (quickbooks_connection_id, platform_client_id) unique so one QB customer per platform client per connection.

**Indexes**: Unique on (quickbooks_connection_id, platform_client_id); index on quickbooks_connection_id for lookups.

---

### quickbooks_invoice_mappings

Maps platform invoice to QuickBooks Invoice for updates and payment sync.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | varchar/uuid | PK, default gen_random_uuid() | |
| quickbooks_connection_id | varchar | NOT NULL, FK → quickbooks_connections.id | |
| platform_invoice_id | varchar | NOT NULL, FK → invoices.id | Platform invoice |
| quickbooks_invoice_id | varchar(64) | NOT NULL | QuickBooks Invoice ID |
| created_at | timestamp | NOT NULL, default now() | |
| updated_at | timestamp | NOT NULL, default now() | |

**Uniqueness**: (quickbooks_connection_id, platform_invoice_id) unique.

**Indexes**: Unique on (quickbooks_connection_id, platform_invoice_id); index on quickbooks_connection_id and platform_invoice_id for lookups.

---

## Relationship to Existing Entities

- **services**: Add or use an existing Service row with type `quickbooks` and configurationFields describing Client ID and Client Secret (for the config form). Connection data itself lives in `quickbooks_connections`, not in `services`.
- **clients**: `quickbooks_customer_mappings.platform_client_id` references `clients.id`. Platform client is the source for creating QB Customer (name, email, phone, address).
- **invoices**: `quickbooks_invoice_mappings.platform_invoice_id` references `invoices.id`. Invoice create/update/payment events trigger sync; only if `invoices.createdAt >= quickbooks_connections.enabled_at`.

---

## State and Validation Rules

- **Connection**: “Configured” when encrypted_client_id and encrypted_client_secret are set. “Connected” when realm_id and valid tokens are present (and optionally enabled_at set). UI can show “Configured” vs “Connected” and prompt for OAuth if not connected.
- **Sync eligibility**: Invoice is eligible for sync only if there is an active connection with enabled_at set and invoice.createdAt >= enabled_at.
- **Customer**: Before creating a QB invoice, look up quickbooks_customer_mappings by (connection_id, invoice.clientId); if missing, create Customer in QB, insert mapping, then create Invoice.

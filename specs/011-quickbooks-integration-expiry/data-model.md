# Data Model: QuickBooks Integration Token Expiry Fix

## Entities

### QuickBooksConnection

- **Description**: Represents the configured QuickBooks Online connection for this deployment, including credentials and connection state.
- **Key fields** (conceptual):
  - `id`: unique identifier.
  - `encrypted_client_id`: stored client ID (encrypted).
  - `encrypted_client_secret`: stored client secret (encrypted).
  - `encrypted_access_token`: current access token (encrypted).
  - `encrypted_refresh_token`: current refresh token (encrypted).
  - `realm_id`: QuickBooks company identifier.
  - `token_expires_at`: timestamp when the current access token expires.
  - `enabled_at`: timestamp when sync was enabled; used to bound which invoices are eligible for sync.

### QuickBooksConnectionStatus (derived, not persisted)

- **Description**: Logical status presented to the UI based on the connection record.
- **States**:
  - `configured`: credentials (client id/secret) are stored.
  - `connected`: realm and valid/refreshable tokens exist.
  - `disconnected`: no realm or tokens, or tokens cannot be refreshed.

### QuickBooksSyncLog (existing)

- **Description**: Records sync attempts for invoicing and payments, including failures due to auth or expiry.

## Relationships

- A single `QuickBooksConnection` is associated with many `QuickBooksSyncLog` entries via `quickbooks_connection_id`.

## Validation and Behaviour Rules

- `encrypted_client_id` and `encrypted_client_secret` must both be present before OAuth can start.
- `encrypted_refresh_token` must be non‑empty to attempt token refresh.
- `token_expires_at` must be updated whenever a new access token is issued.
- The integration should be considered “connected” if:
  - credentials are configured, and
  - realm id is present, and
  - either the access token is valid or a refresh can be attempted with the stored refresh token.


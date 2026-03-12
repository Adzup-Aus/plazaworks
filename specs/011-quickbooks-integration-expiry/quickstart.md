# Quickstart: QuickBooks Integration Token Expiry Fix

## Goal

Ensure the QuickBooks integration stays connected during normal use by refreshing access tokens proactively and only marking the integration as disconnected when credentials can no longer be renewed.

## Steps to Implement

1. **Backend: token refresh behaviour**
   - Review `server/services/quickbooksSync.ts`:
     - Confirm `TOKEN_EXPIRY_BUFFER_MS` and `PROACTIVE_REFRESH_BUFFER_MS` values are appropriate for covering overnight/weekend gaps.
     - Ensure `getValidQuickBooksConnection` only clears the connection when the access token is invalid *and* cannot be refreshed, not merely when it is expired.
     - Verify `proactiveRefreshQuickBooksToken` is idempotent and logs failures without unnecessarily clearing valid credentials.

2. **Backend: scheduling**
   - In `server/index.ts`, confirm `proactiveRefreshQuickBooksToken` is invoked on startup and at the intended interval (e.g. every 12 hours).
   - Adjust comments or configuration as needed to make the schedule clear and maintainable.

3. **Backend: connection status**
   - In `server/modules/quickbooks/routes.ts`, review `/api/quickbooks/status` and `/api/quickbooks/connection`:
     - Ensure `connected` reflects whether the integration has a realm and valid/refreshable tokens, not just whether an access token field is non‑null.
     - Avoid clearing `enabled_at` unless the integration is truly disconnected and requires a fresh OAuth flow.

4. **Frontend: status display**
   - In `client/src/pages/integrations.tsx`, verify that `QuickBooksConnectionStatus` is used to show accurate connection state and guide admins:
     - When `configured && connected`, show that QuickBooks is connected and ready.
     - When `configured && !connected`, show clear messaging and a call‑to‑action to reconnect.

5. **Testing**
   - Add or extend tests in `server/__tests__/api.quickbooks.test.ts` (or similar) to cover:
     - Status and sync behaviour after simulated expiry where a refresh is still possible.
     - Behaviour when refresh fails permanently (e.g. invalid_client or revoked refresh token).
   - Run `npm run test:env` and ensure all tests pass.

## How to Verify

1. Connect QuickBooks in the Integrations page and confirm `/api/quickbooks/connection` reports `configured: true`, `connected: true`.
2. Simulate time passing beyond access token expiry but within the proactive refresh window (e.g. by advancing `token_expires_at` in the DB), then trigger a sync or call `/api/quickbooks/status`; it should succeed without requiring reconnection.
3. Simulate a revoked or invalid refresh token and verify the system treats the integration as disconnected and prompts reconnection in the UI (e.g. `/api/quickbooks/connection` returns `connected: false` and the Integrations page shows a reconnect call-to-action).


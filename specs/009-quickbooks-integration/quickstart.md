# QuickBooks Integration – Developer Quickstart

**Feature**: 009-quickbooks-integration

## Prerequisites

- Node.js and project dependencies installed.
- Intuit Developer account: [developer.intuit.com](https://developer.intuit.com).
- QuickBooks Online sandbox company for testing.

## 1. Intuit Developer Setup

1. Log in to [developer.intuit.com](https://developer.intuit.com) and create or open an app.
2. In **Keys & OAuth**:
   - Copy **Client ID** and **Client Secret** (used in the Integrations → Services → QuickBooks form).
   - Set **Redirect URI** to your app’s OAuth callback, e.g. `https://your-domain.com/api/quickbooks/oauth/callback` (or `http://localhost:PORT/api/quickbooks/oauth/callback` for local dev).
3. Under **Scopes**, enable at least:
   - `com.intuit.quickbooks.accounting` (Customer and Invoice APIs).

## 2. Environment and database

- **Encryption**: Optional `QUICKBOOKS_ENCRYPTION_KEY` (min 16 chars); otherwise `ENCRYPTION_KEY` or `SESSION_SECRET` is used for encrypting stored tokens.
- **Database**: Run the QuickBooks migration: `npm run db:migrate:quickbooks` (or `npx tsx scripts/run-migration.ts migrations/007_quickbooks_tables.sql`).
- **Seed**: Ensure the QuickBooks service exists in Services: `npm run seed:quickbooks-service` (inserts a Service row with `type: 'quickbooks'` if missing).

## 3. Configure in App

1. Run the app and log in as an admin.
2. Go to **Integrations** → **Services** tab.
3. Open **QuickBooks** (ensure a Service of type `quickbooks` exists; seed or create via Services API if needed).
4. Enter **Client ID** and **Client Secret** from the Intuit app, then save.
5. Start OAuth: use the “Connect to QuickBooks” (or similar) action; you’ll be redirected to Intuit, then back to the app. After that, the connection is “Connected” and sync can run.

## 4. Sync Behavior

- **When**: On invoice create, update, status change, or payment record (backend only).
- **Rules**: Only invoices with `createdAt >= quickbooks_connections.enabled_at` are synced. For each invoice, the system ensures the customer exists in QuickBooks (create if missing), then creates or updates the invoice and reflects payment status.
- **Direction**: Platform → QuickBooks only; no pull from QuickBooks.

## 5. Testing

- Use QuickBooks **Sandbox** and a sandbox company for development.
- Create a new invoice after the integration is enabled and confirm it appears in QuickBooks with the correct customer.
- Record a payment on the invoice and confirm status/amount in QuickBooks.
- Test invalid/expired tokens: disconnect or revoke in Intuit and confirm the app shows a clear “reconnect” or “credentials invalid” message.
- Run API tests: `npm run test:env` (QuickBooks tests use mocked QB client when `DATABASE_URL` is set).

## 6. Key Files (Implementation)

- **Config & OAuth**: `server/modules/quickbooks/routes.ts` (or under integrations): connection CRUD, OAuth start/callback.
- **Sync**: `server/services/quickbooksSync.ts` (or under modules/quickbooks): ensure customer, create/update invoice, payment; called from invoice/payment lifecycle.
- **Schema**: `shared/models/quickbooks.ts` (or additions in `integrations.ts`): `quickbooks_connections`, `quickbooks_customer_mappings`, `quickbooks_invoice_mappings`.
- **UI**: Integrations page Services tab + QuickBooks config form (Client ID, Client Secret, Connect/Disconnect).

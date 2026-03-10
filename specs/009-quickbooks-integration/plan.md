# Implementation Plan: QuickBooks Integration

**Branch**: `009-quickbooks-integration` | **Date**: 2025-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-quickbooks-integration/spec.md`

## Summary

Implement one-way sync of invoices (and required customers) from the platform to QuickBooks Online. Admins configure QuickBooks in the Integrations page (Services tab) using Client ID and Client Secret; credentials are stored securely. Only new invoices (created after the integration is enabled) are synced. For each invoice, the system ensures the customer exists in QuickBooks (create if missing), then creates or updates the invoice and reflects payment status. Platform is the source of truth; no historical or reverse sync.

Key technical approach:
- Add QuickBooks as a Service and a per-account connection store (encrypted credentials and OAuth tokens).
- New module or extension for QuickBooks: OAuth flow, Customer/Invoice API client, sync trigger on invoice create/update/payment.
- Sync runs on invoice lifecycle events (create, update, status change, payment); optional retry/queue for resilience.

## Technical Context

**Language/Version**: TypeScript 5.x (existing)
**Primary Dependencies**: Express (existing), Drizzle ORM (existing), QuickBooks Online API (OAuth 2.0 + REST)
**Storage**: PostgreSQL via Drizzle; new tables for QuickBooks connection and sync mapping (invoice ↔ QuickBooks ID)
**Testing**: Vitest with dotenv (`npm run test:env`); API tests for integration config and sync behavior
**Target Platform**: Web (Node.js backend + React frontend)
**Project Type**: Full-stack web application (server + client)
**Performance Goals**: Sync completion within one sync cycle; config save < 2s
**Constraints**: Credentials encrypted at rest; no sync from QuickBooks to platform
**Scale/Scope**: One QuickBooks company per platform account; invoice volume per account as per existing app

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Check | Status | Notes |
|-------|--------|-------|
| Backend module structure | PASS | New `server/modules/quickbooks/` with routes.ts and model.ts (or extend integrations module with quickbooks sub-logic) |
| New tables in shared | PASS | New tables in `shared/models/integrations.ts` or new `shared/models/quickbooks.ts`: connection + sync mapping |
| Frontend | PASS | Integrations page already has Services tab; add QuickBooks service and config form (no new page) |
| Tests | PASS | API tests for QuickBooks config and sync; cover auth, validation |
| Verification | PASS | `npm run test:env` after changes |

**Gate Result**: PASS – No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-quickbooks-integration/
├── plan.md              # This file
├── research.md          # Phase 0: QuickBooks OAuth, Invoice API, credential storage
├── data-model.md        # Phase 1: Connection, sync mapping entities
├── quickstart.md        # Phase 1: Developer setup for QuickBooks
├── contracts/           # Phase 1: API contracts for config and internal sync
└── tasks.md             # Phase 2: (created by /speckit.tasks)
```

### Source Code (repository root)

```text
server/
├── modules/
│   ├── integrations/    # Existing; extend with QuickBooks config endpoints or link
│   └── quickbooks/      # New: OAuth, QB client, sync on invoice events
│       ├── routes.ts    # Optional: QB-specific routes (e.g. OAuth callback)
│       └── model.ts     # Re-exports from @shared/schema
├── services/            # Or under modules/quickbooks/
│   └── quickbooksSync.ts  # Sync logic: ensure customer, create/update invoice, payment
shared/
└── models/
    ├── integrations.ts  # Existing; add quickbooks_connections or similar
    └── quickbooks.ts   # Or new: connection, invoice_sync_mapping
client/
└── src/
    ├── pages/
    │   └── integrations.tsx  # Existing; Services tab shows QuickBooks
    └── components/
        └── integrations/
            └── QuickBooksConfigForm.tsx  # Client ID, Client Secret form
```

**Structure Decision**: New `server/modules/quickbooks/` for QB-specific routes and sync service; new shared model for connection and sync mapping. Integrations module and Services tab remain the UI surface for adding/configuring QuickBooks.

## Complexity Tracking

No constitution violations requiring justification.

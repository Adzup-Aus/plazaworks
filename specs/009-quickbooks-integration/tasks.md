# Tasks: QuickBooks Integration

**Input**: Design documents from `/specs/009-quickbooks-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Constitution requires API tests for new features. API test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Backend: `server/`, `shared/`
- Frontend: `client/src/`
- Paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: QuickBooks-specific setup and credential encryption

- [x] T001 Add credential encryption utility (AES-256 or project-standard) in `server/lib/encrypt.ts` or reuse existing; key from env (e.g. `QUICKBOOKS_ENCRYPTION_KEY` or app secret)
- [x] T002 [P] Ensure QuickBooks Service exists: add seed or migration that inserts a Service row with `type: 'quickbooks'` and `configurationFields` for Client ID and Client Secret in `shared/models/integrations.ts` / seed script or `server/db/seed.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, storage, and module registration that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Define `quickbooks_connections`, `quickbooks_customer_mappings`, and `quickbooks_invoice_mappings` tables and insert schemas in `shared/models/quickbooks.ts`; re-export from `shared/schema.ts`
- [x] T004 Add Drizzle migration for the three QuickBooks tables (run migration generation if project uses migrations)
- [x] T005 Implement storage methods for QuickBooks: getQuickBooksConnection, upsertQuickBooksConnection, getQuickBooksCustomerMapping, upsertQuickBooksCustomerMapping, getQuickBooksInvoiceMapping, upsertQuickBooksInvoiceMapping in `server/storage.ts` (and IStorage interface)
- [x] T006 Create `server/modules/quickbooks/model.ts` re-exporting QuickBooks-related schema from `@shared/schema`
- [x] T007 Register QuickBooks routes in `server/routes/index.ts`: import `registerQuickBooksRoutes` from `../modules/quickbooks/routes` and call it in `registerRoutes()`

**Checkpoint**: Foundation ready – user story implementation can now begin

---

## Phase 3: User Story 1 – Configure QuickBooks and connect account (Priority: P1) – MVP

**Goal**: Admin can open Integrations → Services, select QuickBooks, enter Client ID and Client Secret, save (credentials stored securely), complete OAuth, and see connection status. One account linked to one QuickBooks company.

**Independent Test**: Open Integrations → Services, select QuickBooks, enter credentials, save, complete OAuth; verify integration shows as configured/connected and credentials are not exposed in UI or API response.

### Implementation for User Story 1

- [x] T008 [P] [US1] Implement GET `/api/quickbooks/connection` in `server/modules/quickbooks/routes.ts` returning connection status (configured, connected, realmId, enabledAt) without credentials or tokens; require admin auth
- [x] T009 [P] [US1] Implement PUT `/api/quickbooks/connection` in `server/modules/quickbooks/routes.ts` accepting clientId and clientSecret, encrypting and storing in quickbooks_connections; require admin auth; validate body with Zod
- [x] T010 [US1] Implement GET `/api/quickbooks/oauth/start` in `server/modules/quickbooks/routes.ts` building Intuit authorization URL and returning it (or redirecting); require credentials to be saved first
- [x] T011 [US1] Implement GET `/api/quickbooks/oauth/callback` in `server/modules/quickbooks/routes.ts` exchanging code and realmId for tokens, storing encrypted tokens and realm_id, setting enabled_at, redirecting to Integrations page with success/error
- [x] T012 [US1] Implement POST `/api/quickbooks/disconnect` in `server/modules/quickbooks/routes.ts` clearing tokens and realm_id (optionally enabled_at); keep Client ID/Secret for reconnect; require admin auth
- [x] T013 [US1] Add QuickBooks config form component in `client/src/components/integrations/QuickBooksConfigForm.tsx` with Client ID and Client Secret fields, Save, Connect to QuickBooks (OAuth start), and Disconnect; call GET/PUT connection and oauth/start APIs
- [x] T014 [US1] In Integrations page Services tab, show QuickBooks when a Service with type `quickbooks` exists; when user selects QuickBooks, render QuickBooksConfigForm and load connection status via GET `/api/quickbooks/connection` in `client/src/pages/integrations.tsx` and related ServiceCard/flow
- [x] T015 [US1] Enforce one QuickBooks connection per platform: upsert single row in quickbooks_connections (e.g. single global row or by fixed key) in storage and routes
- [x] T016 [US1] Add API tests for QuickBooks config and auth in `server/__tests__/api.quickbooks.test.ts`: unauthenticated 401 for GET/PUT connection and oauth/start; 400 for invalid body on PUT; happy path mock or skip OAuth callback in test

**Checkpoint**: User Story 1 complete – admin can configure and connect QuickBooks; test independently

---

## Phase 4: User Story 2 – Sync new invoices and ensure customers exist in QuickBooks (Priority: P2)

**Goal**: When an invoice is created, updated, or its status changes (or a payment is recorded), the system ensures the client exists in QuickBooks, then creates or updates the invoice and payment status in QuickBooks.

**Independent Test**: With QuickBooks connected and enabled_at set, create a new invoice; verify customer and invoice exist in QuickBooks. Update invoice or add payment; verify QuickBooks reflects the change.

### Implementation for User Story 2

- [x] T017 [P] [US2] Implement QuickBooks API client (OAuth token refresh, Customer create/read, Invoice create/update, Payment create if needed) in `server/services/quickbooksClient.ts` or `server/modules/quickbooks/quickbooksClient.ts` using realm_id and stored tokens
- [x] T018 [US2] Implement sync service: ensureCustomer(connectionId, platformClientId), syncInvoice(connectionId, platformInvoiceId), syncPayment(connectionId, platformInvoiceId) in `server/services/quickbooksSync.ts`; use quickbooks_customer_mappings and quickbooks_invoice_mappings; only sync if connection.enabled_at is set and invoice.createdAt >= connection.enabled_at
- [x] T019 [US2] In ensureCustomer: look up quickbooks_customer_mappings by (connectionId, platformClientId); if missing, create Customer in QB via client, insert mapping, then return QB customer id
- [x] T020 [US2] In syncInvoice: load invoice with client and line items; ensure customer (T019); create or update Invoice in QB (create if no quickbooks_invoice_mapping); upsert quickbooks_invoice_mappings
- [x] T021 [US2] In syncPayment: after platform payment is recorded, update QB invoice/payment status (create Payment in QB or update invoice per QB API) and keep mapping in sync
- [x] T022 [US2] Invoke QuickBooks sync from invoice and payment lifecycle: call syncInvoice after storage.createInvoice and storage.updateInvoice when QuickBooks connection is connected and enabled_at set and invoice.createdAt >= enabled_at; call syncPayment after storage.createPayment / storage.createInvoicePayment where payment is for an invoice; add calls in `server/modules/invoices/routes.ts` and `server/modules/payments/routes.ts` (or centralize in storage layer)
- [x] T023 [US2] Map platform invoice fields to QuickBooks Invoice (line items, CustomerRef, TxnDate, DueDate, TotalAmt, etc.) and platform client to QuickBooks Customer (DisplayName, PrimaryEmailAddr, PrimaryPhone, etc.) per research.md and QB API docs in `server/services/quickbooksSync.ts`
- [x] T024 [US2] Add API or integration tests for sync in `server/__tests__/api.quickbooks.test.ts`: with mocked QB client, create invoice and assert syncInvoice called and mapping created; or run against sandbox and assert invoice appears in QB
- [x] T025 [US2] On platform invoice delete: when an invoice is deleted, if a quickbooks_invoice_mapping exists, call QuickBooks API to void the corresponding invoice (do not delete the QB record); invoke from invoice delete flow in `server/modules/invoices/routes.ts` or storage layer; implement void in `server/services/quickbooksClient.ts` and call from sync or routes

**Checkpoint**: User Story 2 complete – new invoices and payments sync to QuickBooks; delete → void in QB; test independently

---

## Phase 5: User Story 3 – No historical or reverse sync (Priority: P3)

**Goal**: Only invoices created after the integration is enabled are synced; changes in QuickBooks do not sync back to the platform.

**Independent Test**: Enable integration; confirm pre-existing invoices are not synced; confirm edits in QuickBooks do not update the platform.

### Implementation for User Story 3

- [x] T026 [US3] Enforce enabled_at and createdAt in sync: in `server/services/quickbooksSync.ts` (or callers), skip sync when invoice.createdAt < connection.enabled_at; document that only new invoices are synced
- [x] T027 [US3] Confirm no reverse sync: ensure no jobs or endpoints pull from QuickBooks to update platform invoices/clients; add a short comment or guard in sync service that sync is one-way only
- [x] T028 [US3] Add test in `server/__tests__/api.quickbooks.test.ts`: invoice created before enabled_at is not synced (e.g. sync not called or no mapping created)

**Checkpoint**: User Story 3 complete – historical and reverse sync rules enforced and testable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, docs, and edge-case handling

- [x] T029 [P] Handle invalid/expired credentials: when QB API returns 401/403, clear or mark connection as needing re-auth and return clear error to UI; surface “Reconnect QuickBooks” in `client/src/components/integrations/QuickBooksConfigForm.tsx` when connection fails
- [x] T030 [P] Handle QB API temporary failure: in sync service, log failure and optionally retry once or leave for manual retry; do not expose raw QB errors to non-admin users
- [x] T031 Validate client data before sync: in `server/services/quickbooksSync.ts`, ensure required customer fields (e.g. name) exist on platform client before creating QB customer; return clear error or skip sync with reason if invalid
- [x] T032 Run `npm run test:env` and fix any failing tests; ensure all new code paths are covered per constitution
- [x] T033 [P] Update quickstart.md or developer docs if any steps changed during implementation; run through quickstart once to validate

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies – can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 – BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 – no dependency on US2/US3
- **Phase 4 (US2)**: Depends on Phase 2 and Phase 3 (connection must exist to sync)
- **Phase 5 (US3)**: Depends on Phase 2 and Phase 4 (sync service must exist to enforce rules)
- **Phase 6 (Polish)**: Depends on Phases 3–5

### User Story Dependencies

- **US1 (P1)**: After Foundational only – independently testable (config + OAuth)
- **US2 (P2)**: After US1 (needs connection and enabled_at) – independently testable (create invoice, check QB)
- **US3 (P3)**: After US2 (enforcement in sync service) – independently testable (pre-existing invoice not synced)

### Parallel Opportunities

- T001 and T002 can run in parallel (encryption util vs Service seed)
- T008, T009 can run in parallel (different route handlers)
- T017 can start after T005 (client only needs connection schema/storage)
- T029, T030 can run in parallel (different error-handling paths)
- T033 can run in parallel with T031/T032

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup  
2. Complete Phase 2: Foundational  
3. Complete Phase 3: User Story 1  
4. **STOP and VALIDATE**: Configure and connect QuickBooks in UI; run API tests  
5. Deploy/demo config and connection flow

### Incremental Delivery

1. Setup + Foundational → foundation ready  
2. Add US1 → test config and OAuth → deploy (MVP)  
3. Add US2 → test invoice and payment sync → deploy  
4. Add US3 → test no historical/reverse → deploy  
5. Polish → error handling, tests, docs

### Suggested MVP Scope

- **MVP**: Phase 1 + Phase 2 + Phase 3 (User Story 1) – QuickBooks appears in Services, admin can save credentials and complete OAuth, connection status visible; no sync yet.

---

## Notes

- All tasks use checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- [P] = parallelizable; [US1/US2/US3] = user story for traceability
- Run `npm run test:env` after backend changes (constitution requirement)
- Commit after each task or logical group

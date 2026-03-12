# Tasks: QuickBooks Integration Token Expiry Fix

**Input**: Design documents from `/specs/011-quickbooks-integration-expiry/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: This plan includes a small number of targeted test tasks to satisfy the constitution’s requirement for backend tests and the quickstart’s verification steps.

**Organization**: Tasks are grouped by user story (US1–US3) to enable independent implementation and testing of each story, with a shared Setup and Foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- All descriptions include concrete file paths

---

## Phase 1: Setup (Shared Context)

**Purpose**: Understand existing QuickBooks integration behaviour and code paths.

- [x] T001 [P] Review current QuickBooks token handling and refresh logic in `server/services/quickbooksSync.ts`.  
- [x] T002 [P] Review QuickBooks connection and status endpoints in `server/modules/quickbooks/routes.ts` (including `/api/quickbooks/status`, `/api/quickbooks/connection`, `/api/quickbooks/refresh-token`).  
- [x] T003 [P] Review QuickBooks-related UI usage in `client/src/pages/integrations.tsx` and `client/src/pages/invoice-detail.tsx` for how connection status and sync state are displayed.  

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ensure testing and documentation foundations are ready before changing behaviour.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Ensure a QuickBooks API test file exists (or create one if missing) at `server/__tests__/api.quickbooks.test.ts` with a basic test harness for QuickBooks endpoints.  
- [x] T005 [P] Confirm that proactive token refresh is wired on startup and interval in `server/index.ts` (import and `setInterval` for `proactiveRefreshQuickBooksToken`) and document current schedule in a short comment.  
- [x] T006 [P] Document QuickBooks integration token behaviour and assumptions in `specs/011-quickbooks-integration-expiry/research.md` based on findings from T001–T005 (update or extend existing entries as needed).  

**Checkpoint**: Foundation ready – user story implementation can now begin.

---

## Phase 3: User Story 1 – Integration Stays Connected During Normal Use (Priority: P1) 🎯 MVP

**Goal**: Keep the QuickBooks integration connected during normal and moderate idle periods so that occasional syncs and status checks succeed without re-authorization.

**Independent Test**: With QuickBooks connected, allow several hours (or a day) of no sync activity, then trigger a sync or open Integrations; the integration remains connected and operations succeed without reconnecting.

### Implementation for User Story 1

- [x] T007 [P] [US1] Refine token expiry and refresh behaviour in `server/services/quickbooksSync.ts` (within `getValidQuickBooksConnection`) so the connection is only cleared when access tokens are invalid *and* cannot be refreshed, not merely when expired.  
- [x] T008 [P] [US1] Verify and, if needed, adjust `TOKEN_EXPIRY_BUFFER_MS` and comments in `server/services/quickbooksSync.ts` to ensure refresh is attempted early enough to avoid unnecessary expiry during normal use.  
- [x] T009 [US1] Ensure `/api/quickbooks/status` in `server/modules/quickbooks/routes.ts` reports QuickBooks as enabled when a connection exists and tokens are valid or refreshable, aligning with the “stays connected” requirement.  
- [x] T010 [P] [US1] Add or extend API tests in `server/__tests__/api.quickbooks.test.ts` to cover: a) status and sync behaviour when the access token is near expiry but refreshable, and b) confirming that no reconnect is required in this case.  
- [x] T011 [US1] Run `npm run test:env` and fix any regressions related to QuickBooks status or sync introduced by T007–T010.  

**Checkpoint**: User Story 1 is fully functional and independently testable (serves as MVP).

---

## Phase 4: User Story 2 – Reconnection Only When Necessary (Priority: P2)

**Goal**: Only require reconnection when renewal is no longer possible (e.g. refresh token revoked, credentials invalid), and ensure both backend and UI reflect this clearly.

**Independent Test**: With a valid connection, the UI never shows “disconnected” during periods when the backend can still refresh tokens. After simulating a revoked/invalid refresh token, the system shows disconnected and prompts reconnection.

### Implementation for User Story 2

- [x] T012 [P] [US2] Review and refine failure paths in `server/services/quickbooksSync.ts` (including `proactiveRefreshQuickBooksToken` and any error handling that clears tokens) so credentials are only cleared when provider responses indicate unrecoverable failure (e.g. `invalid_client` or similar).  
- [x] T013 [US2] Update logic for `/api/quickbooks/connection` in `server/modules/quickbooks/routes.ts` so `configured` and `connected` derive from the presence of credentials, realm, and refreshable tokens (per `QuickBooksConnectionStatus` in `data-model.md`).  
- [x] T014 [P] [US2] Update QuickBooks connection messaging and call-to-action in `client/src/pages/integrations.tsx` to: a) treat `configured && connected` as “connected”, and b) show a clear “Reconnect QuickBooks” path only when `configured && !connected`.  
- [x] T015 [US2] Extend tests in `server/__tests__/api.quickbooks.test.ts` to simulate revoked/invalid refresh tokens and assert that the backend reports a disconnected state and does not attempt repeated failing refreshes.  

**Checkpoint**: User Stories 1 and 2 both work independently; reconnection is only requested when renewal is impossible.

---

## Phase 5: User Story 3 – Sync and Status After Idle Period (Priority: P3)

**Goal**: Ensure that after longer idle periods (e.g. overnight or a weekend), the first sync or status check still works without reconnection whenever the provider still allows renewal.

**Independent Test**: With QuickBooks connected, simulate 24–48 hours of idle time (by manipulating `token_expires_at` and invoking the proactive refresh path) and confirm that subsequent status and sync calls succeed without requiring reconnection.

### Implementation for User Story 3

- [x] T016 [P] [US3] Confirm that `PROACTIVE_REFRESH_BUFFER_MS` in `server/services/quickbooksSync.ts` and the 12-hour scheduling in `server/index.ts` together cover the desired 24–48h idle window; adjust buffer or scheduling (and comments) as needed to meet the spec while staying within provider limits.  
- [x] T017 [P] [US3] Add or update tests in `server/__tests__/quickbooksSync.test.ts` to simulate tokens approaching expiry and assert that `proactiveRefreshQuickBooksToken` refreshes tokens and does not clear valid credentials on transient failures.  
- [x] T018 [US3] Verify that existing UI flows in `client/src/pages/integrations.tsx` and `client/src/pages/invoice-detail.tsx` still treat the integration as connected after a simulated long idle, and adjust any conditional UI messages if they incorrectly suggest expiry in this scenario.  

**Checkpoint**: All three user stories are independently testable and support both short and long idle periods without unnecessary reconnection.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, documentation alignment, and cross-story improvements.

- [x] T019 [P] Update `specs/011-quickbooks-integration-expiry/quickstart.md` to reflect the final implemented behaviour and exact verification steps for token expiry and reconnection.  
- [x] T020 [P] Perform an end-to-end validation of QuickBooks integration flows (connect, idle, sync, revoked token) following `quickstart.md`, and capture any remaining notes or edge cases in `specs/011-quickbooks-integration-expiry/research.md`.  

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies – can start immediately.  
- **Foundational (Phase 2)**: Depends on Setup completion – **blocks all user stories**.  
- **User Stories (Phases 3–5)**: All depend on Foundational completion.  
  - User Story 1 (P1) is the MVP and should be implemented first.  
  - User Stories 2 and 3 build on the same connection semantics but are still independently testable once US1 is in place.  
- **Polish (Phase 6)**: Depends on all targeted user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2; no dependency on other stories and forms the MVP.  
- **User Story 2 (P2)**: Should start after US1 since it refines reconnection behaviour on top of the “stays connected” semantics.  
- **User Story 3 (P3)**: Can start after US1 and the foundational proactive refresh behaviour are in place; does not strictly depend on US2 but benefits from completed reconnection semantics.  

### Within Each User Story

- Prefer to complete backend logic before UI adjustments.  
- Update or add tests (T010, T011, T015, T017) in close proximity to the implementation changes they cover.  
- Ensure each story passes its independent test description before moving on to the next.

### Parallel Opportunities

- All tasks marked **[P]** are candidates for parallel execution (different files, minimal direct dependencies):  
  - T001–T003 (Setup reviews)  
  - T005–T006 (Foundational clarifications and documentation)  
  - T007–T008, T010 (US1 backend changes and tests)  
  - T012, T014 (US2 backend and frontend updates)  
  - T016–T017 (US3 scheduling and tests)  
  - T019–T020 (Polish/documentation and end-to-end validation)  
- Different user stories (Phases 3–5) can be worked on by different developers once Phase 2 is complete, as long as they coordinate on shared files like `quickbooksSync.ts` and `quickbooks/routes.ts`.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).  
2. Complete Phase 2 (Foundational).  
3. Implement Phase 3 (User Story 1) tasks T007–T011.  
4. Run `npm run test:env` and perform the US1 independent test scenario.  
5. Deploy or demo as an MVP if the behaviour meets SC-001 and SC-002 from the spec.

### Incremental Delivery

1. After MVP, implement Phase 4 (User Story 2) to tighten reconnection semantics.  
2. Implement Phase 5 (User Story 3) to validate behaviour after longer idle periods.  
3. Finish with Phase 6 (Polish) to align docs and capture final learnings.

### Parallel Team Strategy

With multiple developers:

- Developer A: Lead on backend token handling (`server/services/quickbooksSync.ts`, `server/modules/quickbooks/routes.ts`) and related tests.  
- Developer B: Lead on frontend connection status and messaging (`client/src/pages/integrations.tsx`, `client/src/pages/invoice-detail.tsx`).  
- Developer C: Focus on tests and simulation scenarios (`server/__tests__/api.quickbooks.test.ts`, `server/__tests__/quickbooksSync.test.ts`) and end-to-end validation per `quickstart.md`.  

Coordinate merges carefully for shared backend files and keep tasks aligned with the user stories and phases above.


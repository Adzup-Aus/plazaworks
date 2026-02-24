# Tasks: Functional Staff Permission System

**Input**: Design documents from `/specs/004-staff-permissions/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Backend API tests included as per constitution requirements

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and preparation - minimal setup as this integrates into existing codebase

- [ ] T001 [P] Verify branch is `004-staff-permissions` and working directory is clean
- [ ] T002 [P] Run `npm run test:env` to establish baseline test status before changes

---

## Phase 2: Foundational (Blocking Prerequisites) 🚧 CRITICAL

**Purpose**: Core permission infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Backend Permission Infrastructure

- [ ] T003 [P] Extend `userPermissions` enum in `shared/models/staff.ts` with 14 new permissions (view_dashboard, view_quotes, create_quotes, edit_quotes, delete_quotes, view_invoices, create_invoices, edit_invoices, delete_invoices, view_activities, view_clients, create_clients, edit_clients, delete_clients)
- [ ] T004 Create permission middleware `server/middleware/permissions.ts` with `requirePermission()`, `requireAnyPermission()`, `requireAllPermissions()` functions
- [ ] T005 Add permission helper functions to `server/routes/shared.ts`: `checkPermission()`, `getUserPermissions()`, `isAdmin()`, `normalizePermissions()`
- [ ] T006 Update `server/modules/auth/routes.ts` `/api/auth/user` endpoint to include resolved permissions array in response (including implied permissions)

### Frontend Permission Infrastructure

- [ ] T007 [P] Create `client/src/lib/permissions.ts` with permission constants, normalization function, and `filterNavByPermissions()` utility
- [ ] T008 Create `client/src/hooks/use-permissions.ts` with `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()`, `canView()`, `canCreate()`, `canEdit()`, `canDelete()` functions
- [ ] T009 Create `client/src/components/permission-gate.tsx` component for declarative permission-based rendering
- [ ] T010 Create `client/src/components/permission-redirect.tsx` component for route-level permission guards

### Shared Permission Utilities

- [ ] T011 [P] Define `PERMISSION_IMPLICATIONS` mapping in `shared/models/staff.ts` (create/edit/delete → view)
- [ ] T012 [P] Define `NAV_PERMISSION_MAP` in `client/src/lib/permissions.ts` mapping navigation items to required permissions

**Checkpoint**: Foundation ready - permission infrastructure exists and can be imported anywhere. Run `npm run test:env` to verify no regressions.

---

## Phase 3: User Story 1 - Admin Configures Staff Permissions (Priority: P1) 🎯 MVP

**Goal**: Admins can assign permissions to staff members through the Team page UI, and permissions are persisted and returned in the user session.

**Independent Test**: 
1. Log in as admin
2. Go to Team page
3. Edit a staff member
4. Toggle permissions on/off
5. Save
6. Log in as that staff member
7. Verify `/api/auth/user` response includes the assigned permissions

### Backend Tests for User Story 1

- [ ] T013 [P] [US1] Create API test `server/__tests__/api.permissions.test.ts` - Test that `/api/auth/user` returns correct permissions array
- [ ] T014 [P] [US1] Create API test - Test that staff profile update persists permissions correctly

### Implementation for User Story 1

- [ ] T015 [US1] Verify `server/modules/staff/routes.ts` PATCH endpoint accepts and persists permissions array correctly (may already work - verify only)
- [ ] T016 [US1] Update `server/modules/auth/routes.ts` to normalize permissions (add implied view permissions) when returning user data
- [ ] T017 [US1] Verify `client/src/pages/team.tsx` permission editing UI works with new permission values
- [ ] T018 [US1] Update permission display in Team page to show new permission descriptions

**Checkpoint**: User Story 1 complete. Admin can assign permissions, and they appear in user session. Test: Change permissions → re-login → verify permissions in API response.

---

## Phase 4: User Story 2 - Staff Views Authorized Sections Only (Priority: P1) 🎯 MVP

**Goal**: Navigation items are filtered based on permissions. Dashboard is hidden unless user has `view_dashboard` permission or is admin.

**Independent Test**:
1. Create a staff member with only `view_jobs` permission
2. Log in as that staff member
3. Verify only Jobs appears in navigation
4. Verify Dashboard is NOT visible
5. Add `view_dashboard` permission
6. Refresh → Dashboard should appear

### Backend Tests for User Story 2

- [ ] T019 [P] [US2] Create API test - Test that admin user gets all permissions in session response
- [ ] T020 [P] [US2] Create API test - Test that staff with `view_dashboard` gets dashboard access

### Implementation for User Story 2

- [ ] T021 [US2] Update `client/src/components/app-sidebar.tsx` to filter `mainNavItems` using `filterNavByPermissions()`
- [ ] T022 [US2] Update `client/src/components/app-sidebar.tsx` to filter `dashboardsNavItems` with special handling for Dashboard (requires `view_dashboard` OR admin)
- [ ] T023 [US2] Update `client/src/App.tsx` `AuthenticatedRouter` to redirect to first authorized section if user tries to access `/` without `view_dashboard` permission
- [ ] T024 [US2] Create `client/src/pages/no-access.tsx` page for users with zero permissions
- [ ] T025 [US2] Update `client/src/App.tsx` to show `NoAccess` page when user has no permissions

**Checkpoint**: User Story 2 complete. Navigation respects permissions, dashboard visibility is controlled. Test: Remove all permissions → verify no-access page → add one permission → verify that section appears.

---

## Phase 5: User Story 3 - Staff Performs Authorized Actions Only (Priority: P1) 🎯 MVP

**Goal**: Action buttons (Create, Edit, Delete) are hidden based on permissions across Jobs, Quotes, and Invoices pages.

**Independent Test**:
1. Give staff member `view_jobs` but NOT `create_jobs`
2. Go to Jobs page
3. Verify "Create Job" button is hidden
4. Give `create_jobs` permission
5. Refresh → "Create Job" button should appear
6. Repeat for Edit and Delete actions

### Backend Tests for User Story 3

- [ ] T026 [P] [US3] Create API test - Test that POST /api/jobs returns 403 without `create_jobs` permission
- [ ] T027 [P] [US3] Create API test - Test that PATCH /api/jobs/:id returns 403 without `edit_jobs` permission
- [ ] T028 [P] [US3] Create API test - Test that DELETE /api/jobs/:id returns 403 without `delete_jobs` permission

### Implementation for User Story 3

- [ ] T029 [US3] Update `client/src/pages/jobs.tsx` to hide "Create Job" button when user lacks `create_jobs` permission using `<PermissionGate>`
- [ ] T030 [US3] Update `client/src/pages/jobs.tsx` to hide Edit/Delete actions in job rows based on `edit_jobs`/`delete_jobs` permissions
- [ ] T031 [US3] Update `client/src/pages/quotes.tsx` to hide Create/Edit/Delete actions based on quote permissions
- [ ] T032 [US3] Update `client/src/pages/invoices.tsx` to hide Create/Edit/Delete actions based on invoice permissions
- [ ] T033 [US3] Update `client/src/pages/clients.tsx` to hide Create/Edit/Delete actions based on client permissions

**Checkpoint**: User Story 3 complete. Action buttons respect permissions. Test: Toggle create/edit/delete permissions → verify buttons show/hide accordingly.

---

## Phase 6: User Story 4 - Backend Enforces Permission Checks (Priority: P2)

**Goal**: All API endpoints enforce permission checks and return 403 for unauthorized requests.

**Independent Test**:
1. Get valid auth cookie/token
2. Send direct POST to /api/jobs without `create_jobs` permission
3. Verify 403 Forbidden response
4. Add permission → retry → should succeed

### Backend Tests for User Story 4

- [ ] T034 [P] [US4] Create API test - Test that all job endpoints enforce permissions
- [ ] T035 [P] [US4] Create API test - Test that all quote endpoints enforce permissions
- [ ] T036 [P] [US4] Create API test - Test that all invoice endpoints enforce permissions
- [ ] T037 [P] [US4] Create API test - Test that all client endpoints enforce permissions
- [ ] T038 [P] [US4] Create API test - Test that all staff endpoints enforce permissions
- [ ] T039 [P] [US4] Create API test - Test that admin bypasses all permission checks

### Implementation for User Story 4

- [ ] T040 [US4] Add `requirePermission('view_jobs')` middleware to all job GET endpoints in `server/modules/jobs/routes.ts`
- [ ] T041 [US4] Add `requirePermission('create_jobs')` middleware to POST /api/jobs endpoint
- [ ] T042 [US4] Add `requirePermission('edit_jobs')` middleware to PATCH /api/jobs/:id endpoint
- [ ] T043 [US4] Add `requirePermission('delete_jobs')` middleware to DELETE /api/jobs/:id endpoint
- [ ] T044 [P] [US4] Add permission middleware to all quote endpoints in `server/modules/quotes/routes.ts`
- [ ] T045 [P] [US4] Add permission middleware to all invoice endpoints in `server/modules/invoices/routes.ts`
- [ ] T046 [P] [US4] Add permission middleware to all client endpoints in `server/modules/clients/routes.ts`
- [ ] T047 [P] [US4] Add permission middleware to all staff endpoints in `server/modules/staff/routes.ts`
- [ ] T048 [P] [US4] Add permission middleware to all activity endpoints in `server/modules/activities/routes.ts`
- [ ] T049 [P] [US4] Add permission middleware to schedule endpoints in `server/modules/schedule/routes.ts`

**Checkpoint**: User Story 4 complete. Backend enforces all permission checks. Test: Make direct API calls without permissions → verify 403 responses.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Testing, documentation, and final validation

### Testing & Validation

- [ ] T050 [P] Run full test suite: `npm run test:env` - All tests must pass
- [ ] T051 [P] Verify permission implication logic: create/edit/delete permissions automatically grant view permission
- [ ] T052 [P] Verify admin role grants all permissions
- [ ] T053 [P] Test edge case: User with no permissions sees NoAccess page
- [ ] T054 [P] Test edge case: Permission revocation takes effect on next page load
- [ ] T055 [P] Verify Team page displays all new permissions with readable labels

### Documentation

- [ ] T056 Update `SPECKIT_CONSTITUTION.md` if permission patterns should be followed for new features
- [ ] T057 Verify all new files have appropriate headers/comments

### Code Quality

- [ ] T058 [P] Review all permission checks for consistency
- [ ] T059 [P] Ensure no hardcoded permission strings - use constants from `shared/models/staff.ts`
- [ ] T060 Verify error messages are user-friendly ("You don't have permission to create jobs" not "403 Forbidden")

**Final Checkpoint**: Feature complete. All user stories work independently. All tests pass.

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Status |
|-------|-----------|--------|
| Phase 1: Setup | None | Can start immediately |
| Phase 2: Foundational | Phase 1 | BLOCKS all user stories |
| Phase 3: US1 | Phase 2 | Can start after Foundation |
| Phase 4: US2 | Phase 2, US1 recommended | Can start after Foundation |
| Phase 5: US3 | Phase 2, US1 recommended | Can start after Foundation |
| Phase 6: US4 | Phase 2 | Can start after Foundation |
| Phase 7: Polish | All user stories | Final phase |

### User Story Dependencies

- **US1 (Admin Configures)**: Independent - only needs Foundation
- **US2 (View Sections)**: Independent - only needs Foundation and US1 for testing
- **US3 (Action Buttons)**: Independent - only needs Foundation and US1 for testing
- **US4 (Backend Enforcement)**: Independent - only needs Foundation

**All user stories can be developed in parallel after Foundation is complete.**

### Critical Path

```
Setup → Foundation → US1 → (US2, US3, US4 in parallel) → Polish
```

### Within-Story Dependencies

**US1 (Admin Configures)**:
- T015, T016, T017, T018 can be done in any order after T003-T012
- T013, T014 tests should be written before/during implementation

**US2 (View Sections)**:
- T021 and T022 (sidebar filtering) can be done in parallel
- T023 (redirect) depends on T021, T022
- T024, T025 (no-access page) are independent

**US3 (Action Buttons)**:
- T029-T033 are independent - can be done in parallel across different pages

**US4 (Backend Enforcement)**:
- T040-T043 (jobs) are independent
- T044-T049 (other modules) are independent

---

## Parallel Execution Opportunities

### Maximum Parallelization (5 developers)

**Developer A**: Foundation Phase
- T003, T004, T005, T006 (Backend infrastructure)

**Developer B**: Foundation Phase
- T007, T008, T009, T010, T011, T012 (Frontend/shared infrastructure)

**Developer C**: US1 + US2
- T013-T018 (US1)
- T019-T025 (US2)

**Developer D**: US3
- T026-T033 (Action buttons across all pages)

**Developer E**: US4
- T034-T049 (Backend endpoint enforcement)

### Minimum Implementation (1 developer)

Follow strict sequential order:
1. Phase 1 (T001-T002)
2. Phase 2 (T003-T012) - CRITICAL: All must complete
3. Phase 3 (T013-T018)
4. Phase 4 (T019-T025)
5. Phase 5 (T026-T033)
6. Phase 6 (T034-T049)
7. Phase 7 (T050-T060)

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T012) - CRITICAL
3. Complete Phase 3: US1 (T013-T018)
4. Complete Phase 4: US2 (T019-T025)
5. Complete Phase 5: US3 (T026-T033)
6. **STOP and VALIDATE**: Full manual test of permission system
7. Deploy/demo if ready

**MVP delivers**: Working permission system with UI enforcement. Backend enforcement (US4) can be added later.

### Full Implementation (All User Stories)

1. Complete Setup + Foundational
2. Complete US1 + US2 + US3 (can be parallel)
3. Complete US4 (Backend enforcement)
4. Complete Phase 7: Polish
5. Run full test suite
6. Deploy

### Testing Strategy

- Run `npm run test:env` after each phase
- Manual testing checklist:
  - [ ] Admin can assign all permissions
  - [ ] Staff with `view_jobs` sees Jobs nav item
  - [ ] Staff without `view_jobs` does NOT see Jobs nav item
  - [ ] Staff without `view_dashboard` does NOT see Dashboard
  - [ ] Staff with `create_jobs` sees Create button
  - [ ] Staff without `create_jobs` does NOT see Create button
  - [ ] Direct API call without permission returns 403
  - [ ] Admin bypasses all permission checks
  - [ ] User with no permissions sees NoAccess page

---

## Notes

- [P] tasks = different files, no dependencies - safe to run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- All permission strings MUST come from `userPermissions` enum - no hardcoding
- Backend tests MUST pass before considering feature complete (per constitution)
- Permission changes take effect immediately (no caching)
- Admin role (`admin` in roles array) bypasses all permission checks

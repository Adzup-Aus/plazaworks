# Tasks: Role-Based Permission Management

**Input**: Design documents from `/specs/005-role-permissions/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md, research.md

**Tests**: API tests included as per project standards (Vitest + Supertest)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure - minimal since we're extending existing codebase

- [ ] T001 [P] Verify database connection and existing schema in `shared/schema.ts`
- [ ] T002 [P] Review existing permission middleware in `server/middleware/permissions.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema (Required for all stories)

- [ ] T003 Create `shared/models/roles.ts` with `roles` and `role_permissions` tables
- [ ] T004 [P] Re-export roles models from `shared/schema.ts`
- [ ] T005 Generate and run database migration (`npm run db:generate && npm run db:migrate`)

### Backend Storage Layer (Required for all stories)

- [ ] T006 [P] Add role CRUD methods to `server/storage.ts`:
  - `getRoles()`, `getRole(id)`, `getRoleByName(name)`
  - `createRole(role)`, `updateRole(id, updates)`, `deleteRole(id)`
- [ ] T007 [P] Add role permission methods to `server/storage.ts`:
  - `getRolePermissions(roleId)`, `setRolePermissions(roleId, permissions)`
- [ ] T008 Add role-aware permission resolution to `server/storage.ts`:
  - `getUserPermissionsFromRoles(staffProfile)` method

### Backend Permission Middleware Update (Required for all stories)

- [ ] T009 Update `server/middleware/permissions.ts`:
  - Modify `getUserPermissions()` to aggregate role permissions
  - Combine direct permissions with role-based permissions

**Checkpoint**: Foundation ready - database schema exists, storage methods available, permission middleware updated

---

## Phase 3: User Story 1 - View and Navigate to Roles Management (Priority: P1) 🎯 MVP

**Goal**: Add "Roles" navigation to sidebar and create empty roles page

**Independent Test**: Verify a "Roles" menu item appears in the left sidebar, is clickable, and navigates to a roles management page.

### Implementation for User Story 1

- [ ] T010 [P] [US1] Add "Roles" nav item to `client/src/components/app-sidebar.tsx`
  - Place alongside Jobs, Invoices, Quotes
  - Use Shield icon (existing import from lucide-react)
  - Require `admin_settings` permission
- [ ] T011 [P] [US1] Add `/roles` route in `client/App.tsx` (AuthenticatedRouter)
- [ ] T012 [US1] Create empty `client/src/pages/roles.tsx` page component
  - Default export, basic container structure
  - Include page title "Role Management"

**Checkpoint**: User Story 1 complete - Navigate to Roles page via sidebar

---

## Phase 4: User Story 2 - Create New Roles (Priority: P1) 🎯 MVP

**Goal**: Backend CRUD for roles + Frontend role list and create form

**Independent Test**: Create a new role with a name and description, verify it appears in the roles list.

### API Tests for User Story 2

- [ ] T013 [P] [US2] Create `server/__tests__/api.roles.test.ts` with test:
  - `GET /api/roles` returns roles list (empty initially)
  - `POST /api/roles` creates new role
  - `POST /api/roles` validates name is required
  - `POST /api/roles` enforces unique name

### Backend Implementation for User Story 2

- [ ] T014 [P] [US2] Create `server/modules/roles/model.ts` (re-exports from @shared/schema)
- [ ] T015 [US2] Create `server/modules/roles/routes.ts` with endpoints:
  - `GET /api/roles` - list all roles
  - `POST /api/roles` - create role
- [ ] T016 [US2] Register routes in `server/routes/index.ts`:
  - Import `registerRolesRoutes` from `../modules/roles/routes`
  - Call `registerRolesRoutes(app)` in `registerRoutes()`

### Frontend Implementation for User Story 2

- [ ] T017 [P] [US2] Create `client/src/hooks/use-roles.ts`:
  - `useRoles()` query hook for fetching roles
  - `useCreateRole()` mutation hook
- [ ] T018 [US2] Update `client/src/pages/roles.tsx`:
  - Add role list view (table showing name, description)
  - Add "Create Role" button opening modal/dialog
  - Integrate `useRoles()` hook to fetch and display roles
- [ ] T019 [P] [US2] Create `client/src/components/role-form.tsx`:
  - Form with name (required) and description (optional) fields
  - Validation for required name
  - Submit creates role via `useCreateRole()`

**Checkpoint**: User Story 2 complete - Can view roles list and create new roles

---

## Phase 5: User Story 3 - Assign Permissions to Roles (Priority: P1) 🎯 MVP

**Goal**: Backend permission assignment + Frontend permission toggle UI

**Independent Test**: Assign permissions to a role and verify those permissions are saved and retrievable.

### API Tests for User Story 3

- [ ] T020 [P] [US3] Add tests to `server/__tests__/api.roles.test.ts`:
  - `GET /api/roles/:id/permissions` returns role permissions
  - `PUT /api/roles/:id/permissions` sets role permissions
  - `GET /api/permissions` returns all available permissions with metadata

### Backend Implementation for User Story 3

- [ ] T021 [P] [US3] Update `server/modules/roles/routes.ts` with endpoints:
  - `GET /api/roles/:id/permissions` - get role permissions
  - `PUT /api/roles/:id/permissions` - set role permissions
  - `GET /api/permissions` - list all permissions with metadata
- [ ] T022 [P] [US3] Create permission metadata structure in `server/modules/roles/routes.ts`:
  - Map each `userPermission` to display name, description, category
  - Categories: Dashboard, Jobs, Quotes, Invoices, Schedule, Activities, Users, Clients, Reports, Settings

### Frontend Implementation for User Story 3

- [ ] T023 [P] [US3] Update `client/src/hooks/use-roles.ts`:
  - `useRolePermissions(roleId)` query hook
  - `useSetRolePermissions(roleId)` mutation hook
  - `useAvailablePermissions()` query hook
- [ ] T024 [US3] Create `client/src/components/permission-editor.tsx`:
  - Display permissions grouped by category
  - Toggle switches for each permission
  - Show permission descriptions
  - Save button calls `useSetRolePermissions()`
- [ ] T025 [US3] Update `client/src/pages/roles.tsx`:
  - Add "Edit Permissions" button to each role row
  - Open permission editor in modal/drawer

**Checkpoint**: User Story 3 complete - Can assign permissions to roles (MVP COMPLETE!)

---

## Phase 6: User Story 4 - Modify Existing Roles (Priority: P2)

**Goal**: Edit role name/description and update permissions

**Independent Test**: Modify an existing role's details and permissions, verify changes are saved.

### API Tests for User Story 4

- [ ] T026 [P] [US4] Add tests to `server/__tests__/api.roles.test.ts`:
  - `GET /api/roles/:id` returns single role
  - `PATCH /api/roles/:id` updates role name/description
  - `PATCH /api/roles/:id` validates unique name constraint

### Backend Implementation for User Story 4

- [ ] T027 [P] [US4] Update `server/modules/roles/routes.ts` with endpoints:
  - `GET /api/roles/:id` - get single role
  - `PATCH /api/roles/:id` - update role

### Frontend Implementation for User Story 4

- [ ] T028 [P] [US4] Update `client/src/hooks/use-roles.ts`:
  - `useRole(roleId)` query hook for single role
  - `useUpdateRole(roleId)` mutation hook
- [ ] T029 [P] [US4] Update `client/src/components/role-form.tsx`:
  - Support edit mode (pre-populate with existing values)
  - Submit updates via `useUpdateRole()`
- [ ] T030 [US4] Update `client/src/pages/roles.tsx`:
  - Add "Edit" button to each role row
  - Open role form in edit mode

**Checkpoint**: User Story 4 complete - Can edit existing roles

---

## Phase 7: User Story 5 - Delete Roles (Priority: P2)

**Goal**: Delete unused roles with validation

**Independent Test**: Delete a role with no assigned staff, verify it no longer appears in the list. Verify error when trying to delete role with assigned staff.

### API Tests for User Story 5

- [ ] T031 [P] [US5] Add tests to `server/__tests__/api.roles.test.ts`:
  - `DELETE /api/roles/:id` deletes role successfully
  - `DELETE /api/roles/:id` returns 409 if role has assigned staff
  - `DELETE /api/roles/:id` returns 403 for system roles

### Backend Implementation for User Story 5

- [ ] T032 [US5] Update `server/modules/roles/routes.ts` with endpoint:
  - `DELETE /api/roles/:id` - delete role
  - Check if any staff profiles have this role before deleting
  - Prevent deletion of `isSystem` roles

### Frontend Implementation for User Story 5

- [ ] T033 [P] [US5] Update `client/src/hooks/use-roles.ts`:
  - `useDeleteRole()` mutation hook
- [ ] T034 [US5] Update `client/src/pages/roles.tsx`:
  - Add "Delete" button to each role row
  - Show confirmation dialog before delete
  - Display error if delete fails (role in use)
  - Disable delete for system roles (visual indication)

**Checkpoint**: User Story 5 complete - Can delete unused roles

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Testing & Verification

- [ ] T035 Run `npm run test:env` and fix any failing tests
- [ ] T036 [P] Verify API endpoints return proper error messages
- [ ] T037 [P] Verify frontend form validation matches backend

### UI/UX Polish

- [ ] T038 [P] Add loading states to roles page and forms
- [ ] T039 [P] Add empty state when no roles exist
- [ ] T040 [P] Add success/error toasts for mutations
- [ ] T041 [P] Style system roles differently (badge or indicator)

### Documentation

- [ ] T042 [P] Add JSDoc comments to storage methods
- [ ] T043 [P] Update API documentation if needed

**Checkpoint**: Feature complete and polished

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - T003, T004, T005 (database) must complete before storage layer
  - T006, T007, T008 (storage) must complete before routes
  - T009 (middleware) can run in parallel with storage
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 for navigation but can implement backend independently
- **User Story 3 (P1)**: Can start after US2 backend is complete - Needs role creation to test permission assignment
- **User Story 4 (P2)**: Depends on US2 - Builds on create/edit functionality
- **User Story 5 (P2)**: Depends on US2 - Uses role list from US2

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend routes before frontend hooks
- Hooks before page components
- Core implementation before integration

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- T003, T004 can run together
- T006, T007, T008 can run together after T003-T005 complete
- T009 can run in parallel with T006-T008
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Frontend and backend work within a story can often proceed in parallel

---

## Parallel Example: Foundational Phase

```bash
# Database schema tasks (can run together):
Task: "Create shared/models/roles.ts with roles and role_permissions tables"
Task: "Re-export roles models from shared/schema.ts"

# After schema complete, storage and middleware (can run together):
Task: "Add role CRUD methods to server/storage.ts"
Task: "Add role permission methods to server/storage.ts"
Task: "Add role-aware permission resolution to server/storage.ts"
Task: "Update server/middleware/permissions.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Navigation)
4. Complete Phase 4: User Story 2 (Create Roles)
5. Complete Phase 5: User Story 3 (Assign Permissions)
6. **STOP and VALIDATE**: Test core functionality
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Navigate to Roles page
3. Add User Story 2 → Create roles
4. Add User Story 3 → Assign permissions → **MVP COMPLETE**
5. Add User Story 4 → Edit roles
6. Add User Story 5 → Delete roles
7. Add Polish phase → Production ready

### Suggested Single Developer Sequence

For one developer working sequentially:

1. **Day 1**: Foundational phase (T003-T009)
   - Database schema
   - Storage layer
   - Permission middleware

2. **Day 2**: User Stories 1-2 (T010-T019)
   - Sidebar navigation
   - Backend routes
   - Role list and create form

3. **Day 3**: User Story 3 (T020-T025)
   - Permission assignment backend
   - Permission editor UI
   - **MVP COMPLETE**

4. **Day 4**: User Stories 4-5 (T026-T034)
   - Edit roles
   - Delete roles

5. **Day 5**: Polish + Testing (T035-T043)
   - Test suite
   - UI polish
   - Documentation

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Setup | T001-T002 | Verify existing infrastructure |
| Foundational | T003-T009 | Database, storage, middleware |
| US1 (P1) | T010-T012 | Sidebar navigation |
| US2 (P1) | T013-T019 | Create roles |
| US3 (P1) | T020-T025 | Assign permissions |
| US4 (P2) | T026-T030 | Edit roles |
| US5 (P2) | T031-T034 | Delete roles |
| Polish | T035-T043 | Testing, polish, docs |

**Total Tasks**: 43
**MVP Tasks**: 25 (through US3)
**Parallelizable**: ~60% of tasks marked with [P]

---

## Notes

- All tasks include specific file paths for immediate execution
- Each user story builds on the previous but can be tested independently
- Backend routes follow the Speckit Constitution pattern
- Frontend uses existing patterns (TanStack Query, shadcn/ui components)
- Tests must pass before considering a task complete
- Run `npm run test:env` after backend changes per Constitution

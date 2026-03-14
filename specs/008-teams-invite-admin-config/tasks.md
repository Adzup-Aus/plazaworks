# Tasks: Invite from Teams Page with Admin-Configured User Info

**Input**: Design documents from `/specs/008-teams-invite-admin-config/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: API test updates are included in Polish phase (constitution requires `npm run test:env` and api.auth.test.ts updates per quickstart).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `server/`, `client/`, `shared/` at repository root (per plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm feature context; no new project structure (existing repo).

- [x] T001 Confirm feature branch 008-teams-invite-admin-config and design docs in specs/008-teams-invite-admin-config (plan.md, spec.md, data-model.md, contracts/)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and storage layer MUST be complete before invite API and Team page can persist or read the new fields.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Add first_name, last_name, profile_image_url (nullable varchar) columns to user_invites table in shared/models/auth.ts
- [x] T003 Extend updateUserInvite to accept firstName, lastName, profileImageUrl in server/repositories/AuthTenantRepository.ts and in IStorage/implementation in server/storage.ts
- [x] T004 Run database migration or npm run db:push after schema change so user_invites has new columns

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Invite Functionality on Teams Page (Priority: P1) 🎯 MVP

**Goal**: Invite functionality is available from the Team page; admin can create and send an invite from /team and see pending invites there.

**Independent Test**: As admin, open /team; use "Invite user" (or equivalent); submit email, first name, last name, role; confirm invite is created and list shows it. Non-admin does not see or cannot use invite action.

### Implementation for User Story 1

- [x] T005 [US1] Extend POST /api/invites in server/modules/auth/routes.ts to require firstName, lastName in body and accept optional profileImageUrl; validate trim, non-empty; store on invite; return firstName, lastName, profileImageUrl in 201 response
- [x] T006 [US1] Extend GET /api/invites in server/modules/auth/routes.ts to include firstName, lastName, profileImageUrl in each invite object in response
- [x] T007 [US1] Add invite creation form (email, first name, last name, role) and pending invites list to client/src/pages/team.tsx; gate invite action by super-admin (use /api/auth/is-super-admin or existing permission)
- [x] T008 [US1] Redirect /admin/invites to /team in client/src/App.tsx or remove standalone invite route; optionally remove "Invite users" from admin nav in client/src/components/app-sidebar.tsx so primary entry is Team page

**Checkpoint**: User Story 1 complete - admin can create and list invites from Team page

---

## Phase 4: User Story 2 - Admin Configures All User Info Before Sending Invite (Priority: P2)

**Goal**: When creating an invite, admin can set email, first name, last name, role, and optionally permissions and profile image; validation prevents sending with missing required fields.

**Independent Test**: On Team page, create invite with all fields (email, first name, last name, role, optional permissions, optional profile); send. Try submitting with empty first name or last name; confirm validation errors and no invite sent.

### Implementation for User Story 2

- [x] T009 [P] [US2] Add optional permissions selector and optional profile image upload (reuse existing upload flow) to invite form in client/src/pages/team.tsx
- [x] T010 [US2] In server/modules/auth/routes.ts enforce POST /api/invites validation: return 400 when firstName or lastName missing or empty after trim; enforce max length (e.g. 100) for firstName and lastName

**Checkpoint**: User Story 2 complete - admin can configure all user info and validation prevents invalid invites

---

## Phase 5: User Story 3 - Invited User Only Configures Password (Priority: P3)

**Goal**: Accept-invite page shows only password (and confirm password); user is created from invite data (firstName, lastName, role, profileImageUrl); invitee does not enter name or profile.

**Independent Test**: Open valid invite link; confirm form has only password and confirm password; submit valid password; sign in and confirm user has admin-set name and role. Expired or used link shows clear error.

### Implementation for User Story 3

- [x] T011 [US3] In server/modules/auth/routes.ts change POST /api/invites/accept to accept only token and password in body; create user from invite (email, firstName, lastName, profileImageUrl, roleId, permissions from invite; use null for missing firstName/lastName/profileImageUrl for backward compatibility)
- [x] T012 [US3] In server/modules/auth/routes.ts extend GET /api/invites/accept response to include firstName, lastName when token valid (for accept-page display)
- [x] T013 [US3] Simplify client/src/pages/accept-user-invite.tsx to show only password and confirm password fields; remove first name, last name, and profile image fields; POST /api/invites/accept with body { token, password } only; keep redirect to login with success message on success

**Checkpoint**: User Story 3 complete - invitee only sets password; account created from invite data

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: API tests and verification per constitution and quickstart.

- [x] T014 Update server/__tests__/api.auth.test.ts: add/update tests for POST /api/invites with firstName, lastName (and optional profileImageUrl); POST /api/invites/accept with password only and verify user has invite's name; duplicate email at invite create and at accept returns 400; GET /api/invites returns firstName, lastName, profileImageUrl
- [x] T015 Run npm run test:env and fix any failing tests (requires DB: run `npm run db:migrate:user-invites-admin-fields` or `npm run db:push` to add user_invites columns; api.auth tests pass)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 - backend routes and Team page invite UI
- **Phase 4 (US2)**: Depends on Phase 3 - extends same form and validation
- **Phase 5 (US3)**: Depends on Phase 2 (accept reads from invite); can run in parallel with Phase 3/4 if desired
- **Phase 6 (Polish)**: Depends on Phase 3, 4, 5 complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational - invite on Team page + extended POST/GET /api/invites
- **User Story 2 (P2)**: After US1 - same form extended with permissions and profile image; backend validation
- **User Story 3 (P3)**: After Foundational - password-only accept; backend accept handler and accept-user-invite page

### Within Each User Story

- US1: T005, T006 (backend) can be done in either order; T007, T008 (client) after API ready
- US2: T009 and T010 are independent (different files)
- US3: T011 then T012 (same file); T013 (client) after T011

### Parallel Opportunities

- T002 [P]: Schema change is independent
- T009 [P] [US2] and T010 [US2]: Form additions (client) and validation (server) can be done in parallel
- After Foundational, US1 backend (T005, T006) and US3 backend (T011, T012) could be parallel (same file, so sequential in practice); US1 client (T007, T008) and US3 client (T013) are different files and can be parallel with each other

---

## Parallel Example: User Story 2

```text
# In parallel (different files):
T009 [P] [US2] Add optional permissions selector and optional profile image upload to invite form in client/src/pages/team.tsx
T010 [US2] In server/modules/auth/routes.ts enforce POST /api/invites validation (firstName, lastName required, max length)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (schema + storage)
3. Complete Phase 3: User Story 1 (extended invite API + Team page invite form and list)
4. **STOP and VALIDATE**: As admin, create invite from /team and confirm list shows it
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → schema and storage ready
2. Add User Story 1 → invite from Team page (MVP)
3. Add User Story 2 → full form (permissions, profile image) and validation
4. Add User Story 3 → password-only accept flow
5. Polish → API tests and npm run test:env

### Suggested Order for Single Developer

1. T001 → T002 → T003 → T004 (Setup + Foundational)
2. T005 → T006 → T007 → T008 (US1)
3. T009 → T010 (US2)
4. T011 → T012 → T013 (US3)
5. T014 → T015 (Polish)

---

## Notes

- [P] tasks = different files or no dependencies on incomplete work
- [Story] label maps task to spec.md user story for traceability
- Each user story is independently testable per Independent Test in spec
- Commit after each task or logical group
- Constitution: run `npm run test:env` after backend/API changes; all tests must pass

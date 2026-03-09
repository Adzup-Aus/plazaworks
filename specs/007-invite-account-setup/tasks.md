# Tasks: Full Account Setup for Invited Users

**Input**: Design documents from `/specs/007-invite-account-setup/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story for independent implementation and testing. Constitution requires API tests; backend tests in server/__tests__/api.auth.test.ts.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `server/modules/auth/routes.ts`, `server/__tests__/api.auth.test.ts`
- **Shared**: `shared/models/auth.ts`
- **Client**: `client/src/pages/`, `client/src/components/`

---

## Phase 1: Setup (Environment)

**Purpose**: Verify environment and dependencies for the feature branch.

- [x] T001 Verify Node/npm and PostgreSQL available; run `npm install` and ensure `DATABASE_URL` in `.env` from repo root
- [x] T002 [P] Confirm existing invite flow: GET /api/invites/accept and POST /api/invites/accept in server/modules/auth/routes.ts and client route /accept-invite → AcceptUserInvite in client/src/App.tsx

---

## Phase 2: Foundational (Schema & Accept API)

**Purpose**: Schema change and extended accept endpoint so the full account setup page can submit. BLOCKS all user stories.

**Independent Test**: POST /api/invites/accept with token, password, firstName, lastName, optional profileImageUrl creates user with those fields and returns 201; duplicate email returns 400/409.

- [x] T003 Add `permissions` column (text[], default []) to `user_invites` in shared/models/auth.ts and re-export from shared/schema.ts
- [x] T004 Run migration or `npm run db:push` so user_invites.permissions exists in the database
- [x] T005 Extend POST /api/invites/accept in server/modules/auth/routes.ts: require firstName, lastName (trim, non-empty, max length e.g. 100); accept optional profileImageUrl; validate password ≥ 8 chars
- [x] T006 In POST /api/invites/accept in server/modules/auth/routes.ts: before creating user, check if auth_identity exists for invite.email; if yes return 400 or 409 with clear message and do not create user
- [x] T007 In POST /api/invites/accept in server/modules/auth/routes.ts: pass firstName, lastName, profileImageUrl to authStorage.upsertUser() when creating the new user
- [x] T008 In POST /api/invites/accept in server/modules/auth/routes.ts: when creating staff profile (invite.roleId or invite.permissions), merge role permissions with invite.permissions (filter to valid UserPermission); create staff profile with merged permissions; handle invite with no role and no permissions (empty or omit staff profile per existing behavior)

**Checkpoint**: Backend accept supports full account payload; duplicate email rejected. Run `npm run test:env` after T008 to catch regressions.

---

## Phase 3: User Story 1 – Full Account Setup Page (Priority: P1) – MVP

**Goal**: Invited user opens invite link and sees full account setup form (first name, last name, password, confirm, optional profile image); on submit, account is created and user is redirected to login with success message.

**Independent Test**: Open valid invite link → see full account form (not password-only); submit valid data → redirect to /login with success message; sign in → see name in app.

- [x] T009 [P] [US1] Replace password-only form in client/src/pages/accept-user-invite.tsx with full account setup form: fields for first name, last name, password, confirm password, optional profile image (file input or upload trigger)
- [x] T010 [US1] In client/src/pages/accept-user-invite.tsx add client-side validation: trim first/last name, require non-empty; password ≥ 8; password === confirm; show validation errors and prevent submit when invalid
- [x] T011 [US1] In client/src/pages/accept-user-invite.tsx implement profile image upload using existing presigned flow (POST /api/invites/accept/request-upload then PUT to URL); pass returned objectPath as profileImageUrl in accept payload; validate file type (image/jpeg, image/png, image/webp) and size (5MB) before upload
- [x] T012 [US1] In client/src/pages/accept-user-invite.tsx on successful POST /api/invites/accept redirect to /login with success message (toast and ?registered=1); do not auto-sign-in
- [x] T013 [US1] Ensure GET /api/invites/accept?token=... is used to validate token and show email on full account setup page in client/src/pages/accept-user-invite.tsx; keep existing token-in-URL behavior

**Checkpoint**: User can complete full account setup from invite link and land on login with success message.

---

## Phase 4: User Story 2 – Avatar Fallback (Priority: P2)

**Goal**: Where the app displays the user (sidebar, header, profile), show profile image if set; otherwise first letter of first name; else first letter of email; else generic placeholder.

**Independent Test**: Sign in as user without profile image → avatar shows first letter of first name; sign in with profile image → image shown; user with no first name → fallback to email letter or placeholder.

- [ ] T014 [P] [US2] Add or extend avatar component/helper in client/src/components/ (e.g. UserAvatar.tsx or in existing layout): accept user { profileImageUrl?, firstName?, email? }; render image if profileImageUrl else circle with first letter of firstName (uppercase) else first letter of email (local part or first char) else placeholder (e.g. "?" or default icon)
- [ ] T015 [US2] Use avatar component in sidebar (e.g. app-sidebar or layout that shows current user) in client/src/components/
- [ ] T016 [US2] Use avatar component in header/nav where current user is displayed in client/src/
- [ ] T017 [US2] Use avatar component on profile/settings page if present in client/src/pages/

**Checkpoint**: All user display locations show profile image or first-letter/placeholder fallback.

---

## Phase 5: User Story 3 – API Tests for Accept (Priority: P3)

**Goal**: API tests cover extended accept behavior: required firstName/lastName, optional profileImageUrl, validation errors, duplicate email, 500 handling.

**Independent Test**: `npm run test:env` includes new accept tests and they pass.

- [ ] T018 [P] [US3] In server/__tests__/api.auth.test.ts add test: POST /api/invites/accept with valid token + password + firstName + lastName returns 201 and user has firstName, lastName in DB
- [ ] T019 [P] [US3] In server/__tests__/api.auth.test.ts add test: POST /api/invites/accept with valid token + firstName + lastName + password + profileImageUrl returns 201 and user has profileImageUrl set
- [ ] T020 [P] [US3] In server/__tests__/api.auth.test.ts add test: POST /api/invites/accept with missing firstName or lastName returns 400 with message
- [ ] T021 [P] [US3] In server/__tests__/api.auth.test.ts add test: POST /api/invites/accept when invite email already has an account returns 400 or 409 and does not create duplicate user
- [ ] T022 [US3] Run `npm run test:env` and fix any failing tests; ensure existing invite and auth tests still pass

**Checkpoint**: Backend test suite passes with new accept coverage.

---

## Phase 6: User Story 4 – Permissions During Invitation (Priority: P4)

**Goal**: Admin can assign specific permissions (and optional role) when creating an invite; on accept, staff profile receives union of role permissions and invite permissions; list invites returns permissions.

**Independent Test**: Create invite with permissions (and optionally role); accept and complete setup; sign in and verify user has expected permissions.

**Dependency**: T023 and T024 depend on T026 (storage must persist and return permissions first).

- [ ] T026 [US4] Add storage support for invite permissions: ensure createUserInvite and updateUserInvite in server (e.g. AuthTenantRepository or storage) accept and persist permissions; listUserInvites returns permissions
- [ ] T023 [US4] In server/modules/auth/routes.ts POST /api/invites: accept optional `permissions` array in body; filter to valid UserPermission (shared/models/staff.ts); store on invite (create/update); include permissions in 201 response
- [ ] T024 [US4] In server/modules/auth/routes.ts GET /api/invites: include `permissions` in each invite object in response
- [ ] T025 [US4] In server/modules/auth/routes.ts POST /api/invites/accept: when creating staff profile, merge role permissions (from invite.roleId) with invite.permissions; filter to valid UserPermission; create staff profile with merged list; if no role and no permissions, keep existing behavior (no staff profile or empty)
- [ ] T027 [P] [US4] In client invite UI (e.g. client/src/pages/invite.tsx or admin invite page): add permission selector (e.g. multi-select from GET /api/permissions); send permissions array in POST /api/invites along with email and optional roleId
- [ ] T028 [P] [US4] In server/__tests__/api.auth.test.ts add test: POST /api/invites with permissions creates invite with stored permissions; GET /api/invites returns them
- [ ] T029 [US4] In server/__tests__/api.auth.test.ts add test: accept invite with role and permissions creates staff profile with union of role permissions and invite permissions

**Checkpoint**: Invite create/list and accept apply permissions; tests pass.

---

## Phase 7: Polish & Verification

**Purpose**: Final verification and cross-cutting checks.

- [ ] T030 Run `npm run test:env` and ensure all tests pass
- [ ] T031 [P] Verify quickstart.md steps: full account setup flow, avatar in sidebar/header, permissions on invite and after accept
- [ ] T032 Update any inline docs or README references to invite flow (e.g. “set password” → “full account setup”) if present in repo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1. **Blocks** Phases 3–6.
- **Phase 3 (US1)**: Depends on Phase 2 (accept API and schema).
- **Phase 4 (US2)**: Can start after Phase 2; benefits from US1 (user has firstName) but avatar can be built and tested with existing user data.
- **Phase 5 (US3)**: Depends on Phase 2 (tests target extended accept).
- **Phase 6 (US4)**: Depends on Phase 2 (schema has permissions; accept merge logic).
- **Phase 7 (Polish)**: After Phases 3–6 (or subset) complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational only. Delivers MVP (full account setup page).
- **US2 (P2)**: After Foundational; can parallel with US1.
- **US3 (P3)**: After Foundational (API tests).
- **US4 (P4)**: After Foundational; invite create/accept merge.

### Parallel Opportunities

- T001 and T002 can run in parallel.
- T009, T014 can start once Phase 2 is done (T009 + T014 in parallel).
- T018–T021 (US3 tests) can be written in parallel.
- T027, T028 (US4 client + test) can run in parallel after T023–T026.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup)
2. Phase 2 (Foundational: schema + accept API)
3. Phase 3 (US1: full account setup page)
4. Run test:env; manually test invite link → full form → redirect to login
5. Optionally add Phase 5 (US3 tests) for accept coverage

### Incremental Delivery

1. Phase 1 + 2 → backend ready for full account and permissions
2. Phase 3 (US1) → full account setup page (MVP)
3. Phase 4 (US2) → avatar fallback everywhere
4. Phase 5 (US3) → API tests for accept
5. Phase 6 (US4) → permissions on invite and merge on accept
6. Phase 7 → final verification

---

## Notes

- [P] = parallelizable; [USn] = user story for traceability.
- Each phase checkpoint is independently testable.
- Constitution: API tests required; run `npm run test:env` after backend changes.
- Paths: server/modules/auth/routes.ts, shared/models/auth.ts, client/src/pages/accept-user-invite.tsx, client/src/components/ (avatar), client invite page, server/__tests__/api.auth.test.ts.

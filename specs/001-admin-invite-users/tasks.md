# Tasks: Admin-Only Access and Email Invites

**Input**: Design documents from `/specs/001-admin-invite-users/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently. Constitution requires API tests for backend changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `server/`, `server/modules/auth/`, `server/__tests__/`
- **Shared**: `shared/`, `shared/models/`, `shared/schema.ts`
- **Client**: `client/src/`, `client/src/pages/`, `client/src/App.tsx`
- **Scripts**: `scripts/` at repo root (create if missing)

---

## Phase 1: Setup

**Purpose**: Ensure script and test structure for seed and auth/invite tests.

- [ ] T001 Create `scripts/` directory at repo root and add npm script to run admin seed (e.g. `"seed:admin": "tsx scripts/seed-admin.ts"` in package.json) if not present.
- [ ] T002 [P] Ensure `server/__tests__/api.auth.test.ts` exists (create minimal file if missing) for auth and invite API tests.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and storage for user invites; required before US2 and US3.

**Checkpoint**: After this phase, user_invites table exists and storage can create/list/accept invites.

- [ ] T003 [P] Add `user_invites` table to `shared/models/auth.ts` (id, email, token, invitedBy, expiresAt, usedAt, createdAt) with indexes on email, token (unique), and (expiresAt, usedAt).
- [ ] T004 Re-export `userInvites` and related types from `shared/schema.ts` (import from shared/models/auth and export; add to schema if not auto-exported).
- [ ] T005 Add user-invite storage methods in `server/storage.ts` (or AuthTenantRepository): createUserInvite, getUserInviteByToken, listUserInvites, markUserInviteUsed; ensure repository/db uses shared user_invites table.
- [ ] T006 Re-export userInvites and invite types from `server/modules/auth/model.ts` for use in auth routes.

---

## Phase 3: User Story 1 – Admin Logs In with Seeded Account (Priority: P1) – MVP

**Goal**: Seeded admin (cliff@gmail.com / secret1234) exists after deploy; login works; registration is removed.

**Independent Test**: Run seed, open /login, sign in with cliff@gmail.com / secret1234; confirm redirect to app. Visit /register and confirm it is removed or redirects with “invite only” message.

### Implementation for User Story 1

- [ ] T007 [US1] Implement admin seed script in `scripts/seed-admin.ts`: create or get owner organization, create user with email cliff@gmail.com, create auth_identity with bcrypt hash for secret1234, add user as organization_member (owner or admin) of owner org; idempotent (skip if admin user already exists).
- [ ] T008 [US1] Disable public registration in `server/modules/auth/routes.ts`: change POST /api/auth/register to return 410 Gone (or 404) with body `{ "message": "Registration is by invite only." }`.
- [ ] T009 [US1] Remove register route and link from client: in `client/src/App.tsx` remove Register import and `<Route path="/register" component={Register} />`; remove `/register` from isPublicRoute check; remove any “Sign up” link to /register from `client/src/pages/login.tsx` (or equivalent).
- [ ] T010 [US1] Optionally redirect /register to login: if keeping a `/register` path for bookmarks, add a single route that redirects to /login with a query or message that registration is by invite only (otherwise omit /register entirely).
- [ ] T011 [US1] Add or update API tests in `server/__tests__/api.auth.test.ts`: test POST /api/auth/login with cliff@gmail.com and correct password returns 200 and session; test POST /api/auth/register returns 410 (or 404) with expected message; test unauthenticated GET /api/auth/session returns isAuthenticated false.

**Checkpoint**: Admin can log in; registration is disabled; api.auth tests pass.

---

## Phase 4: User Story 2 – Admin Invites User by Email (Priority: P2)

**Goal**: Admin can create invites (email), list invites, and invitee receives email with link; duplicate email and validation handled.

**Independent Test**: As admin, open invite UI, submit email; confirm invite in list and (if email configured) email received; submit same email again and confirm “already registered” or resend behavior; non-admin gets 403 on POST /api/invites.

### Implementation for User Story 2

- [ ] T012 [US2] Implement POST /api/invites in `server/modules/auth/routes.ts`: require auth and super-admin (or seeded admin email cliff@gmail.com); validate body (email required, valid format); if auth_identity exists for email return 400 “Email is already registered”; create or resend user_invite (new token, expiresAt e.g. 7 days), send invite email with link to /accept-invite?token=; return 201 with inviteId, email, expiresAt.
- [ ] T013 [US2] Implement GET /api/invites in `server/modules/auth/routes.ts`: require auth and super-admin; optional query status=pending|used|expired; return 200 with invites array (id, email, expiresAt, usedAt, createdAt, invitedBy).
- [ ] T014 [US2] Add invite email sending in `server/email.ts` (or existing email module): function to send user-invite email with accept-invite link (base URL + /accept-invite?token=); call from POST /api/invites.
- [ ] T015 [US2] Add admin invite page in `client/src/pages/invite.tsx`: list invites (GET /api/invites), form to submit email (POST /api/invites); show success/error toasts; gate by isSuperAdmin (redirect or hide if not admin).
- [ ] T016 [US2] Add route and nav for invite page: in `client/src/App.tsx` add Route for invite page (e.g. path `/admin/invites` or `/invite` under AuthenticatedRouter); in `client/src/components/app-sidebar.tsx` (or nav) add “Invite users” link for super-admin only.
- [ ] T017 [US2] Add API tests in `server/__tests__/api.auth.test.ts`: POST /api/invites unauthenticated returns 401; POST as non-admin returns 403; POST with valid email as admin returns 201; POST with already-registered email returns 400; GET /api/invites as admin returns 200 with array.

**Checkpoint**: Admin can create and list invites; invite email sent; tests pass.

---

## Phase 5: User Story 3 – Invited User Accepts and Gains Access (Priority: P3)

**Goal**: Invitee can open link, set password, and then sign in; expired/used token shows clear message.

**Independent Test**: Create invite, open /accept-invite?token=..., set password, submit; sign in with that email/password. Use expired or used token and confirm error message.

### Implementation for User Story 3

- [ ] T018 [US3] Implement GET /api/invites/accept in `server/modules/auth/routes.ts`: query token; if missing or invalid/expired/used return 400 `{ "message": "Invalid or expired invite link", "valid": false }`; else return 200 with email (masked or full), valid: true, inviteId.
- [ ] T019 [US3] Implement POST /api/invites/accept in `server/modules/auth/routes.ts`: body token, password (min 8 chars); validate token and invite (pending, not expired); create user (users table) and auth_identity (email + password hash); mark invite usedAt; return 201 with message and userId.
- [ ] T020 [US3] Add accept-user-invite page in `client/src/pages/accept-user-invite.tsx`: on mount read token from query, GET /api/invites/accept?token=; if invalid/expired show message and link to login or “contact admin”; if valid show form (password, confirm password), POST /api/invites/accept on submit; on success redirect to /login with success message.
- [ ] T021 [US3] Add public route for accept-invite: in `client/src/App.tsx` add Route path `/accept-invite` component AcceptUserInvite in PublicRouter; add `/accept-invite` to isPublicRoute check so unauthenticated users can open the page.
- [ ] T022 [US3] Add API tests in `server/__tests__/api.auth.test.ts`: GET /api/invites/accept without token or with bad token returns 400; POST /api/invites/accept with valid token and password creates user and returns 201; POST with expired/used token returns 400; after accept, login with new email/password succeeds.

**Checkpoint**: Invitee can set password and sign in; expired/used handled; tests pass.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Cleanup, validation, and full suite pass.

- [ ] T023 Remove or repurpose `client/src/pages/register.tsx`: delete file or replace with redirect to login with “Registration is by invite only” message so no dead code remains.
- [ ] T024 Run `npm run test:env` and fix any failing tests; ensure all new and updated tests in `server/__tests__/api.auth.test.ts` pass.
- [ ] T025 [P] Run through `specs/001-admin-invite-users/quickstart.md`: seed admin, login, create invite, accept invite, sign in as invitee; document any env (e.g. RESEND_API_KEY) needed for email.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: No dependencies; BLOCKS US2 and US3.
- **Phase 3 (US1)**: Depends on Phase 1 (script, test file). Can run in parallel with Phase 2 for T007–T011 after T001–T002.
- **Phase 4 (US2)**: Depends on Phase 2 (table, storage, model). Depends on US1 for “admin” (seed) and is-super-admin.
- **Phase 5 (US3)**: Depends on Phase 2 (table, storage). Can follow US2 (invites exist to accept).
- **Phase 6 (Polish)**: Depends on Phases 3–5 complete.

### User Story Dependencies

- **US1**: After Setup; no story dependency. Delivers: seed admin, no register, login works.
- **US2**: After Foundational + US1 (admin exists to invite). Delivers: create/list invites, email.
- **US3**: After Foundational; benefits from US2 (invites to accept). Delivers: accept-invite flow, new user can log in.

### Parallel Opportunities

- T001 and T002 can run in parallel (Phase 1).
- T003 and T004 can run in parallel with T005 (after T003); T006 after T004.
- Within US2: T012, T013, T014 touch same routes file but in sequence; T015 and T016 can be parallel (different files).
- Within US3: T018 and T019 same file; T020 and T021 different files (can parallel after T019).

---

## Parallel Example: User Story 2

```text
After T012–T014 (invite API + email):
  T015: Add client/src/pages/invite.tsx
  T016: Add route and nav in App.tsx and app-sidebar
  T017: Add invite API tests in api.auth.test.ts
T017 can be done in parallel with T015/T016 (different files).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) so schema exists.
3. Complete Phase 3 (US1): seed admin, disable register, login + tests.
4. **STOP and VALIDATE**: Seed, login as admin, confirm no register. Run `npm run test:env`.

### Incremental Delivery

1. Phase 1 + 2 → foundation.
2. Phase 3 (US1) → MVP: admin login, no self-register.
3. Phase 4 (US2) → admin can invite; list invites; email sent.
4. Phase 5 (US3) → invitee sets password and signs in.
5. Phase 6 → polish and full test pass.

### Task Count Summary

| Phase    | Story | Task IDs   | Count |
|----------|-------|------------|-------|
| Setup    | –     | T001–T002  | 2     |
| Foundational | –  | T003–T006  | 4     |
| US1      | P1    | T007–T011  | 5     |
| US2      | P2    | T012–T017  | 6     |
| US3      | P3    | T018–T022  | 5     |
| Polish   | –     | T023–T025  | 3     |
| **Total**|       |            | **25**|

---

## Notes

- [P] = different files or no dependency on other incomplete tasks.
- [USn] = task belongs to that user story for traceability.
- Each user story is independently testable; run `npm run test:env` after each phase.
- Commit after each task or logical group; stop at any checkpoint to validate.

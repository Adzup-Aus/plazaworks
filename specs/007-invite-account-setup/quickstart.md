# Quickstart: Full Account Setup for Invited Users

**Branch**: `007-invite-account-setup` | **Date**: 2025-03-08

## Prerequisites

- Same as base project: Node, npm, PostgreSQL, `.env` with `DATABASE_URL`.
- Existing invite flow (001): admin can create invites; accept-invite page exists (to be replaced by full account setup page).

## Setup

1. **Schema**
   - Add `permissions` column to `user_invites` (text[], default []). Run migration or `npm run db:push` after updating `shared/models/auth.ts`.

2. **Backend**
   - In `server/modules/auth/routes.ts`:
     - **POST /api/invites**: Accept optional `permissions` in body; validate against userPermissions; store on invite; return permissions in response.
     - **POST /api/invites/accept**: Require `firstName`, `lastName`; accept optional `profileImageUrl`. Validate trim/non-empty names, password length, duplicate email (check auth_identity by invite.email → 400/409). Create user with firstName, lastName, profileImageUrl; create staff profile with permissions = union(role permissions, invite.permissions) (filter to valid only).
   - **GET /api/invites**: Include `permissions` in each invite in response.

3. **Client**
   - **Full account setup page**: Replace or rename current accept-invite flow so the page at `/accept-invite?token=...` shows: first name, last name, password, confirm password, optional profile image (use existing presigned upload: request URL → upload file → pass objectPath/URL as profileImageUrl). On success, redirect to `/login` with success message.
   - **Avatar**: Add or reuse a component that shows user.profileImageUrl if set; else first letter of firstName; else first letter of email; else placeholder. Use in sidebar, header, profile/settings.
   - **Invite UI (admin)**: When creating an invite, add permission selector (and keep optional role). Send `permissions` array in POST /api/invites.

4. **Tests**
   - Extend `server/__tests__/api.auth.test.ts`: accept with firstName/lastName/profileImageUrl; accept with duplicate email (400/409); invite create with permissions; list invites returns permissions.

## Verify

- **Full account setup**: Open valid invite link → see form with first name, last name, password, confirm, optional photo. Submit → redirect to login with message; sign in → see name and avatar (or letter fallback) in header/sidebar.
- **Avatar**: As user without profile image, confirm first letter of first name in sidebar/header; as user with profile image, confirm image shows.
- **Permissions on invite**: Create invite with role and/or permissions; accept and complete setup; sign in and confirm user has expected permissions (e.g. only allowed features).
- **Tests**: `npm run test:env` passes.

## Key files (after implementation)

- **Backend**: `server/modules/auth/routes.ts` (extended invite + accept).
- **Shared**: `shared/models/auth.ts` (user_invites.permissions; users already has firstName, lastName, profileImageUrl).
- **Client**: `client/src/pages/accept-user-invite.tsx` (or equivalent) full account setup form; avatar component; invite page with permission selector.
- **Contracts**: `specs/007-invite-account-setup/contracts/invites-api-extensions.md`.

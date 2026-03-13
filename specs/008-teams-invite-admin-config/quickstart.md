# Quickstart: Invite from Teams Page with Admin-Configured User Info

**Branch**: `008-teams-invite-admin-config` | **Date**: 2025-03-13

## Prerequisites

- Same as base project: Node, npm, PostgreSQL, `.env` with `DATABASE_URL`.
- Existing invite flow (001, 007): auth module has POST/GET /api/invites and POST /api/invites/accept; Team page exists at `/team`.

## Setup

1. **Schema**
   - Add `first_name`, `last_name`, `profile_image_url` (nullable) to `user_invites` in `shared/models/auth.ts`. Run migration or `npm run db:push`.

2. **Backend**
   - **Storage / repository**: Extend `createUserInvite` and `updateUserInvite` to accept and persist firstName, lastName, profileImageUrl. Update `IStorage.updateUserInvite` signature and `AuthTenantRepository.updateUserInvite` to allow these fields (and use them when resending/updating pending invite).
   - In `server/modules/auth/routes.ts`:
     - **POST /api/invites**: Require `firstName`, `lastName` in body; accept optional `profileImageUrl`. Validate trim, non-empty, max length. Store on invite. Reject if email already registered.
     - **POST /api/invites/accept**: Accept only `token` and `password`. Load invite; create user with email, firstName, lastName, profileImageUrl from invite (use null if missing for backward compatibility); create auth identity and staff profile; mark invite used.
     - **GET /api/invites**: Include firstName, lastName, profileImageUrl in each invite in response.
     - **GET /api/invites/accept**: Optionally return firstName, lastName in response for accept-page display.

3. **Client**
   - **Team page** (`client/src/pages/team.tsx`): Add invite creation form with email, first name, last name, role, optional permissions, optional profile image (reuse existing upload flow if used elsewhere). Add list of pending invites (or link to same). Use POST /api/invites with extended body; GET /api/invites for list.
   - **Accept-invite page** (`client/src/pages/accept-user-invite.tsx`): Remove first name, last name, and profile image fields. Show only password and confirm password. POST /api/invites/accept with `{ token, password }` only.
   - **Navigation**: Move “Invite users” from admin nav to Team page, or remove `/admin/invites` and add invite UI to Team page; optionally redirect `/admin/invites` to `/team`.

4. **Tests**
   - Update `server/__tests__/api.auth.test.ts`: Create invite with firstName, lastName (and optional profileImageUrl); accept with password only and verify user has invite’s name; duplicate email at invite create and at accept returns 400; list invites returns new fields.

## Verify

- **Team page**: As admin, open `/team`; create invite with email, first name, last name, role; confirm invite is created and email sent; list shows new fields.
- **Accept flow**: Open accept link; form shows only password (and confirm); submit valid password; confirm user is created with admin-set name and role; sign in and see correct profile.
- **Backward compatibility**: Use an old invite (if any) with no firstName/lastName; accept with password only; user created with null name; avatar fallback works.
- **Tests**: `npm run test:env` passes.

## Key files (after implementation)

- **Backend**: `server/modules/auth/routes.ts` (invite create/accept); `server/repositories/AuthTenantRepository.ts` and `server/storage.ts` (updateUserInvite); `shared/models/auth.ts` (user_invites columns).
- **Client**: `client/src/pages/team.tsx` (invite form + list); `client/src/pages/accept-user-invite.tsx` (password-only form).
- **Contracts**: `specs/008-teams-invite-admin-config/contracts/invites-api-008.md`.
